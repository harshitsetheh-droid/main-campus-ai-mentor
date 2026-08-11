import "dotenv/config";
import { signToken } from "./src/auth.js";
import pool from "./src/db.js";

const res = await pool.query("SELECT id, username FROM users WHERE username=$1", ["anisk"]);
const user = res.rows[0];
const token = signToken(user.id, user.username);

const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// Case 1: topic in PDF -> should NOT call Gemini, fast reply with links
const t0 = Date.now();
const r1 = await fetch("http://localhost:5000/api/mentor", { method: "POST", headers, body: JSON.stringify({ message: "How to learn python?" }) }).then(r => r.json());
console.log("=== PYTHON (in PDF),", Date.now() - t0, "ms ===");
console.log(r1);

// Case 2: topic not in PDF -> should call Gemini for roadmap
const t1 = Date.now();
const r2 = await fetch("http://localhost:5000/api/mentor", { method: "POST", headers, body: JSON.stringify({ message: "Rust programming kaise sikhu?" }) }).then(r => r.json());
console.log("\n=== RUST (not in PDF),", Date.now() - t1, "ms ===");
console.log(r2.reply);

process.exit(0);
