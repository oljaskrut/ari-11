import { Writable } from "stream"
import { Buffer } from "buffer" // Explicit import for clarity

interface JitterBufferOptions {
  targetDurationMs: number // Target buffer size in milliseconds
  minThresholdFactor?: number // Factor of target duration to reach before starting processing (e.g., 0.5 for 50%)
  sampleRate: number // e.g., 16000
  bitDepth: number // e.g., 16
  onChunkReadyCallback: (chunk: Buffer) => void | Promise<void> // Your function to process buffered audio
}

export class JitterBuffer {
  private targetDurationMs: number
  private sampleRate: number
  private bitDepth: number
  private onChunkReadyCallback: (chunk: Buffer) => void | Promise<void>

  private bytesPerSample: number
  private bytesPerMs: number
  private targetBufferSizeBytes: number
  private minBufferBeforeProcessingBytes: number

  private audioBufferQueue: Buffer[] = []
  private totalBufferedBytes: number = 0
  private isProcessing: boolean = false

  constructor(options: JitterBufferOptions) {
    this.targetDurationMs = options.targetDurationMs
    this.sampleRate = options.sampleRate
    this.bitDepth = options.bitDepth
    this.onChunkReadyCallback = options.onChunkReadyCallback

    if (this.bitDepth % 8 !== 0) {
      throw new Error("Bit depth must be a multiple of 8.")
    }
    this.bytesPerSample = this.bitDepth / 8

    if (this.sampleRate <= 0 || this.bytesPerSample <= 0) {
      throw new Error("Sample rate and bytes per sample must be positive.")
    }

    this.bytesPerMs = (this.sampleRate * this.bytesPerSample) / 1000
    this.targetBufferSizeBytes = Math.max(this.bytesPerSample, this.targetDurationMs * this.bytesPerMs) // Ensure at least one sample fits

    const minThresholdFactor = options.minThresholdFactor ?? 0.5 // Default to 50%
    this.minBufferBeforeProcessingBytes = Math.max(this.bytesPerSample, this.targetBufferSizeBytes * minThresholdFactor)

    // console.log(
    //   `JitterBuffer initialized: Target=${this.targetDurationMs}ms (${this.targetBufferSizeBytes.toFixed(
    //     0,
    //   )} bytes), MinStart=${this.minBufferBeforeProcessingBytes.toFixed(0)} bytes`,
    // )
  }

  /**
   * Adds an incoming audio chunk to the buffer and writes it to the file stream.
   * Triggers processing if the buffer threshold is met.
   * @param chunk The raw audio data buffer.
   */
  public write(chunk: Buffer): void {
    if (!Buffer.isBuffer(chunk) || chunk.length === 0) {
      // console.log("Ignoring invalid or empty chunk.")
      return
    }

    // Add to internal buffer queue
    this.audioBufferQueue.push(chunk)
    this.totalBufferedBytes += chunk.length
    // console.log(`Received ${chunk.length} bytes. Buffer size: ${this.totalBufferedBytes} bytes`); // Verbose logging

    // Start processing if not already running and buffer is sufficient
    if (!this.isProcessing && this.totalBufferedBytes >= this.minBufferBeforeProcessingBytes) {
      this._processBuffer() // Don't await, let it run in the background
    }
  }

  /**
   * Internal method to process buffered audio chunks asynchronously.
   */
  private async _processBuffer(): Promise<void> {
    if (this.isProcessing) return // Prevent concurrent runs
    this.isProcessing = true
    // console.log("Starting audio processing loop...")

    while (this.totalBufferedBytes >= this.bytesPerSample) {
      // Ensure at least one full sample is buffered
      const chunkToProcess = this.audioBufferQueue.shift() // Get the oldest chunk

      if (!chunkToProcess) {
        // This case should ideally not be reached if totalBufferedBytes > 0,
        // but handle defensively.
        console.log("Warning: Buffer queue empty despite positive byte count. Recalculating.")
        this.totalBufferedBytes = this.audioBufferQueue.reduce((sum, buf) => sum + buf.length, 0)
        if (this.totalBufferedBytes < this.bytesPerSample) break // Exit if truly empty now
        continue // Try again if recalculation showed data
      }

      this.totalBufferedBytes -= chunkToProcess.length
      // console.log(`Processing chunk: ${chunkToProcess.length} bytes. Remaining buffer: ${this.totalBufferedBytes} bytes`); // Verbose

      try {
        // Call the user-provided callback with the buffered chunk
        // We don't await here to keep processing moving, assuming the callback
        // handles its own async operations or is fast enough.
        // If strict ordering *after* callback completion is needed, you would await.
        this.onChunkReadyCallback(chunkToProcess)
      } catch (err: any) {
        console.log("Error during onChunkReadyCallback:", err.message)
        // Decide how to handle callback errors (e.g., log, stop, continue)
      }

      // Yield to the event loop to prevent blocking
      // Use setImmediate for better performance than setTimeout(0) in loops
      await new Promise((resolve) => setImmediate(resolve))

      // Check if buffer is depleted below minimum sample size *during* the loop
      if (this.totalBufferedBytes < this.bytesPerSample) {
        break
      }
    }

    this.isProcessing = false
    // console.log("Audio processing loop finished.")

    // Optional: Check if buffer grew large enough again *immediately* after stopping
    // This handles cases where data arrived just as the loop was finishing.
    if (this.totalBufferedBytes >= this.minBufferBeforeProcessingBytes) {
      console.log("Buffer refilled sufficiently, restarting processing immediately.")
      this._processBuffer() // Restart processing
    }
  }

  /**
   * Cleans up resources, like ensuring the file stream is closed if managed here.
   * (Currently minimal, but good practice to include).
   */
  public destroy(): void {
    console.log("Destroying JitterBuffer.")
    this.audioBufferQueue = []
    this.totalBufferedBytes = 0
    // Note: Closing the outputFileStream is usually handled by the code
    // that created it, unless the JitterBuffer is meant to own it.
  }
}
