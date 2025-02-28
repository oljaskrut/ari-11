import ari, { type Client } from "ari-client"
import { vars } from "../config"
import { ApiMethods } from "./api-methods"
import type { ActiveCalls } from "./types"
import { EventListeners } from "./event-listeners"

export class AriController {
  private client?: Client
  private activeCalls: ActiveCalls = new Map()
  connected = false
  connecting = false
  onConnect?: () => void
  apiMethods?: ApiMethods

  constructor({ onConnect }: { onConnect?: () => void } = {}) {
    this.onConnect = onConnect
    this.connect()
  }

  async connect() {
    if (this.connected || this.connecting) return true
    this.connecting = true
    try {
      this.client = await ari.connect(vars.ariUrl, vars.ariUser, vars.ariPassword)
      await this.client.start(vars.defaultApp)
      console.log("ARI connected")
      this.connected = true

      const listeners = new EventListeners(this.client, this.activeCalls)
      listeners.setListeners()

      this.apiMethods = new ApiMethods(this.client)

      this.onConnect?.()
      return true
    } catch (error: any) {
      console.error("ARI error:", error?.message)
      this.disconnect()
      return false
    } finally {
      this.connecting = false
    }
  }

  async disconnect() {
    if (!this.connected) return true
    console.log("Closing ARI session...")

    const cleanupPromises = [...this.activeCalls.keys()].map((channelId) => {
      const session = this.activeCalls.get(channelId)
      if (!session) return Promise.resolve()
      const promises = [session.channel.hangup(), session.extChannel?.hangup(), session.bridge?.destroy()]
      return Promise.allSettled(promises)
    })

    this.apiMethods = undefined

    try {
      await Promise.all(cleanupPromises)
      this.activeCalls.clear()
      // maybe remove listeners
      await this.client?.stop()
    } catch (error) {
      console.error("Error during ARI session close:", error)
    } finally {
      console.log("Closed ARI")
      this.connected = false
      return true
    }
  }
}
