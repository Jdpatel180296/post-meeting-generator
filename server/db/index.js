// server/db/index.js
const Knex = require("knex");
const config = require("./knexfile.js");
const env = process.env.NODE_ENV || "development";
const knex = Knex(config[env]);

module.exports = {
  knex,

  async getMeetingById(id) {
    const meeting = await knex("meetings").where({ id }).first();
    if (meeting && meeting.platform_link) {
      meeting.meeting_url = meeting.platform_link;
      delete meeting.platform_link; // Remove platform_link from response
    }
    return meeting;
  },

  async createOrUpdateMeeting(meeting) {
    console.log("[DB] createOrUpdateMeeting received:", {
      id: meeting.id,
      meeting_url: meeting.meeting_url,
    });

    const insert = {
      id: meeting.id,
      user_id: meeting.user_id || null,
      google_account_id: meeting.google_account_id || null,
      summary: meeting.summary || null,
      start_time: meeting.start_time ? new Date(meeting.start_time) : null,
      end_time: meeting.end_time ? new Date(meeting.end_time) : null,
      platform: meeting.platform || "unknown",
      platform_link: meeting.meeting_url || null, // Store meeting_url in platform_link column
      attendees: meeting.attendees ? JSON.stringify(meeting.attendees) : null,
      notetaker_enabled: !!meeting.notetaker_enabled,
    };

    console.log("[DB] Inserting meeting_url:", insert.platform_link);

    // upsert using ON CONFLICT (id)
    await knex.raw(
      `INSERT INTO meetings (${Object.keys(insert).join(
        ","
      )}) VALUES (${Object.keys(insert)
        .map(() => "?")
        .join(",")}) ON CONFLICT (id) DO UPDATE SET ${Object.keys(insert)
        .map((k) => `${k}=EXCLUDED.${k}`)
        .join(",")}`,
      Object.values(insert)
    );
    const saved = await this.getMeetingById(meeting.id);
    console.log("[DB] Saved meeting meeting_url:", saved?.meeting_url);
    return saved;
  },

  async createRecallBot({ meeting_id, recall_bot_id, status = "scheduled" }) {
    return await knex("recall_bots")
      .insert({ meeting_id, recall_bot_id, status })
      .returning("*");
  },

  async listPendingBots() {
    return await knex("recall_bots")
      .whereNot("status", "media_available")
      .select("*");
  },

  async updateBotStatus(recall_bot_id, status) {
    return await knex("recall_bots")
      .where({ recall_bot_id })
      .update({ status, last_checked_at: knex.fn.now() });
  },

  async touchBot(recall_bot_id) {
    return await knex("recall_bots")
      .where({ recall_bot_id })
      .update({ last_checked_at: knex.fn.now() });
  },

  async saveRecallMedia({
    recall_bot_id,
    meeting_id,
    audio_url,
    video_url,
    transcript,
  }) {
    return await knex("recall_media")
      .insert({ recall_bot_id, meeting_id, audio_url, video_url, transcript })
      .returning("*");
  },

  // ===== SOCIAL MEDIA & POSTS =====
  async createUser(email) {
    return await knex("users")
      .insert({ email })
      .onConflict("email")
      .merge()
      .returning("*");
  },

  async getUserByEmail(email) {
    return await knex("users").where({ email }).first();
  },

  async saveSocialMediaAccount({
    user_id,
    platform,
    access_token,
    refresh_token,
    provider_id,
    provider_email,
    token_expires_at,
  }) {
    return await knex("social_media_accounts")
      .insert({
        user_id,
        platform,
        access_token,
        refresh_token,
        provider_id,
        provider_email,
        token_expires_at,
      })
      .onConflict(["user_id", "platform"])
      .merge()
      .returning("*");
  },

  async getSocialMediaAccounts(user_id) {
    return await knex("social_media_accounts").where({ user_id });
  },

  async getSocialMediaAccountByPlatform(user_id, platform) {
    return await knex("social_media_accounts")
      .where({ user_id, platform })
      .first();
  },

  async createAutomation({ user_id, platform, name, prompt, enabled = true }) {
    return await knex("automations")
      .insert({ user_id, platform, name, prompt, enabled })
      .returning("*");
  },

  async getAutomationsByUser(user_id) {
    return await knex("automations").where({ user_id });
  },

  async getAutomationsByUserAndPlatform(user_id, platform) {
    return await knex("automations").where({
      user_id,
      platform,
      enabled: true,
    });
  },

  async updateAutomation(automation_id, updates) {
    return await knex("automations")
      .where({ id: automation_id })
      .update({ ...updates, updated_at: knex.fn.now() })
      .returning("*");
  },

  async deleteAutomation(automation_id) {
    return await knex("automations").where({ id: automation_id }).del();
  },

  async createPost({
    meeting_id,
    automation_id,
    platform,
    content,
    status = "draft",
  }) {
    return await knex("posts")
      .insert({ meeting_id, automation_id, platform, content, status })
      .returning("*");
  },

  async getPostsByMeeting(meeting_id) {
    return await knex("posts").where({ meeting_id });
  },

  async getPostsByMeetingAndPlatform(meeting_id, platform) {
    return await knex("posts").where({ meeting_id, platform });
  },

  async updatePost(post_id, updates) {
    return await knex("posts")
      .where({ id: post_id })
      .update(updates)
      .returning("*");
  },

  async publishPost(post_id, external_post_id) {
    return await knex("posts")
      .where({ id: post_id })
      .update({
        status: "published",
        external_post_id,
        posted_at: knex.fn.now(),
      })
      .returning("*");
  },

  async getUserSettings(user_id) {
    return await knex("user_settings").where({ user_id }).first();
  },

  async saveUserSettings(user_id, settings) {
    return await knex("user_settings")
      .insert({ user_id, ...settings })
      .onConflict("user_id")
      .merge()
      .returning("*");
  },

  async getPastMeetings(user_id) {
    return await knex("meetings")
      .where("start_time", "<", knex.fn.now())
      .andWhere({ user_id })
      .orderBy("start_time", "desc");
  },

  async getMeetingWithMedia(meeting_id) {
    const meeting = await this.getMeetingById(meeting_id);
    if (!meeting) return null;
    const media = await knex("recall_media").where({ meeting_id });
    const transcript = media.length > 0 ? media[0].transcript : null;
    return { ...meeting, transcript, media };
  },

  // ===== NOTETAKER PREFERENCES (Persistent) =====
  async saveNotetakerPreference({ user_email, event_id, enabled }) {
    if (!user_email || !event_id) return null;
    // Only persist if we have a real email (rudimentary check)
    if (!user_email.includes("@")) return null;
    let user = await this.getUserByEmail(user_email);
    if (!user) {
      const created = await this.createUser(user_email);
      // createUser returns an array (due to returning(*)) or object depending on pg version
      user = Array.isArray(created) ? created[0] : created;
    }
    const row = await knex("notetaker_preferences")
      .insert({ user_id: user.id, event_id, enabled })
      .onConflict(["user_id", "event_id"]) // upsert
      .merge({ enabled, updated_at: knex.fn.now() })
      .returning("*");
    return Array.isArray(row) ? row[0] : row;
  },

  async getNotetakerFlagsForUser(user_email) {
    if (!user_email || !user_email.includes("@")) return {};
    const user = await this.getUserByEmail(user_email);
    if (!user) return {};
    const rows = await knex("notetaker_preferences")
      .where({ user_id: user.id })
      .select("event_id", "enabled");
    const flags = {};
    rows.forEach((r) => {
      flags[r.event_id] = !!r.enabled;
    });
    return flags;
  },
};
