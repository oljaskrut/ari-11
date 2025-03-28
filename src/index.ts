import express from "express"
import { timestamp } from "./utils/utils"
import { ariRoutes } from "./ari-routes"

const PORT = process.env.PORT || 8000

const app = express()
app.use(express.json())

app.use("/ari", ariRoutes)

const startTime = timestamp()

app.use(/^\/$/, (_, res) => {
  res.send({ status: "OK", started: startTime, timestamp: timestamp() })
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
