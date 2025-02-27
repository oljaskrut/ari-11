import { splitAudioBuffer } from "./buff-split"
import { appendFileSync } from "fs"

const CHUNK_DURATION_MS = 40

export class AudioQueue {
  callback: (buffer: Buffer) => void
  chunkDurationMs = CHUNK_DURATION_MS
  public queue: Buffer[]
  public processing = false
  public interrupted = false
  private currentTimer: Timer | null = null

  constructor(callback: (buffer: Buffer) => void) {
    this.callback = callback
    this.queue = []
  }
  processQueue() {
    if (this.processing) return
    if (this.queue.length === 0) return

    const audioData = this.queue.shift()
    if (audioData) {
      this.processing = true
      this.sendAudioOut(audioData)
    }
  }

  sendAudioOut(audioData: Buffer) {
    const chunks = splitAudioBuffer(audioData, {
      chunkDurationMs: this.chunkDurationMs,
    })

    const sendChunk = (index: number) => {
      if (this.interrupted) {
        console.log(Date.now(), "audio interrupted")
        this.processing = false
        return
      }
      if (index < chunks.length) {
        this.callback(chunks[index])
        this.currentTimer = setTimeout(() => {
          sendChunk(index + 1)
        }, this.chunkDurationMs)
      } else {
        this.processing = false
        this.processQueue()
      }
    }

    sendChunk(0)
  }
  enqueue = (audioData: Buffer) => {
    this.queue.push(audioData)
    appendFileSync("queue.txt", audioData.toString("base64") + "\n")
    this.processQueue()
  }

  public interrupt() {
    console.log(`[${new Date().toISOString()}] Interrupt received, clearing audio queue.`)
    this.interrupted = true
    this.queue = []
    if (this.currentTimer) {
      clearTimeout(this.currentTimer)
      this.currentTimer = null
    }
  }
}
