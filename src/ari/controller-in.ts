import ari, { type Bridge, type Channel, type Client } from "ari-client"
import { randomUUID } from "crypto"
import { Call11 } from "../11abs/call11"
import { cleanupARI } from "./cleanup"
import { vars } from "../config"

interface CallSession {
  channel: Channel
  extChannel?: Channel
  bridge?: Bridge
  sessionId: string
  call11?: Call11
}

export class AriControllerIn {
  // @ts-ignore
  private client: Client
  private activeCalls: Map<string, CallSession> = new Map()
  connected = false

  constructor() {
    this.connect()
  }

  async connect() {
    try {
      this.client = await ari.connect(vars.ariUrl, vars.ariUser, vars.ariPassword)
      await this.client.start("externalMedia")
      this.setCoreListeners()
      console.log("connected")
      this.connected = true
    } catch (error: any) {
      console.error("ARI error:", error?.message)
      this.close()
    }
  }

  setCoreListeners() {
    this.client.on("StasisStart", async (_: any, channel: Channel) => {
      try {
        if (!channel.caller.number) return
        console.log(`New call from ${channel.caller.number} to ${channel.connected.number}`)

        const sessionId = randomUUID()

        const callSession: CallSession = {
          channel,
          sessionId,
        }

        this.activeCalls.set(channel.id, callSession)
        this.setupChannelEventListeners(channel)
        await this.handleIncomingCall(callSession)
      } catch (error) {
        console.error("Error handling StasisStart event:", error)
        await channel.hangup()
        this.activeCalls.delete(channel.id)
      }
    })

    this.client.on("StasisEnd", async (_: any, channel: Channel) => {
      console.log(`Channel ${channel.id} has left Stasis application`)
      await this.cleanupCallSession(channel.id)
    })

    this.client.on("APILoadError", (error: Error) => {
      console.error("ARI client error:", error)
    })
  }

  setupChannelEventListeners(channel: Channel) {
    channel.on("ChannelDestroyed", async () => {
      console.log(`Channel ${channel.id} destroyed`)
      await this.cleanupCallSession(channel.id)
    })

    channel.on("ChannelHangupRequest", async () => {
      console.log(`Hangup requested for channel ${channel.id}`)
      // await channel.hangup()
      await this.cleanupCallSession(channel.id)
    })
  }

  async cleanupCallSession(channelId: string) {
    const session = this.activeCalls.get(channelId)
    if (!session) return

    await session.call11?.disconnect()
    await session.extChannel?.hangup().catch()
    // .catch((err) => console.error(`Error hanging up ext channel for ${channelId}:`, err?.message))
    await session.bridge?.destroy().catch()
    // .catch((err) => console.error(`Error destroying bridge for ${channelId}:`, err?.message))
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
      await this.cleanupCallSession(channel.id)
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
    const extChannel = this.client.Channel()

    extChannel.on("StasisStart", async (event: any, chan: Channel) => {
      if (!callSession.bridge) return
      await callSession.bridge.addChannel({ channel: chan.id })
      console.log(`External media channel ${chan.id} added to bridge ${callSession.bridge.id}.`)

      const onDisconnect = () => callSession.channel.hangup()
      const call11 = new Call11(callSession.sessionId, onDisconnect)
      callSession.call11 = call11
      // testAudio(callSession.sessionId)
    })

    extChannel.on("StasisEnd", (event: any, chan: Channel) => {
      console.log(`External media channel ended: ${chan.id}`)
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

    console.log("External media sessionId: ", callSession.sessionId)
    callSession.extChannel = extChannel
  }

  async close() {
    if (!this.connected) return
    console.log("Closing ARI session...")

    // await cleanupARI(this.client)

    const cleanupPromises = [...this.activeCalls.keys()].map((channelId) => {
      const session = this.activeCalls.get(channelId)
      if (session) {
        return Promise.all([
          session.channel
            .hangup()
            .catch((err) => console.error(`Error hanging up channel ${channelId}:`, err?.message)),
          session.extChannel
            ?.hangup()
            .catch((err) => console.error(`Error hanging up ext channel for ${channelId}:`, err?.message)),
          session.bridge
            ?.destroy()
            .catch((err) => console.error(`Error destroying bridge for ${channelId}:`, err?.message)),
        ])
      }
      return Promise.resolve()
    })

    try {
      await Promise.all(cleanupPromises)
      this.activeCalls.clear()
      await this.client?.stop()
    } catch (error) {
      console.error("Error during ARI session close:", error)
    }
  }
}
