/*
  Simple DB readiness check for PostgreSQL.
  Tries to connect using DATABASE_URL (preferred) or PG* envs.
  Retries a few times before giving up, to handle cold starts.
*/
const { Client } = require("pg");

function buildConfig() {
  if (process.env.DATABASE_URL) {
    const ssl =
      process.env.PGSSLMODE === "disable"
        ? false
        : { rejectUnauthorized: false };
    return { connectionString: process.env.DATABASE_URL, ssl };
  }
  // Fallback to discrete env vars
  return {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "postmeeting",
    ssl: process.env.PGSSLMODE === "disable" ? false : undefined,
  };
}

async function waitForDb({ retries = 30, delayMs = 2000 } = {}) {
  const cfg = buildConfig();
  for (let attempt = 1; attempt <= retries; attempt++) {
    const client = new Client(cfg);
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log(
        `[waitForDb] Database is ready (attempt ${attempt}/${retries}).`
      );
      return;
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      console.log(
        `[waitForDb] DB not ready yet (attempt ${attempt}/${retries}): ${message}`
      );
      try {
        await client.end();
      } catch {}
      if (attempt === retries) {
        console.error("[waitForDb] Giving up waiting for database.");
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

waitForDb();
