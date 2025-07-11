import type { Client } from "ari-client"
import { vars } from "../config"
import { trunkNumberMap } from "../number-map"

export const callMethod =
  (client: Client) =>
  async ({
    number,
    trunk,
    threadId,
    timeout,
    firstMessage,
    prompt,
    agentId,
    assistantId,
  }: {
    number: string
    trunk: string
    threadId: string | undefined
    agentId?: string
    timeout?: number
    firstMessage?: string
    prompt?: string
    assistantId?: string
  }) => {
    timeout = timeout ?? 30_000

    return new Promise(async (resolve) => {
      try {
        let timer: Timer | undefined = undefined

        const send = (data: any) => {
          clearTimeout(timer)
          resolve(data)
        }

        const channel = client.Channel()
        channel.on("ChannelHangupRequest", (event) => {
          console.log("HangupRequest", number, event.cause)
          send(`HangupRequest with cause ${event.cause}`)
        })
        channel.on("ChannelStateChange", (event) => {
          if (event.channel.state === "Ringing") {
            console.log("Ringing", number)
          } else if (event.channel.state === "Up") {
            console.log("Up", number)
            send(`Call is Up`)
          } else {
            console.log("ChannelStateChange", number, event.channel.state)
          }
        })
        await channel.originate({
          endpoint: `PJSIP/${number}@${trunk}`,
          app: vars.defaultApp,
          formats: vars.defaultFormat,
          callerId: trunkNumberMap[trunk],
          variables: {
            receiverNumber: number,
            callerNumber: trunkNumberMap[trunk],
            threadId,
            prompt,
            firstMessage,
            agentId,
            assistantId,
          },
        })

        timer = setTimeout(() => {
          console.log("call timed out")
          channel.hangup()
          resolve("timeout")
        }, timeout)
        console.log("Call Originate", number)
      } catch (e: any) {
        console.error("Error originating call", number, e?.message)
        resolve(false)
      }
    })
  }

export type CallMethodArgs = Parameters<ReturnType<typeof callMethod>>
