const postgrator = require("postgrator");
const path = require("path");
const fs = require("fs");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/pathfinder";

async function runMigrations() {
  const migrationPattern = path.join(__dirname, "migrations", "*");

  const migrator = new postgrator({
    migrationDirectory: path.join(__dirname, "migrations"),
    driver: "pg",
    connectionString: DATABASE_URL,
    schemaTable: "migrations",
    validateChecksums: false,
  });

  try {
    const result = await migrator.migrate();
    console.log(`Ran ${result.length} migration(s):`);
    result.forEach((m) => console.log(`  ${m.filename}`));
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigrations();
