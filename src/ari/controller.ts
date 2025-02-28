import ari, { type Bridge, type Channel, type Client } from "ari-client"
import { randomUUID } from "crypto"
import { Call11 } from "../11abs/call11"
import { vars } from "../config"
import { cleanupARI } from "./cleanup"

interface CallSession {
  sessionId: string
  channel: Channel
  extChannel?: Channel
  bridge?: Bridge
  call11?: Call11
}

export class AriController {
  // @ts-ignore
  private client: Client
  private activeCalls: Map<string, CallSession> = new Map()
  connected = false

  constructor() {
    this.connect()
  }

  async connect() {
    if (this.connected) return
    try {
      this.client = await ari.connect(vars.ariUrl, vars.ariUser, vars.ariPassword)
      await this.client.start("externalMedia")
      this.setCoreListeners()
      console.log("ARI connected")
      this.connected = true
    } catch (error: any) {
      console.error("ARI error:", error?.message)
      this.disconnect()
    }
  }

  async call(number: string, AGENT_ID?: string) {
    if (!this.connected) return
    try {
      await this.client.Channel().originate({
        endpoint: `PJSIP/${number}`,
        app: "externalMedia",
        formats: "slin16",
        callerId: "Pleep",
        variables: { AGENT_ID },
      })
      console.log("Call Originate to", number)
    } catch (e: any) {
      console.error("Error originating call to", number, e?.message)
    }
  }

  setCoreListeners() {
    this.client.on("StasisStart", this.handleStatisStart)
    this.client.on("StasisEnd", async (_, channel: Channel) => {
      console.log(`Channel ${channel.id} has left Stasis application`)
    })
    this.client.on("APILoadError", (error) => {
      console.error("ARI client error:", error?.message)
    })
  }

  handleStatisStart = async (_: any, channel: Channel) => {
    if (!channel.caller.number) return
    try {
      console.log(`New call from ${channel.caller.number} to ${channel.connected.number}`)
      const sessionId = randomUUID()
      const callSession: CallSession = {
        sessionId,
        channel,
      }
      this.activeCalls.set(channel.id, callSession)

      channel.on("ChannelHangupRequest", async () => {
        console.log(`Hangup requested for channel ${channel.id}`)
        await this.cleanupCallSession(channel.id)
      })

      await this.handleIncomingCall(callSession)
    } catch (error) {
      console.error("Error handling StasisStart event:", error)
      await channel.hangup()
      this.activeCalls.delete(channel.id)
    }
  }

  async cleanupCallSession(channelId: string) {
    const session = this.activeCalls.get(channelId)
    if (!session) return

    await session.call11?.disconnect()
    await session.bridge?.destroy().catch()
    await session.extChannel?.hangup().catch()
    this.activeCalls.delete(channelId)
  }

  async handleIncomingCall(callSession: CallSession) {
    const { channel } = callSession

    try {
      console.log(`Answering channel ${channel.id}`)
      await channel.answer()

      const bridge = await this.createBridge(callSession)
      await bridge.addChannel({ channel: channel.id })
      console.log(`Incoming channel ${channel.id} added to bridge ${bridge.id}.`)

      await this.createExtChannel(callSession)
    } catch (error: any) {
      console.error(`Error handling incoming call for channel ${channel.id}:`, error?.message)
      await channel.hangup()
    }
  }

  async createBridge(callSession: CallSession) {
    const bridge = this.client.Bridge()
    await bridge.create({ type: "mixing" })
    console.log(`Bridge created with id: ${bridge.id}`)
    callSession.bridge = bridge
    return bridge
  }

  async createExtChannel(callSession: CallSession) {
    const { bridge, sessionId } = callSession
    if (!bridge) return

    const extChannel = this.client.Channel()
    extChannel.on("StasisStart", async (_, chan: Channel) => {
      await bridge.addChannel({ channel: chan.id })
      console.log(`External media channel ${chan.id} added to bridge ${bridge.id}.`)

      const agentId = await this.getChanVar(callSession.channel, "AGENT_ID")
      const onDisconnect = () => callSession.channel.hangup()
      callSession.call11 = new Call11(sessionId, { onDisconnect, agentId })
    })
    extChannel.on("StasisEnd", (_, chan: Channel) => {
      console.log(`External media channel ended: ${chan.id}`)
      callSession.extChannel = undefined
    })

    await extChannel.externalMedia({
      app: "externalMedia",
      external_host: vars.audioSocketHost,
      format: "slin16",
      transport: "tcp",
      encapsulation: "audiosocket",
      // @ts-ignore
      data: callSession.sessionId,
    })
    callSession.extChannel = extChannel
    console.log("External media sessionId: ", sessionId)
  }

  async getChanVar(channel: Channel, variable: string) {
    try {
      const res = await channel.getChannelVar({ variable })
      return res.value
    } catch (e: any) {
      return
    }
  }

  async cleanup() {
    if (!this.connected) return
    await cleanupARI(this.client)
  }

  async disconnect() {
    if (!this.connected) return
    console.log("Closing ARI session...")

    const cleanupPromises = [...this.activeCalls.keys()].map((channelId) => {
      const session = this.activeCalls.get(channelId)
      if (!session) return Promise.resolve()
      const promises = [session.channel.hangup(), session.extChannel?.hangup(), session.bridge?.destroy()]
      return Promise.allSettled(promises)
    })

    try {
      await Promise.all(cleanupPromises)
      this.activeCalls.clear()
      await this.client?.stop()
    } catch (error) {
      console.error("Error during ARI session close:", error)
    } finally {
      console.log("Closed ARI")
      this.connected = false
    }
  }
}
