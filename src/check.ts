import WebSocket from "ws"
import { readFileSync } from "fs"
import { AudioQueue } from "./utils/audio-queue"
import { vars } from "./config"

export function testAudio(sessionId: string, file_name: string) {
  const clientWs = new WebSocket(`${vars.webSocketUrl}?sessionId=${sessionId}`)
  console.info("[Server] connected.")

  const sendAudioOut = (data: Buffer) => {
    clientWs.send(data)
  }

  const audioQueue = new AudioQueue(sendAudioOut)

  const buffer_strings = readFileSync(file_name, "utf8").split("\n")
  buffer_strings.forEach((buffer_string) => {
    audioQueue.enqueue(Buffer.from(buffer_string, "base64"))
  })

  clientWs.on("close", () => {
    console.log("[CLIENT] Client disconnected")
  })

  clientWs.on("error", (error: any) => {
    console.error("[CLIENT] WebSocket error:", error)
  })
}
