const axios = require("axios");

function getRecallClient() {
  return axios.create({
    baseURL: "https://us-west-2.recall.ai/api/v1",
    headers: {
      Authorization: `Token ${(process.env.RECALL_API_KEY || "").trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 10_000,
  });
}

// Export the client - will be created fresh each time or cached
let cachedClient = null;
module.exports = new Proxy(
  {},
  {
    get(target, prop) {
      if (!cachedClient) {
        cachedClient = getRecallClient();
      }
      return cachedClient[prop];
    },
  }
);
