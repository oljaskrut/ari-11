import type { Channel, Client } from "ari-client"
import { randomUUID } from "crypto"
import type { ActiveCalls, CallSession } from "./types"
import { BLANK_VALUE, vars } from "../config"
import { Call11 } from "../11abs/call11"
import { getAgent, getCallerNumber, getChannelVar } from "./helper"
import axios from "axios"

export class EventListeners {
  constructor(private client: Client, private activeCalls: ActiveCalls) {}

  setListeners() {
    this.client.on("StasisStart", this.handleStatisStart)
    this.client.on("StasisEnd", async (_, channel: Channel) => {
      console.log(`Channel ${channel.id} has left Stasis application`)
    })
    this.client.on("APILoadError", (error) => {
      console.error("ARI client error:", error?.message)
    })
  }

  handleStatisStart = async (_: any, channel: Channel) => {
    if (!channel.caller.number && !channel.caller.name) return

    try {
      let callerNumber = channel.caller.number.replace("+", "")
      let receiverNumber = getCallerNumber(channel).replace("+", "")

      const callerNumberOut = await getChannelVar(channel, "callerNumber")
      const receiverNumberOut = await getChannelVar(channel, "receiverNumber")
      const threadId = await getChannelVar(channel, "threadId")
      const firstMessage = await getChannelVar(channel, "firstMessage")
      const prompt = await getChannelVar(channel, "prompt")
      const agentId = await getChannelVar(channel, "agentId")
      const assistantId = await getChannelVar(channel, "assistantId")

      if (callerNumberOut && receiverNumberOut) {
        console.log("outgoing call", callerNumberOut, receiverNumberOut)
        callerNumber = receiverNumberOut.replace("+", "")
        receiverNumber = callerNumberOut.replace("+", "")
      }

      console.log(`New call from ${callerNumber} to ${channel.connected.number} (${receiverNumber})`)
      const sessionId = randomUUID()
      const callSession: CallSession = {
        sessionId,
        channel,
        callerNumber,
        receiverNumber,
        threadId,
        prompt,
        firstMessage,
        agentId,
        assistantId,
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
    // fucked by not catchable errors
    // await session.bridge?.destroy().catch()
    await session.extChannel?.hangup().catch()
    this.activeCalls.delete(channelId)
  }

  async handleIncomingCall(callSession: CallSession) {
    const { channel } = callSession

    try {
      // console.log(`Answering channel ${channel.id}`)
      await channel.answer()

      const bridge = await this.createBridge(callSession)
      await bridge.addChannel({ channel: channel.id })
      // console.log(`Incoming channel ${channel.id} added to bridge ${bridge.id}.`)

      await this.createExtChannel(callSession)
    } catch (error: any) {
      console.error(`Error handling incoming call for channel ${channel.id}:`, error?.message)
      await channel.hangup()
    }
  }

  async createBridge(callSession: CallSession) {
    const bridge = this.client.Bridge()
    await bridge.create({ type: "mixing" })
    // console.log(`Bridge created with id: ${bridge.id}`)
    callSession.bridge = bridge
    return bridge
  }

  async createExtChannel(callSession: CallSession) {
    const { bridge, sessionId, receiverNumber, callerNumber } = callSession
    if (!bridge) return

    const extChannel = this.client.Channel()
    extChannel.on("StasisStart", async (_, chan: Channel) => {
      await bridge.addChannel({ channel: chan.id })
      // console.log(`External media channel ${chan.id} added to bridge ${bridge.id}.`)

      let agentObj: {
        agentId: string
        assistantId: string
        threadId: string
        extendedPrompt?: string
        firstMessage?: string
      }

      if (callSession.agentId && callSession.assistantId && callSession.threadId) {
        agentObj = {
          agentId: callSession.agentId,
          assistantId: callSession.assistantId,
          threadId: callSession.threadId,
          extendedPrompt: callSession.prompt,
          firstMessage: callSession.firstMessage,
        }
      } else {
        const agentData = await getAgent(receiverNumber, callerNumber)

        if (!agentData) {
          console.log("no agent id, hanging up")
          await callSession.channel.hangup()
          return
        }

        agentObj = {
          agentId: agentData.agent_id,
          assistantId: agentData.assistantId,
          threadId: callSession.threadId ?? agentData.threadId,
          extendedPrompt: agentData.prompt,
          firstMessage: agentData.firstMessage,
        }
      }

      const onDisconnect = async (agentId: string, conversationId?: string) => {
        callSession.channel.hangup()
        if (!conversationId) return console.log("onDisconnect no conversationid")
        // no webhooks for now, soon
        if (vars.webhookUrl === BLANK_VALUE) return
        try {
          const { data } = await axios.post(vars.webhookUrl, {
            number: callerNumber,
            agentId,
            conversationId,
            threadId: agentObj.threadId,
          })
          console.log("disconnect webhook done", callSession.channel.caller.number, agentId, conversationId, data)
        } catch (e: any) {
          console.log("error disconnect webhook", e?.message, e?.response?.data)
        }
      }
      callSession.call11 = new Call11(sessionId, {
        onDisconnect,
        callerNumber,
        ...agentObj,
      })
    })
    extChannel.on("StasisEnd", (_, chan: Channel) => {
      console.log(`External media channel ended: ${chan.id}`)
      callSession.extChannel = undefined
    })

    await extChannel.externalMedia({
      app: vars.defaultApp,
      external_host: vars.audioSocketHost,
      format: vars.defaultFormat,
      transport: vars.defaultTransport,
      encapsulation: vars.defaultEncapsulation,
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
}
