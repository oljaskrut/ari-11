import ari, { type Client } from "ari-client"

if (process.argv[2]) {
  console.log("cleanup")
  const client = await ari.connect("http://191.101.2.43:8088", "oljas", "Oljas1")
  await cleanupARI(client)
}

export async function cleanupARI(client: Client) {
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
}
