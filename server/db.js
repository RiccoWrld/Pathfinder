const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const isLocalDatabase =
  !connectionString ||
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1");

// One shared pool keeps database connections reusable across every route.
const pool = new Pool({
  connectionString,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
});

module.exports = pool;
