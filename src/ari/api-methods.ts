import type { Client } from "ari-client"
import { cleanupARI } from "./cleanup"
import { callMethod, type CallMethodArgs } from "./call-method"

export class ApiMethods {
  constructor(private client: Client) {}

  async call(...args: CallMethodArgs) {
    return callMethod(this.client)(...args)
  }

  async cleanup() {
    return cleanupARI(this.client)
  }
  async channelsList() {
    return this.client.channels.list()
  }
  async bridgesList() {
    return this.client.bridges.list()
  }
  async devicesList() {
    return this.client.deviceStates.list()
  }
  async endpointsList() {
    return this.client.endpoints.list()
  }
}
