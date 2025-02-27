import { AriControllerOut } from "./ari/controller-out"

const controller = new AriControllerOut({
  dialString: "PJSIP/702@kcell",
})
controller.connect()

process.on("SIGINT", async () => {
  await controller.close()
  process.exit()
})
