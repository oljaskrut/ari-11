import { Router } from "express"
const app = Router()

import { AriController } from "./ari/controller"
import { timestamp } from "./utils/utils"

const controller = new AriController()

app.get("/disconnect", async (_, res) => {
  const result = await controller.disconnect()
  res.send({ success: result })
})

app.get("/connect", async (_, res) => {
  const result = await controller.connect()
  res.send({ success: result })
})

app.get("/call/:number", async (req, res) => {
  const number = req.params.number
  if (!number) {
    res.send({ success: false, error: "Invalid number" })
    return
  }
  let agentId = req.query.agentId
  if (agentId) {
    agentId = agentId.toString()
  }
  const call = (await controller.apiMethods?.call(number, { agentId })) ?? null
  res.send({ status: call, timestamp: timestamp() })
})

app.get("/cleanup", async (_, res) => {
  await controller.apiMethods?.cleanup()
  res.send({ success: true })
})

app.get("/channels", async (_, res) => {
  const channels = (await controller.apiMethods?.channelsList()) ?? null
  res.send({ channels })
})

app.get("/bridges", async (_, res) => {
  const bridges = (await controller.apiMethods?.bridgesList()) ?? null
  res.send({ bridges })
})

app.get("/devices", async (_, res) => {
  const devices = (await controller.apiMethods?.devicesList()) ?? null
  res.send({ devices })
})

app.get("/endpoints", async (_, res) => {
  const endpoints = (await controller.apiMethods?.endpointsList()) ?? null
  res.send({ endpoints })
})

app.get(/^\/$/, (_, res) => {
  res.send({ status: "OK", timestamp: timestamp(), connected: controller.connected })
})

process.on("SIGINT", async () => {
  await controller.disconnect()
  process.exit()
})

export const ariRoutes = app
