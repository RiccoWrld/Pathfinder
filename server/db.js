const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL;
const isLocalDatabase =
  !connectionString ||
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1") ||
  connectionString.includes("@db:");
const shouldUseSsl = databaseSsl
  ? databaseSsl.toLowerCase() === "true"
  : !isLocalDatabase;

// One shared pool keeps database connections reusable across every route.
const pool = new Pool({
  connectionString,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
