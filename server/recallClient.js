const axios = require("axios");

const recall = axios.create({
  baseURL: "https://us-west-2.recall.ai/api/v1",
  headers: {
    Authorization: `Token ${process.env.RECALL_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 10_000,
});

module.exports = recall;
