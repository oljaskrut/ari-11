module.exports = {
  apps: [
    {
      name: "ari-11", // Choose a name for your main app service
      script: "dist/index.js", // Path to the entry file for the main app
      watch: ["dist"], // Watch the 'dist' directory for changes and restart
    },
    {
      name: "audiosocket", // Choose a name for your RTP server service
      script: "dist/rtp-server.js", // Path to the entry file for the RTP server
      watch: ["dist"], // Watch the 'dist' directory for changes and restart
    },
  ],
}
