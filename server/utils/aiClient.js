// server/utils/aiClient.js
const axios = require("axios");

// Ollama configuration
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";

async function callOllamaChat(messages, opts = {}) {
  if (!OLLAMA_URL) {
    throw new Error("OLLAMA_URL not configured in environment");
  }

  try {
    const res = await axios.post(
      `${OLLAMA_URL}/api/chat`,
      {
        model: OLLAMA_MODEL,
        messages,
        ...opts,
      },
      { timeout: 120000 }
    );

    // Ollama's chat API typically returns { choices: [ { message: { content } } ] }
    if (res.data?.choices?.[0]?.message?.content) {
      return res.data.choices[0].message.content;
    }

    // Fallbacks for different response shapes
    if (typeof res.data === "string") return res.data;
    if (res.data?.text) return res.data.text;
    return JSON.stringify(res.data);
  } catch (err) {
    console.error("Ollama error:", err?.response?.data || err.message);
    throw err;
  }
}

async function generateSocialPost({
  transcript,
  platform,
  customPrompt,
  meetingSummary,
}) {
  const systemPrompt = `You are an expert social media content writer. Generate a compelling, professional social media post based on the provided meeting transcript and custom instructions.\nPlatform: ${platform}\nKeep the tone appropriate for the platform (LinkedIn is professional, Facebook can be more casual/friendly).\nKeep posts concise and engaging.${
    customPrompt ? ` Additional instructions: ${customPrompt}` : ""
  }`;

  const userMessage = `Meeting transcript:\n${transcript}\n\n${
    meetingSummary ? `Meeting summary: ${meetingSummary}` : ""
  }\n\nPlease generate an engaging social media post for ${platform} based on the meeting. Include relevant hashtags if appropriate for the platform.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const text = await callOllamaChat(messages, {
    max_tokens: 500,
    temperature: 0.7,
  });
  return (text || "").toString();
}

async function generateFollowUpEmail({ transcript, meetingSummary }) {
  const system =
    "You are an expert at writing professional follow-up emails after meetings. Generate a concise, friendly follow-up email that recaps what was discussed.";
  const user = `Meeting transcript:\n${transcript}\n\n${
    meetingSummary ? `Meeting summary: ${meetingSummary}` : ""
  }\n\nPlease generate a professional follow-up email that summarizes the meeting discussion and next steps.`;

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const text = await callOllamaChat(messages, {
    max_tokens: 800,
    temperature: 0.7,
  });
  return (text || "").toString();
}

module.exports = {
  generateSocialPost,
  generateFollowUpEmail,
};
