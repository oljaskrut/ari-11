import { Channel } from "ari-client"
import { trunkNumberMap } from "../number-map"

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
