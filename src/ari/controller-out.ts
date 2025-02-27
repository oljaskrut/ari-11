import ari, { type Bridge, type Client, type Channel } from "ari-client"
import { randomUUID } from "crypto"
import { vars } from "../config"

interface AriOptions {
  dialString: string
}

export class AriControllerOut {
  private client?: Client
  private bridge?: Bridge
  private localChannel?: Channel
  private externalChannel?: Channel
  private options: AriOptions

  constructor(options: AriOptions) {
    this.options = options
  }

  async connect() {
    try {
      this.client = await ari.connect(vars.ariUrl, vars.ariUser, vars.ariPassword)
      console.log("connected")
      await this.client.start("externalMedia")

      this.bridge = this.client.Bridge()
      await this.bridge.create({ type: "mixing" })
      console.log("Mixing bridge создан.")

      this.localChannel = this.client.Channel()
      this.localChannel.on("StasisStart", async (_: any, chan: any) => {
        console.log(`Локальный канал запущен: ${chan.id}`)
        if (this.bridge) {
          await this.bridge.addChannel({ channel: chan.id })
        }
      })
      this.localChannel.on("StasisEnd", (_: any, chan: any) => {
        console.log(`Локальный канал завершен: ${chan.id}`)
        this.close()
      })

      await this.localChannel.originate({
        endpoint: this.options.dialString,
        app: "externalMedia",
        formats: "slin16",
      })
      console.log(`Originate выполнен для ${this.options.dialString}`)

      this.externalChannel = this.client.Channel()
      this.externalChannel.on("StasisStart", async (_: any, chan: any) => {
        console.log(`External Media канал запущен: ${chan.id}`)
        if (this.bridge) {
          await this.bridge.addChannel({ channel: chan.id })
        }
      })
      this.externalChannel.on("StasisEnd", (_: any, chan: any) => {
        console.log(`External Media канал завершен: ${chan.id}`)
        this.close()
      })

      const sessionId = randomUUID()

      await this.externalChannel.externalMedia({
        app: "externalMedia",
        external_host: vars.audioSocketHost,
        format: "slin16",
        transport: "tcp",
        encapsulation: "audiosocket",
        // @ts-ignore
        data: sessionId,
      })
    } catch (error) {
      console.error("Ошибка подключения к ARI:")
      console.log(error)
      this.close()
    }
  }

  async close() {
    console.log("Завершение ARI сессии...")
    try {
      await this.localChannel?.hangup()
      await this.externalChannel?.hangup()
      await this.bridge?.destroy()
      await this.client?.stop()
    } catch (e) {
      // console.log("close error", e)
    }
  }
}
