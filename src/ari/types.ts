import { type Bridge, type Channel, type Client } from "ari-client"
import type { Call11 } from "../11abs/call11"

export interface CallSession {
  sessionId: string
  channel: Channel
  extChannel?: Channel
  receiverNumber: string
  callerNumber: string
  bridge?: Bridge
  call11?: Call11
  threadId?: string
  firstMessage?: string
  prompt?: string
  agentId?: string
	assistantId?: string
}

export type ActiveCalls = Map<string, CallSession>
