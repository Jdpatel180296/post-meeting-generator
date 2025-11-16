// server/utils/aiClient.js
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateSocialPost({
  transcript,
  platform,
  customPrompt,
  meetingSummary,
}) {
  if (!openai.apiKey) {
    throw new Error("OPENAI_API_KEY not set in environment");
  }

  const systemPrompt = `You are an expert social media content writer. Generate a compelling, professional social media post based on the provided meeting transcript and custom instructions.
Platform: ${platform}
Keep the tone appropriate for the platform (LinkedIn is professional, Facebook can be more casual/friendly).
Keep posts concise and engaging.
${customPrompt ? `Additional instructions: ${customPrompt}` : ""}`;

  const userMessage = `Meeting transcript:\n${transcript}\n\n${
    meetingSummary ? `Meeting summary: ${meetingSummary}` : ""
  }
  
Please generate an engaging social media post for ${platform} based on the meeting. Include relevant hashtags if appropriate for the platform.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || "";
  } catch (err) {
    console.error("OpenAI error:", err);
    throw err;
  }
}

async function generateFollowUpEmail({ transcript, meetingSummary }) {
  if (!openai.apiKey) {
    throw new Error("OPENAI_API_KEY not set in environment");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are an expert at writing professional follow-up emails after meetings. Generate a concise, friendly follow-up email that recaps what was discussed.",
      },
      {
        role: "user",
        content: `Meeting transcript:\n${transcript}\n\n${
          meetingSummary ? `Meeting summary: ${meetingSummary}` : ""
        }\n\nPlease generate a professional follow-up email that summarizes the meeting discussion and next steps.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 800,
  });

  return response.choices[0]?.message?.content || "";
}

module.exports = {
  generateSocialPost,
  generateFollowUpEmail,
};
