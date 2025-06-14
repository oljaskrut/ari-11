import { Channel } from "ari-client"
import { trunkNumberMap } from "../number-map"
import { BLANK_VALUE, vars } from "../config"
import axios, { isAxiosError } from "axios"

export function getTrunkName(channel: Channel) {
  const channelName = channel.name //"PJSIP/kcell_9-00000047"
  let trunkName = ""

  if (channelName && channelName.includes("/") && channelName.includes("-")) {
    const partAfterSlash = channelName.split("/")[1]

    trunkName = partAfterSlash.split("-")[0]
  }

  return trunkName
}

export function getCallerNumber(channel: Channel) {
  const trunkName = getTrunkName(channel)
  return trunkNumberMap[trunkName]
}

export async function getAgent(receiverNumber: string, callerNumber: string) {
  try {
    const { data } = await axios.get<IGetAgent>(`${vars.webhookUrl}/agent`, {
      params: {
        receiverNumber,
        callerNumber,
      },
    })
		
    return data
  } catch (e) {
    if (isAxiosError(e)) {
      console.log("error getting agent id", e.message, e.response?.data)
    }
    return
  }
}

export async function getChannelVar(channel: Channel, variable: string) {
  try {
    const varRes = await channel.getChannelVar({
      variable,
    })
    return varRes?.value
  } catch (e) {}
}

interface IGetAgent {
  agent_id: string
  assistantId: string
  threadId: string
  callerNumber: string
  receiverNumber: string
  prompt?: string
	firstMessage?: string
}
