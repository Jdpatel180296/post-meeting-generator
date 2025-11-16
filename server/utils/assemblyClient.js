const axios = require("axios");

const ASSEMBLY_API_KEY = process.env.ASSEMBLY_API_KEY;
if (!ASSEMBLY_API_KEY) {
  console.warn(
    "ASSEMBLY_API_KEY not set; assemblyClient will not work until provided"
  );
}

const client = axios.create({
  baseURL: "https://api.assemblyai.com/v2",
  headers: {
    Authorization: `Bearer ${ASSEMBLY_API_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 60_000,
});

async function transcribeUrl(audioUrl) {
  if (!ASSEMBLY_API_KEY) throw new Error("ASSEMBLY_API_KEY is not configured");

  // Create transcript
  const resp = await client.post("/transcript", { audio_url: audioUrl });
  const transcriptId = resp.data.id;

  // Poll for completion
  while (true) {
    const r = await client.get(`/transcript/${transcriptId}`);
    const status = r.data.status;
    if (status === "completed") {
      return r.data;
    }
    if (status === "error") {
      throw new Error(
        "AssemblyAI transcription error: " + (r.data.error || "unknown")
      );
    }
    // wait and poll again
    await new Promise((res) => setTimeout(res, 3000));
  }
}

module.exports = { transcribeUrl };
