// server/db/knexfile.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

module.exports = {
  development: {
    client: "pg",
    connection: {
      host: process.env.PGHOST || "localhost",
      port: process.env.PGPORT || 5432,
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "",
      database: process.env.PGDATABASE || "postmeeting",
    },
    migrations: { directory: __dirname + "/migrations" },
  },
};
