import WebSocket from "ws"
import { ElevenLabs } from "./elevenlabs"
import { AudioQueue } from "../utils/audio-queue"
import { vars } from "../config"

interface Call11Options {
  onDisconnect?: (agentId: string, conversationId?: string) => void
  agentId?: string
  callerNumber?: string
  extendedPrompt?: string
}

export class Call11 {
  sessionId: string
  onDisconnect?: (agentId: string, conversationId?: string) => void
  clientWs?: WebSocket
  elevenLabs?: ElevenLabs
  agentId: string
  callerNumber?: string
  extendedPrompt?: string

  constructor(sessionId: string, { onDisconnect, agentId, callerNumber, extendedPrompt }: Call11Options = {}) {
    this.sessionId = sessionId
    this.onDisconnect = onDisconnect
    this.callerNumber = callerNumber

    this.agentId = agentId ?? vars.defaultAgentId
    this.extendedPrompt = extendedPrompt
    this.initClientWs()
    this.initElevenLabs()
  }

  initElevenLabs() {
    const sendAudioOut = (data: Buffer) => this.clientWs?.send(data)
    const audioQueue = new AudioQueue(sendAudioOut)
    const elevenLabs = new ElevenLabs({
      agentId: this.agentId,
      sessionId: this.sessionId,
      audioQueue,
      onDisconnect: this.onDisconnect,
      callerNumber: this.callerNumber,
      extendedPrompt: this.extendedPrompt,
    })
    this.elevenLabs = elevenLabs
    elevenLabs.init()
  }

  initClientWs() {
    // const jitterBuffer = new JitterBuffer({
    //   onChunkReadyCallback: (chunk) => {
    //     this.elevenLabs?.sendAudio(chunk)
    //     outputFileStream?.write(chunk)
    //   },
    // })

    const clientWs = new WebSocket(`${vars.webSocketUrl}?sessionId=${this.sessionId}`)
    // console.info(`[${this.sessionId}] ws connected`)

    clientWs.on("message", async (message: any) => {
      // jitterBuffer.write(message)
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
