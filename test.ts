import { AriController } from "./src/ari/controller"

const onConnect = async () => {
  console.log("onConnect")
  const callRes = await controller.apiMethods?.call("556")
  console.log({ callRes })
}
const controller = new AriController({ onConnect })

controller.connect()

process.on("SIGINT", async () => {
  await controller.disconnect()
  process.exit()
})
