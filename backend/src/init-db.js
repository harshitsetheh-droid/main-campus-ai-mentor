import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

// Connect to the default 'postgres' database to create the target database if missing
const baseUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/campus_ai_mentor";

async function init() {
  const { Client } = pg;
  const client = new Client({ connectionString: baseUrl });
  try {
    await client.connect();
  } catch (err) {
    console.error("❌ Could not connect to PostgreSQL:", err.message);
    console.error("   Make sure PostgreSQL is running and DATABASE_URL is correct.");
    process.exit(1);
  }

  const dbName = new URL(baseUrl).pathname.replace("/", "");
  const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (res.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`✅ Database "${dbName}" created.`);
  } else {
    console.log(`ℹ️  Database "${dbName}" already exists.`);
  }
  await client.end();
}

init();
