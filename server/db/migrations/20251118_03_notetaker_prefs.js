// server/db/migrations/20251118_03_notetaker_prefs.js
// Adds persistent storage for per-user notetaker enablement on calendar events.
// Events are identified by the composite key we already expose to the client:
//   `${accountEmail}|${googleEventId}` stored in event_id.
// We upsert on (user_id, event_id) so toggling is idempotent.
// If a user has not yet authenticated (anon-* key) we skip persistence.

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable("notetaker_preferences");
  if (!hasTable) {
    await knex.schema.createTable("notetaker_preferences", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.uuid("user_id").references("id").inTable("users").notNullable();
      t.text("event_id").notNullable();
      t.boolean("enabled").notNullable().defaultTo(false);
      t.timestamp("updated_at").defaultTo(knex.fn.now());
      t.unique(["user_id", "event_id"]);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("notetaker_preferences");
};
