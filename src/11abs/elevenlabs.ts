import WebSocket from "ws"
import { safeParseJSON } from "../utils/utils"
import type { AudioQueue } from "../utils/audio-queue"
import { vars } from "../config"

interface ElevenLabsOptions {
  agentId: string
  sessionId: string
  audioQueue: AudioQueue
  onDisconnect?: (agentId: string, conversationId?: string) => void
  callerNumber?: string
  extendedPrompt?: string
}

export class ElevenLabs {
  agentId: string
  sessionId: string
  elevenLabsWs: WebSocket | undefined
  isConnected = false
  audioQueue: AudioQueue
  onDisconnect?: (agentId: string, conversationId?: string) => void
  conversationId?: string
  callerNumber?: string
  extendedPrompt?: string

  constructor({ agentId, audioQueue, onDisconnect, sessionId, callerNumber, extendedPrompt }: ElevenLabsOptions) {
    this.agentId = agentId
    this.sessionId = sessionId
    this.audioQueue = audioQueue
    this.onDisconnect = onDisconnect
    this.callerNumber = callerNumber
    this.extendedPrompt = extendedPrompt
  }

  init() {
    if (this.elevenLabsWs) return

    const elevenLabsWs = new WebSocket(`${vars.elevenLabsUrl}?agent_id=${this.agentId}`)

    elevenLabsWs.on("open", () => {
      // console.info(`[${this.sessionId}] 11abs connected`)
      if (this.callerNumber) {
        this.sendInitiationMetadata({ caller_number: this.callerNumber })
      }
    })
    elevenLabsWs.on("message", this.handleMessage)
    elevenLabsWs.on("error", (error) => console.error("11abs error:", error))
    elevenLabsWs.on("close", () => {
      console.info(`[${this.sessionId}] 11abs disconnected`)
      this.onDisconnect?.(this.agentId, this.conversationId)
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
          this.conversationId = message.conversation_initiation_metadata_event.conversation_id
          console.log(
            `[${this.sessionId}] 11abs conversation_id:`,
            message.conversation_initiation_metadata_event.conversation_id,
          )
          break

        case "user_transcript":
          if (vars.logTranscripts) {
            console.log(`[${this.sessionId}] USER:`, message.user_transcription_event.user_transcript)
          }
          break

        case "agent_response":
          if (vars.logTranscripts) {
            console.log(`[${this.sessionId}] AGENT:`, message.agent_response_event.agent_response)
          }
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
    if (!this.isConnected) return
    if (!this.elevenLabsWs) return
    if (this.elevenLabsWs.readyState !== WebSocket.OPEN) return
    this.elevenLabsWs?.send(
      JSON.stringify({
        user_audio_chunk: message.toString("base64"),
      }),
    )
  }

  sendInitiationMetadata = ({ caller_number }: { caller_number: string }) => {
    this.elevenLabsWs?.send(
      JSON.stringify({
        type: "conversation_initiation_client_data",
        dynamic_variables: {
          custom__caller_number: caller_number,
        },
        conversation_config_override: {
          agent: {
            prompt: {
              prompt: this.extendedPrompt,
            },
          },
        },
      }),
    )
  }

  close() {
    if (!this.elevenLabsWs) return
    this.elevenLabsWs.close()
  }
}
