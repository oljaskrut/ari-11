/**
 * Splits an audio Buffer into chunks corresponding to a given duration.
 *
 * @param {Buffer} buffer - The original audio buffer.
 * @param {Object} options - Audio options.
 * @param {number} options.sampleRate - Audio sample rate (Hz), e.g. 8000.
 * @param {number} options.bytesPerSample - Bytes per audio sample, e.g. 2 for PCM 16-bit.
 * @param {number} options.channels - Number of audio channels, e.g. 1 for mono.
 * @param {number} options.chunkDurationMs - Duration (in milliseconds) of each chunk.
 * @returns {Buffer[]} An array of audio chunks as Buffer objects.
 */

export function splitAudioBuffer(
  buffer: Buffer,
  {
    sampleRate = 8000,
    bytesPerSample = 2,
    channels = 1,
    chunkDurationMs = 40,
  }: { sampleRate?: number; bytesPerSample?: number; channels?: number; chunkDurationMs?: number } = {},
) {
  // Calculate the number of bytes in each chunk.
  const chunkSize = (sampleRate * bytesPerSample * channels * chunkDurationMs) / 1000

  const chunks = []
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    const end = offset + chunkSize > buffer.length ? buffer.length : offset + chunkSize
    chunks.push(buffer.slice(offset, end))
  }
  return chunks
}
