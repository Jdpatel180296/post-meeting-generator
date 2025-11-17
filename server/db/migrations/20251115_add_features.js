// server/db/migrations/20251115_add_features.js
// Legacy file retained to avoid breaking existing knex_migrations references.
// It now performs no operations. New schema is created by 20251115_02_add_features.js
exports.up = async function () {
  // no-op (tables are created by ordered migration 20251115_02_add_features.js)
};

exports.down = async function () {
  // no-op
};
