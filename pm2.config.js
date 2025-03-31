module.exports = {
  apps: [
    {
      name: "ari-11",
      script: "src/index.ts",
      interpreter: "bun",
      watch: ["src"],
      env: {
        AGENT_ID: "",
        ARI_USER: "",
        ARI_PASS: "",
        WEBHOOK_URL: "",
      },
    },
    {
      name: "audiosocket",
      script: "src/rtp-server.ts",
      watch: ["src"],
    },
  ],
}
