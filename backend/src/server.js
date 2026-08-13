import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import pool from "./db.js";
import { requireAuth, signToken } from "./auth.js";
import { GoogleGenAI } from "@google/genai";
import PDFDocument from "pdfkit";
import { cleanupDuplicateSkills } from "./skill-cleanup.js";
import { searchKnowledgeBase, formatKnowledgeReply, notFoundAck } from "./knowledge-base.js";
import { isStorageEnabled, isStoragePath, ensureResumeBucket, uploadBytes, readBytes, deleteObject } from "./storage.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Behind Render's Cloudflare edge: trust X-Forwarded-For so rate limits are
// counted per real visitor IP, not per shared edge IP.
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = path.join(__dirname, "uploads");

// Fixed institution for the redesign
const INSTITUTION = "MBM University, Jodhpur";

// ---------------------------------------------------------------------------
// SECURITY HARDENING
// ---------------------------------------------------------------------------
// 1) Security headers (CSP, X-Frame-Options, nosniff, HSTS, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Vite build uses external scripts only; react inline style={{}} attrs need style 'unsafe-inline'
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginResourcePolicy: false, // allow browser to load uploaded images cross-origin
  })
);
// 2) CORS: allow configured origins AND same-origin requests. The browser
//    sends an Origin header for every <script>/<link crossorigin> subresource,
//    so same-origin must be accepted or the deployed frontend refuses to load.
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  const host = req.headers.host || "";
  const isSameOrigin = origin === `https://${host}` || origin === `http://${host}`;
  if (isSameOrigin || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  }
  return res.status(403).json({ error: "Origin not allowed" });
});
// 3) Request body limits (prevent oversized payload DoS)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
// 4) Global rate limit: generous per-IP cap for normal API use
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
// 5) Auth rate limit: generous per-visitor cap (real client IPs) to stop
//    brute-force without blocking a whole classroom behind one NAT/edge IP
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: "Too many login attempts. Please wait a few minutes and try again." }),
});
// Per-username lockout: 3 wrong passwords -> that account can't be tried for 10 minutes.
// (In-memory; fine for a single-instance college deployment.)
const LOGIN_LOCK_MAX_FAILS = 3;
const LOGIN_LOCK_MS = 10 * 60_000;
const loginLocks = new Map(); // normalized identifier -> { fails, lockedUntil }
function loginLockKey(identifier) {
  return String(identifier || "").trim().toLowerCase();
}
function loginLockRemainingMins(key) {
  if (loginLocks.size > 2000) {
    const now = Date.now();
    for (const [k, rec] of loginLocks) {
      if (rec.lockedUntil) {
        if (rec.lockedUntil <= now) loginLocks.delete(k);
      } else if (now - rec.lastFail > LOGIN_LOCK_MS) {
        loginLocks.delete(k); // stale failure counter (no activity for 10 min)
      }
    }
  }
  const rec = loginLocks.get(key);
  if (!rec) return 0;
  if (rec.lockedUntil > Date.now()) {
    return Math.max(1, Math.ceil((rec.lockedUntil - Date.now()) / 60_000));
  }
  if (rec.lockedUntil) loginLocks.delete(key); // expired lock -> start fresh
  return 0;
}
function recordLoginFailure(key) {
  const now = Date.now();
  let rec = loginLocks.get(key);
  if (rec && rec.lockedUntil > now) return; // already locked
  if (!rec) rec = { fails: 0, lockedUntil: 0 };
  rec.fails += 1;
  rec.lastFail = now;
  if (rec.fails >= LOGIN_LOCK_MAX_FAILS) {
    rec.lockedUntil = now + LOGIN_LOCK_MS;
    rec.fails = 0;
  }
  loginLocks.set(key, rec);
}
function clearLoginLock(key) {
  loginLocks.delete(key);
}
// 6) Upload route: stricter, larger limit only for the single upload endpoint
app.use("/api/upload", express.json({ limit: "20mb" }), rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false }));

// ---------------------------------------------------------------------------
// INPUT VALIDATORS
// ---------------------------------------------------------------------------
const SAFE_BASE64 = /^data:([^;]+);base64,[a-zA-Z0-9+/=\s]+$/;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_UPLOAD_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".pdf", ".docx", ".doc", ".txt"]);

function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 8 || pw.length > 128) return "Password must be at least 8 characters (max 128)";
  if (!/[A-Z]/.test(pw)) return "Password must contain at least 1 capital letter";
  if (!/[a-z]/.test(pw)) return "Password must contain at least 1 small letter";
  if (!/[0-9]/.test(pw)) return "Password must contain at least 1 number";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must contain at least 1 symbol (e.g. !@#$%^&*)";
  return null;
}

function safeString(v, max = 2000) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

// Return a generic error to the client; never leak internal details (SQL, paths, keys).
// Full detail goes to the server log only.
function sendServerError(res, err, fallback = "Something went wrong") {
  console.error("[server error]", err);
  return res.status(500).json({ error: fallback });
}

// Serve uploaded files (photos, resumes, certificates)
// Serve with nosniff + forced immutable content-type so an uploaded .html/.svg/
// executable can never be interpreted as a script or navigate the browser.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const MIME_BY_EXT = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif",
  ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
};
app.use("/uploads", express.static(UPLOAD_DIR, { index: false, dotfiles: "deny" }));
app.use("/uploads", (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `inline; filename="${path.basename(req.path)}"`);
  if (MIME_BY_EXT[ext]) res.setHeader("Content-Type", MIME_BY_EXT[ext]);
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  next();
});

// Stream files stored in Supabase Storage (survive server restarts)
app.use("/storage/uploads", async (req, res) => {
  try {
    const key = String(req.path || "").replace(/^\/+/, "");
    if (!key) return res.status(404).json({ error: "File not found" });
    const buf = await readBytes(`/storage/uploads/${key}`);
    const ext = path.extname(key).toLowerCase();
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(key)}"`);
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.type(MIME_BY_EXT[ext] || "application/octet-stream");
    res.send(buf);
  } catch (err) {
    res.status(404).json({ error: "File not found" });
  }
});

// ---------------------------------------------------------------------------
// Helper: ensure schema on startup (idempotent dev bootstrap)
// ---------------------------------------------------------------------------
async function ensureSchema() {
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    // ALTER ... ADD COLUMN IF NOT EXISTS requires separate statements in PG.
    // Split on the semicolon that ends each top-level statement.
    await pool.query(schemaSql);
  } catch (err) {
    console.error("⚠️  Could not ensure schema (is PostgreSQL running?):", err.message);
  }
}

// ---------------------------------------------------------------------------
// UPLOAD ROUTE (base64 -> file)
// ---------------------------------------------------------------------------
app.post("/api/upload", requireAuth, async (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data || typeof data !== "string") {
      return res.status(400).json({ error: "Missing file data" });
    }
    const m = /^data:([^;]+);base64,(.+)$/.exec(data);
    if (!m) return res.status(400).json({ error: "Invalid data URI" });
    const meta = m[1].toLowerCase();
    const ext = (filename && path.extname(filename).toLowerCase()) || "";
    if (ext && !ALLOWED_UPLOAD_EXT.has(ext)) {
      return res.status(400).json({ error: `File type .${ext.replace(".", "")} is not allowed` });
    }
    // Refuse executable/hazardous payloads even if disguised
    if (/text\/html|application\/x-javascript|text\/javascript/.test(meta)) {
      return res.status(400).json({ error: "This file type is not allowed" });
    }
    if (!SAFE_BASE64.test(data)) {
      return res.status(400).json({ error: "Invalid file payload" });
    }
    const dir = path.join(UPLOAD_DIR, String(req.userId));
    fs.mkdirSync(dir, { recursive: true });
    const safeName = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(dir, safeName);
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "File is too large (max 10MB)" });
    }
    if (isStorageEnabled()) {
      const key = `${req.userId}/${safeName}`;
      const url = await uploadBytes(key, buf, meta || "application/octet-stream");
      return res.json({ url });
    }
    fs.writeFileSync(filePath, buf);
    // serve images with a strict content-type so uploaded HTML/SVG can't execute as scripts
    res.json({ url: `/uploads/${req.userId}/${safeName}` });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ---------------------------------------------------------------------------
// AUTH ROUTES
// ---------------------------------------------------------------------------
app.post("/api/auth/register", authLimiter, async (req, res) => {
  const username = safeString(req.body.username, 30);
  const email = safeString(req.body.email, 200);
  const rollNo = safeString(req.body.rollNo, 20);
  const { password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Please fill in all the required fields." });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: "Username must be 3-30 characters (letters, numbers, _ . -)" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) OR ($3 <> '' AND roll_no = $3)",
      [username, email, rollNo]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "That username, email or roll number is already registered. Try logging in instead." });
    }
    const hash = await bcrypt.hash(password, 12);
    const userRes = await pool.query(
      "INSERT INTO users (username, email, password_hash, roll_no) VALUES ($1, $2, $3, $4) RETURNING id, username, email, roll_no",
      [username, email, hash, rollNo]
    );
    const user = userRes.rows[0];
    await pool.query(
      `INSERT INTO profiles (user_id, name, institution)
       VALUES ($1, $2, $3)`,
      [user.id, username, INSTITUTION]
    );
    const token = signToken(user.id, user.username);
    res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email, rollNo: user.roll_no || "", role: user.role || "student" } });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const identifier = safeString(req.body.identifier, 200);
  const { password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: "Please enter your username/email/roll number and password." });
  }
  const lockKey = loginLockKey(identifier);
  const lockedMins = loginLockRemainingMins(lockKey);
  if (lockedMins > 0) {
    return res.status(429).json({
      error: `Too many failed attempts for this account. Try again in ${lockedMins} minute${lockedMins > 1 ? "s" : ""}.`,
    });
  }
  try {
    const userRes = await pool.query(
      "SELECT id, username, email, roll_no, password_hash, role FROM users WHERE username = $1 OR email = $1 OR roll_no = $1 LIMIT 1",
      [identifier]
    );
    const user = userRes.rows[0];
    // Constant-ish timing: always run a bcrypt compare to reduce user-enumeration timing signals
    if (!user) {
      await bcrypt.compare(password, "$2b$12$abcdefghijklmnopqrstuu2dummyhashdummyhashdumm");
      recordLoginFailure(lockKey);
      return res.status(401).json({ error: "Incorrect username or password. Please try again." });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      recordLoginFailure(lockKey);
      return res.status(401).json({ error: "Incorrect username or password. Please try again." });
    }
    clearLoginLock(lockKey);
    const token = signToken(user.id, user.username);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, rollNo: user.roll_no || "", role: user.role || "student" } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const userRes = await pool.query("SELECT id, username, email, role FROM users WHERE id = $1", [req.userId]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });
    const u = userRes.rows[0];
    res.json({ user: { id: u.id, username: u.username, email: u.email, role: u.role || "student" } });
  } catch (err) {
    sendServerError(res, err);
  }
});

// Role guard: pass the roles allowed to hit the route, e.g. requireRole("super_admin")
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const r = await pool.query("SELECT role FROM users WHERE id = $1", [req.userId]);
      const role = (r.rows[0] && r.rows[0].role) || "student";
      req.role = role;
      if (!roles.includes(role)) {
        return res.status(403).json({ error: "You do not have permission for this action" });
      }
      next();
    } catch (err) {
      sendServerError(res, err);
    }
  };
}

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------
async function getProfileSummary(uid) {
  const [user, prof, skills, coding, certs, projects, resumes] = await Promise.all([
    pool.query("SELECT email FROM users WHERE id = $1 LIMIT 1", [uid]),
    pool.query("SELECT * FROM profiles WHERE user_id = $1 LIMIT 1", [uid]),
    pool.query("SELECT * FROM skills WHERE user_id = $1 ORDER BY id", [uid]),
    pool.query("SELECT id, name, platform, url FROM coding_profiles WHERE user_id = $1 ORDER BY id", [uid]),
    pool.query("SELECT * FROM certificates WHERE user_id = $1 ORDER BY created_at DESC", [uid]),
    pool.query("SELECT * FROM projects WHERE user_id = $1 ORDER BY id", [uid]),
    pool.query("SELECT * FROM resumedocs WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1", [uid]),
  ]);
  const p = prof.rows[0] || {};
  return {
    profile: {
      email: user.rows[0]?.email || "",
      name: p.name,
      institution: p.institution,
      branch: p.branch,
      semester: p.current_semester,
      targetRole: p.target_role,
      targetCgpa: p.target_cgpa,
      targetCompanyType: p.target_company_type,
      targetCompanyName: p.target_company_name,
      timelineCurrent: p.timeline_current,
      timelineNext: p.timeline_next,
      workType: p.work_type,
      githubUrl: p.github_url,
      linkedinUrl: p.linkedin_url,
      avatarUrl: p.avatar_url,
      photoUrl: p.photo_url,
      phone: p.phone || "",
      certificatesCount: certs.rows.filter((c) => c.verified).length,
      projectsCount: projects.rows.filter((x) => x.status === "completed").length,
      skillScore: skills.rows.length,
    },
    skills: skills.rows.map((s) => ({
      id: String(s.id),
      name: s.name,
      category: s.category,
      platform: s.platform,
      mastery: s.mastery,
      requiredLevel: s.required_level,
      questionsSolved: s.questions_solved,
      totalQuestions: s.total_questions,
      status: s.status,
      cohortAvg: s.cohort_avg,
      topAvg: s.top_avg,
      percentage: s.mastery,
    })),
    codingProfiles: coding.rows,
    certificates: certs.rows.map((c) => ({ id: String(c.id), title: c.title, category: c.category, filePath: c.file_path, improvedSkill: c.improved_skill, organization: c.organization, verified: c.verified, summary: c.check_summary })),
    projects: projects.rows.map((pr) => ({ id: String(pr.id), title: pr.title, description: pr.description, imageUrl: pr.image_url, repoUrl: pr.repo_url, level: pr.level, status: pr.status, progress: pr.progress, recommendedByAi: pr.recommended_by_ai })),
    resume: resumes.rows[0] ? { fileName: resumes.rows[0].file_name, filePath: resumes.rows[0].file_path } : null,
  };
}

app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const data = await getProfileSummary(req.userId);
    const bench = await computeSkillBenchmarks(req.userId);
    data.skills = data.skills.map((s) => {
      const key = canonicalSkillName(s.name);
      const b = bench[key] || { cohortAvg: s.mastery, top10Avg: s.mastery };
      return { ...s, cohortAvg: b.cohortAvg, topAvg: b.top10Avg };
    });
    res.json(data);
  } catch (err) {
    sendServerError(res, err);
  }
});

app.put("/api/profile", requireAuth, async (req, res) => {
  try {
    const uid = req.userId;
    const {
      name, branch, semester, semester2, targetRole, targetCgpa, targetCompanyType,
      targetCompanyName, timelineCurrent, timelineNext, workType, githubUrl,
      linkedinUrl, avatarUrl, photoUrl, phone,
    } = req.body;
    await pool.query(
      `UPDATE profiles SET
         name = COALESCE($2, name),
         institution = COALESCE($3, institution),
         branch = COALESCE($4, branch),
         current_semester = COALESCE($5, current_semester),
         target_role = COALESCE($6, target_role),
         target_cgpa = COALESCE($7, target_cgpa),
         target_company_type = COALESCE($8, target_company_type),
         target_company_name = COALESCE($9, target_company_name),
         timeline_current = COALESCE($10, timeline_current),
         timeline_next = COALESCE($11, timeline_next),
         work_type = COALESCE($12, work_type),
         github_url = COALESCE($13, github_url),
         linkedin_url = COALESCE($14, linkedin_url),
         avatar_url = COALESCE($15, avatar_url),
         photo_url = COALESCE($16, photo_url),
         phone = COALESCE($17, phone)
       WHERE user_id = $1`,
      [
        uid, name ?? null, INSTITUTION, branch ?? null, semester ?? null,
        targetRole ?? null, targetCgpa ?? null, targetCompanyType ?? null,
        targetCompanyName ?? null, timelineCurrent ?? null, timelineNext ?? null,
        workType ?? null, githubUrl ?? null, linkedinUrl ?? null, avatarUrl ?? null,
        photoUrl ?? null, phone ?? null,
      ]
    );
    try { await rebuildUserRag(uid); } catch (e) { console.error("RAG rebuild error:", e.message); }
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// SKILLS (single source of truth for profile + compare + dashboard gap)
// ---------------------------------------------------------------------------
const PLATFORM_REF = {
  leetcode: { cohort: 70, top: 92 },
  gfg: { cohort: 65, top: 90 },
  cf: { cohort: 60, top: 85 },
  cc: { cohort: 62, top: 88 },
  tuf: { cohort: 68, top: 90 },
};

app.post("/api/profile/skills", requireAuth, async (req, res) => {
  try {
    const { name, category, platform, totalQuestions } = req.body;
    if (!name) return res.status(400).json({ error: "Skill name is required" });
    const dupKey = String(name).toLowerCase().trim();
    const mine = await pool.query("SELECT name FROM skills WHERE user_id=$1", [req.userId]);
    if (mine.rows.some((r) => String(r.name).toLowerCase().trim() === dupKey)) {
      return res.status(400).json({ error: `You already track "${String(name).trim()}" — skill names are always unique` });
    }
    const cat = category || "Core CS";
    const plat = platform || "";
    const total = Math.max(1, parseInt(totalQuestions, 10) || 5);
    const ref = SKILL_PLATFORM[plat.toLowerCase()] || { cohort: 60, top: 90 };
    const ins = await pool.query(
      `INSERT INTO skills (user_id, name, category, platform, questions_solved, total_questions,
        mastery, required_level, cohort_avg, top_avg, status)
       VALUES ($1,$2,$3,$4,0,$5,0,0,$6,$7,'active')
       RETURNING id, name, category, platform, total_questions`,
      [req.userId, String(name).toUpperCase().trim(), cat, plat, total, ref.cohort, ref.top]
    );
    const skill = ins.rows[0];
    await createCheckpoints(req.userId, skill.id, total);
    const fullSkill = await getSkillDetail(req.userId, skill.id);
    res.json(fullSkill);
  } catch (err) {
    sendServerError(res, err);
  }
});

async function createCheckpoints(uid, skillId, total) {
  const labels = ["Basics", "Intermediate", "Advanced", "Expert"];
  for (let i = 0; i < total; i++) {
    const label = labels[i] || `Checkpoint ${i + 1}`;
    await pool.query(
      "INSERT INTO checkpoints (skill_id, user_id, label, level) VALUES ($1,$2,$3,$4)",
      [skillId, uid, label, i + 1]
    );
  }
}

// Mark checkpoints done (top N by level) so the stored mastery % matches the
// score exactly, mirroring the PATCH /profile/skills/:id mastery mapping.
async function syncCheckpointsToMastery(uid, skillId, masteryScore) {
  const ms = Math.max(0, Math.min(100, Math.round(masteryScore)));
  await pool.query("UPDATE checkpoints SET done = FALSE WHERE skill_id=$1 AND user_id=$2", [skillId, uid]);
  const cps = await pool.query(
    "SELECT id, level FROM checkpoints WHERE skill_id=$1 AND user_id=$2 ORDER BY level",
    [skillId, uid]
  );
  const total = cps.rows.length;
  const toMark = Math.max(0, Math.min(total, Math.round((ms / 100) * total)));
  for (let i = 0; i < toMark; i++) {
    await pool.query("UPDATE checkpoints SET done = TRUE WHERE id=$1", [cps.rows[i].id]);
  }
}

// Public achievement broadcast: a notification is created for EVERY user EXCEPT
// the actor (the one who performed the action). Message follows the agreed
// format ("Harsh has completed DSA with 100% mastery!" / "Harsh's ABC certificate
// has been verified!"). `template` must contain the {name} placeholder.
async function broadcastAchievement(actorUid, template, detail, type = "achievement") {
  const actor = await pool.query("SELECT name FROM profiles WHERE user_id=$1 LIMIT 1", [actorUid]);
  const actorName = actor.rows[0]?.name || "A student";
  const others = await pool.query("SELECT id FROM users WHERE id <> $1", [actorUid]);
  const targetIds = others.rows.map((r) => r.id);
  if (!targetIds.length) return;
  const message = String(template).replace("{name}", actorName);
  for (const tid of targetIds) {
    await pool.query(
      "INSERT INTO notifications (user_id, type, title, detail) VALUES ($1,$2,$3,$4)",
      [tid, type, message, detail || ""]
    );
  }
}

async function getSkillDetail(uid, skillId) {
  const s = await pool.query("SELECT * FROM skills WHERE id=$1 AND user_id=$2", [skillId, uid]);
  if (s.rowCount === 0) return null;
  const skill = s.rows[0];
  const cps = await pool.query("SELECT id, label, level, done FROM checkpoints WHERE skill_id=$1 AND user_id=$2 ORDER BY level", [skillId, uid]);
  const done = cps.rows.filter((c) => c.done).length;
  const total = cps.rows.length || 1;
  return {
    id: String(skill.id),
    name: skill.name,
    category: skill.category,
    platform: skill.platform,
    questionsSolved: skill.questions_solved,
    totalQuestions: skill.total_questions,
    mastery: Math.round((done / total) * 100),
    checkpoints: cps.rows.map((c) => ({ id: String(c.id), label: c.label, level: c.level, done: c.done })),
    masteryPercent: Math.round((done / total) * 100),
    requiredLevel: skill.required_level,
    cohortAvg: skill.cohort_avg,
  };
}

app.get("/api/profile/skills/:id", requireAuth, async (req, res) => {
  try {
    const skill = await getSkillDetail(req.userId, req.params.id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json(skill);
  } catch (err) {
    sendServerError(res, err);
  }
});

app.patch("/api/profile/skills/:id", requireAuth, async (req, res) => {
  try {
    const { requiredLevel, totalQuestions, questionsSolved, masteryScore } = req.body;
    const prevSkill = await pool.query("SELECT name, mastery FROM skills WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    await pool.query(
      `UPDATE skills SET
         required_level = COALESCE($3, required_level),
         total_questions = COALESCE($4, total_questions),
         questions_solved = COALESCE($5, questions_solved),
         mastery = COALESCE($6, mastery),
         updated_at = NOW()
       WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.userId, requiredLevel ?? null, totalQuestions ?? null, questionsSolved ?? null, typeof masteryScore === "number" ? Math.round(masteryScore) : null]
    );
    // if a score came from the skill simulator modal, map it onto checkpoints
    // (mark the top N checkpoints done so group mastery = masteryScore)
    if (typeof masteryScore === "number") {
      const ms = Math.max(0, Math.min(100, Math.round(masteryScore)));
      await pool.query("UPDATE checkpoints SET done = FALSE WHERE skill_id=$1 AND user_id=$2", [req.params.id, req.userId]);
      const cps = await pool.query(
        "SELECT id, level FROM checkpoints WHERE skill_id=$1 AND user_id=$2 ORDER BY level",
        [req.params.id, req.userId]
      );
      const total = cps.rows.length;
      const toMark = Math.max(0, Math.min(total, Math.round((ms / 100) * total)));
      for (let i = 0; i < toMark; i++) {
        await pool.query("UPDATE checkpoints SET done = TRUE WHERE id=$1", [cps.rows[i].id]);
      }
      // Broadcast to everyone EXCEPT the actor when the skill first hits 100%
      if (ms >= 100 && (prevSkill.rows[0]?.mastery || 0) < 100) {
        await broadcastAchievement(
          req.userId,
          `{name} has completed ${prevSkill.rows[0]?.name || "a skill"} with 100% mastery!`,
          "Full skill mastery achieved"
        );
      }
    }
    res.json(await getSkillDetail(req.userId, req.params.id));
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete("/api/profile/skills/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM skills WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// Toggle checkpoint, recompute mastery + confirm notification
app.post("/api/checkpoints/:id/toggle", requireAuth, async (req, res) => {
  try {
    const cp = await pool.query("SELECT * FROM checkpoints WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    if (cp.rowCount === 0) return res.status(404).json({ error: "Checkpoint not found" });
    const row = cp.rows[0];
    const nv = !row.done;
    await pool.query("UPDATE checkpoints SET done=$2 WHERE id=$1", [req.params.id, nv]);
    const skillId = row.skill_id;
    const prevSkill = await pool.query("SELECT name, mastery FROM skills WHERE id=$1 AND user_id=$2", [skillId, req.userId]);
    const skill = await getSkillDetail(req.userId, skillId);
    await pool.query("UPDATE skills SET mastery=$2, updated_at=NOW() WHERE id=$1", [skillId, skill.masteryPercent]);
    // Broadcast to everyone EXCEPT the actor when a skill first hits 100%
    if (skill && skill.masteryPercent >= 100 && (prevSkill.rows[0]?.mastery || 0) < 100) {
      await broadcastAchievement(
        req.userId,
        `{name} has completed ${skill.name} with 100% mastery!`,
        "Full skill mastery achieved"
      );
    }
    res.json(skill);
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// CODING PROFILES (max 3, unique platform/URL)
// ---------------------------------------------------------------------------
app.get("/api/platforms", async (req, res) => {
  const r = await pool.query("SELECT id, name, base_url FROM platforms ORDER BY name");
  res.json(r.rows);
});

app.post("/api/profile/coding", requireAuth, async (req, res) => {
  try {
    const { name, url, platform } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });
    let clean = url.trim();
    if (!/^https?:\/\//i.test(clean)) clean = "https://" + clean;
    let parsed;
    try { parsed = new URL(clean); } catch { return res.status(400).json({ error: "Invalid URL" }); }
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathKey = (parsed.pathname || "/").replace(/\/+$/, "").toLowerCase();
    const uniqueKey = host + pathKey;
    const count = await pool.query("SELECT COUNT(*)::int AS c FROM coding_profiles WHERE user_id=$1", [req.userId]);
    if (count.rows[0].c >= 3) return res.status(400).json({ error: "Maximum 3 coding profiles allowed (1 GitHub, 1 LinkedIn, 1 coding platform)" });
    const dup = await pool.query("SELECT id FROM coding_profiles WHERE user_id=$1 AND unique_key=$2", [req.userId, uniqueKey]);
    if (dup.rowCount > 0) return res.status(400).json({ error: "This URL is already added" });
    // category enforcement: github/linkedin/coding
    const p = (platform || "").toLowerCase();
    const kind = p === "github" ? "github" : p === "linkedin" ? "linkedin" : "coding";
    const hasKind = await pool.query("SELECT id FROM coding_profiles WHERE user_id=$1 AND platform=$2", [req.userId, kind]);
    if (hasKind.rowCount > 0) return res.status(400).json({ error: `Only one ${kind} profile allowed` });
    const ins = await pool.query(
      "INSERT INTO coding_profiles (user_id, name, url, platform, unique_key) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, platform, url",
      [req.userId, name || host, clean, kind, uniqueKey]
    );
    res.json(ins.rows[0]);
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete("/api/profile/coding/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM coding_profiles WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// CERTIFICATES (upload + AI verification via Gemini vision)
// ---------------------------------------------------------------------------
async function analyzeCertificate(filePath, userTitle) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { verified: false, summary: "AI verification pending Gemini key", improvedSkill: "" };
  }
  try {
    let b64;
    if (isStoragePath(filePath)) {
      b64 = (await readBytes(filePath)).toString("base64");
    } else {
      const abs = path.join(UPLOAD_DIR, filePath.replace(/^\/uploads\//, ""));
      if (!fs.existsSync(abs)) {
        return { verified: false, summary: "Certificate image not found on server", improvedSkill: "" };
      }
      b64 = fs.readFileSync(abs).toString("base64");
    }
    const mime = filePath.toLowerCase().endsWith(".png") ? "image/png"
      : filePath.toLowerCase().endsWith(".jpg") || filePath.toLowerCase().endsWith(".jpeg") ? "image/jpeg"
      : filePath.toLowerCase().endsWith(".webp") ? "image/webp"
      : filePath.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png";
    const ai = new GoogleGenAI({ apiKey });
    const prompt =
      `You are a strict, careful certificate verifier for CampusAI Mentor (MBM University). ` +
      `The student uploaded an image and claims it is a certificate with this title: "${userTitle}".\n\n` +
      `IMPORTANT - verify in this order:\n` +
      `1. FIRST decide if the image is a genuine certificate/document at all. A real certificate or award document has clear markers such as: an official header ("Certificate of Completion", "Certificate of Achievement", "Letter of Recommendation", "Internship Certificate", "Participation Certificate"), an issuing organization's name/logo, a seal/stamp or signature block, a student name, a date, and a border/graphic design. ` +
      `REJECT (isCertificateDocument=false) anything that is NOT such a document: random photos, selfies, memes, screenshots of apps/WhatsApp/messages, handwritten notes, blank papers, ID photos, posters, or images with no certificate text/marks.\n` +
      `2. Then, if it IS a certificate document: extract the exact title on it (detectedTitle), the organization/company/institute that issued it (organization), the student's name if visible (studentName), and the main topic/skill (topic). ` +
      `3. Determine matches: ` +
      (userTitle
        ? `true ONLY IF the extracted title clearly covers the same skill/topic/technical text as the claimed title (e.g. claimed "Python" vs document "Python Programming Certificate" = match; claimed "Hackathon Winner" vs document "Webinar" = NO match). Typo-level differences are OK, but a totally different topic must be false.`
        : `no claimed title was provided, so set matches to true (extraction-only mode).`) + `\n` +
      `4. Classify the certificate type (certType) into EXACTLY one of these values only: "Course", "Hackathon", "Competitive", "Internship", "Other". ` +
      `- "Course" = completion/training/tutorial/certification of an online course (e.g. Coursera, NPTEL, Udemy). ` +
      `- "Hackathon" = won/participated in a hackathon or coding contest event. ` +
      `- "Competitive" = competitive programming / coding competition rank, Olympiad, etc. ` +
      `- "Internship" = internship / summer training / industrial training / work experience certificate. ` +
      `- "Other" = anything else (workshops, seminars, webinars, club activities, volunteering, sports, etc.).\n` +
      `5. Identify the PRIMARY technical skill this certificate proves (improvedSkill) - one clean short skill name (e.g. "Python", "DSA", "AI & ML", "Web Development"), or "" if non-technical.\n` +
      `6. verified is TRUE only if isCertificateDocument === true AND matches === true. In any doubt, choose false. Be conservative - approving a fake certificate is worse than rejecting a real one.\n\n` +
      `Return ONLY a JSON object, no markdown, in this exact shape:\n` +
      `{"isCertificateDocument": true|false, "detectedTitle": "exact title text seen on the document or ''", "organization": "issuing org/company name seen or ''", "studentName": "name on the certificate or ''", "topic": "main topic/subject", "matches": true|false, "certType": "Course|Hackathon|Competitive|Internship|Other", "improvedSkill": "main skill proved or ''", "verified": true|false, "summary": "1-2 sentence verdict: what the image appears to be, detected title/org, and the exact reason for verified true or false."}`;
    const resp = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mime, data: b64 } },
          ],
        }],
        config: { temperature: 0 },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timed out")), 15000)),
    ]);
    const text = resp.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { verified: false, summary: "AI could not parse certificate (treating as unverified)", improvedSkill: "" };
    const parsed = JSON.parse(m[0]);
    // Double gate: only trust a certificate when the model explicitly confirms the
    // image IS a real certificate document. The title-match gate only applies when
    // a claimed title was provided (empty title = analyze/extract mode: the client
    // auto-fills the form and the final save re-verifies with the real title).
    const isDoc = parsed.isCertificateDocument === true;
    const matches = !userTitle || parsed.matches !== false;
    const verified = isDoc && matches;
    const allowedTypes = ["Course", "Hackathon", "Competitive", "Internship", "Other"];
    const certType = allowedTypes.includes(parsed.certType) ? parsed.certType : "Other";
    return {
      verified,
      summary: parsed.summary || "Certificate analyzed.",
      improvedSkill: parsed.improvedSkill || "",
      detectedTitle: parsed.detectedTitle || "",
      organization: parsed.organization || "",
      studentName: parsed.studentName || "",
      topic: parsed.topic || "",
      certType,
    };
  } catch (err) {
    console.error("Certificate AI analysis error:", err.message);
    return { verified: false, summary: "AI check failed - will retry on next upload", improvedSkill: "" };
  }
}

// Analyze a certificate image and return extracted data (for UI auto-fill) without saving.
// Rejects non-certificates exactly like the create endpoint, and also exposes the
// extracted title/organization/skill/type so the client can pre-fill its form.
app.post("/api/profile/certificates/analyze", requireAuth, async (req, res) => {
  try {
    const { fileUrl } = req.body;
    if (!fileUrl) return res.status(400).json({ error: "Certificate image is required" });
    const analysis = await analyzeCertificate(fileUrl, "");
    if (!analysis.verified) {
      return res.status(400).json({
        error: "This does not look like a valid certificate, so it was not added.",
        reason: analysis.summary || "AI could not verify this as a certificate.",
      });
    }
    res.json(analysis);
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/profile/certificates", requireAuth, async (req, res) => {
  try {
    const { title, category, fileUrl, improvedSkill, organization } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (!fileUrl) return res.status(400).json({ error: "Certificate image is required" });

    // run AI verification; only a verified certificate is allowed to be added
    const analysis = await analyzeCertificate(fileUrl, title);
    if (!analysis.verified) {
      return res.status(400).json({
        error: "This does not look like a valid certificate, so it was not added.",
        reason: analysis.summary || "AI could not verify this as a certificate.",
      });
    }
    const skill = analysis.improvedSkill || improvedSkill || "";
    const org = analysis.organization || organization || "";
    const ins = await pool.query(
      `INSERT INTO certificates (user_id, title, category, file_path, improved_skill, organization, verified, check_summary)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7) RETURNING id`,
      [req.userId, title, category || "", fileUrl, skill, org, analysis.summary]
    );
    // notify everyone EXCEPT the actor that the certificate was verified
    await broadcastAchievement(
      req.userId,
      `{name} earned a ${title} certificate in ${skill || "a skill"} from ${org || "an organization"}!`,
      "AI certificate verification passed"
    );
    res.json({ id: String(ins.rows[0].id), verified: true, summary: analysis.summary });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete("/api/profile/certificates/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM certificates WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// RESUME (uploaded file store)
// ---------------------------------------------------------------------------
app.post("/api/resume/upload", requireAuth, async (req, res) => {
  try {
    const { fileUrl, fileName } = req.body;
    if (!fileUrl) return res.status(400).json({ error: "No file" });
    // Assign the next sequential resume number for this user (1, 2, 3, ...)
    const numRes = await pool.query(
      "SELECT COALESCE(MAX(resume_no), 0) + 1 AS next_no FROM resumedocs WHERE user_id = $1",
      [req.userId]
    );
    const resumeNo = numRes.rows[0].next_no;
    const ins = await pool.query(
      "INSERT INTO resumedocs (user_id, file_path, file_name, resume_no) VALUES ($1,$2,$3,$4) RETURNING id, file_name, file_path, resume_no",
      [req.userId, fileUrl, fileName || "resume.pdf", resumeNo]
    );
    res.json(ins.rows[0]);
  } catch (err) {
    sendServerError(res, err);
  }
});

// Local heuristic fallback so resume analysis still works when the Gemini
// quota is exhausted or the AI service is unavailable. It scores the user's
// live profile (skills, projects, certificates, coding profiles, links) and
// returns actionable strengths/additions without calling any external API.
async function localResumeAnalysis(uid) {
  const data = await getProfileSummary(uid);
  const p = data.profile || {};
  const skills = data.skills || [];
  const projects = data.projects || [];
  const certs = data.certificates || [];
  const coding = data.codingProfiles || [];

  let score = 15; // base: resume file present
  if (skills.length) score += Math.min(30, skills.length * 4);
  const avgMastery = skills.length ? skills.reduce((a, s) => a + (s.mastery ?? 0), 0) / skills.length : 0;
  if (avgMastery >= 50) score += 10;
  else if (avgMastery >= 25) score += 5;
  if (projects.length) score += Math.min(20, projects.length * 5);
  if (certs.filter((c) => c.verified).length) score += 10;
  if (coding.length) score += Math.min(10, coding.length * 4);
  if (p.targetRole) score += 5;
  if (p.githubUrl || p.linkedinUrl || coding.some((c) => c.platform === "github" || c.platform === "linkedin")) score += 5;
  score = Math.max(20, Math.min(92, Math.round(score)));

  const strengths = skills
    .slice()
    .sort((a, b) => (b.mastery ?? 0) - (a.mastery ?? 0))
    .slice(0, 4)
    .map((s) => s.name);
  if (projects.length) strengths.push(`${projects.length} project${projects.length > 1 ? "s" : ""} documented`);
  if (certs.filter((c) => c.verified).length) strengths.push(`${certs.filter((c) => c.verified).length} verified certificate${certs.filter((c) => c.verified).length > 1 ? "s" : ""}`);
  if (coding.length) strengths.push(`${coding.length} coding profile${coding.length > 1 ? "s" : ""} linked`);

  const additions = [];
  if (skills.length < 8) additions.push("Add more in-demand technical skills (aim for 8+ keywords for ATS)");
  if (!projects.length) additions.push("Add 2-3 portfolio projects with measurable outcomes");
  if (!certs.length) additions.push("Upload certificates to strengthen keyword matching");
  if (!(p.githubUrl || p.linkedinUrl) && !coding.some((c) => c.platform === "github" || c.platform === "linkedin")) additions.push("Link your GitHub and LinkedIn profiles");
  if (!p.targetRole) additions.push("Set your target role in Profile so the ATS score can be role-specific");
  if (additions.length < 3) additions.push("Quantify achievements in your project descriptions (e.g. \"reduced load by 40%\")");

  const summary =
    `Local analysis of your CampusAI profile (AI service unavailable, score estimated from your on-profile data). ` +
    `You have ${skills.length} skill${skills.length !== 1 ? "s" : ""} at ${Math.round(avgMastery)}% average mastery, ` +
    `${projects.length} project${projects.length !== 1 ? "s" : ""}, and ` +
    `${certs.length} certificate${certs.length !== 1 ? "s" : ""}. ` +
    `Focus on the recommended additions below to boost ATS visibility for ${p.targetRole || "your target role"}.`;

  return {
    atsScore: score,
    strengths: strengths.slice(0, 4),
    additions: additions.slice(0, 5),
    summary,
    skills: skills.map((s) => s.name),
    skillLevels: {},
    local: true,
  };
}

async function analyzeResume(uid, filePath) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return localResumeAnalysis(uid);
  }
  try {
    let abs;
    let b64;
    if (isStoragePath(filePath)) {
      b64 = (await readBytes(filePath)).toString("base64");
    } else {
      abs = path.join(UPLOAD_DIR, filePath.replace(/^\/uploads\//, ""));
      if (!fs.existsSync(abs)) {
        return { atsScore: 0, strengths: [], additions: [], summary: "Resume file not found on server", skills: [] };
      }
      b64 = fs.readFileSync(abs).toString("base64");
    }
    const lower = filePath.toLowerCase();
    const mime = lower.endsWith(".pdf") ? "application/pdf"
      : lower.endsWith(".png") ? "image/png"
      : lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg"
      : lower.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    // target role context for ATS scoring
    const prof = await pool.query("SELECT target_role, branch FROM profiles WHERE user_id = $1 LIMIT 1", [uid]);
    const targetRole = prof.rows[0]?.target_role || "Software Engineering";

    const ai = new GoogleGenAI({ apiKey });
    const prompt =
      `You are an expert ATS resume parser and career coach for CampusAI Mentor (MBM University, India). ` +
      `The student's target role is: "${targetRole}". ` +
      `Read the attached resume document (PDF/image/DOCX) and return a JSON object ONLY, no markdown, in this exact shape:\n` +
      `{"atsScore": <0-100 number estimating how well the resume matches ATS parsing for the target role>, ` +
      `"skills": ["each individual technical skill name only, one per entry - e.g. for a line like 'Languages: Python, Java, C++' return ["Python","Java","C++"], never the whole line or section header. ALSO extract implicit skills from descriptive sentences: e.g. 'strong grip on DSA' -> add "DSA", 'proficient in web development' -> add "Web Development", 'worked on MERN stack projects' -> add "MERN Stack" and "React". Include only real technical skills, not soft skills like 'teamwork'."], ` +
      `"skillLevels": {"Skill Name exactly as it appears in the skills array above": "Beginner or Intermediate or Advanced"} - assign each listed skill the proficiency level indicated anywhere in the document (e.g. a line 'Python (Intermediate)', 'Level: Advanced', 'proficient in SQL' -> Intermediate, 'basic knowledge of Git' -> Beginner). If the document does not state a level for a skill, omit that skill from this object. Values must be exactly one of "Beginner", "Intermediate", "Advanced". Include an entry for every skill whose level you can determine.` +
      `"strengths": ["2-4 short strengths: what the resume does well for the target role"], ` +
      `"additions": ["3-5 recommended skill/section additions that would boost ATS match for the target role"], ` +
      `"summary": "1-2 sentence summary of the resume's overall quality and biggest gap for ${targetRole}."}\n` +
      `Base atsScore on presence of: relevant keywords, quantified achievements, projects, education details, links, formatting.`;
    const resp = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mime, data: b64 } },
          ],
        }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timed out")), 15000)),
    ]);
    const text = resp.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) {
      return { atsScore: 0, strengths: [], additions: [], summary: "AI could not parse resume", skills: [] };
    }
    const parsed = JSON.parse(m[0]);
    const rawLevels = parsed.skillLevels && typeof parsed.skillLevels === "object" ? parsed.skillLevels : {};
    const skillLevels = {};
    for (const [k, v] of Object.entries(rawLevels)) {
      const lvl = String(v || "").toLowerCase().trim();
      if (/^beginner/i.test(lvl)) skillLevels[k] = "Beginner";
      else if (/^intermediate/i.test(lvl)) skillLevels[k] = "Intermediate";
      else if (/^adv/i.test(lvl)) skillLevels[k] = "Advanced";
    }
    return {
      atsScore: Math.max(0, Math.min(100, Number(parsed.atsScore) || 0)),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      additions: Array.isArray(parsed.additions) ? parsed.additions.map(String) : [],
      summary: parsed.summary || "Resume analyzed.",
      skills: Array.isArray(parsed.skills) ? parsed.skills.map(String) : [],
      skillLevels,
    };
  } catch (err) {
    console.error("Resume AI analysis error:", err.message);
    // Gemini quota exhausted / API down: fall back to local profile-based analysis
    return localResumeAnalysis(uid);
  }
}

// ---------------------------------------------------------------------------
// RAG: build per-user knowledge chunks + embed + retrieve (cosine similarity)
// ---------------------------------------------------------------------------
async function embedText(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const resp = await Promise.race([
      ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: [{ role: "user", parts: [{ text }] }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("embed timed out")), 10000)),
    ]);
    const values = resp?.embeddings?.[0]?.values;
    return Array.isArray(values) ? values : null;
  } catch (err) {
    console.error("Embedding error:", err.message);
    return null;
  }
}

function cosineSim(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function getUserRagChunks(uid) {
  const data = await getProfileSummary(uid);
  const chunks = [];
  const p = data.profile || {};
  chunks.push({ source: "profile", title: "Student Profile", content:
    `Name ${p.name}, branch ${p.branch}, semester ${p.semester}, institution ${p.institution}. Target role ${p.targetRole}. ` +
    `Target CGPA ${p.targetCgpa}. Desired company type ${p.targetCompanyType}${p.targetCompanyName ? ` (${p.targetCompanyName})` : ""}. ` +
    `Current timeline focus ${p.timelineCurrent}, next step ${p.timelineNext}. Preferred work type ${p.workType}.` });
  for (const s of data.skills || []) {
    chunks.push({ source: "skill", title: `Skill: ${s.name}`, content:
      `${s.name} - mastery ${s.mastery}%. Category ${s.category || "uncategorized"}, platform ${s.platform || "general"}. ` +
      `Solved ${s.questionsSolved || 0} of ${s.totalQuestions || 0} questions. Status ${s.status || "active"}.` });
  }
  for (const pr of data.projects || []) {
    chunks.push({ source: "project", title: `Project: ${pr.title}`, content:
      `${pr.title} - ${pr.description} Level ${pr.level}, status ${pr.status}, progress ${pr.progress}%. Repo ${pr.repoUrl || "not linked"}.` });
  }
  for (const c of data.certificates || []) {
    chunks.push({ source: "certificate", title: `Certificate: ${c.title}`, content:
      `${c.title} (${c.category || "no category"}) ${c.verified ? "AI-verified" : "not yet verified"}. Improved skill: ${c.improvedSkill || "unspecified"}. ${c.summary || ""}` });
  }
  const ats = await pool.query(
    "SELECT ats_score, strengths, additions FROM resume_analysis WHERE user_id=$1 ORDER BY id DESC LIMIT 1", [uid]);
  if (ats.rows[0]) {
    chunks.push({ source: "resume", title: "Resume ATS Analysis", content:
      `Resume ATS score ${ats.rows[0].ats_score}/100. Strengths: ${(ats.rows[0].strengths || []).join(", ")}. ` +
      `Recommended additions: ${(ats.rows[0].additions || []).join(", ")}.` });
  }
  return chunks;
}

async function rebuildUserRag(uid) {
  const chunks = await getUserRagChunks(uid);
  await pool.query("DELETE FROM rag_chunks WHERE user_id=$1", [uid]);
  for (const ch of chunks) {
    const emb = await embedText(ch.content);
    if (!emb) continue;
    await pool.query(
      "INSERT INTO rag_chunks (user_id, source, title, content, embedding) VALUES ($1,$2,$3,$4,$5)",
      [uid, ch.source, ch.title, ch.content, JSON.stringify(emb)]
    );
  }
}

async function retrieveRag(uid, query, k = 4) {
  const qemb = await embedText(query);
  if (!qemb) return [];
  const rows = await pool.query("SELECT id, source, title, content, embedding FROM rag_chunks WHERE user_id=$1", [uid]);
  const scored = [];
  for (const r of rows.rows) {
    let vec = [];
    try { vec = JSON.parse(r.embedding || "[]"); } catch {}
    const sim = cosineSim(qemb, vec);
    if (sim > 0.25) scored.push({ source: r.source, title: r.title, content: r.content, score: sim });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

async function dedupeSkillsWithAi(candidates, existingNames) {
  if (!candidates?.length) return [];
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null; // caller falls back to string-based dedup
  const overlapExisting = candidates.filter((c) => existingNames.includes(c.toLowerCase()));
  if (overlapExisting.length === candidates.length) return [];
  try {
    const ai = new GoogleGenAI({ apiKey });
    const resp = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{ text:
            `An automated resume parser extracted these skill names:\n${JSON.stringify(candidates)}\n\n` +
            `The student already has these skills:\n${JSON.stringify(existingNames)}\n\n` +
            `The extracted list often contains duplicate or overlapping skills (same skill written differently, or a broad skill listed alongside its sub-skills). ` +
            `Return a JSON array ONLY of the genuinely distinct TECHNICAL skills that are brand-new for this student. Follow these rules:\n` +
            `1. Treat same-skill-different-name as duplicates (e.g. "DSA" vs "Data structures and algorithms", "Python" vs "Python programming", "C++" vs "C plus plus", "SQL" vs "DBMS", "JS" vs "JavaScript", "HTML" vs "HTML5").\n` +
            `2. If a broad skill AND its sub-skills are both present, keep ONLY the sub-skills and drop the broad umbrella (e.g. drop "Web Development" and keep "Frontend", "Backend", "HTML", "CSS", "JavaScript", "REST APIs", "Node.js"; drop "Machine Learning" and keep "Regression", "Classification", "EDA", "Model Training").\n` +
            `3. Do NOT include anything already covered by an existing skill.\n` +
            `4. Prefer the shortest/most standard name.\n` +
            `Return ONLY a plain JSON array of strings. Do not add markdown, comments, or explanations.` },
          ],
        }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timed out")), 15000)),
    ]);
    const text = resp.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    return Array.isArray(parsed) ? parsed.map(String).map((s) => s.trim()).filter(Boolean) : null;
  } catch (err) {
    console.error("AI skill dedup error:", err.message);
    return null;
  }
}

app.post("/api/resume/analyze", requireAuth, async (req, res) => {
  try {
    const { fileUrl } = req.body;
    if (!fileUrl) return res.status(400).json({ error: "No file to analyze" });
    const result = await analyzeResume(req.userId, fileUrl);
    // link this analysis to the matching uploaded resume (by file_path) so the
    // AI mentor can recall per-resume skills + recommendations later
    const resumeRow = await pool.query(
      "SELECT resume_no FROM resumedocs WHERE user_id=$1 AND file_path=$2 ORDER BY id DESC LIMIT 1",
      [req.userId, fileUrl]
    );
    const resumeNo = resumeRow.rows[0]?.resume_no || 0;
    // Skills from the PDF carry an optional proficiency level
    // (Beginner/Intermediate/Advanced) that overrides the stored mastery.
    const LEVEL_MASTERY = { Beginner: 33, Intermediate: 66, Advanced: 99 };
    const existing = await pool.query("SELECT id, name, mastery FROM skills WHERE user_id = $1", [req.userId]);
    const existingLower = new Map(existing.rows.map((r) => [String(r.name).toLowerCase(), r]));
    // Full detected list drives the OVERRIDE pass (existing skills must be
    // reachable even though the AI dedup only returns genuinely-new skills).
    const allDetected = (result.skills || []).map((s) => String(s).trim()).filter(Boolean);
    // AI-deduped list drives the ADD pass (only brand-new skills get inserted).
    let candidates = [...allDetected];
    const aiFiltered = await dedupeSkillsWithAi(allDetected, [...existingLower.keys()]);
    if (aiFiltered && aiFiltered.length) candidates = aiFiltered;
    const lvlFor = (name) => {
      const raw = (result.skillLevels || {})[name] || (result.skillLevels || {})[name.toLowerCase()];
      return LEVEL_MASTERY[raw] || null;
    };
    const isDuplicate = (name) => {
      const n = name.toLowerCase();
      if (existingLower.has(n)) return true;
      // near-duplicate: skip if an existing skill is a substring of it (or vice versa) for names >= 4 chars
      for (const e of existingLower.keys()) {
        if (n.length >= 4 && e.length >= 4 && (n.includes(e) || e.includes(n))) return true;
      }
      return false;
    };
    let addedCount = 0;
    let overriddenCount = 0;
    // PASS 1: override existing skills whose level the PDF states explicitly
    for (const name of allDetected) {
      const trimmed = String(name).trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      const levelMastery = lvlFor(trimmed);
      const existingSkill = existingLower.get(key);
      if (!existingSkill) continue;
      if (levelMastery != null && levelMastery !== existingSkill.mastery) {
        await pool.query(
          "UPDATE skills SET mastery=$3, updated_at=NOW() WHERE id=$1 AND user_id=$2",
          [existingSkill.id, req.userId, levelMastery]
        );
        await syncCheckpointsToMastery(req.userId, existingSkill.id, levelMastery);
        overriddenCount++;
      }
    }
    // PASS 2: insert brand-new skills (never removes anything on the profile)
    for (const name of candidates) {
      const trimmed = String(name).trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      const levelMastery = lvlFor(trimmed);
      if (existingLower.has(key)) continue;
      if (isDuplicate(trimmed)) continue;
      const cat = "Core CS";
      const ref = SKILL_PLATFORM[""] || { cohort: 60, top: 90 };
      const mastery = levelMastery ?? 0;
      const ins = await pool.query(
        `INSERT INTO skills (user_id, name, category, platform, questions_solved, total_questions,
          mastery, required_level, cohort_avg, top_avg, status)
         VALUES ($1,$2,$3,'',0,5,$6,0,$4,$5,'active')
         RETURNING id`,
        [req.userId, trimmed.toUpperCase(), cat, ref.cohort, ref.top, mastery]
      );
      await createCheckpoints(req.userId, ins.rows[0].id, 5);
      if (mastery > 0) await syncCheckpointsToMastery(req.userId, ins.rows[0].id, mastery);
      existingLower.set(key, { id: ins.rows[0].id, name: trimmed.toUpperCase(), mastery });
      addedCount++;
    }
    // persist analysis for later dashboard + mentor reads (store detected skills
    // AND recommended additions so the AI mentor can reuse them per resume)
    await pool.query(
      `INSERT INTO resume_analysis (user_id, ats_score, target_role, strengths, additions, skills, resume_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.userId, result.atsScore, "", result.strengths, result.additions, result.skills || [], resumeNo]
    );
    // store improvements from additions
    for (const title of result.additions.slice(0, 5)) {
      await pool.query(
        `INSERT INTO improvements (user_id, title, description, icon, type)
         VALUES ($1,$2,$3,'Check','add')`,
        [req.userId, title, `Add "${title}" to your resume to improve ATS keyword match.`]
      );
    }
    // rebuild RAG knowledge base so the mentor can retrieve fresh resume context
    // (fire-and-forget: embedding ~60 chunks serially is slow, don't block the response)
    rebuildUserRag(req.userId).catch((e) => console.error("RAG rebuild error:", e.message));
    res.json({ ...result, addedCount, overriddenCount });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// SKILL CLEANUP: AI dedup of the user's existing skills (keep sub-skills,
// remove umbrella skills + duplicates). Applies to all skills on their
// profile and deletes redundant entries.
// ---------------------------------------------------------------------------
app.post("/api/skills/cleanup", requireAuth, async (req, res) => {
  try {
    const result = await cleanupDuplicateSkills(req.userId);
    res.json(result);
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// RESUME LIST + PER-RESUME ANALYSIS (for the AI mentor "improve my resume"
// flow). Every uploaded resume gets a sequential number; each analysis stores
// the detected skills + recommended additions against that number.
// ---------------------------------------------------------------------------
app.get("/api/resume/list", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.id, r.resume_no, r.file_name, r.file_path, r.uploaded_at,
              a.ats_score, a.skills, a.additions, a.strengths
       FROM resumedocs r
       LEFT JOIN LATERAL (
         SELECT ats_score, skills, additions, strengths
         FROM resume_analysis
         WHERE user_id = r.user_id AND resume_no = r.resume_no
         ORDER BY id DESC LIMIT 1
       ) a ON true
       WHERE r.user_id = $1
       ORDER BY r.resume_no`,
      [req.userId]
    );
    res.json({
      resumes: r.rows.map((row) => ({
        resumeNo: row.resume_no,
        fileName: row.file_name,
        filePath: row.file_path,
        uploadedAt: row.uploaded_at ? row.uploaded_at.toISOString() : null,
        atsScore: row.ats_score ?? null,
        skills: row.skills || [],
        additions: row.additions || [],
        strengths: row.strengths || [],
      })),
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.get("/api/resume/analysis/:num", requireAuth, async (req, res) => {
  try {
    const num = parseInt(req.params.num, 10);
    if (!num || num < 1) return res.status(400).json({ error: "Invalid resume number" });
    const r = await pool.query(
      `SELECT r.file_name, r.file_path, a.ats_score, a.skills, a.additions, a.strengths
       FROM resumedocs r
       LEFT JOIN LATERAL (
         SELECT ats_score, skills, additions, strengths
         FROM resume_analysis
         WHERE user_id = r.user_id AND resume_no = r.resume_no
         ORDER BY id DESC LIMIT 1
       ) a ON true
       WHERE r.user_id = $1 AND r.resume_no = $2
       ORDER BY r.id DESC LIMIT 1`,
      [req.userId, num]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Resume not found" });
    const row = r.rows[0];
    res.json({
      resumeNo: num,
      fileName: row.file_name,
      filePath: row.file_path,
      atsScore: row.ats_score ?? null,
      skills: row.skills || [],
      additions: row.additions || [],
      strengths: row.strengths || [],
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete("/api/resume/:num", requireAuth, async (req, res) => {
  try {
    const num = parseInt(req.params.num, 10);
    if (!num || num < 1) return res.status(400).json({ error: "Invalid resume number" });
    const r = await pool.query(
      "SELECT file_path FROM resumedocs WHERE user_id=$1 AND resume_no=$2 ORDER BY id DESC LIMIT 1",
      [req.userId, num]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Resume not found" });
    const filePath = r.rows[0].file_path;
    await pool.query("DELETE FROM resume_analysis WHERE user_id=$1 AND resume_no=$2", [req.userId, num]);
    await pool.query("DELETE FROM resumedocs WHERE user_id=$1 AND resume_no=$2", [req.userId, num]);
    // remove the physical file from disk / storage if it exists
    if (isStoragePath(filePath)) {
      try { await deleteObject(filePath); } catch { /* ignore */ }
    } else {
      const abs = path.join(UPLOAD_DIR, String(filePath || "").replace(/^\/uploads\//, ""));
      if (filePath && abs.startsWith(UPLOAD_DIR) && fs.existsSync(abs)) {
        try { fs.unlinkSync(abs); } catch { /* ignore */ }
      }
    }
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// RESUME GENERATION (one-page PDF from live profile data)
// ---------------------------------------------------------------------------
function escapeLatex(s) {
  return String(s || "").replace(/[\\{}_%$#&~^><]/g, (c) => "\\" + c);
}

function sanitizeFilename(s) {
  return String(s || "Resume").replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
}

app.post("/api/resume/generate", requireAuth, async (req, res) => {
  try {
    const data = await getProfileSummary(req.userId);
    const p = data.profile || {};
    const skills = (data.skills || []).filter((s) => (s.mastery ?? s.percentage ?? 0) >= 66);
    const projects = (data.projects || []).filter((x) => x.title).slice(0, 4);
    const coding = (data.codingProfiles || []).slice(0, 3);
    const targetRole = p.targetRole || "Software Engineer";

    const contacts = [
      p.phone ? escapeLatex(p.phone) : "",
      p.email ? escapeLatex(p.email) : "",
      p.githubUrl ? "github.com/" + String(p.githubUrl).replace(/^https?:\/\/(www\.)?(github\.com\/)?/i, "").replace(/\/$/, "") : "",
      p.linkedinUrl ? String(p.linkedinUrl).replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "") : "",
      ...coding.map((c) => {
        const handle = String(c.name || "").trim().replace(/^@/, "");
        const plat = String(c.platform || "").toLowerCase();
        if (plat === "github") return handle ? "github.com/" + handle : "";
        if (plat === "linkedin") return handle ? "linkedin.com/in/" + handle : "";
        return handle ? `${plat || "coding"}.com/${handle}` : "";
      }),
    ].filter(Boolean);
    const contactLine = [...new Set(contacts)].filter(Boolean).join("  |  ");

    const summary =
      `Dedicated and disciplined ${escapeLatex(data.profile.institution || "Engineering")} student (${escapeLatex(p.branch || "B.Tech")}, ${escapeLatex(p.semester || "")}) ` +
      `targeting a ${escapeLatex(p.targetRole || "Software Engineering")} role. Consistent, sincere, and self-motivated with strong fundamentals in ` +
      `${skills.slice(0, 3).map((s) => escapeLatex(s.name)).join(", ") || "core engineering"} and a track record of building projects.`;

    // Keep only unique skill names, join into ~3 columns for space.
    const skillNames = [...new Set(skills.map((s) => escapeLatex(s.name)))];

    const doc = new PDFDocument({ size: "A4", margins: { top: 32, bottom: 28, left: 36, right: 36 } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const name = sanitizeFilename(p.name || "resume");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${name}_resume.pdf"`);
      res.send(buffer);
    });

    // Header
    doc.fontSize(24).font("Helvetica-Bold").fillColor("#14143a").text(p.name || "Student Name", { align: "center" });
    doc.moveUp(0.4).fontSize(10).font("Helvetica").fillColor("#3d3d5c").text(escapeLatex(p.branch || "") + (p.semester ? ` | ${escapeLatex(p.semester)}` : "") + (p.targetCgpa ? ` | CGPA: ${escapeLatex(p.targetCgpa)}` : ""), { align: "center" });
    if (contactLine) doc.moveDown(0.3).fontSize(8.5).fillColor("#1a1a3a").text(contactLine, { align: "center" });
    doc.moveDown(0.7);
    doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor("#14143a").lineWidth(1).stroke();
    doc.moveDown(0.6);

    const section = (title) => {
      doc.moveDown(0.5).fontSize(11.5).font("Helvetica-Bold").fillColor("#14143a").text(title.toUpperCase(), { characterSpacing: 0.6 });
      doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor("#c9c9e8").lineWidth(0.7).stroke();
      doc.moveDown(0.35);
    };
    const body = (txt) => doc.fontSize(9.3).font("Helvetica").fillColor("#1a1a2e").text(txt, { lineGap: 3 });
    const bullet = (txt) => { doc.fontSize(9.3).font("Helvetica").fillColor("#1a1a2e").text("  • " + txt, { lineGap: 3 }); };

    section("Summary");
    body(summary);

    if (skillNames.length) {
      section("Technical Skills");
      doc.fontSize(9.3).font("Helvetica").fillColor("#1a1a2e");
      let line = "";
      skillNames.forEach((n, i) => {
        const chunk = (line ? "  • " : "") + n + " (" + skills[i].mastery + "%)";
        if ((line + chunk).length > 95) { doc.text(line); line = n + " (" + skills[i].mastery + "%)  "; }
        else line += (line ? "   • " : "") + n + " (" + skills[i].mastery + "%)";
        if (i === skillNames.length - 1 && line) doc.text(line);
      });
    }

    if (projects.length) {
      section("Projects");
      const maxProj = doc.y < 500 ? 3 : 2;
      projects.slice(0, maxProj).forEach((pr) => {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#14143a").text(escapeLatex(pr.title));
        if (pr.repoUrl) { doc.fontSize(8.3).font("Helvetica").fillColor("#5b5fef").text(String(pr.repoUrl).replace(/^https?:\/\//, "")); }
        if (pr.description) { doc.fontSize(8.8).font("Helvetica").fillColor("#33334d").text(escapeLatex(pr.description), { lineGap: 2 }); }
        doc.moveDown(0.2);
      });
    }

    section("Personal Attributes");
    bullet("Disciplined, sincere and self-motivated with strong commitment to deadlines");
    bullet("Good analytical & problem-solving ability — driven to keep learning new technologies");
    bullet("Ambitious about building a career in " + escapeLatex(p.targetRole || "software engineering"));

    doc.end();
  } catch (err) {
    console.error("Resume generation error:", err.message);
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------
const SKILL_PLATFORM = {
  "": { cohort: 60, top: 90 },
  leetcode: { cohort: 70, top: 80 },
  gfg: { cohort: 65, top: 85 },
};

app.get("/api/dashboard", requireAuth, async (req, res) => {
  try {
    const uid = req.userId;
    const [profRes, skillsRes, projectsRes, certsRes, notifRes] = await Promise.all([
      pool.query("SELECT name, branch, target_role, target_cgpa, target_company_name FROM profiles WHERE user_id=$1 LIMIT 1", [uid]),
      pool.query("SELECT * FROM skills WHERE user_id=$1 ORDER BY id", [uid]),
      pool.query("SELECT * FROM projects WHERE user_id=$1 ORDER BY id", [uid]),
      pool.query("SELECT COUNT(*)::int AS c FROM certificates WHERE user_id=$1 AND verified=TRUE", [uid]),
      pool.query("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5", [uid]),
    ]);
    const prof = profRes.rows[0] || {};
    const skills = skillsRes.rows;
    const projects = projectsRes.rows;

    // skill gap: current (mastery %) vs required
    const gap = skills.map((s) => ({
      id: String(s.id),
      name: s.name,
      category: s.category,
      current: s.mastery,
      required: s.required_level || 80,
    }));

    const pendingSkills = skills.filter((s) => s.status === "pending" || (s.mastery || 0) < (s.required_level || 80));

    res.json({
      name: prof.name,
      branch: prof.branch,
      targetRole: prof.target_role || "",
      targetCgpa: prof.target_cgpa || "",
      targetCompanyName: prof.target_company_name || "",
      projectCount: projects.filter((p) => p.status === "completed").length,
      certificateCount: certsRes.rows[0].c,
      skillGap: gap,
      skills: skills.map((s) => ({
        name: s.name,
        mastery: s.mastery,
      })),
      projects: projects.map((p) => ({
        id: String(p.id),
        title: p.title,
        description: p.description,
        repoUrl: p.repo_url,
        status: p.status,
        progress: p.progress,
        recommendedByAi: p.recommended_by_ai,
        aiVerified: p.ai_verified,
        aiVerification: p.ai_verification || '',
        imageUrl: p.image_url,
        level: p.level,
      })),
      recommendations: pendingSkills.map((s) => ({ text: `Strengthen ${s.name}`, color: "violet", navigatesTo: "compare" })),
      notifications: notifRes.rows,
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PROJECTS
// ---------------------------------------------------------------------------
// AI verification for manually added projects: checks whether the project is
// real and portfolio-worthy or just filler ("time pass"). Falls back to
// { verified: true } with a neutral note when Gemini is unavailable.
async function verifyProjectWithAi(title, description, repoUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { verified: true, verdict: "", reason: "AI verification unavailable (no API key)" };
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const call = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text:
            `You are a strict project validator for a college student portfolio platform (CampusAI Mentor, MBM University).\n` +
            `The student manually added this project:\n` +
            `- Title: "${title}"\n` +
            `- Description: "${description || ""}"\n` +
            `- GitHub/repo link: "${repoUrl || ""}"\n\n` +
            `Decide if this is a REAL, portfolio-worthy project or filler/time-pass (vague, trivial, or fake entries like "tic tac toe", "todo list" without substance are SUSPICIOUS; projects with clear scope, tech, and outcomes are REAL).\n` +
            `Return ONLY a JSON object (no markdown) in this exact shape:\n` +
            `{"verified": true|false, "reason": "one sentence explaining the verdict"}` +
            `\nBe conservative but fair: a short but concrete project can still be real. Reject only clearly fake/trivial/filler entries.`
        }],
      }],
    });
    const resp = await Promise.race([
      call,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timed out")), 15000)),
    ]);
    const text = resp.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { verified: true, verdict: "", reason: "AI could not parse verdict" };
    const parsed = JSON.parse(m[0]);
    return {
      verified: parsed.verified !== false,
      verdict: parsed.verified !== false ? "verified" : "rejected",
      reason: String(parsed.reason || "").trim(),
    };
  } catch (err) {
    console.error("Project AI verification error:", err.message);
    return { verified: true, verdict: "", reason: "AI verification failed - treated as valid" };
  }
}

app.post("/api/dashboard/projects", requireAuth, async (req, res) => {
  try {
    const { title, description, repoUrl, level, status, recommendedByAi, progress } = req.body;
    if (!title) return res.status(400).json({ error: "Project title is required" });
    let aiVerified = true;
    let aiReason = "";
    // AI-recommended projects are trusted; only manually added ones get checked
    if (!recommendedByAi) {
      const check = await verifyProjectWithAi(title, description, repoUrl);
      aiVerified = check.verified;
      aiReason = check.reason || "";
    }
    const ins = await pool.query(
      `INSERT INTO projects (user_id, title, description, repo_url, level, status, progress, recommended_by_ai, ai_verified, ai_verification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, ai_verified, ai_verification`,
      [req.userId, title, description || "", repoUrl || "", level || "Beginner", status || "ongoing", progress || 0, !!recommendedByAi, aiVerified, aiReason]
    );
    res.json(ins.rows[0]);
  } catch (err) {
    sendServerError(res, err);
  }
});

app.patch("/api/dashboard/projects/:id", requireAuth, async (req, res) => {
  try {
    const { title, repoUrl, status, progress } = req.body;
    const prev = await pool.query("SELECT title, progress FROM projects WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    await pool.query(
      `UPDATE projects SET
         title = COALESCE($3, title),
         repo_url = COALESCE($4, repo_url),
         status = COALESCE($5, status),
         progress = COALESCE($6, progress)
       WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.userId, title ?? null, repoUrl ?? null, status ?? null, progress ?? null]
    );
    const pr = await pool.query("SELECT * FROM projects WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    // Broadcast to everyone EXCEPT the actor when a project first reaches 100%
    const newProgress = Number(pr.rows[0]?.progress || 0);
    if (newProgress >= 100 && (prev.rows[0]?.progress || 0) < 100) {
      await broadcastAchievement(
        req.userId,
        `{name} has completed the project ${prev.rows[0]?.title || "a project"}!`,
        "Project completed"
      );
    }
    res.json(pr.rows[0]);
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete("/api/dashboard/projects/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM projects WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// AI PROJECT SUGGESTIONS: given skills + target role, suggest projects.
// Each suggestion lists which skills it exercises. Results are NOT persisted.
// ---------------------------------------------------------------------------
async function suggestProjectsWithAi(skillsList, targetRole, existingTitles = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  const promptSkills = [...new Set((skillsList || []).map((s) => String(s).trim()).filter(Boolean))];
  if (apiKey && promptSkills.length) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const AI_TIMEOUT_MS = 15000;
      const call = ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{
            text:
              `You are a project-ideas generator for a college student targeting the role "${targetRole}".\n` +
              `The student already knows these skills: ${JSON.stringify(promptSkills)}\n` +
              `Their existing projects (do not repeat these): ${JSON.stringify(existingTitles)}\n\n` +
              `Suggest 5 concrete, realistic, portfolio-worthy project ideas that let them PRACTICE and DEMONSTRATE those exact skills for the "${targetRole}" role. ` +
              `Each project must be achievable by a student and clearly tie back to the skills listed.\n` +
              `"skillsUsed" must list ONLY 4-8 skills from the provided skills list that the student actually exercises while building this project - never invent new skills.\n` +
              `Return ONLY a JSON array (no markdown) in this exact shape:\n` +
              `[{"title": "...", "description": "2-3 sentence description of what the project does and what the student builds", ` +
              `"skillsUsed": ["skill name 1","skill name 2","..."], "level": "Beginner|Intermediate|Advanced"}]` +
              `\nUse only real skills from the student's list in "skillsUsed". Keep description concise but specific.`
          }],
        }],
      });
      const resp = await Promise.race([
        call,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timed out")), AI_TIMEOUT_MS)),
      ]);
      const text = resp.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const m = text.match(/\[[\s\S]*\]/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (Array.isArray(parsed)) {
          const clean = parsed
            .map((p) => ({
              title: String(p.title || "").trim(),
              description: String(p.description || "").trim(),
              skillsUsed: Array.isArray(p.skillsUsed) ? p.skillsUsed.map((s) => String(s)) : [],
              level: ["Beginner", "Intermediate", "Advanced"].includes(p.level) ? p.level : "Beginner",
            }))
            // only keep projects whose skills genuinely belong to the student's strong list
            .filter((p) => p.title && p.skillsUsed.some((sk) => promptSkills.some((ok) => ok.toLowerCase() === String(sk).toLowerCase())))
            .map((p) => ({ ...p, skillsUsed: p.skillsUsed.filter((sk) => promptSkills.some((ok) => ok.toLowerCase() === String(sk).toLowerCase())) }))
            .filter((p) => p.title);
          if (clean.length) {
            // exclude any that match existing project titles
            const existing = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
            return clean.filter((p) => !existing.has(p.title.trim().toLowerCase())).slice(0, 5);
          }
        }
      }
    } catch (err) {
      console.error("Gemini suggest failed, using fallback:", err.message);
    }
  }
  return fallbackSuggestions(promptSkills, targetRole, existingTitles);
}

const PROJECT_TEMPLATES = {
  "web development": { title: "Portfolio Web App", level: "Beginner", description: "Build a full responsive portfolio site showcasing your projects and resume with interactive sections." },
  "html": { title: "Responsive Static Website", level: "Beginner", description: "Design and build a multi-page responsive static website with modern CSS layouts and accessibility." },
  "css": { title: "Responsive Static Website", level: "Beginner", description: "Design and build a multi-page responsive static website with modern CSS layouts and accessibility." },
  "javascript": { title: "Interactive Dashboard", level: "Intermediate", description: "Build an interactive browser dashboard with live charts, filters, and DOM manipulation." },
  "react": { title: "React Task Manager", level: "Intermediate", description: "Build a stateful React app with components, hooks, routing, and localStorage persistence." },
  "node": { title: "REST API Service", level: "Intermediate", description: "Build a REST API with CRUD endpoints, authentication, and a small SQLite/Postgres store." },
  "python": { title: "Command-Line Automation", level: "Beginner", description: "Write a Python CLI tool that automates a repetitive task, processes files, and reports results." },
  "c/c++": { title: "System Utilities", level: "Intermediate", description: "Implement classic system utilities (file parser, sorting/merge tool) in C/C++ with efficient data structures." },
  "c++": { title: "System Utilities", level: "Intermediate", description: "Implement classic system utilities (file parser, sorting/merge tool) in C/C++ with efficient data structures." },
  "dsa": { title: "Algorithm Visualizer", level: "Intermediate", description: "Build a visualizer for sorting, graph, and DP algorithms that animates steps and compares complexity." },
  "data structures": { title: "Algorithm Visualizer", level: "Intermediate", description: "Build a visualizer for sorting, graph, and DP algorithms that animates steps and compares complexity." },
  "data analysis": { title: "Data Insights Notebook", level: "Intermediate", description: "Analyze a public dataset end-to-end: cleaning, EDA, correlation, and visualization into insights." },
  "machine learning": { title: "ML Predictor", level: "Intermediate", description: "Train and evaluate an ML model on a real dataset with preprocessing, feature engineering, and metrics." },
  "sql": { title: "Database Explorer", level: "Beginner", description: "Build a query tool over a sample relational database demonstrating joins, indexing, and aggregates." },
  "mysql": { title: "Database Explorer", level: "Beginner", description: "Build a query tool over a sample relational database demonstrating joins, indexing, and aggregates." },
  "git": { title: "Dev Workflow Guide", level: "Beginner", description: "Create a documented repo with branching strategy, CI hooks, and release conventions." },
};

function fallbackSuggestions(skillsList, targetRole, existingTitles = []) {
  const existing = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  const out = [];
  const used = new Set();
  for (const name of skillsList) {
    const tpl = PROJECT_TEMPLATES[String(name).toLowerCase()];
    if (!tpl) continue;
    if (existing.has(tpl.title.toLowerCase())) continue;
    if (used.has(tpl.title)) continue;
    used.add(tpl.title);
    out.push({ title: tpl.title, description: tpl.description, level: tpl.level, skillsUsed: [name, ...extraSkills(name)] });
    if (out.length >= 5) break;
  }
  if (!out.length && skillsList.length) {
    out.push({
      title: `${targetRole} Capstone Project`,
      description: `Hands-on project applying your core skills (${skillsList.slice(0, 6).join(", ")}) to a realistic ${targetRole} challenge with documentation and a demo.`,
      level: "Intermediate",
      skillsUsed: skillsList.slice(0, 6),
    });
  }
  return out;
}

function extraSkills(skillName) {
  const map = {
    "dsa": ["C/C++", "Problem Solving"],
    "data analysis": ["Python", "Pandas", "Matplotlib"],
    "machine learning": ["Python", "Scikit-learn", "Data Analysis"],
    "web development": ["HTML", "CSS", "JavaScript"],
  };
  return map[String(skillName).toLowerCase()] || [];
}

app.post("/api/projects/suggest", requireAuth, async (req, res) => {
  try {
    // Optional overrides: user can pick their own skills/role, otherwise use profile defaults
    const { skills, role } = req.body || {};
    const ctx = await getProfileSummary(req.userId);
    const skillNames = Array.isArray(skills) && skills.length
      ? skills.map(String)
      : (ctx.skills || []).map((s) => s.name);
    const targetRole = role ? String(role).trim() : (ctx.profile?.targetRole || "Software Engineer");
    // Only suggest based on skills the student actually knows decently (mastery > 20%)
    const masteryMap = new Map((ctx.skills || []).map((s) => [s.name.toLowerCase(), s.mastery ?? s.percentage ?? 0]));
    const strongSkills = skillNames.filter((n) => (masteryMap.get(String(n).toLowerCase()) || 0) > 20);
    if (!strongSkills.length) {
      skillNames.length
        ? res.status(400).json({ error: "None of your selected skills have mastery above 20%. Improve your skills first." })
        : res.status(400).json({ error: "No skills found. Add skills first or pass a skills list." });
      return;
    }
    const existingTitles = (ctx.projects || []).map((pr) => pr.title).filter(Boolean);
    const suggestions = await suggestProjectsWithAi(strongSkills, targetRole, existingTitles);
    res.json({ suggestions, role: targetRole });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// COMPARE (sorted benchmarks + leaderboard)
// ---------------------------------------------------------------------------
// canonical skill-name map so the same skill entered differently
// (SQL / sql / Databases) still groups into one cohort benchmark
const SKILL_CANONICAL = {
  sql: "databases, sql & postgresql",
  dbms: "databases, sql & postgresql",
  postgresql: "databases, sql & postgresql",
  mysql: "databases, sql & postgresql",
  mongodb: "databases, sql & postgresql",
  html: "html & css",
  html5: "html & css",
  css: "html & css",
  css3: "html & css",
  js: "javascript",
  javascript: "javascript",
  node: "node.js & express",
  nodejs: "node.js & express",
  "node js": "node.js & express",
  express: "node.js & express",
  expressjs: "node.js & express",
  react: "react",
  next: "next.js",
  nextjs: "next.js",
  dsa: "data structures & algorithms",
  ds: "data structures & algorithms",
  "data structures": "data structures & algorithms",
  python: "python",
  java: "java",
  "c/c++": "c / c++",
  cpp: "c / c++",
  "c++": "c / c++",
  ml: "machine learning",
  "machine learning": "machine learning",
  numpy: "machine learning",
  pandas: "machine learning",
  tensorflow: "machine learning",
  pytorch: "machine learning",
  keras: "machine learning",
  genai: "generative ai",
  llm: "generative ai",
  "deep learning": "deep learning",
  devops: "devops",
  docker: "devops",
  kubernetes: "devops",
  k8s: "devops",
  cloud: "cloud computing",
  linux: "cloud computing",
  git: "git & github",
  github: "git & github",
  oops: "object oriented programming",
  "object oriented programming": "object oriented programming",
  excel: "excel & spreadsheets",
  eda: "exploratory data analysis",
  gitlab: "git & github",
};

function canonicalSkillName(name) {
  const key = String(name || "").toLowerCase().trim();
  return SKILL_CANONICAL[key] || key;
}

// Resolve which students belong to a comparison scope. `all` = everyone,
// otherwise we match the current user's profile value for that dimension.
async function computeScopeUserIds(uid, scope) {
  if (scope !== "department" && scope !== "branch" && scope !== "semester") return null;
  const prof = await pool.query("SELECT branch, institution, current_semester, semester FROM profiles WHERE user_id=$1 LIMIT 1", [uid]);
  const p = prof.rows[0] || {};
  let col;
  if (scope === "department") col = "institution";
  else if (scope === "branch") col = "branch";
  else col = "current_semester"; // semester scope
  const val = p[col] || (scope === "semester" ? p.semester : "");
  if (!String(val).trim()) return null; // user hasn't set it -> fall back to all
  const q = await pool.query(
    `SELECT user_id FROM profiles WHERE ${col} IS NOT NULL AND ${col} <> '' AND ${col} = $1`,
    [val]
  );
  return new Set(q.rows.map((r) => r.user_id));
}

// Compute REAL per-skill cohort + top-10% benchmarks from every student's
// actual mastery. Skills are grouped by canonical name; cohortAvg = mean
// mastery of everyone who tracks that skill, top10Avg = mean mastery of the
// top 10% of that group (min 1 student).
async function computeSkillBenchmarks(uid, allowedUserIds = null) {
  const all = await pool.query(
    "SELECT user_id, name, mastery FROM skills ORDER BY mastery DESC"
  );
  const groups = new Map(); // canonical name -> [{userId, mastery}]
  for (const row of all.rows) {
    if (allowedUserIds && !allowedUserIds.has(row.user_id)) continue;
    const key = canonicalSkillName(row.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ userId: row.user_id, mastery: row.mastery });
  }
  const bench = {};
  for (const [key, raw] of groups) {
    const rows = [];
    const seen = new Set(); // count each student once, keep their best mastery row
    for (const r of raw) {
      if (seen.has(r.userId)) continue;
      seen.add(r.userId);
      rows.push(r);
    }
    const n = rows.length;
    const avg = (arr) => Math.round(arr.reduce((a, b) => a + b.mastery, 0) / arr.length);
    const topN = Math.max(1, Math.ceil(n * 0.1));
    bench[key] = {
      n,
      cohortAvg: avg(rows),
      top10Avg: avg(rows.slice(0, topN)), // rows already sorted mastery DESC
      userRank: 0,
    };
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].userId === uid) {
        bench[key].userRank = i + 1; // 1-based rank within this skill's cohort
        break;
      }
    }
  }
  return bench;
}

// Overall student rank across every tracked skill (sum of mastery).
async function computeOverallRank(uid, allowedUserIds = null) {
  const cond = allowedUserIds && allowedUserIds.size
    ? ` WHERE user_id = ANY($1::int[])`
    : "";
  const params = allowedUserIds && allowedUserIds.size ? [[...allowedUserIds]] : [];
  const r = await pool.query(
    `SELECT user_id, SUM(mastery)::int AS total,
            ROW_NUMBER() OVER (ORDER BY SUM(mastery) DESC)::int AS rank
     FROM skills${cond} GROUP BY user_id`,
    params
  );
  const totalStudents = r.rows.length;
  const mine = r.rows.find((x) => x.user_id === uid);
  return {
    totalStudents,
    userRank: mine ? mine.rank : 0,
    userTotal: mine ? mine.total : 0,
  };
}

app.get("/api/compare", requireAuth, async (req, res) => {
  try {
    const uid = req.userId;
    const sortBy = req.query.sort || "branch";
    const scope = req.query.scope || "all";
    const allowed = await computeScopeUserIds(uid, scope);
    const skillsRes = await pool.query("SELECT * FROM skills WHERE user_id=$1 ORDER BY id", [uid]);
    const [bench, rankInfo] = await Promise.all([
      computeSkillBenchmarks(uid, allowed),
      computeOverallRank(uid, allowed),
    ]);
    const skills = skillsRes.rows.map((s) => {
      const key = canonicalSkillName(s.name);
      const b = bench[key] || { cohortAvg: s.mastery, top10Avg: s.mastery, n: 1 };
      const mastery = s.mastery;
      return {
        id: String(s.id),
        name: s.name,
        category: s.category,
        platform: s.platform,
        userScore: mastery,
        mastery,
        cohortAvg: b.cohortAvg,
        top10Avg: b.top10Avg,
        cohortSize: b.n,
        userRankInSkill: b.userRank,
        questionsSolved: s.questions_solved,
        totalQuestions: s.total_questions,
        status: s.status,
        requiredLevel: s.required_level,
        updatedAt: s.updated_at ? s.updated_at.toISOString() : null,
      };
    });
    const sorted = sortSkills(skills, sortBy);
    const cohorts = [
      {
        id: scope === "all" ? "all_students" : `scope_${scope}`,
        name: `${scope === "all" ? "All Students" : scope[0].toUpperCase() + scope.slice(1)} (${rankInfo.totalStudents})`,
        totalStudents: rankInfo.totalStudents,
        userRank: rankInfo.userRank,
      },
    ];
    res.json({ skills: sorted, cohorts, sort: sortBy, scope });
  } catch (err) {
    sendServerError(res, err);
  }
});

function sortSkills(skills, sortBy) {
  const arr = [...skills];
  if (sortBy === "mastery") arr.sort((a, b) => b.mastery - a.mastery);
  else if (sortBy === "category") arr.sort((a, b) => a.category.localeCompare(b.category));
  else if (sortBy === "recent") arr.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  else arr.sort((a, b) => a.mastery - b.mastery); // default: weakest first
  return arr;
}

app.post("/api/compare/skills", requireAuth, async (req, res) => {
  try {
    const { name, category, platform, totalQuestions } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const dupKey = String(name).toLowerCase().trim();
    const mine = await pool.query("SELECT name FROM skills WHERE user_id=$1", [req.userId]);
    if (mine.rows.some((r) => String(r.name).toLowerCase().trim() === dupKey)) {
      return res.status(400).json({ error: `You already track "${String(name).trim()}" — skill names are always unique` });
    }
    const cat = category || "General CS";
    const total = Math.max(1, parseInt(totalQuestions, 10) || 5);
    const ref = SKILL_PLATFORM[platform?.toLowerCase()] || { cohort: 60, top: 90 };
    const ins = await pool.query(
      `INSERT INTO skills (user_id, name, category, platform, questions_solved, total_questions, cohort_avg, top_avg, mastery, required_level)
       VALUES ($1,$2,$3,$4,0,$5,$6,$7,0,80) RETURNING id`,
      [req.userId, String(name).toUpperCase().trim(), cat, platform || "", total, ref.cohort, ref.top]
    );
    await createCheckpoints(req.userId, ins.rows[0].id, total);
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------------------
app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("SELECT id, type, title, detail, is_read, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5", [req.userId]);
    res.json({ notifications: r.rows });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/notifications/read/:id", requireAuth, async (req, res) => {
  await pool.query("UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// ANONYMOUS CLUBS (identity never revealed — text + emoji only)
// ---------------------------------------------------------------------------
// Stable, unguessable anonymous handle per user (same every time they post).
function anonymousHandle(uid) {
  return "Student #" + ((((uid * 2654435761) % 8999) + 1000) | 0);
}

app.get("/api/clubs", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.name, c.description, c.emoji,
              COUNT(m.id)::int AS members,
              EXISTS(SELECT 1 FROM club_members me WHERE me.club_id = c.id AND me.user_id = $1) AS joined
       FROM clubs c
       LEFT JOIN club_members m ON m.club_id = c.id
       GROUP BY c.id ORDER BY c.id`,
      [req.userId]
    );
    res.json({ clubs: r.rows, me: anonymousHandle(req.userId) });
  } catch (err) {
    sendServerError(res, err);
  }
});

// Explicit join/leave so the member count reflects who really joined
app.post("/api/club/:id/join", requireAuth, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    if (!clubId || Number.isNaN(clubId)) return res.status(400).json({ error: "Invalid club" });
    const club = await pool.query("SELECT id FROM clubs WHERE id=$1", [clubId]);
    if (club.rowCount === 0) return res.status(404).json({ error: "Club not found" });
    await pool.query(
      "INSERT INTO club_members (club_id, user_id) VALUES ($1,$2) ON CONFLICT (club_id, user_id) DO NOTHING",
      [clubId, req.userId]
    );
    const n = await pool.query("SELECT COUNT(*)::int AS members FROM club_members WHERE club_id=$1", [clubId]);
    res.json({ joined: true, members: n.rows[0].members });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/club/:id/leave", requireAuth, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    if (!clubId || Number.isNaN(clubId)) return res.status(400).json({ error: "Invalid club" });
    await pool.query("DELETE FROM club_members WHERE club_id=$1 AND user_id=$2", [clubId, req.userId]);
    const n = await pool.query("SELECT COUNT(*)::int AS members FROM club_members WHERE club_id=$1", [clubId]);
    res.json({ joined: false, members: n.rows[0].members });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.get("/api/club/:id/messages", requireAuth, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    if (!clubId || Number.isNaN(clubId)) return res.status(400).json({ error: "Invalid club" });
    const after = parseInt(req.query.after, 10) || 0;
    const club = await pool.query("SELECT id FROM clubs WHERE id=$1", [clubId]);
    if (club.rowCount === 0) return res.status(404).json({ error: "Club not found" });
    const r = await pool.query(
      `SELECT id, user_id, text, created_at
       FROM club_messages WHERE club_id = $1 AND id > $2
       ORDER BY id DESC LIMIT 100`,
      [clubId, after]
    );
    const me = anonymousHandle(req.userId);
    const messages = r.rows.reverse().map((m) => ({
      id: m.id,
      text: m.text,
      handle: m.user_id === req.userId ? me : anonymousHandle(m.user_id),
      // uid is an unguessable numeric id — never revealing-to-identity; used
      // only so anyone can send an anonymous PM request to a specific person
      senderUid: m.user_id,
      isMine: m.user_id === req.userId,
      createdAt: m.created_at ? m.created_at.toISOString() : null,
    }));
    res.json({ messages });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/club/:id/messages", requireAuth, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    if (!clubId || Number.isNaN(clubId)) return res.status(400).json({ error: "Invalid club" });
    const text = safeString(req.body.text, 300).trim();
    if (!text) return res.status(400).json({ error: "Message cannot be empty" });
    // text + emoji only: strip anything that is not letters, digits, emoji or punctuation
    if (text.length > 300) return res.status(400).json({ error: "Message too long (max 300)" });
    const club = await pool.query("SELECT id FROM clubs WHERE id=$1", [clubId]);
    if (club.rowCount === 0) return res.status(404).json({ error: "Club not found" });
    const member = await pool.query(
      "SELECT 1 FROM club_members WHERE club_id=$1 AND user_id=$2",
      [clubId, req.userId]
    );
    if (member.rowCount === 0) {
      return res.status(403).json({ error: "Pehle club join karo — chat sirf members ke liye hai" });
    }
    const r = await pool.query(
      `INSERT INTO club_messages (club_id, user_id, text)
       VALUES ($1,$2,$3) RETURNING id, user_id, text, created_at`,
      [clubId, req.userId, text]
    );
    const row = r.rows[0];
    const me = anonymousHandle(req.userId);
    res.json({
      message: {
        id: row.id,
        text: row.text,
        handle: me,
        isMine: true,
        createdAt: row.created_at ? row.created_at.toISOString() : null,
      },
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// ANONYMOUS FRIENDS & DMs (chat request -> approve -> friend -> DM)
// Identity is NEVER revealed: handles are always "Student #XXXX"
// ---------------------------------------------------------------------------
async function friendsWith(a, b) {
  const small = Math.min(a, b);
  const big = Math.max(a, b);
  const r = await pool.query("SELECT 1 FROM friends WHERE user_a=$1 AND user_b=$2", [small, big]);
  return r.rowCount > 0;
}
async function blockedEither(a, b) {
  const r = await pool.query(
    "SELECT 1 FROM blocked_users WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1",
    [a, b]
  );
  return r.rowCount > 0;
}
async function pendingRequestBetween(a, b) {
  const r = await pool.query(
    "SELECT id, from_user_id, status FROM chat_requests WHERE ((from_user_id=$1 AND to_user_id=$2) OR (from_user_id=$2 AND to_user_id=$1)) AND status='pending'",
    [a, b]
  );
  return r.rows[0] || null;
}
// After a request is declined, the requester waits 5 minutes before the same
// pair can be asked again (either direction) — prevents spam re-requests.
async function recentlyDeclined(a, b) {
  const r = await pool.query(
    `SELECT 1 FROM chat_requests
     WHERE status='declined'
       AND ((from_user_id=$1 AND to_user_id=$2) OR (from_user_id=$2 AND to_user_id=$1))
       AND created_at > NOW() - INTERVAL '5 minutes'
     LIMIT 1`,
    [a, b]
  );
  return r.rowCount > 0;
}

app.get("/api/friends", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT CASE WHEN user_a=$1 THEN user_b ELSE user_a END AS fid
       FROM friends WHERE user_a=$1 OR user_b=$1`,
      [req.userId]
    );
    res.json({ friends: r.rows.map((row) => ({ id: row.fid, handle: anonymousHandle(row.fid) })) });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.get("/api/friends/requests", requireAuth, async (req, res) => {
  try {
    const inc = await pool.query(
      `SELECT r.id, r.from_user_id, r.created_at FROM chat_requests r
       WHERE r.to_user_id=$1 AND r.status='pending' ORDER BY r.id DESC`,
      [req.userId]
    );
    const out = await pool.query(
      `SELECT r.id, r.to_user_id, r.status, r.created_at FROM chat_requests r
       WHERE r.from_user_id=$1 ORDER BY r.id DESC`,
      [req.userId]
    );
    res.json({
      incoming: inc.rows.map((r) => ({
        id: r.id,
        fromHandle: anonymousHandle(r.from_user_id),
        createdAt: r.created_at ? r.created_at.toISOString() : null,
      })),
      outgoing: out.rows.map((r) => ({
        id: r.id,
        toHandle: anonymousHandle(r.to_user_id),
        status: r.status,
        createdAt: r.created_at ? r.created_at.toISOString() : null,
      })),
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

// One request endpoint for every trigger: username search, uid (from club
// message PM button), or scanned QR payload. Returns the relationship state.
app.post("/api/friends/request", requireAuth, async (req, res) => {
  try {
    let targetId = null;
    const username = safeString(req.body.username, 60).trim().toLowerCase();
    const uid = parseInt(req.body.uid, 10) || 0;
    let code = safeString(req.body.code, 200).trim();
    if (username) {
      const r = await pool.query("SELECT id FROM users WHERE LOWER(username)=$1", [username]);
      if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });
      targetId = r.rows[0].id;
    } else if (uid) {
      targetId = uid;
    } else if (code) {
      if (code.startsWith("CAMPUSAI|")) code = code.slice("CAMPUSAI|".length);
      const parts = code.split("|");
      if (parts.length < 2) return res.status(400).json({ error: "Invalid QR code" });
      const [idPart, token] = parts;
      const uidFromCode = parseInt(idPart, 10) || 0;
      const r = await pool.query("SELECT id FROM users WHERE id=$1 AND qr_token=$2", [uidFromCode, token]);
      if (r.rowCount === 0) return res.status(404).json({ error: "Invalid QR code" });
      targetId = uidFromCode;
    } else {
      return res.status(400).json({ error: "username, uid or code required" });
    }

    if (targetId === req.userId) return res.status(400).json({ error: "You cannot add yourself" });
    const target = await pool.query("SELECT id FROM users WHERE id=$1", [targetId]);
    if (target.rowCount === 0) return res.status(404).json({ error: "User not found" });
    if (await blockedEither(req.userId, targetId)) {
      return res.status(403).json({ error: "This request is not possible right now" });
    }
    if (await friendsWith(req.userId, targetId)) {
      return res.json({ relation: "friends", friend: { id: targetId, handle: anonymousHandle(targetId) } });
    }
    if (await recentlyDeclined(req.userId, targetId)) {
      return res.status(429).json({ error: "Request abhi decline hui hai — 5 minute baad phir se bhejna" });
    }
    const pending = await pendingRequestBetween(req.userId, targetId);
    if (pending) {
      if (pending.from_user_id === req.userId) {
        return res.json({ relation: "requested", requestId: pending.id, toHandle: anonymousHandle(targetId) });
      }
      return res.json({ relation: "pending", requestId: pending.id });
    }
    const ins = await pool.query(
      `INSERT INTO chat_requests (from_user_id, to_user_id)
       VALUES ($1,$2)
       ON CONFLICT (from_user_id, to_user_id)
       DO UPDATE SET status='pending', created_at=NOW()
       RETURNING id`,
      [req.userId, targetId]
    );
    res.json({ relation: "requested", requestId: ins.rows[0].id, toHandle: anonymousHandle(targetId) });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/friends/requests/:id/accept", requireAuth, async (req, res) => {
  try {
    const rid = parseInt(req.params.id, 10) || 0;
    const r = await pool.query(
      "SELECT id, from_user_id, to_user_id FROM chat_requests WHERE id=$1 AND to_user_id=$2 AND status='pending'",
      [rid, req.userId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Request not found" });
    const { from_user_id: fromId } = r.rows[0];
    if (await blockedEither(req.userId, fromId)) {
      return res.status(403).json({ error: "This request is not possible right now" });
    }
    await pool.query("UPDATE chat_requests SET status='accepted' WHERE id=$1", [rid]);
    const small = Math.min(req.userId, fromId);
    const big = Math.max(req.userId, fromId);
    await pool.query(
      "INSERT INTO friends (user_a, user_b) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [small, big]
    );
    res.json({ friend: { id: fromId, handle: anonymousHandle(fromId) } });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/friends/requests/:id/decline", requireAuth, async (req, res) => {
  try {
    const rid = parseInt(req.params.id, 10) || 0;
    const r = await pool.query(
      "UPDATE chat_requests SET status='declined' WHERE id=$1 AND to_user_id=$2 AND status='pending' RETURNING id",
      [rid, req.userId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Request not found" });
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/friends/:id/block", requireAuth, async (req, res) => {
  try {
    const other = parseInt(req.params.id, 10) || 0;
    if (!other || other === req.userId) return res.status(400).json({ error: "Invalid user" });
    await pool.query(
      "INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [req.userId, other]
    );
    const small = Math.min(req.userId, other);
    const big = Math.max(req.userId, other);
    await pool.query("DELETE FROM friends WHERE user_a=$1 AND user_b=$2", [small, big]);
    await pool.query(
      "DELETE FROM chat_requests WHERE (from_user_id=$1 AND to_user_id=$2) OR (from_user_id=$2 AND to_user_id=$1)",
      [req.userId, other]
    );
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/friends/:id/unblock", requireAuth, async (req, res) => {
  try {
    const other = parseInt(req.params.id, 10) || 0;
    if (!other) return res.status(400).json({ error: "Invalid user" });
    await pool.query(
      "DELETE FROM blocked_users WHERE blocker_id=$1 AND blocked_id=$2",
      [req.userId, other]
    );
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.get("/api/friends/blocked", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("SELECT blocked_id FROM blocked_users WHERE blocker_id=$1", [req.userId]);
    res.json({ blocked: r.rows.map((row) => ({ id: row.blocked_id, handle: anonymousHandle(row.blocked_id) })) });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.get("/api/dms/:friendId/messages", requireAuth, async (req, res) => {
  try {
    const fid = parseInt(req.params.friendId, 10) || 0;
    if (!fid || fid === req.userId) return res.status(400).json({ error: "Invalid chat" });
    if (!(await friendsWith(req.userId, fid))) return res.status(403).json({ error: "Not friends yet" });
    if (await blockedEither(req.userId, fid)) return res.status(403).json({ error: "Chat unavailable" });
    const after = parseInt(req.query.after, 10) || 0;
    const r = await pool.query(
      `SELECT id, sender_id, text, created_at
       FROM dm_messages WHERE ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)) AND id>$3
       ORDER BY id DESC LIMIT 100`,
      [req.userId, fid, after]
    );
    const me = anonymousHandle(req.userId);
    const messages = r.rows.reverse().map((m) => ({
      id: m.id,
      text: m.text,
      handle: m.sender_id === req.userId ? me : anonymousHandle(m.sender_id),
      isMine: m.sender_id === req.userId,
      createdAt: m.created_at ? m.created_at.toISOString() : null,
    }));
    res.json({ messages });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/dms/:friendId/messages", requireAuth, async (req, res) => {
  try {
    const fid = parseInt(req.params.friendId, 10) || 0;
    if (!fid || fid === req.userId) return res.status(400).json({ error: "Invalid chat" });
    if (!(await friendsWith(req.userId, fid))) return res.status(403).json({ error: "Not friends yet" });
    if (await blockedEither(req.userId, fid)) return res.status(403).json({ error: "Chat unavailable" });
    const text = safeString(req.body.text, 300).trim();
    if (!text) return res.status(400).json({ error: "Message cannot be empty" });
    if (text.length > 300) return res.status(400).json({ error: "Message too long (max 300)" });
    const r = await pool.query(
      `INSERT INTO dm_messages (sender_id, receiver_id, text)
       VALUES ($1,$2,$3) RETURNING id, sender_id, text, created_at`,
      [req.userId, fid, text]
    );
    const row = r.rows[0];
    res.json({
      message: {
        id: row.id,
        text: row.text,
        handle: anonymousHandle(req.userId),
        isMine: true,
        createdAt: row.created_at ? row.created_at.toISOString() : null,
      },
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.get("/api/me/qrcode", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("SELECT qr_token FROM users WHERE id=$1", [req.userId]);
    const token = (r.rows[0] && r.rows[0].qr_token) || "";
    res.json({ code: `CAMPUSAI|${req.userId}|${token}` });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// SUPER ADMIN (user management)
// ---------------------------------------------------------------------------
app.get("/api/admin/users", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const q = safeString(req.query.q, 60).trim();
    const r = q
      ? await pool.query(
          `SELECT id, username, email, roll_no, role, created_at FROM users
           WHERE LOWER(username) LIKE LOWER($1) OR LOWER(email) LIKE LOWER($1) OR roll_no LIKE $1
           ORDER BY id LIMIT 100`,
          [`%${q}%`]
        )
      : await pool.query(
          `SELECT id, username, email, roll_no, role, created_at FROM users ORDER BY id LIMIT 300`
        );
    res.json({ users: r.rows });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/admin/users/:id/role", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10) || 0;
    if (id === req.userId) return res.status(400).json({ error: "Apna role khud nahi badal sakte" });
    const role = String(req.body.role || "").trim();
    const allowed = ["student", "placement_officer", "club_manager", "faculty", "super_admin"];
    if (!allowed.includes(role)) return res.status(400).json({ error: "Invalid role" });
    const r = await pool.query("UPDATE users SET role=$2 WHERE id=$1 RETURNING id, username, role", [id, role]);
    if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: r.rows[0] });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete("/api/admin/users/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10) || 0;
    if (id === req.userId) return res.status(400).json({ error: "Apna account yahan delete nahi kar sakte" });
    const r = await pool.query("DELETE FROM users WHERE id=$1 RETURNING id", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// CLUB MANAGEMENT (super admin appoints club managers; managers moderate)
// ---------------------------------------------------------------------------
app.get("/api/admin/clubs", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.name, c.description, c.emoji,
              COUNT(DISTINCT m.user_id)::int AS members,
              COALESCE(JSON_AGG(DISTINCT jsonb_build_object('id', u.id, 'username', u.username)) FILTER (WHERE u.id IS NOT NULL), '[]') AS managers
       FROM clubs c
       LEFT JOIN club_members m ON m.club_id = c.id
       LEFT JOIN club_managers cm ON cm.club_id = c.id
       LEFT JOIN users u ON u.id = cm.user_id
       GROUP BY c.id ORDER BY c.id`
    );
    // build handle server-side per manager user id
    const clubs = r.rows.map((c) => ({
      ...c,
      managers: (c.managers || []).map((m) => ({ ...m, handle: anonymousHandle(m.id) })),
    }));
    res.json({ clubs });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/admin/clubs", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const name = safeString(req.body.name, 80).trim();
    const description = safeString(req.body.description, 300).trim();
    const emoji = safeString(req.body.emoji, 10).trim() || "💬";
    if (!name) return res.status(400).json({ error: "Club name is required" });
    const r = await pool.query(
      "INSERT INTO clubs (name, description, emoji) VALUES ($1,$2,$3) ON CONFLICT (name) DO NOTHING RETURNING id, name, description, emoji",
      [name, description, emoji]
    );
    if (r.rowCount === 0) return res.status(409).json({ error: "Is naam ka club pehle se hai" });
    res.status(201).json({ club: r.rows[0] });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete("/api/admin/clubs/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10) || 0;
    const r = await pool.query("DELETE FROM clubs WHERE id=$1 RETURNING id", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Club not found" });
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// Super admin appoints / removes a club manager for a specific club
app.post("/api/admin/clubs/:id/managers", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10) || 0;
    const userId = parseInt(req.body.userId, 10) || 0;
    if (!clubId || !userId) return res.status(400).json({ error: "Club and user are required" });
    const club = await pool.query("SELECT id FROM clubs WHERE id=$1", [clubId]);
    if (club.rowCount === 0) return res.status(404).json({ error: "Club not found" });
    const user = await pool.query("SELECT id, username FROM users WHERE id=$1", [userId]);
    if (user.rowCount === 0) return res.status(404).json({ error: "User not found" });
    await pool.query(
      "INSERT INTO club_managers (club_id, user_id) VALUES ($1,$2) ON CONFLICT (club_id, user_id) DO NOTHING",
      [clubId, userId]
    );
    await pool.query("UPDATE users SET role='club_manager' WHERE id=$1 AND role='student'", [userId]);
    res.json({ success: true, manager: { id: userId, username: user.rows[0].username, handle: anonymousHandle(userId) } });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete("/api/admin/clubs/:id/managers/:userId", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10) || 0;
    const userId = parseInt(req.params.userId, 10) || 0;
    await pool.query("DELETE FROM club_managers WHERE club_id=$1 AND user_id=$2", [clubId, userId]);
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// Club manager view: clubs they manage
app.get("/api/manager/clubs", requireAuth, requireRole("club_manager", "super_admin"), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.name, c.description, c.emoji
       FROM club_managers cm JOIN clubs c ON c.id = cm.club_id
       WHERE cm.user_id = $1 ORDER BY c.id`,
      [req.userId]
    );
    res.json({ clubs: r.rows });
  } catch (err) {
    sendServerError(res, err);
  }
});

// Club manager: recent messages in a club they manage (for moderation)
app.get("/api/manager/clubs/:id/messages", requireAuth, requireRole("club_manager", "super_admin"), async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10) || 0;
    const ok = await pool.query(
      "SELECT 1 FROM club_managers WHERE club_id=$1 AND user_id=$2",
      [clubId, req.userId]
    );
    if (ok.rowCount === 0 && req.role !== "super_admin") {
      return res.status(403).json({ error: "Tum is club ke manager nahi ho" });
    }
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const r = await pool.query(
      `SELECT id, text, created_at FROM club_messages
       WHERE club_id = $1 ORDER BY id DESC LIMIT $2`,
      [clubId, limit]
    );
    const messages = r.rows.reverse().map((m) => ({
      id: m.id,
      text: m.text,
      createdAt: m.created_at ? m.created_at.toISOString() : null,
    }));
    res.json({ messages });
  } catch (err) {
    sendServerError(res, err);
  }
});

// Club manager moderates: delete any message in their club (anonymously —
// reporter never sees who wrote it, only the text)
app.delete("/api/manager/clubs/:id/messages/:messageId", requireAuth, requireRole("club_manager", "super_admin"), async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10) || 0;
    const messageId = parseInt(req.params.messageId, 10) || 0;
    const ok = await pool.query(
      "SELECT 1 FROM club_managers WHERE club_id=$1 AND user_id=$2",
      [clubId, req.userId]
    );
    if (ok.rowCount === 0 && req.role !== "super_admin") {
      return res.status(403).json({ error: "Tum is club ke manager nahi ho" });
    }
    const r = await pool.query("DELETE FROM club_messages WHERE id=$1 AND club_id=$2 RETURNING id", [messageId, clubId]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Message not found" });
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// FACULTY (cohort-level stats, never names/identities)
// ---------------------------------------------------------------------------
app.get("/api/faculty/stats", requireAuth, requireRole("faculty", "placement_officer", "super_admin"), async (req, res) => {
  try {
    const [users, skillStats, topSkills, clubsActive] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total FROM users WHERE role='student'"),
      pool.query(
        `SELECT ROUND(AVG(s.percentage))::int AS avg_skill_percentage, COUNT(DISTINCT s.user_id)::int AS students_with_skills
         FROM skills s`
      ),
      pool.query(
        `SELECT s.name, COUNT(*)::int AS students, ROUND(AVG(s.percentage))::int AS avg_percentage
         FROM skills s GROUP BY s.name ORDER BY students DESC, avg_percentage DESC LIMIT 12`
      ),
      pool.query(
        `SELECT COUNT(DISTINCT club_id)::int AS active_clubs,
                COUNT(*)::int AS total_memberships,
                COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN club_id END)::int AS active_last_7d
         FROM club_members`
      ),
    ]);
    res.json({
      stats: {
        totalStudents: users.rows[0].total,
        avgSkillPercentage: skillStats.rows[0].avg_skill_percentage,
        studentsWithSkills: skillStats.rows[0].students_with_skills,
        topSkills: topSkills.rows,
        clubsActive: clubsActive.rows[0].active_clubs,
        clubsMemberships: clubsActive.rows[0].total_memberships,
        clubsActiveLast7d: clubsActive.rows[0].active_last_7d,
      },
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// PLACEMENT (on-campus drive feed)
// ---------------------------------------------------------------------------
app.get("/api/placement/drives", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, company, role, package, deadline, status FROM placement_drives ORDER BY id"
    );
    res.json({ drives: r.rows });
  } catch (err) {
    sendServerError(res, err);
  }
});

// Drives CRUD — Placement Officer + Super Admin only
app.post("/api/placement/drives", requireAuth, requireRole("placement_officer", "super_admin"), async (req, res) => {
  try {
    const company = safeString(req.body.company, 120).trim();
    const role = safeString(req.body.role, 120).trim();
    const pkg = safeString(req.body.package, 60).trim();
    const deadline = safeString(req.body.deadline, 120).trim();
    const status = ["open", "upcoming", "closed"].includes(String(req.body.status)) ? String(req.body.status) : "open";
    if (!company) return res.status(400).json({ error: "Company name is required" });
    const r = await pool.query(
      `INSERT INTO placement_drives (company, role, package, deadline, status)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, company, role, package, deadline, status`,
      [company, role, pkg, deadline, status]
    );
    res.status(201).json({ drive: r.rows[0] });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.patch("/api/placement/drives/:id", requireAuth, requireRole("placement_officer", "super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10) || 0;
    const company = safeString(req.body.company, 120).trim();
    const role = safeString(req.body.role, 120).trim();
    const pkg = safeString(req.body.package, 60).trim();
    const deadline = safeString(req.body.deadline, 120).trim();
    const status = ["open", "upcoming", "closed"].includes(String(req.body.status)) ? String(req.body.status) : null;
    if (!company) return res.status(400).json({ error: "Company name is required" });
    const r = await pool.query(
      `UPDATE placement_drives
       SET company=$2, role=$3, package=$4, deadline=$5, status=COALESCE($6, status)
       WHERE id=$1 RETURNING id, company, role, package, deadline, status`,
      [id, company, role, pkg, deadline, status]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Drive not found" });
    res.json({ drive: r.rows[0] });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete("/api/placement/drives/:id", requireAuth, requireRole("placement_officer", "super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10) || 0;
    const r = await pool.query("DELETE FROM placement_drives WHERE id=$1 RETURNING id", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Drive not found" });
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// Company question bank: PO / Super Admin share questions + frequency for a
// specific company; every student can browse them.
app.get("/api/placement/company-questions", requireAuth, async (req, res) => {
  try {
    const company = safeString(req.query.company, 120).trim();
    const r = company
      ? await pool.query(
          `SELECT q.id, q.company, q.question, q.frequency, q.created_at
           FROM placement_company_questions q
           WHERE LOWER(q.company) = LOWER($1)
           ORDER BY q.frequency DESC, q.id`,
          [company]
        )
      : await pool.query(
          `SELECT q.id, q.company, q.question, q.frequency, q.created_at
           FROM placement_company_questions q
           ORDER BY q.company, q.frequency DESC, q.id`
        );
    res.json({ questions: r.rows });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.get("/api/placement/company-questions/companies", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT company, COUNT(*)::int AS question_count, MAX(frequency) AS max_frequency
       FROM placement_company_questions
       GROUP BY company ORDER BY company`
    );
    res.json({ companies: r.rows });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.post("/api/placement/company-questions", requireAuth, requireRole("placement_officer", "super_admin"), async (req, res) => {
  try {
    const company = safeString(req.body.company, 120).trim();
    const question = safeString(req.body.question, 500).trim();
    const frequency = Math.max(1, Math.min(100, parseInt(req.body.frequency, 10) || 1));
    if (!company || !question) return res.status(400).json({ error: "Company and question are required" });
    const r = await pool.query(
      `INSERT INTO placement_company_questions (company, question, frequency, added_by)
       VALUES ($1,$2,$3,$4) RETURNING id, company, question, frequency, created_at`,
      [company, question, frequency, req.userId]
    );
    res.status(201).json({ question: r.rows[0] });
  } catch (err) {
    sendServerError(res, err);
  }
});

app.delete("/api/placement/company-questions/:id", requireAuth, requireRole("placement_officer", "super_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10) || 0;
    const r = await pool.query("DELETE FROM placement_company_questions WHERE id=$1 RETURNING id", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Question not found" });
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
});

// AI placement question suggester: company + difficulty -> questions with
// real-world metadata (how often asked, which years, which skills needed).
app.post("/api/placement/questions", requireAuth, async (req, res) => {
  try {
    const c = safeString(req.body.company, 100).trim();
    if (!c) return res.status(400).json({ error: "Company name is required" });
    const lvl = ["basic", "intermediate", "hard"].includes(String(req.body.level).toLowerCase())
      ? String(req.body.level).toLowerCase()
      : "basic";
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        company: c, level: lvl,
        questions: [
          { question: `Tell us about yourself and why you want to join ${c}.`, frequency: 90, years: ["2019", "2020", "2021", "2022", "2023", "2024", "2025"], skills: ["Communication"], difficulty: "basic" },
          { question: `What is your approach to solving a coding problem under time pressure?`, frequency: 75, years: ["2020", "2022", "2023", "2024", "2025"], skills: ["DSA", "Problem Solving"], difficulty: lvl },
          { question: `Explain a project you built and the challenges you faced.`, frequency: 80, years: ["2019", "2021", "2023", "2025"], skills: ["Project Work", "Presentations"], difficulty: "basic" },
        ],
      });
    }
    const ai = new GoogleGenAI({ apiKey });
    const prompt =
      `You are an Indian campus placement expert. Generate exactly 6 REALISTIC interview questions that ` +
      `students are actually asked at ${c} (India campus recruitment, fresher level) at ${lvl.toUpperCase()} difficulty ` +
      `(basic = common/hr/fundamental, intermediate = moderate technical, hard = deep technical/problem solving).\n` +
      `IMPORTANT constraints:\n` +
      `- Only questions genuinely associated with ${c}'s hiring process; if unknown, use typical Indian IT recruiter questions for that role.\n` +
      `- Sort the 6 questions by RELEVANCE (most commonly asked first).\n` +
      `- For EVERY question give realistic interview-stat metadata:\n` +
      `  "frequency": integer 1-100 (how often this question appears in real drives, be honest: HR rounds ~70-90, core DSA ~60-85, niche tech lower)\n` +
      `  "years": array of strings (realistic years the question trended in, e.g. ["2020","2022","2023","2025"])\n` +
      `  "skills": 1-4 skills a student needs to answer it well (e.g. ["Arrays","Time Complexity"])\n` +
      `  "difficulty": "basic" | "intermediate" | "hard"\n` +
      `Return ONLY a JSON array, no markdown, no explanation:\n` +
      `[{"question":"...","frequency":85,"years":["2020","2022","2024"],"skills":["DSA","Arrays"],"difficulty":"basic"}]`;
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature: 0.4 },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timed out")), 25000)),
    ]);
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || "";
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return res.status(502).json({ error: "AI could not generate questions. Please try again." });
    const parsed = JSON.parse(m[0]);
    const questions = (Array.isArray(parsed) ? parsed : parsed.questions || [])
      .slice(0, 8)
      .map((q) => ({
        question: String(q.question || "").trim().slice(0, 500),
        frequency: Math.max(1, Math.min(100, parseInt(q.frequency, 10) || 1)),
        years: Array.isArray(q.years) ? q.years.filter((y) => typeof y === "string" || typeof y === "number").map(String).slice(0, 10) : [],
        skills: Array.isArray(q.skills) ? q.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 8) : [],
        difficulty: ["basic", "intermediate", "hard"].includes(String(q.difficulty).toLowerCase()) ? String(q.difficulty).toLowerCase() : lvl,
      }))
      .filter((q) => q.question)
      .sort((a, b) => b.frequency - a.frequency);
    if (!questions.length) return res.status(502).json({ error: "AI returned no questions. Please try again." });
    res.json({ company: c, level: lvl, questions });
  } catch (err) {
    sendServerError(res, err);
  }
});

// ---------------------------------------------------------------------------
// AI MENTOR
// ---------------------------------------------------------------------------
app.post("/api/mentor", requireAuth, async (req, res) => {
  try {
    const { message, history } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const username = req.username;
    if (!apiKey) {
      return res.json({
        reply: `Hi ${username}! I'm your CampusAI Academic Mentor (Gemini integration pending). Regarding "${message}", I recommend focusing on structured learning paths, building 2-3 portfolio projects, and optimizing your resume keywords for ATS parsing.`,
      });
    }
    // ---- CORE INSTRUCTION: "How to learn [Topic]?" must check the curated PDF knowledge base first ----
    const learningIntent =
      /(how (to|do i|can i) (learn|start|master|study|prepare)|learn (a )?skill|learning (roadmap|path)|sikhu|sikhe|sikhte|roadmap for|resources (to|for) learn|best way to learn|teach me|want to learn|start learning|study plan for)/i.test(message);
    if (learningIntent) {
      const kbMatch = searchKnowledgeBase(message);
      if (kbMatch) {
        // Step 2: topic IS in the PDFs -> give the exact curated links directly.
        return res.json({ reply: formatKnowledgeReply(kbMatch, username) });
      }
      // Step 3: topic NOT in the PDFs -> acknowledge + generate a roadmap with links.
      const ack = notFoundAck(message.replace(/\?+$/, "").trim() || message, username);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const AI_ROADMAP_TIMEOUT_MS = 15000;
        const resp = await Promise.race([
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
              role: "user",
              parts: [{ text:
                `The user (${username}) asked: "${message}" about learning a new skill. ` +
                `This topic is NOT in the curated syllabus PDF. As their AI Mentor, build a clear, step-by-step roadmap for a complete beginner ` +
                `to master this skill. For EVERY step, provide a high-quality, real and up-to-date link: official documentation, trusted tutorials ` +
                `(freeCodeCamp, MDN, GeeksforGeeks, official docs, YouTube channels, Coursera/edX free courses). ONLY use links you are confident exist. ` +
                `Format the answer as a numbered markdown list: "Step 1: <goal> - <link>". Keep it encouraging and practical, max 8 steps. ` +
                `Do NOT mention that the topic is missing again — the student already received that note.`,
              }],
            }],
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timed out")), AI_ROADMAP_TIMEOUT_MS)),
        ]);
        const roadmap = resp.text || "Here is a roadmap: 1) Start with official docs and free tutorials, 2) Build a small project, 3) Practice daily.";
        return res.json({ reply: ack + "\n\n" + roadmap });
      } catch (err) {
        console.error("Mentor roadmap generation error:", err.message);
        return res.json({ reply: ack + "\n\nStep 1: Start with official docs & free tutorials. Step 2: Build a small project. Step 3: Practice daily. Step 4: Contribute/open-source. Step 5: Add it to your CampusAI profile!" });
      }
    }
    // ---- CONTEXT INJECTION: fetch ONLY this user's live data and embed it ----
    const ctx = await getProfileSummary(req.userId);
    const p = ctx.profile || {};
    const skillList = (ctx.skills || [])
      .map((s) => `${s.name}${s.mastery ? ` (${s.mastery}% mastery)` : ""}`)
      .join(", ") || "none yet";
    const codingList = (ctx.codingProfiles || []).map((c) => `${c.name} (${c.platform || "platform"})`).join(", ") || "none yet";
    const certList = (ctx.certificates || []).map((c) => `${c.title}${c.verified ? " [AI-verified]" : ""}`).join(", ") || "none yet";
    const projectList = (ctx.projects || []).map((pr) => `${pr.title} (${pr.status}${pr.progress ? `, ${pr.progress}%` : ""})`).join(", ") || "none yet";
    const atsRow = await pool.query(
      "SELECT ats_score, strengths, additions FROM resume_analysis WHERE user_id=$1 ORDER BY id DESC LIMIT 1",
      [req.userId]
    );
    const ats = atsRow.rows[0];
    const resumeSummary = ats
      ? `latest resume ATS score ${ats.ats_score}/100; detected strengths: ${(ats.strengths || []).join(", ") || "none"}; recommended additions: ${(ats.additions || []).join(", ") || "none"}`
      : "no resume analyzed yet";

    // Per-resume summary (numbered) so the mentor can recall exactly which
    // resume the student wants to improve and its stored recommendations.
    const resumeRows = await pool.query(
      `SELECT r.resume_no, r.file_name, a.ats_score, a.skills, a.additions
       FROM resumedocs r
       LEFT JOIN LATERAL (
         SELECT ats_score, skills, additions
         FROM resume_analysis
         WHERE user_id = r.user_id AND resume_no = r.resume_no
         ORDER BY id DESC LIMIT 1
       ) a ON true
       WHERE r.user_id = $1
       ORDER BY r.resume_no`,
      [req.userId]
    );
    const resumeListSummary = resumeRows.rows.length
      ? resumeRows.rows.map((x) => {
          const parts = [`Resume #${x.resume_no}: "${x.file_name}"`];
          if (x.ats_score != null) parts.push(`ATS ${x.ats_score}/100`);
          if ((x.skills || []).length) parts.push(`skills: ${x.skills.join(", ")}`);
          if ((x.additions || []).length) parts.push(`recommended: ${x.additions.join(", ")}`);
          return parts.join(" — ");
        }).join("\n")
      : "none uploaded yet";

    // ---- RAG RETRIEVAL: embed the question, pull the user's most relevant knowledge ----
    let ragText = "";
    try {
      // lazy-build knowledge base on first chat if it is empty
      const cnt = await pool.query("SELECT COUNT(*)::int AS c FROM rag_chunks WHERE user_id=$1", [req.userId]);
      if (!cnt.rows[0]?.c) await rebuildUserRag(req.userId);
      const hits = await retrieveRag(req.userId, message, 4);
      if (hits.length) {
        ragText = "--- RELEVANT STUDENT KNOWLEDGE (retrieved) ---\n" +
          hits.map((h, i) => `[${i + 1}] ${h.source}:${h.title}\n${h.content}`).join("\n\n") +
          "\n--- END RELEVANT KNOWLEDGE ---";
      }
    } catch (e) {
      console.error("RAG retrieval error:", e.message);
    }

    const contextBlock =
      `--- STUDENT CONTEXT (live data from CampusAI, only this user) ---\n` +
      `Name: ${p.name || username || "unknown"}\n` +
      `Institution: ${p.institution || "MBM University"}, Branch: ${p.branch || "not set"}, Semester: ${p.semester || "not set"}\n` +
      `Target role: ${p.targetRole || "not set"}, Target CGPA: ${p.targetCgpa || "not set"}, Company type: ${p.targetCompanyType || "not set"}${p.targetCompanyName ? ` (${p.targetCompanyName})` : ""}\n` +
      `Timeline: current ${p.timelineCurrent || "not set"}, next ${p.timelineNext || "not set"}, work type ${p.workType || "not set"}\n` +
      `Skills: ${skillList}\n` +
      `Coding profiles: ${codingList}\n` +
      `Certificates (${(ctx.certificates || []).length}): ${certList}\n` +
      `Projects (${(ctx.projects || []).length}): ${projectList}\n` +
      `Resume: ${resumeSummary}\n` +
      `All uploaded resumes (numbered — use this when the user asks to improve a specific resume):\n${resumeListSummary}\n` +
      `--- END STUDENT CONTEXT ---` +
      (ragText ? `\n\n${ragText}` : "");

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction =
      `You are CampusAI Mentor, an encouraging AI Academic and Career Mentor for college students. ` +
      `The student you are talking to is named ${username} (real name: ${p.name || "not provided"}). Address them by name. ` +
      `Answer his/her questions based on the student context below — use their actual skills, target role, ` +
      `projects, certificates, coding profiles and resume data to give personalized, actionable advice. ` +
      `If the user asks about their progress or skills, reference their real data. ` +
      `If their target role is set, tailor recommendations for that role. Keep responses concise and structured with markdown.\n\n` +
      contextBlock;

    const AI_TIMEOUT_MS = 20000;
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: systemInstruction }] },
          ...(history || []).map((h) => ({ role: h.sender === "user" ? "user" : "model", parts: [{ text: h.text }] })),
          { role: "user", parts: [{ text: message }] },
        ],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timed out")), AI_TIMEOUT_MS)),
    ]);
    res.json({ reply: response.text || "Let's map out the best path forward!" });
  } catch (err) {
    console.error("Gemini API Error:", err.message);
    res.json({
      reply: `Hi ${req.username}, I've processed your query. Let's structure a custom roadmap! ` +
        `Note: the AI service was temporarily unavailable, so this is a template response. ` +
        `Try again in a moment for a fully personalized answer.`,
    });
  }
});

// Chat persistence
app.get("/api/chat/messages", requireAuth, async (req, res) => {
  try {
    const r = await pool.query("SELECT id, sender, text FROM chat_messages WHERE user_id=$1 ORDER BY id", [req.userId]);
    res.json({ messages: r.rows.map((m) => ({ id: String(m.id), sender: m.sender, text: m.text })) });
  } catch (err) {
    sendServerError(res, err);
  }
});
app.post("/api/chat/messages", requireAuth, async (req, res) => {
  try {
    const sender = safeString(req.body.sender, 20);
    const text = safeString(req.body.text, 8000);
    if (!sender || !text) return res.status(400).json({ error: "sender and text are required" });
    const r = await pool.query("INSERT INTO chat_messages (user_id, sender, text) VALUES ($1,$2,$3) RETURNING id", [req.userId, sender, text]);
    res.json(r.rows[0]);
  } catch (err) {
    sendServerError(res, err);
  }
});

// Malformed JSON / unknown routes shouldn't crash the server or leak internals
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    return res.status(400).json({ error: "Invalid request payload" });
  }
  // CORS failures surface as plain errors
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Skill topics extracted from the technical skills syllabus PDF
app.get("/api/skill-topics", (req, res) => {
  try {
    const dataPath = path.join(__dirname, "skill_topics.json");
    if (!fs.existsSync(dataPath)) {
      return res.json({ skills: [] });
    }
    const skills = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    res.json({ skills });
  } catch (err) {
    console.error("skill-topics error:", err.message);
    res.status(500).json({ error: "Failed to load skill topics" });
  }
});

// Serve React build in production
const reactDist = path.join(__dirname, "../../react/dist");
if (fs.existsSync(reactDist)) {
  app.use(express.static(reactDist));
  app.get("*", (req, res) => res.sendFile(path.join(reactDist, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 CampusAI Mentor backend running on http://localhost:${PORT}`);
  ensureSchema();
  ensureResumeBucket();
});