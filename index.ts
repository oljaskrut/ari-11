import { AriControllerIn } from "./src/ari/controller-in"

const controller = new AriControllerIn()

process.on("SIGINT", async () => {
  await controller.close()
  process.exit()
})
