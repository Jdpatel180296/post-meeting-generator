// server/db/migrations/20251115_init.js
// Legacy migration kept for compatibility with earlier deployments.
// This file is now a no-op because the ordered migration 20251115_01_init.js
// creates these tables with idempotent guards.
exports.up = async function () {
  // no-op
};

exports.down = async function () {
  // no-op
};
