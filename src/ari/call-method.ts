import type { Client } from "ari-client"
import { vars } from "../config"
import { delay } from "../utils/utils"

export const callMethod =
  (client: Client) =>
  async (number: string, { agentId, timeout }: { agentId?: string; timeout?: number } = {}) => {
    const AGENT_ID = agentId
    timeout = timeout ?? 30_000

    return new Promise(async (resolve) => {
      try {
        const channel = client.Channel()
        channel.on("ChannelHangupRequest", (event) => {
          console.log("HangupRequest", number, event.cause)
          resolve(`HangupRequest:${event.cause}`)
        })
        channel.on("ChannelStateChange", (event) => {
          if (event.channel.state === "Ringing") {
            console.log("Ringing", number)
          } else if (event.channel.state === "Up") {
            console.log("Up", number)
            resolve(`Up:${event.channel.id}`)
          } else {
            console.log("ChannelStateChange", number, event.channel.state)
          }
        })
        await channel.originate({
          endpoint: `PJSIP/${number}`,
          app: vars.defaultApp,
          formats: vars.defaultFormat,
          callerId: "Pleep",
          variables: { AGENT_ID },
        })

        delay(timeout).then(() => {
          console.log("call timed out")
          channel.hangup()
          resolve("timeout")
        })
        console.log("Call Originate", number)
      } catch (e: any) {
        console.error("Error originating call", number, e?.message)
        resolve(false)
      }
    })
  }

export type CallMethodArgs = Parameters<ReturnType<typeof callMethod>>
