/*
  Simple DB readiness check for PostgreSQL.
  - Uses DATABASE_URL if set, otherwise PG* env vars.
  - Logs target host/port (not credentials) to aid debugging.
  - Retries with exponential backoff to handle cold starts on PaaS providers.
*/
const { Client } = require("pg");

function sanitizeUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    if (u.username) u.username = "***";
    return u.toString();
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

function buildConfig() {
  if (process.env.DATABASE_URL) {
    const ssl =
      process.env.PGSSLMODE === "disable"
        ? false
        : { rejectUnauthorized: false };
    return {
      useUrl: true,
      connectionString: process.env.DATABASE_URL,
      ssl,
      debugLabel: sanitizeUrl(process.env.DATABASE_URL),
    };
  }
  // Fallback to discrete env vars
  const cfg = {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "postmeeting",
    ssl: process.env.PGSSLMODE === "disable" ? false : undefined,
  };
  const debugLabel = `${cfg.user ? "***" : ""}@${cfg.host}:${cfg.port}/${
    cfg.database
  }`;
  return { ...cfg, useUrl: false, debugLabel };
}

function backoffDelay(baseMs, attempt, maxMs = 30000) {
  // Exponential backoff with jitter
  const exp = baseMs * Math.pow(1.5, attempt - 1);
  const jitter = Math.random() * 500; // up to 0.5s jitter
  return Math.min(maxMs, Math.round(exp + jitter));
}

async function waitForDb({ retries = 60, delayMs = 2000 } = {}) {
  const cfg = buildConfig();
  console.log(
    `[waitForDb] Connecting using ${cfg.useUrl ? "DATABASE_URL" : "PG envs"}: ${
      cfg.debugLabel
    }`
  );
  for (let attempt = 1; attempt <= retries; attempt++) {
    const client = new Client(cfg.useUrl ? cfg : { ...cfg });
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
      const sleep = backoffDelay(delayMs, attempt);
      await new Promise((res) => setTimeout(res, sleep));
    }
  }
}

waitForDb();
