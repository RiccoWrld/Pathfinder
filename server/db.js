const { Pool } = require("pg");

// One shared pool keeps database connections reusable across every route.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
