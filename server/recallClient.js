const axios = require("axios");

const recall = axios.create({
  baseURL: "https://api.recall.ai/v1",
  headers: {
    Authorization: `Token ${process.env.RECALL_API_KEY}`, // pulled from env
    "Content-Type": "application/json",
  },
  timeout: 10_000,
});

module.exports = recall;
