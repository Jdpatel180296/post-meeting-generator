// server/db/migrations/20251115_01_init.js
exports.up = async function (knex) {
  // Ensure idempotency if re-run: create extension safely
  try {
    await knex.raw('create extension if not exists "pgcrypto"');
  } catch (e) {
    // ignore if extension creation fails due to permissions; gen_random_uuid may still be available
  }
  // Ensure pgcrypto is available for gen_random_uuid()
  await knex.raw('create extension if not exists "pgcrypto"');

  // users
  const hasUsers = await knex.schema.hasTable("users");
  if (!hasUsers) {
    await knex.schema.createTable("users", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.text("email").unique().notNullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  // google accounts
  const hasGoogle = await knex.schema.hasTable("google_accounts");
  if (!hasGoogle) {
    await knex.schema.createTable("google_accounts", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.uuid("user_id").references("id").inTable("users");
      t.text("google_user_id");
      t.text("email");
      t.text("access_token");
      t.text("refresh_token");
      t.text("scope");
      t.timestamp("token_expires_at");
      t.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  // meetings
  const hasMeetings = await knex.schema.hasTable("meetings");
  if (!hasMeetings) {
    await knex.schema.createTable("meetings", (t) => {
      t.text("id").primary();
      t.uuid("user_id").references("id").inTable("users");
      t.uuid("google_account_id").references("id").inTable("google_accounts");
      t.text("summary");
      t.timestamp("start_time");
      t.timestamp("end_time");
      t.text("platform");
      t.text("platform_link");
      t.jsonb("attendees");
      t.boolean("notetaker_enabled").defaultTo(false);
      t.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  // recall_bots
  const hasBots = await knex.schema.hasTable("recall_bots");
  if (!hasBots) {
    await knex.schema.createTable("recall_bots", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.text("meeting_id").references("id").inTable("meetings");
      t.text("recall_bot_id").notNullable();
      t.text("status");
      t.timestamp("last_checked_at");
      t.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  // recall_media
  const hasMedia = await knex.schema.hasTable("recall_media");
  if (!hasMedia) {
    await knex.schema.createTable("recall_media", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.text("recall_bot_id");
      t.text("meeting_id");
      t.text("audio_url");
      t.text("video_url");
      t.text("transcript");
      t.timestamp("fetched_at").defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("recall_media");
  await knex.schema.dropTableIfExists("recall_bots");
  await knex.schema.dropTableIfExists("meetings");
  await knex.schema.dropTableIfExists("google_accounts");
  await knex.schema.dropTableIfExists("users");
};
