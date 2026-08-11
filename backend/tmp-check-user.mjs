import pool from "./src/db.js";
const res = await pool.query("SELECT id, username, email FROM users WHERE username=$1", ["anisk"]);
console.log(JSON.stringify(res.rows));
process.exit(0);
