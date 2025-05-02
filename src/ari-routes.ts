import { Router } from "express"
const app = Router()

import { AriController } from "./ari/controller"
import { timestamp } from "./utils/utils"
import { vars } from "./config"
import { trunkNumberMap } from "./number-map"

const controller = new AriController()

app.get("/disconnect", async (_, res) => {
  const result = await controller.disconnect()
  res.send({ success: result })
})

app.get("/connect", async (_, res) => {
  const result = await controller.connect()
  res.send({ success: result })
})

app.get("/set-agent/:agentId", (req, res) => {
  const agentId = req.params.agentId
  if (!agentId) {
    res.send({ success: false, error: "Invalid agentId" })
    return
  }
  vars.defaultAgentId = agentId
  res.send({ success: true, timestamp: timestamp(), agentId: vars.defaultAgentId })
})

app.get("/call/:number", async (req, res) => {
  const numberString = req.params.number
  const threadId = req.query.threadId as string | undefined

  if (!numberString) {
    res.send({ success: false, error: "Invalid number" })
    return
  }
  const number = numberString.split("@")[0]
  const trunk = numberString.split("@")[1]

  if (!trunk || !Object.keys(trunkNumberMap).includes(trunk)) {
    res.send({ success: false, error: "Invalid trunk" })
    return
  }
  const call = (await controller.apiMethods?.call(number, trunk, threadId)) ?? null
  res.send({ status: call, timestamp: timestamp() })
})

app.get("/cleanup", async (_, res) => {
  const result = (await controller.apiMethods?.cleanup()) ?? null
  res.send({ success: result })
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
