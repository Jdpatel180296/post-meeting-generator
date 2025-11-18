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
const cors = require("cors");
const axios = require("axios");
let transcribeUrl;
try {
  ({ transcribeUrl } = require("./utils/assemblyClient"));
} catch (e) {
  console.error("[assemblyClient] Failed to load, using stub:", e.message);
  transcribeUrl = async () => ({ text: null, stub: true });
}
const path = require("path");

const app = express();

// Behind Railway/Render proxies, trust the first proxy hop so Express
// correctly recognizes HTTPS via X-Forwarded-Proto and sets secure cookies.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Build allowed origins from env
function buildAllowedOrigins() {
  const list = new Set();
  const normalize = (o) => (o ? o.replace(/\/$/, "") : o); // strip trailing slash
  const push = (v) => {
    if (!v) return;
    list.add(normalize(v));
  };
  // Comma separated list supported
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach(push);
  push(process.env.FRONTEND_URL);
  push(process.env.BACKEND_URL);
  if (process.env.NODE_ENV !== "production") {
    push("http://localhost:3000");
    push("http://localhost:4000");
    push("https://9lrg68wq-3000.usw3.devtunnels.ms");
  }
  return Array.from(list);
}

const allowedOrigins = buildAllowedOrigins();
console.log("[CORS] Allowed origins:", allowedOrigins);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Some non-browser requests have no origin; allow them
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, "");
    const ok = allowedOrigins.includes(normalized);
    if (ok) {
      console.log("[CORS] Allowed origin:", origin);
      return callback(null, true);
    }
    console.warn("[CORS] Blocked origin:", origin, "normalized:", normalized);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  // Let default header whitelist apply; if you need custom headers add them here.
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
};

// Log the CORS origin and incoming Origin for easier diagnostics
app.use((req, res, next) => {
  if (req.headers.origin) {
    console.log("[CORS] Origin:", req.headers.origin);
  }
  next();
});

// Inform caches that responses vary by Origin
app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

// Simple health check early so platform can detect readiness
app.get("/health", (req, res) =>
  res.json({ ok: true, uptime: process.uptime() })
);

app.use(cors(corsOptions));
// Explicitly handle preflight for all routes - use regex to avoid path-to-regexp '*' error
app.options(/.*/, cors(corsOptions));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    // Do not create sessions until something is stored
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      // Required for cross-site cookies when frontend and backend are on different domains
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// === CONFIG - replace these with values from your Google Cloud Console ===
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";
const CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET";
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "https://9lrg68wq-3000.usw3.devtunnels.ms/oauth2callback";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "profile",
  "email",
];

const oauth2ClientFactory = () =>
  new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// In-memory store: map userKey -> array of accounts {id, email, tokens}
// userKey is per-session by default and becomes the user's email after OAuth
const LINKED_ACCOUNTS_STORE = {};

// Helper: per-session/user identity. Before OAuth, assign an anonymous key.
// After OAuth, we set req.session.userKey to the user's email for persistence.
function getUserKey(req) {
  try {
    if (req?.session?.userKey) return req.session.userKey;
    // generate a short anon key and persist in session
    const crypto = require("crypto");
    const anon = `anon-${crypto.randomBytes(8).toString("hex")}`;
    if (req?.session) req.session.userKey = anon;
    return anon;
  } catch (e) {
    // fallback if session missing for some reason
    return "anon-fallback";
  }
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

    // bind session to user's email after successful OAuth
    if (account.email) {
      if (req?.session) req.session.userKey = account.email;
    }

    const userKey = getUserKey(req);
    // allow multiple accounts; avoid duplicate email
    LINKED_ACCOUNTS_STORE[userKey] = LINKED_ACCOUNTS_STORE[userKey] || [];
    const exists = LINKED_ACCOUNTS_STORE[userKey].some(
      (a) => a.email === account.email
    );
    if (!exists) LINKED_ACCOUNTS_STORE[userKey].push(account);

    // redirect back to client app (support both dev and production)
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(
      `${frontendUrl}/?linked=${encodeURIComponent(account.email)}`
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
    const userKey = getUserKey(req);
    let user = await db.getUserByEmail(userKey);
    if (!user) {
      user = await db.createUser(userKey);
    }

    await db.saveSocialMediaAccount({
      user_id: user.id,
      platform: "linkedin",
      access_token: accessToken,
      refresh_token: null,
      provider_id: linkedinId,
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
    const userKey = getUserKey(req);
    let user = await db.getUserByEmail(userKey);
    if (!user) {
      user = await db.createUser(userKey);
    }

    await db.saveSocialMediaAccount({
      user_id: user.id,
      platform: "facebook",
      access_token: accessToken,
      refresh_token: null,
      provider_id: facebookId,
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
    const userKey = getUserKey(req);
    const user = await db.getUserByEmail(userKey);
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
  const userKey = getUserKey(req);
  res.json(LINKED_ACCOUNTS_STORE[userKey] || []);
});

// Fetch upcoming events from all linked accounts
app.get("/api/events", async (req, res) => {
  const userKey = getUserKey(req);
  const accounts = LINKED_ACCOUNTS_STORE[userKey] || [];
  const now = new Date();
  // Start from 24 hours ago to catch events across all timezones
  const timeMinDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  // limit events to a 2-month window to avoid returning events decades in the future
  const timeMaxDate = new Date(now);
  timeMaxDate.setMonth(timeMaxDate.getMonth() + 2);
  const timeMinIso = timeMinDate.toISOString();
  const timeMaxIso = timeMaxDate.toISOString();

  const allEvents = [];
  for (const acct of accounts) {
    const oauth2Client = oauth2ClientFactory();
    oauth2Client.setCredentials(acct.tokens);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    try {
      const resp = await calendar.events.list({
        calendarId: "primary",
        timeMin: timeMinIso,
        timeMax: timeMaxIso,
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

// Debug endpoint: return events plus detected link candidates (hangoutLink, location, conference entryPoints)
app.get("/api/events/debug", async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const accounts = LINKED_ACCOUNTS_STORE[userKey] || [];
    const now = new Date();
    // Start from 24 hours ago to catch events across all timezones
    const timeMinDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // limit events to a 2-month window so debug output stays small and relevant
    const timeMaxDate = new Date(now);
    timeMaxDate.setMonth(timeMaxDate.getMonth() + 2);
    const timeMinIso = timeMinDate.toISOString();
    const timeMaxIso = timeMaxDate.toISOString();

    const allEvents = [];
    for (const acct of accounts) {
      const oauth2Client = oauth2ClientFactory();
      oauth2Client.setCredentials(acct.tokens);
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      try {
        const resp = await calendar.events.list({
          calendarId: "primary",
          timeMin: timeMinIso,
          timeMax: timeMaxIso,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
        });
        const items = resp.data.items || [];
        items.forEach((it) =>
          allEvents.push({ accountEmail: acct.email, event: it })
        );
      } catch (err) {
        console.error("Error fetching events for", acct.email, err.message);
      }
    }

    const debug = allEvents.map(({ accountEmail, event }) => {
      const hangoutLink = event.hangoutLink || null;
      const location = event.location || null;
      let entryPoint = null;
      try {
        const eps = event.conferenceData?.entryPoints || [];
        const ep = eps.find((p) => p.uri || p.entryPointUri || p.label);
        if (ep) entryPoint = ep.uri || ep.entryPointUri || null;
      } catch (e) {
        /* ignore */
      }

      const detected = hangoutLink || location || entryPoint || null;

      // log summary for debugging
      console.log("[Events Debug]", event.id || event.summary, {
        accountEmail,
        hangoutLink: !!hangoutLink,
        location: !!location,
        entryPoint: !!entryPoint,
        detected: !!detected,
      });

      return {
        id: accountEmail + "|" + (event.id || event.summary || Math.random()),
        accountEmail,
        summary: event.summary || "(no title)",
        start: event.start ? event.start.dateTime || event.start.date : null,
        raw: event,
        candidates: { hangoutLink, location, entryPoint },
        detectedLink: detected,
      };
    });

    res.json(debug);
  } catch (err) {
    console.error("Error in /api/events/debug", err);
    res
      .status(500)
      .json({ error: "failed to fetch debug events", details: err?.message });
  }
});

// Debug: return DB state for meetings, recall_bots and recall_media to help diagnose scheduling
app.get("/api/debug/state", async (req, res) => {
  try {
    const db = require("./db");
    const meetings = await db
      .knex("meetings")
      .select(
        "id",
        "summary",
        "start_time",
        "platform",
        "platform_link as meeting_url",
        "notetaker_enabled"
      );
    const bots = await db
      .knex("recall_bots")
      .select(
        "id",
        "meeting_id",
        "recall_bot_id",
        "status",
        "last_checked_at",
        "created_at"
      );
    const media = await db
      .knex("recall_media")
      .select(
        "id",
        "meeting_id",
        "audio_url",
        "video_url",
        "transcript",
        "created_at"
      );
    res.json({ meetings, bots, media });
  } catch (err) {
    console.error("Error in /api/debug/state", err);
    res
      .status(500)
      .json({ error: "failed to fetch debug state", details: err?.message });
  }
});

// schedule recall bot for meeting
app.post("/api/schedule-recall-bot", async (req, res) => {
  try {
    const { meetingId, joinLeadMinutes = 5 } = req.body;
    if (!meetingId) return res.status(400).json({ error: "missing meetingId" });

    const db = require("./db");
    const meeting = await db.getMeetingById(meetingId);
    if (!meeting) return res.status(404).json({ error: "meeting not found" });

    // Log the fields we search for a link on so we can debug source of meeting links
    console.log("[Schedule] fetching link for meetingId=", meetingId, {
      meeting_url: meeting.meeting_url || null,
      location: meeting.location || null,
      summary: meeting.summary || null,
      description: meeting.description || null,
    });

    const { extractPlatformAndLink } = require("./utils/extractPlatform");
    const { platform, link, source } = extractPlatformAndLink(meeting);

    console.log("[Schedule] extractPlatformAndLink result for", meetingId, {
      platform: platform || null,
      link: link || null,
      source: source || null,
    });

    if (!link) return res.status(400).json({ error: "no meeting link found" });

    const joinAt = new Date(
      new Date(meeting.start_time).getTime() - joinLeadMinutes * 60000
    );

    try {
      const recall = require("./recallClient");
      const payload = {
        meeting_url: link,
        bot_name: `Bot for ${meeting.summary || meetingId}`,
      };

      // Debug: Check API key
      const apiKey = process.env.RECALL_API_KEY;
      console.log("[Recall] API Key present:", !!apiKey);
      console.log("[Recall] API Key length:", apiKey?.length);
      console.log("[Recall] API Key first 10 chars:", apiKey?.substring(0, 10));
      console.log("[Recall] Calling API with payload:", payload);

      const r = await recall.post("/bot", payload);
      console.log("[Recall] API response:", r.data);
      const recallBotId = r.data?.id || r.data?.bot?.id;

      await db.createRecallBot({
        meeting_id: meetingId,
        recall_bot_id: recallBotId,
        status: "scheduled",
      });

      return res.json({ ok: true, recallBotId });
    } catch (err) {
      console.error("recall create error", err?.response?.data || err.message);

      // Check if error response is HTML (authentication failure)
      const errorData = err?.response?.data;
      let errorMessage = err.message;

      if (
        typeof errorData === "string" &&
        errorData.includes("<!DOCTYPE html>")
      ) {
        // Extract the error title from HTML if possible
        const titleMatch = errorData.match(/<title>(.*?)<\/title>/);
        const h1Match = errorData.match(/<h1[^>]*>(.*?)<\/h1>/);

        if (titleMatch || h1Match) {
          errorMessage = (
            titleMatch?.[1] ||
            h1Match?.[1] ||
            "Authentication failed"
          ).replace(/<[^>]*>/g, "");
        } else {
          errorMessage =
            "Recall.ai API authentication failed - please check your RECALL_API_KEY";
        }
      }

      return res.status(500).json({
        error: "recall create failed",
        message: errorMessage,
        hint:
          typeof errorData === "string" && errorData.includes("CSRF")
            ? "Invalid or expired API key. Please update RECALL_API_KEY in .env file"
            : undefined,
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

// In-memory cache for instant UI feedback; persisted copy stored in notetaker_preferences.
const NOTETAKER_FLAGS = {};
app.post("/api/toggle-notetaker", async (req, res) => {
  try {
    const { id, enabled } = req.body;
    if (!id) return res.status(400).send("Missing id");
    NOTETAKER_FLAGS[id] = !!enabled;
    // Persist if we have an authenticated user (email userKey)
    const userKey = getUserKey(req);
    try {
      const db = require("./db");
      await db.saveNotetakerPreference({
        user_email: userKey,
        event_id: id,
        enabled: !!enabled,
      });
    } catch (e) {
      console.warn("[Notetaker] persistence skipped:", e.message);
    }
    res.json({
      id,
      enabled: NOTETAKER_FLAGS[id],
      persisted: userKey.includes("@"),
    });
  } catch (err) {
    console.error("/api/toggle-notetaker error", err);
    res.status(500).json({ error: "failed to toggle", details: err.message });
  }
});

app.get("/api/notetaker-flags", async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const db = require("./db");
    const persisted = await db.getNotetakerFlagsForUser(userKey);
    // Merge persisted with in-memory (in-memory wins for current session immediacy)
    const merged = { ...persisted, ...NOTETAKER_FLAGS };
    res.json(merged);
  } catch (err) {
    console.error("/api/notetaker-flags error", err);
    res
      .status(500)
      .json({ error: "failed to load flags", details: err.message });
  }
});

// ===== SOCIAL MEDIA & POSTS ENDPOINTS =====

// Get past meetings
app.get("/api/past-meetings", async (req, res) => {
  try {
    const db = require("./db");
    // Include attendees + platform_link so UI can show participant count and platform logo/link.
    const meetings = await db
      .knex("meetings")
      .leftJoin("recall_media", "meetings.id", "recall_media.meeting_id")
      .select(
        "meetings.id",
        "meetings.summary",
        "meetings.start_time as start",
        "meetings.end_time as end",
        "meetings.platform",
        "meetings.platform_link",
        "meetings.attendees",
        db.knex.raw("recall_media.transcript IS NOT NULL as has_transcript")
      )
      .where("meetings.start_time", "<", db.knex.fn.now())
      .orderBy("meetings.start_time", "desc");

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
    const userKey = getUserKey(req);
    const user = await db.getUserByEmail(userKey);
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
    const userKey = getUserKey(req);
    const user = await db.getUserByEmail(userKey);
    if (!user) return res.json([]);
    const automations = await db.getAutomationsByUser(user.id);
    res.json(automations);
  } catch (err) {
    console.error("Error fetching automations:", err);
    res.status(500).json({ error: "Failed to fetch automations" });
  }
});

// Create or update a meeting record in our DB (used before scheduling a recall bot)
app.post("/api/meetings", async (req, res) => {
  try {
    const meeting = req.body;
    if (!meeting || !meeting.id)
      return res.status(400).json({ error: "meeting id required" });
    const db = require("./db");
    const saved = await db.createOrUpdateMeeting(meeting);
    console.log("[Meetings] saved meeting", {
      id: saved.id,
      meeting_url: saved.meeting_url || null,
      location: saved.location || null,
      summary: saved.summary || null,
    });
    res.json(saved);
  } catch (err) {
    console.error("Error saving meeting:", err);
    res
      .status(500)
      .json({ error: "Failed to save meeting", details: err?.message });
  }
});

// Get recall bots for a meeting (status, timestamps)
app.get("/api/meetings/:id/recall-bots", async (req, res) => {
  try {
    const meeting_id = req.params.id;
    const db = require("./db");
    const bots = await db
      .knex("recall_bots")
      .where({ meeting_id })
      .select("id", "recall_bot_id", "status", "last_checked_at", "created_at");
    res.json(bots || []);
  } catch (err) {
    console.error("Error fetching recall bots:", err);
    res.status(500).json({ error: "Failed to fetch recall bots" });
  }
});

// Create automation
app.post("/api/automations", async (req, res) => {
  try {
    const { platform, name, prompt } = req.body;
    if (!platform || !name)
      return res.status(400).json({ error: "platform and name required" });

    const db = require("./db");
    const userKey = getUserKey(req);
    let user = await db.getUserByEmail(userKey);
    if (!user) {
      user = await db.createUser(userKey);
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
    const userKey = getUserKey(req);
    let user = await db.getUserByEmail(userKey);
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
    const userKey = getUserKey(req);
    let user = await db.getUserByEmail(userKey);
    if (!user) {
      user = await db.createUser(userKey);
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
const HOST = process.env.HOST || "0.0.0.0"; // Bind to all interfaces for Railway
app.listen(PORT, HOST, () =>
  console.log(`Server listening on ${HOST}:${PORT}`)
);

// Export app for testability (supertest) without requiring a live network listener
module.exports = app;

// CORS debug utility endpoint
app.get("/cors-debug", (req, res) => {
  res.json({
    incomingOrigin: req.headers.origin || null,
    allowedOrigins,
    nodeEnv: process.env.NODE_ENV,
  });
});

// Serve static React frontend in production
// If client build/ exists, copy it to server/public and this will serve it
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
// SPA fallback: for any non-API route, serve index.html so React Router can handle client-side routing.
// Use a regex route to avoid path-to-regexp parameter parsing issues (and avoid matching /api/*).
app.get(/^\/(?!api).*/, (req, res) => {
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
