// server/poller.js
const recall = require("./recallClient");
const db = require("./db");

async function pollOnce() {
  const bots = await db.listPendingBots();
  for (const b of bots) {
    try {
      const resp = await recall.get(`/bots/${b.recall_bot_id}`);
      const data = resp.data || {};
      const mediaStatus = data.media_status || data.status;

      if (mediaStatus) {
        await db.updateBotStatus(b.recall_bot_id, mediaStatus);
      }

      if (
        mediaStatus === "available" ||
        (data.media && Object.keys(data.media).length)
      ) {
        const media = data.media || {};
        await db.saveRecallMedia({
          recall_bot_id: b.recall_bot_id,
          meeting_id: b.meeting_id,
          audio_url: media.audio_url,
          video_url: media.video_url,
          transcript: media.transcript_text || media.transcript_url || null,
        });
        await db.updateBotStatus(b.recall_bot_id, "media_available");
      }

      await db.touchBot(b.recall_bot_id);
    } catch (err) {
      console.error(
        "poll error for",
        b.recall_bot_id,
        err?.response?.data || err.message
      );
    }
  }
}

async function start(intervalMs = 60_000) {
  await pollOnce();
  setInterval(pollOnce, intervalMs);
}

module.exports = { start };
