export const env = {
  HOST: process.env.ASTERISK_HOST ?? "localhost",
  AUDIO_SOCKET_PORT: 9999,
  ARI_PORT: 8088,
  WEB_SOCKET_PORT: 8081,
  ARI_USER: process.env.ARI_USER ?? "",
  ARI_PASS: process.env.ARI_PASS ?? "",
  AGENT_ID: process.env.AGENT_ID ?? "",
  WEBHOOK_URL: process.env.WEBHOOK_URL ?? "",
}

export const vars = {
  ariUrl: `http://${env.HOST}:${env.ARI_PORT}`,
  ariUser: env.ARI_USER,
  ariPassword: env.ARI_PASS,
  audioSocketHost: `${env.HOST}:${env.AUDIO_SOCKET_PORT}`,
  webSocketUrl: `ws://${env.HOST}:${env.WEB_SOCKET_PORT}`,

  defaultAgentId: env.AGENT_ID,
  elevenLabsUrl: `wss://api.elevenlabs.io/v1/convai/conversation`,

  webhookUrl: env.WEBHOOK_URL,

  defaultApp: "externalMedia",
  defaultFormat: "slin16",
  defaultTransport: "tcp",
  defaultEncapsulation: "audiosocket",
}
