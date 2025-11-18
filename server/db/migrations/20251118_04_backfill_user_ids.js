// server/db/migrations/20251118_04_backfill_user_ids.js
// Backfills user_id for existing meetings by extracting email from the meeting id
// and creating/linking users accordingly.

exports.up = async function (knex) {
  // Get all meetings with NULL user_id
  const meetings = await knex("meetings").whereNull("user_id").select("id");

  console.log(`[Migration] Found ${meetings.length} meetings without user_id`);

  for (const meeting of meetings) {
    // Extract email from the meeting id (format: email|eventId)
    const parts = meeting.id.split("|");
    if (parts.length < 2) {
      console.log(
        `[Migration] Skipping meeting ${meeting.id} - invalid format`
      );
      continue;
    }

    const email = parts[0];
    console.log(
      `[Migration] Processing meeting ${meeting.id} with email ${email}`
    );

    // Get or create user
    let user = await knex("users").where({ email }).first();

    if (!user) {
      console.log(`[Migration] Creating user for ${email}`);
      const created = await knex("users").insert({ email }).returning("*");
      user = Array.isArray(created) ? created[0] : created;
    }

    // Update meeting with user_id
    await knex("meetings")
      .where({ id: meeting.id })
      .update({ user_id: user.id });

    console.log(
      `[Migration] Updated meeting ${meeting.id} with user_id ${user.id}`
    );
  }

  console.log(`[Migration] Backfilled ${meetings.length} meetings`);
};

exports.down = async function (knex) {
  // Set user_id back to NULL for backfilled meetings
  // (This is just for rollback - in practice you may not want to do this)
  await knex("meetings").whereNotNull("user_id").update({ user_id: null });
};
