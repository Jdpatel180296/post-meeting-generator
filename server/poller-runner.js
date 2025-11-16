// server/poller-runner.js
const poller = require("./poller");
poller.start(parseInt(process.env.POLL_INTERVAL_MS || "60000"));
console.log("Poller started");
