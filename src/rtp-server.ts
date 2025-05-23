import { AudioSocket } from "@fonoster/streams"
import { WebSocketServer, WebSocket } from "ws"

const WEBSOCKET_PORT = 8081
const AUDIO_SOCKET_PORT = 9999
const LOG_INTERVAL = 10000

interface Session {
  sessionId: string
  wsConnection: WebSocket | null
  audioConnection: any
  started: boolean
  lastActivity: number
}

const audioSocket = new AudioSocket()
const wss = new WebSocketServer({ port: WEBSOCKET_PORT })
const sessions = new Map<string, Session>()

console.log(`WebSocket server listening on port ${WEBSOCKET_PORT}`)

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`)
  const sessionId = url.searchParams.get("sessionId")

  if (!sessionId) {
    ws.close(1008, "Missing sessionId parameter")
    return
  }

  let session = sessions.get(sessionId)
  if (!session) {
    session = {
      sessionId,
      wsConnection: ws,
      audioConnection: null,
      started: false,
      lastActivity: Date.now(),
    }
    sessions.set(sessionId, session)
    console.log(`New session created: ${sessionId}`)
  } else {
    session.wsConnection = ws
    session.lastActivity = Date.now()
  }

  console.log(`WebSocket connected for session: ${sessionId}`)

  ws.on("message", (data: Buffer) => {
    const session = sessions.get(sessionId)
    if (!session) return
    session.lastActivity = Date.now()

    if (session.audioConnection) {
      if (!session.started) {
        console.log(`Session ${sessionId} started streaming`)
        session.started = true
      }
      session.audioConnection.write(data)
    }
  })

  ws.on("close", () => {
    console.log(`WebSocket closed for session: ${sessionId}`)
    const session = sessions.get(sessionId)
    if (session) {
      session.wsConnection = null
      // Keep the session alive for a while in case WebSocket reconnects
      setTimeout(() => {
        const currentSession = sessions.get(sessionId)
        if (currentSession && !currentSession.wsConnection) {
          cleanupSession(sessionId)
        }
      }, 30000)
    }
  })
})

audioSocket.onConnection(async (req, res) => {
  const sessionId = req.ref
  console.log(`AudioSocket connected, session ref: ${sessionId}`)

  let session = sessions.get(sessionId)
  if (!session) {
    session = {
      sessionId,
      wsConnection: null,
      audioConnection: res,
      started: false,
      lastActivity: Date.now(),
    }
    sessions.set(sessionId, session)
  } else {
    session.audioConnection = res
    session.lastActivity = Date.now()
  }

  res.onError((err) => {
    console.error(`AudioSocket error for session ${sessionId}:`, err)
  })

  res.onClose(() => {
    console.log(`AudioSocket closed for session: ${sessionId}`)
    const session = sessions.get(sessionId)
    if (session) {
      session.audioConnection = null

      if (!session.wsConnection) {
        cleanupSession(sessionId)
      }
    }
  })

  res.onData((data: Buffer) => {
    const session = sessions.get(sessionId)
    if (!session) return
    session.lastActivity = Date.now()

    if (session.wsConnection && session.wsConnection.readyState === WebSocket.OPEN) {
      session.wsConnection.send(data)
    }
  })
})

audioSocket.listen(AUDIO_SOCKET_PORT, () => {
  console.log(`AudioSocket server listening on port ${AUDIO_SOCKET_PORT}`)
})

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) return
  if (session.wsConnection) {
    try {
      session.wsConnection.close()
    } catch (err) {
      console.error(`Error closing WebSocket for session ${sessionId}:`, err)
    }
  }
  sessions.delete(sessionId)
  console.log(`Session removed: ${sessionId}`)
}

// Periodic logging of packet counts and session cleanup
setInterval(() => {
  for (const [sessionId, session] of sessions.entries()) {
    const inactiveThreshold = 2 * 60 * 1000
    if (Date.now() - session.lastActivity > inactiveThreshold) {
      console.log(`Session ${sessionId} inactive for more than 2 minutes, cleaning up`)
      cleanupSession(sessionId)
    }
  }
}, LOG_INTERVAL)
