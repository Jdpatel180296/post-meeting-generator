require("dotenv").config();
// Global error handlers to surface unexpected errors that cause the process to exit
process.on("unhandledRejection", (reason, promise) => {
  try {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  } catch (e) {
    console.error("UnhandledRejection logging failed", e);
  }
});

process.on("uncaughtException", (err) => {
  try {
    console.error("Uncaught Exception:", err && err.stack ? err.stack : err);
  } catch (e) {
    console.error("uncaughtException logging failed", e);
  }
  // keep default behavior (exit) after logging so it's obvious something broke
  process.exit(1);
});
const express = require("express");
const session = require("express-session");
const { google } = require("googleapis");
const bodyParser = require("body-parser");
const axios = require("axios");
const { transcribeUrl } = require("./utils/assemblyClient");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(
  session({ secret: "dev-secret", resave: false, saveUninitialized: true })
);

// === CONFIG - replace these with values from your Google Cloud Console ===
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";
const CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET";
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/oauth2callback";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "profile",
  "email",
];

const oauth2ClientFactory = () =>
  new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// In-memory store: map demoUserId -> array of accounts {id, email, tokens}
const LINKED_ACCOUNTS_STORE = {
  // demo user id 1 for everyone in this demo
  "demo-user": [],
};

// Helper: get demo user id (in prod use real auth)
function getDemoUserId(req) {
  return "demo-user";
}

app.get("/auth/url", (req, res) => {
  const oauth2Client = oauth2ClientFactory();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  res.json({ url });
});

// OAuth2 callback
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");
  const oauth2Client = oauth2ClientFactory();
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // get user's profile/email
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const profile = await oauth2.userinfo.get();
    const account = { id: profile.data.id, email: profile.data.email, tokens };

    const demoUser = getDemoUserId(req);
    // allow multiple accounts; avoid duplicate email
    LINKED_ACCOUNTS_STORE[demoUser] = LINKED_ACCOUNTS_STORE[demoUser] || [];
    const exists = LINKED_ACCOUNTS_STORE[demoUser].some(
      (a) => a.email === account.email
    );
    if (!exists) LINKED_ACCOUNTS_STORE[demoUser].push(account);

    // redirect back to client app (client should be running at :3000)
    return res.redirect(
      "http://localhost:3000/?linked=" + encodeURIComponent(account.email)
    );
  } catch (err) {
    console.error(err);
    return res.status(500).send("OAuth error");
  }
});

// ===== LINKEDIN OAUTH =====

// LinkedIn auth URL
app.get("/api/auth/linkedin", (req, res) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID || "your_linkedin_client_id";
  const redirectUri = encodeURIComponent(
    process.env.LINKEDIN_REDIRECT_URI ||
      "http://localhost:4000/api/auth/linkedin/callback"
  );
  const scope = encodeURIComponent("w_member_social");
  const state = Math.random().toString(36).substring(7);

  // Store state for verification
  if (!global.oauthStates) global.oauthStates = {};
  global.oauthStates[state] = { platform: "linkedin", timestamp: Date.now() };

  const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
  res.json({ url });
});

// LinkedIn callback
app.get("/api/auth/linkedin/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`http://localhost:3000/settings?error=${error}`);
  }

  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  // Verify state
  if (!global.oauthStates?.[state]) {
    return res.status(400).send("Invalid state");
  }
  delete global.oauthStates[state];

  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

    const tokenResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      null,
      {
        params: {
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    const expiresIn = tokenResponse.data.expires_in;

    // Get LinkedIn profile
    const profileResponse = await axios.get("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const linkedinId = profileResponse.data.id;

    // Save to database
    const db = require("./db");
    const demoUser = getDemoUserId(req);
    let user = await db.getUserByEmail(demoUser);
    if (!user) {
      user = await db.createUser(demoUser);
    }

    await db.saveSocialMediaAccount({
      user_id: user.id,
      platform: "linkedin",
      access_token: accessToken,
      refresh_token: null,
      platform_user_id: linkedinId,
      expires_at: new Date(Date.now() + expiresIn * 1000),
    });

    return res.redirect(
      `http://localhost:3000/settings?success=LinkedIn connected!`
    );
  } catch (err) {
    console.error("LinkedIn OAuth error:", err.message);
    return res.redirect(
      `http://localhost:3000/settings?error=LinkedIn connection failed`
    );
  }
});

// ===== FACEBOOK OAUTH =====

// Facebook auth URL
app.get("/api/auth/facebook", (req, res) => {
  const appId = process.env.FACEBOOK_APP_ID || "your_facebook_app_id";
  const redirectUri = encodeURIComponent(
    process.env.FACEBOOK_REDIRECT_URI ||
      "http://localhost:4000/api/auth/facebook/callback"
  );
  const scope = encodeURIComponent(
    "pages_manage_posts,pages_manage_metadata,pages_read_engagement"
  );
  const state = Math.random().toString(36).substring(7);

  // Store state for verification
  if (!global.oauthStates) global.oauthStates = {};
  global.oauthStates[state] = { platform: "facebook", timestamp: Date.now() };

  const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&display=popup`;
  res.json({ url });
});

// Facebook callback
app.get("/api/auth/facebook/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`http://localhost:3000/settings?error=${error}`);
  }

  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  // Verify state
  if (!global.oauthStates?.[state]) {
    return res.status(400).send("Invalid state");
  }
  delete global.oauthStates[state];

  try {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

    // Get access token
    const tokenResponse = await axios.get(
      "https://graph.facebook.com/v18.0/oauth/access_token",
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get Facebook user profile
    const profileResponse = await axios.get(
      "https://graph.facebook.com/v18.0/me",
      {
        params: {
          access_token: accessToken,
          fields: "id,name",
        },
      }
    );

    const facebookId = profileResponse.data.id;

    // Save to database
    const db = require("./db");
    const demoUser = getDemoUserId(req);
    let user = await db.getUserByEmail(demoUser);
    if (!user) {
      user = await db.createUser(demoUser);
    }

    await db.saveSocialMediaAccount({
      user_id: user.id,
      platform: "facebook",
      access_token: accessToken,
      refresh_token: null,
      platform_user_id: facebookId,
      expires_at: null,
    });

    return res.redirect(
      `http://localhost:3000/settings?success=Facebook connected!`
    );
  } catch (err) {
    console.error("Facebook OAuth error:", err.message);
    return res.redirect(
      `http://localhost:3000/settings?error=Facebook connection failed`
    );
  }
});

// Disconnect social account
app.delete("/api/social-accounts/:platform", async (req, res) => {
  try {
    const { platform } = req.params;
    if (!["linkedin", "facebook"].includes(platform)) {
      return res.status(400).json({ error: "Invalid platform" });
    }

    const db = require("./db");
    const demoUser = getDemoUserId(req);
    const user = await db.getUserByEmail(demoUser);
    if (!user) return res.status(404).json({ error: "User not found" });

    await db
      .knex("social_media_accounts")
      .where({ user_id: user.id, platform })
      .delete();

    res.json({ ok: true, message: `${platform} account disconnected` });
  } catch (err) {
    console.error("Error disconnecting account:", err);
    res.status(500).json({ error: "Failed to disconnect account" });
  }
});

// AssemblyAI transcription adapter
// POST /api/transcribe-assembly
// body: { audio_url: string, meeting_id: string }
app.post("/api/transcribe-assembly", async (req, res) => {
  try {
    const { audio_url, meeting_id } = req.body;
    if (!audio_url || !meeting_id)
      return res
        .status(400)
        .json({ error: "audio_url and meeting_id required" });

    // run transcription
    const result = await transcribeUrl(audio_url);
    const transcriptText = result.text || null;

    // persist to recall_media table so UI can pick it up via getMeetingWithMedia
    const db = require("./db");
    await db.saveRecallMedia({
      recall_bot_id: null,
      meeting_id,
      audio_url,
      video_url: null,
      transcript: transcriptText,
    });

    res.json({ ok: true, transcript: transcriptText, raw: result });
  } catch (err) {
    console.error(
      "AssemblyAI transcription error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({
      error: "Transcription failed",
      details: err?.message || String(err),
    });
  }
});

// List connected accounts
app.get("/api/accounts", (req, res) => {
  const demoUser = getDemoUserId(req);
  res.json(LINKED_ACCOUNTS_STORE[demoUser] || []);
});

// Fetch upcoming events from all linked accounts
app.get("/api/events", async (req, res) => {
  const demoUser = getDemoUserId(req);
  const accounts = LINKED_ACCOUNTS_STORE[demoUser] || [];
  const now = new Date().toISOString();

  const allEvents = [];
  for (const acct of accounts) {
    const oauth2Client = oauth2ClientFactory();
    oauth2Client.setCredentials(acct.tokens);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    try {
      const resp = await calendar.events.list({
        calendarId: "primary",
        timeMin: now,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 50,
      });
      const items = resp.data.items || [];
      // attach account email to each event so frontend can attribute and toggle
      items.forEach((it) =>
        allEvents.push({ accountEmail: acct.email, event: it })
      );
    } catch (err) {
      console.error("Error fetching events for", acct.email, err.message);
    }
  }
  // simple normalized format
  const normalized = allEvents.map(({ accountEmail, event }) => ({
    id: accountEmail + "|" + (event.id || event.summary || Math.random()),
    accountEmail,
    summary: event.summary || "(no title)",
    start: event.start ? event.start.dateTime || event.start.date : null,
    end: event.end ? event.end.dateTime || event.end.date : null,
    hangoutLink: event.hangoutLink || null,
    raw: event,
  }));

  res.json(normalized);
});

// schedule recall bot for meeting
app.post("/api/schedule-recall-bot", async (req, res) => {
  try {
    const { meetingId, joinLeadMinutes = 5 } = req.body;
    if (!meetingId) return res.status(400).json({ error: "missing meetingId" });

    const db = require("./db");
    const meeting = await db.getMeetingById(meetingId);
    if (!meeting) return res.status(404).json({ error: "meeting not found" });

    const { extractPlatformAndLink } = require("./utils/extractPlatform");
    const { platform, link } = extractPlatformAndLink(meeting);
    if (!link) return res.status(400).json({ error: "no meeting link found" });

    const joinAt = new Date(
      new Date(meeting.start_time).getTime() - joinLeadMinutes * 60000
    );

    try {
      const recall = require("./recallClient");
      const payload = {
        join_url: link,
        call_id: meetingId,
        join_at: joinAt.toISOString(),
      };
      const r = await recall.post("/bots/create_join_bot", payload);
      const recallBotId = r.data?.bot?.id || r.data?.id;

      await db.createRecallBot({
        meeting_id: meetingId,
        recall_bot_id: recallBotId,
        status: "scheduled",
      });

      return res.json({ ok: true, recallBotId });
    } catch (err) {
      console.error("recall create error", err?.response?.data || err.message);
      return res.status(500).json({
        error: "recall create failed",
        details: err?.response?.data || err.message,
      });
    }
  } catch (err) {
    console.error(
      "/api/schedule-recall-bot handler error",
      err && err.stack ? err.stack : err
    );
    return res.status(500).json({
      error: "internal server error",
      details: err?.message || String(err),
    });
  }
});

// In-memory notetaker flags: eventId -> boolean
const NOTETAKER_FLAGS = {};
app.post("/api/toggle-notetaker", (req, res) => {
  const { id, enabled } = req.body;
  if (!id) return res.status(400).send("Missing id");
  NOTETAKER_FLAGS[id] = !!enabled;
  res.json({ id, enabled: NOTETAKER_FLAGS[id] });
});

app.get("/api/notetaker-flags", (req, res) => {
  res.json(NOTETAKER_FLAGS);
});

// ===== SOCIAL MEDIA & POSTS ENDPOINTS =====

// Get past meetings
app.get("/api/past-meetings", async (req, res) => {
  try {
    const db = require("./db");
    // In production, would get user_id from real auth
    const demoUser = getDemoUserId(req);
    const meetings = await db.getPastMeetings(demoUser);
    res.json(meetings);
  } catch (err) {
    console.error("Error fetching past meetings:", err);
    res.status(500).json({ error: "Failed to fetch past meetings" });
  }
});

// Get meeting with transcript and media
app.get("/api/meetings/:id", async (req, res) => {
  try {
    const db = require("./db");
    const meeting = await db.getMeetingWithMedia(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json(meeting);
  } catch (err) {
    console.error("Error fetching meeting:", err);
    res.status(500).json({ error: "Failed to fetch meeting" });
  }
});

// Generate social media post
app.post("/api/generate-post", async (req, res) => {
  try {
    const { meeting_id, platform, automation_id } = req.body;
    if (!meeting_id || !platform)
      return res
        .status(400)
        .json({ error: "meeting_id and platform required" });

    const db = require("./db");
    const meeting = await db.getMeetingWithMedia(meeting_id);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    if (!meeting.transcript)
      return res
        .status(400)
        .json({ error: "No transcript available for this meeting" });

    const { generateSocialPost } = require("./utils/aiClient");

    let customPrompt = "";
    if (automation_id) {
      const automation = await db
        .knex("automations")
        .where({ id: automation_id })
        .first();
      customPrompt = automation?.prompt || "";
    }

    const postContent = await generateSocialPost({
      transcript: meeting.transcript,
      platform,
      customPrompt,
      meetingSummary: meeting.summary,
    });

    // Save post to DB
    const post = await db.createPost({
      meeting_id,
      automation_id: automation_id || null,
      platform,
      content: postContent,
      status: "draft",
    });

    res.json(post);
  } catch (err) {
    console.error("Error generating post:", err);
    res.status(500).json({
      error: "Failed to generate post",
      details: err?.message || String(err),
    });
  }
});

// Generate follow-up email
app.post("/api/generate-followup-email", async (req, res) => {
  try {
    const { meeting_id } = req.body;
    if (!meeting_id)
      return res.status(400).json({ error: "meeting_id required" });

    const db = require("./db");
    const meeting = await db.getMeetingWithMedia(meeting_id);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    if (!meeting.transcript)
      return res
        .status(400)
        .json({ error: "No transcript available for this meeting" });

    const { generateFollowUpEmail } = require("./utils/aiClient");
    const emailContent = await generateFollowUpEmail({
      transcript: meeting.transcript,
      meetingSummary: meeting.summary,
    });

    res.json({ email: emailContent });
  } catch (err) {
    console.error("Error generating email:", err);
    res.status(500).json({
      error: "Failed to generate email",
      details: err?.message || String(err),
    });
  }
});

// Get posts for a meeting
app.get("/api/meetings/:id/posts", async (req, res) => {
  try {
    const db = require("./db");
    const posts = await db.getPostsByMeeting(req.params.id);
    res.json(posts);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Get social media accounts for user
app.get("/api/social-accounts", async (req, res) => {
  try {
    const db = require("./db");
    const demoUser = getDemoUserId(req);
    const user = await db.getUserByEmail(demoUser);
    if (!user) return res.json([]);
    const accounts = await db.getSocialMediaAccounts(user.id);
    res.json(accounts);
  } catch (err) {
    console.error("Error fetching social accounts:", err);
    res.status(500).json({ error: "Failed to fetch social accounts" });
  }
});

// Get automations for user
app.get("/api/automations", async (req, res) => {
  try {
    const db = require("./db");
    const demoUser = getDemoUserId(req);
    const user = await db.getUserByEmail(demoUser);
    if (!user) return res.json([]);
    const automations = await db.getAutomationsByUser(user.id);
    res.json(automations);
  } catch (err) {
    console.error("Error fetching automations:", err);
    res.status(500).json({ error: "Failed to fetch automations" });
  }
});

// Create automation
app.post("/api/automations", async (req, res) => {
  try {
    const { platform, name, prompt } = req.body;
    if (!platform || !name)
      return res.status(400).json({ error: "platform and name required" });

    const db = require("./db");
    const demoUser = getDemoUserId(req);
    let user = await db.getUserByEmail(demoUser);
    if (!user) {
      user = await db.createUser(demoUser);
    }

    const automation = await db.createAutomation({
      user_id: user.id,
      platform,
      name,
      prompt,
    });

    res.json({ automation });
  } catch (err) {
    console.error("Error creating automation:", err);
    res.status(500).json({ error: "Failed to create automation" });
  }
});

// Delete automation
app.delete("/api/automations/:id", async (req, res) => {
  try {
    const automation_id = req.params.id;
    const db = require("./db");
    await db.deleteAutomation(automation_id);
    res.json({ ok: true, message: "Automation deleted" });
  } catch (err) {
    console.error("Error deleting automation:", err);
    res.status(500).json({ error: "Failed to delete automation" });
  }
});

// Publish post to social media
app.post("/api/posts/:id/publish", async (req, res) => {
  try {
    const post_id = req.params.id;
    const db = require("./db");

    const post = await db.knex("posts").where({ id: post_id }).first();
    if (!post) return res.status(404).json({ error: "Post not found" });

    // In real implementation, would call LinkedIn/Facebook API here
    // For now, just mark as published
    const updated = await db.publishPost(post_id, "social-post-" + post_id);

    res.json({
      ok: true,
      message: "Post published successfully",
      post: updated[0] || post,
    });
  } catch (err) {
    console.error("Error publishing post:", err);
    res.status(500).json({
      error: "Failed to publish post",
      details: err?.message || String(err),
    });
  }
});

// Get user settings
app.get("/api/settings", async (req, res) => {
  try {
    const db = require("./db");
    const demoUser = getDemoUserId(req);
    let user = await db.getUserByEmail(demoUser);
    if (!user) return res.json({ join_lead_minutes: 5 });
    const settings = await db.getUserSettings(user.id);
    res.json(settings || { join_lead_minutes: 5 });
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Update user settings
app.post("/api/settings", async (req, res) => {
  try {
    const { join_lead_minutes } = req.body;
    const db = require("./db");
    const demoUser = getDemoUserId(req);
    let user = await db.getUserByEmail(demoUser);
    if (!user) {
      user = await db.createUser(demoUser);
    }

    const settings = await db.saveUserSettings(user.id, { join_lead_minutes });
    res.json(settings);
  } catch (err) {
    console.error("Error updating settings:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Generic express error handler to log errors and avoid silent crashes
app.use((err, req, res, next) => {
  console.error("Express error:", err && err.stack ? err.stack : err);
  try {
    res.status(500).json({
      error: "internal server error",
      details: err?.message || String(err),
    });
  } catch (e) {
    // if sending the response fails, at least log it
    console.error("Error sending error response", e);
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Server listening on", PORT));

// Serve static React frontend in production
// If client build/ exists, copy it to server/public and this will serve it
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
// SPA fallback: for any route not matched by API, serve index.html
// This allows React Router to handle client-side routing
app.get("*", (req, res) => {
  const indexPath = path.join(publicPath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      // if index.html doesn't exist, just return 404
      res.status(404).send("Not Found");
    }
  });
});

// Start the poller to fetch Recall.ai bot results and transcripts.
// Run it after the server is listening so db and other modules are ready.
try {
  const poller = require("./poller");
  // start with default interval (60s). In dev you can override by passing ms.
  poller.start().then(() => console.log("Poller started"));
} catch (err) {
  console.error("Failed to start poller:", err && err.stack ? err.stack : err);
}
