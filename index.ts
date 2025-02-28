import express from "express"
import { AriController } from "./src/ari/controller"
import { timestamp } from "./src/utils/utils"

const controller = new AriController()

const PORT = process.env.PORT || 8000

const app = express()
app.use(express.json())

app.get("/check", (_, res) => {
  res.send({ status: "OK", timestamp: timestamp(), connected: controller.connected })
})

app.get("/disconnect", async (_, res) => {
  await controller.disconnect()
  res.send({ success: true })
})

app.get("/connect", async (_, res) => {
  await controller.connect()
  res.send({ success: true })
  process.exit(1)
})

app.get("/cleanup", async (_, res) => {
  await controller.cleanup()
  res.send({ success: true })
})

app.get("/call/:number", async (req, res) => {
  const number = req.params.number
  if (!number) {
    res.send({ success: false, error: "Invalid number" })
    return
  }
  if (!controller.connected) {
    res.send({ success: false, error: "Not connected" })
    return
  }
  let agentId = req.query.agentId
  if (agentId) {
    agentId = agentId.toString()
  }
  await controller.call(number, agentId)
  res.send({ status: "OK", timestamp: timestamp(), connected: controller.connected })
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

process.on("SIGINT", async () => {
  await controller.disconnect()
  process.exit()
})
