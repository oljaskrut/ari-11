export const env = {
  HOST: process.env.ASTERISK_HOST ?? "127.0.0.1",
  AUDIO_SOCKET_PORT: 9999,
  ARI_PORT: 8088,
  WEB_SOCKET_PORT: 8081,
  ARI_USER: process.env.ARI_USER ?? "",
  ARI_PASS: process.env.ARI_PASS ?? "",
  AGENT_ID: process.env.AGENT_ID ?? "",
}

export const vars = {
  ariUrl: `http://${env.HOST}:${env.ARI_PORT}`,
  ariUser: env.ARI_USER,
  ariPassword: env.ARI_PASS,
  audioSocketHost: `${env.HOST}:${env.AUDIO_SOCKET_PORT}`,
  webSocketUrl: `ws://${env.HOST}:${env.WEB_SOCKET_PORT}`,
  dialString: "PJSIP/702@kcell",

  elevenLabsUrl: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${env.AGENT_ID}`,
}
