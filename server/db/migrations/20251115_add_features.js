// server/db/migrations/20251115_add_features.js
exports.up = async function (knex) {
  // Social media accounts (LinkedIn, Facebook credentials)
  await knex.schema.createTable("social_media_accounts", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id").references("id").inTable("users").notNullable();
    t.text("platform").notNullable(); // "linkedin" or "facebook"
    t.text("access_token").notNullable();
    t.text("refresh_token");
    t.text("provider_id").notNullable(); // LinkedIn user ID or Facebook user ID
    t.text("provider_email");
    t.timestamp("token_expires_at");
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.unique(["user_id", "platform"]); // One account per platform per user
  });

  // Automations (rules for generating posts per platform)
  await knex.schema.createTable("automations", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id").references("id").inTable("users").notNullable();
    t.text("platform").notNullable(); // "linkedin" or "facebook"
    t.text("name").notNullable(); // e.g., "Marketing Post for LinkedIn"
    t.text("prompt").notNullable(); // Custom prompt for AI post generation
    t.boolean("enabled").defaultTo(true);
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());
  });

  // Generated posts (AI-generated content ready to publish)
  await knex.schema.createTable("posts", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.text("meeting_id").references("id").inTable("meetings");
    t.uuid("automation_id").references("id").inTable("automations");
    t.text("platform").notNullable(); // "linkedin" or "facebook"
    t.text("content").notNullable(); // Generated post text
    t.text("status").defaultTo("draft"); // "draft" or "published"
    t.text("external_post_id"); // ID returned by LinkedIn/Facebook after posting
    t.timestamp("posted_at");
    t.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // User settings (join lead time, preferences)
  await knex.schema.createTable("user_settings", (t) => {
    t.uuid("user_id").primary().references("id").inTable("users");
    t.integer("join_lead_minutes").defaultTo(5); // Minutes before meeting to join
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("user_settings");
  await knex.schema.dropTableIfExists("posts");
  await knex.schema.dropTableIfExists("automations");
  await knex.schema.dropTableIfExists("social_media_accounts");
};
