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
  let agentId = vars.defaultAgentId

  if (vars.webhookUrl === BLANK_VALUE) {
    console.log("no webhook url, using default agent id")
    return { agentId, newPrompt: undefined }
  }

  try {
    const { data } = await axios.get(`${vars.webhookUrl}/agent`, {
      params: {
        receiverNumber,
        callerNumber,
      },
    })

    const agent_id = data?.agent_id
    const newPrompt = data?.prompt

    if (agent_id) {
      agentId = agent_id
    }
    return { agentId, newPrompt }
  } catch (e) {
    if (isAxiosError(e)) {
      console.log("error getting agent id", e.message, e.response?.data)
    }
    return { agentId, newPrompt: undefined }
  }
}
