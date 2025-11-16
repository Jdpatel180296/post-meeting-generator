// server/db/knexfile.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const migrations = { directory: path.join(__dirname, "migrations") };

const development = {
  client: "pg",
  connection: {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "postmeeting",
  },
  migrations,
};

// Prefer DATABASE_URL on hosted platforms (Railway/Heroku/etc.)
// Enable SSL if needed; Railway typically sets sslmode=require in the URL, but
// we also add a safe default here.
const production = {
  client: "pg",
  connection: process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl:
          process.env.PGSSLMODE === "disable"
            ? false
            : { rejectUnauthorized: false },
      }
    : development.connection,
  pool: { min: 2, max: 10 },
  migrations,
};

module.exports = {
  development,
  production,
};
