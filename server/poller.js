// server/poller.js
const recall = require("./recallClient");
const db = require("./db");
const { transcribeUrl } = require("./utils/assemblyClient");

async function pollOnce() {
  const bots = await db.listPendingBots();
  for (const b of bots) {
    try {
      const resp = await recall.get(`/bot/${b.recall_bot_id}/`);
      const data = resp.data || {};

      // Get latest status from status_changes array
      const statusChanges = data.status_changes || [];
      const latestStatus =
        statusChanges.length > 0
          ? statusChanges[statusChanges.length - 1].code
          : null;

      if (latestStatus) {
        await db.updateBotStatus(b.recall_bot_id, latestStatus);
        console.log(`[Poller] Bot ${b.recall_bot_id} status: ${latestStatus}`);
      }

      // Check if bot is done and has recordings
      if (
        latestStatus === "done" &&
        data.recordings &&
        data.recordings.length > 0
      ) {
        const recording = data.recordings[0];
        const mediaShortcuts = recording.media_shortcuts || {};

        // Extract video URL from video_mixed
        let videoUrl = null;
        if (mediaShortcuts.video_mixed?.data?.download_url) {
          videoUrl = mediaShortcuts.video_mixed.data.download_url;
        }

        // Extract audio URL - check if audio_mixed exists
        let audioUrl = null;
        if (mediaShortcuts.audio_mixed?.data?.download_url) {
          audioUrl = mediaShortcuts.audio_mixed.data.download_url;
        }

        // Transcribe using AssemblyAI if audio available, otherwise use video
        let transcriptText = null;
        const transcribeFrom = audioUrl || videoUrl;

        if (transcribeFrom) {
          try {
            console.log(
              `[Poller] Transcribing ${audioUrl ? "audio" : "video"} for bot ${
                b.recall_bot_id
              } with AssemblyAI...`
            );
            const assemblyResult = await transcribeUrl(transcribeFrom);
            transcriptText = assemblyResult.text || null;
            console.log(
              `[Poller] Transcription completed for bot ${b.recall_bot_id}`
            );
          } catch (transcribeErr) {
            console.error(
              `[Poller] AssemblyAI transcription failed for bot ${b.recall_bot_id}:`,
              transcribeErr.message
            );
          }
        }

        await db.saveRecallMedia({
          recall_bot_id: b.recall_bot_id,
          meeting_id: b.meeting_id,
          audio_url: audioUrl,
          video_url: videoUrl,
          transcript: transcriptText,
        });
        await db.updateBotStatus(b.recall_bot_id, "media_available");
        console.log(`[Poller] Saved media for bot ${b.recall_bot_id}`);
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
