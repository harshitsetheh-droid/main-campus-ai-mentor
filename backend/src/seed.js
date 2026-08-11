import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";
import { seedData } from "./seed-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSchema(client) {
  const schemaSql = fs.readFileSync(
    path.join(__dirname, "schema.sql"),
    "utf8"
  );
  await client.query(schemaSql);
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await runSchema(client);

    // Clear reference tables only (student data is user-scoped, left untouched)
    await client.query("TRUNCATE TABLE cohorts RESTART IDENTITY CASCADE");

    const d = seedData;

    for (const c of d.cohorts) {
      await client.query(
        `INSERT INTO cohorts (id, name, total_students, user_rank) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, total_students = EXCLUDED.total_students`,
        [c.id, c.name, c.totalStudents, c.userRank]
      );
    }

    await client.query("COMMIT");
    console.log("✅ Seed complete. Reference data (cohorts) ready. No default student feed.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
