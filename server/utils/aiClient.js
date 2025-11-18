// server/utils/aiClient.js
const OpenAI = require("openai");

// Try OpenAI first, fallback to Ollama if OpenAI key not available
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";
const USE_OPENAI = OPENAI_API_KEY && !OPENAI_API_KEY.includes("sk_...");

let openai;
if (USE_OPENAI) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
}

async function callAI(messages, opts = {}) {
  if (USE_OPENAI) {
    try {
      const response = await openai.chat.completions.create({
        model: opts.model || "gpt-3.5-turbo",
        messages,
        max_tokens: opts.max_tokens || 500,
        temperature: opts.temperature || 0.7,
      });
      return response.choices[0]?.message?.content || "";
    } catch (err) {
      console.error("OpenAI error:", err.message);
      throw new Error(`OpenAI API error: ${err.message}`);
    }
  } else {
    // Fallback to Ollama
    const axios = require("axios");
    try {
      const res = await axios.post(
        `${OLLAMA_URL}/api/chat`,
        {
          model: OLLAMA_MODEL,
          messages,
          stream: false,
        },
        { timeout: 120000 }
      );

      // Ollama returns { message: { content } }
      if (res.data?.message?.content) {
        return res.data.message.content;
      }
      return res.data?.response || JSON.stringify(res.data);
    } catch (err) {
      console.error("Ollama error:", err?.response?.data || err.message);

      // If both OpenAI and Ollama are unavailable, return a helpful demo response
      if (process.env.NODE_ENV === "development") {
        console.warn("Using mock AI response for development");
        const userMessage =
          messages.find((m) => m.role === "user")?.content || "";
        if (userMessage.includes("follow-up email")) {
          return `Subject: Follow-up from our recent meeting\n\nHi team,\n\nThank you for taking the time to meet today. I wanted to follow up on our discussion and summarize the key points:\n\n${
            userMessage.includes("transcript")
              ? "Based on our conversation, we covered several important topics and identified next steps for moving forward."
              : ""
          }\n\nPlease let me know if you have any questions or need clarification on any points discussed.\n\nBest regards`;
        } else {
          return `Excited to share insights from our recent meeting! 🚀\n\nKey takeaways:\n✅ Productive discussion on project goals\n✅ Identified next steps and action items\n✅ Great collaboration and teamwork\n\n#teamwork #productivity #collaboration`;
        }
      }

      throw new Error(
        `AI service not available. Please configure OPENAI_API_KEY in your .env file or start Ollama locally.`
      );
    }
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

  const text = await callAI(messages, {
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

  const text = await callAI(messages, {
    max_tokens: 800,
    temperature: 0.7,
  });
  return (text || "").toString();
}

module.exports = {
  generateSocialPost,
  generateFollowUpEmail,
};
