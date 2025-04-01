import WebSocket from "ws"
import { ElevenLabs } from "./elevenlabs"
import { AudioQueue } from "../utils/audio-queue"
import { env, vars } from "../config"
import { FileWriter } from "wav"
import { timestamp } from "../utils/utils"
import { JitterBuffer } from "./jitter-buffer"

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
    let outputFileStream: FileWriter | undefined
    if (env.environment === "dev") {
      outputFileStream = new FileWriter(`test-${timestamp()}.wav`, {
        sampleRate: 16000,
        channels: 1,
      })
    }

    // const SAMPLE_RATE = 16000
    // const BIT_DEPTH = 16
    // const BUFFER_DURATION_MS = 200 // Adjust buffer size (milliseconds)
    // const MIN_BUFFER_START_FACTOR = 0.6

    // const jitterBuffer = new JitterBuffer({
    //   targetDurationMs: BUFFER_DURATION_MS,
    //   minThresholdFactor: MIN_BUFFER_START_FACTOR,
    //   sampleRate: SAMPLE_RATE,
    //   bitDepth: BIT_DEPTH,
    //   onChunkReadyCallback: (chunk) => {
    //     // This is where you use the *buffered* audio data
    //     this.elevenLabs?.sendAudio(chunk)
    //     outputFileStream.write(chunk)
    //     // You could also perform your quality analysis here on the buffered chunk
    //     // analyzeAudioChunk(chunk);
    //   },
    // })

    const clientWs = new WebSocket(`${vars.webSocketUrl}?sessionId=${this.sessionId}`)
    // console.info(`[${this.sessionId}] ws connected`)

    clientWs.on("message", async (message: any) => {
      // jitterBuffer.write(message)
      this.elevenLabs?.sendAudio(message)
      outputFileStream?.write(message)
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
