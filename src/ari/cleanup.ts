import ari, { type Client } from "ari-client"

export async function cleanupARI(client: Client) {
  try {
    const channels = await client.channels.list()

    console.log("channels", channels.length)

    channels.forEach(async (channel) => {
      if (channel.state === "Up") {
        const chan = await client.channels.get({ channelId: channel.id })
        await chan.hangup()
      }
    })

    const bridges = await client.bridges.list()

    console.log("bridges", bridges.length)

    bridges.forEach(async (bridge) => {
      const brd = await client.bridges.get({ bridgeId: bridge.id })
      await brd.destroy()
    })

    return true
  } catch (e) {
    console.log("error cleanupARI", e)
    return false
  }
}
