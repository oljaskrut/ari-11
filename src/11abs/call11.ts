import WebSocket from "ws"
import { ElevenLabs } from "./elevenlabs"
import { AudioQueue } from "../utils/audio-queue"
import { vars } from "../config"

export class Call11 {
  sessionId: string
  onDisconnect?: (agentId: string, conversationId?: string) => void
  clientWs?: WebSocket
  elevenLabs?: ElevenLabs
  agentId: string

  constructor(
    sessionId: string,
    {
      onDisconnect,
      agentId,
    }: { onDisconnect?: (agentId: string, conversationId?: string) => void; agentId?: string } = {},
  ) {
    this.sessionId = sessionId
    this.onDisconnect = onDisconnect

    this.agentId = agentId ?? vars.defaultAgentId

    this.initClientWs()
    this.initElevenLabs()
  }

  initElevenLabs() {
    const sendAudioOut = (data: Buffer) => this.clientWs?.send(data)
    const audioQueue = new AudioQueue(sendAudioOut)
    const elevenLabs = new ElevenLabs(this.agentId, this.sessionId, audioQueue, this.onDisconnect)
    this.elevenLabs = elevenLabs
    elevenLabs.init()
  }

  initClientWs() {
    const clientWs = new WebSocket(`${vars.webSocketUrl}?sessionId=${this.sessionId}`)
    console.info(`[${this.sessionId}] ws connected`)

    clientWs.on("message", async (message: any) => {
      this.elevenLabs?.sendAudio(message)
    })
    clientWs.on("close", () => {
      console.log(`[${this.sessionId}] ws disconnected`)
      this.elevenLabs?.close()
    })
    clientWs.on("error", (error: any) => {
      console.error(`[${this.sessionId}] ws error:`, error)
    })
    this.clientWs = clientWs
  }

  disconnect() {
    this.elevenLabs?.close()
    this.clientWs?.close()
  }
}
