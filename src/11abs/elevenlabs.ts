import WebSocket from "ws"
import { safeParseJSON } from "../utils/utils"
import type { AudioQueue } from "../utils/audio-queue"
import { vars } from "../config"

export class ElevenLabs {
  agentId: string
  sessionId: string
  elevenLabsWs: WebSocket | undefined
  isConnected = false
  audioQueue: AudioQueue
  onDisconnect?: () => void

  constructor(agentId: string, sessionId: string, audioQueue: AudioQueue, onDisconnect?: () => void) {
    this.agentId = agentId
    this.sessionId = sessionId
    this.audioQueue = audioQueue
    this.onDisconnect = onDisconnect
  }

  init() {
    if (this.elevenLabsWs) return

    const elevenLabsWs = new WebSocket(`${vars.elevenLabsUrl}?agentId=${this.agentId}`)

    elevenLabsWs.on("open", () => {
      console.info(`[${this.sessionId}] 11abs connected`)
    })
    elevenLabsWs.on("message", this.handleMessage)
    elevenLabsWs.on("error", (error) => console.error("11abs error:", error))
    elevenLabsWs.on("close", () => {
      console.info(`[${this.sessionId}] 11abs disconnected`)
      this.onDisconnect?.()
    })

    this.isConnected = true
    this.elevenLabsWs = elevenLabsWs
  }

  handleMessage = (data: any, isBinary?: boolean) => {
    try {
      data = isBinary ? data : data.toString("utf8")
      const message = safeParseJSON(data)
      if (!message) return

      switch (message.type) {
        case "conversation_initiation_metadata":
          // console.info("1abs got initiation metadata")
          // console.log(message)
          break

        case "user_transcript":
          console.log(`[${this.sessionId}] USER:`, message.user_transcription_event.user_transcript)
          break

        case "agent_response":
          console.log(`[${this.sessionId}] AGENT:`, message.agent_response_event.agent_response)
          break

        case "audio":
          const buffer = Buffer.from(message.audio_event.audio_base_64, "base64")
          this.audioQueue.enqueue(buffer)
          break

        case "interruption":
          console.log(`[${this.sessionId}],"11abs interruption`)
          this.audioQueue.interrupt()
          break

        case "ping":
          const pongResponse = {
            type: "pong",
            event_id: message.ping_event.event_id,
          }
          this.elevenLabsWs?.send(JSON.stringify(pongResponse))
          break

        case "agent_response_correction":
          // console.log("correction", message.correction_event)
          break

        case "client_tool_call":
          const { tool_name, tool_call_id, parameters } = message.client_tool_call
          console.log("client_tool_call", tool_name, parameters)
          break

        default:
          console.log(`[${this.sessionId}] 11abs unhandled message:`, message)
          break
      }
    } catch (error) {
      console.error(`[${this.sessionId}]`, "Error handling message from ElevenLabs:", data, error)
    }
  }

  sendAudio = (message: Buffer) => {
    this.elevenLabsWs?.send(
      JSON.stringify({
        user_audio_chunk: message.toString("base64"),
      }),
    )
  }

  close() {
    if (!this.elevenLabsWs) return
    this.elevenLabsWs.close()
  }
}
