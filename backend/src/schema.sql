-- CampusAI Mentor PostgreSQL Schema

-- Users (authentication)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roll number (optional, unique; used as an alternate login identifier)
ALTER TABLE users ADD COLUMN IF NOT EXISTS roll_no TEXT DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS users_roll_no_uq ON users(roll_no) WHERE roll_no <> '';

-- Unique fixed QR code payload token per user (generated once; used to
-- auto-send friend requests when another student scans it)
ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_token TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS users_qr_token_uq ON users(qr_token) WHERE qr_token <> '';
UPDATE users SET qr_token = md5(random()::text || clock_timestamp()::text || id::text) WHERE qr_token = '';

-- Roles: student (default) | placement_officer | club_manager | faculty | super_admin
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
-- harsh1 is the super admin (idempotent bootstrap)
UPDATE users SET role = 'super_admin' WHERE username = 'harsh1' AND role <> 'super_admin';

-- Original/full name (filled at signup; backfilled with username for old accounts)
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
UPDATE users SET name = username WHERE name = '';

-- Friend requests (anonymous chat request flow: request -> approve -> friend)
CREATE TABLE IF NOT EXISTS chat_requests (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS chat_requests_to_idx ON chat_requests(to_user_id, status);

-- Accepted friendships (dono users ek dusre ki friend list mein)
CREATE TABLE IF NOT EXISTS friends (
  id SERIAL PRIMARY KEY,
  user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);

-- Direct messages between friends (anonymous handles only, text + emoji)
CREATE TABLE IF NOT EXISTS dm_messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dm_pair_idx ON dm_messages(sender_id, receiver_id, id);

-- Block list (blocked user: no requests, no DMs, friendship removed)
CREATE TABLE IF NOT EXISTS blocked_users (
  id SERIAL PRIMARY KEY,
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);

-- Student profile (one per user)
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  institution TEXT NOT NULL DEFAULT '',
  semester TEXT NOT NULL DEFAULT '',
  target_role TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  certificates_count INTEGER NOT NULL DEFAULT 0,
  achievements_count INTEGER NOT NULL DEFAULT 0,
  skill_score INTEGER NOT NULL DEFAULT 0
);

-- Technical skills
CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  percentage INTEGER NOT NULL DEFAULT 50
);

-- Recent activities
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  time_ago TEXT NOT NULL DEFAULT 'Just now',
  icon TEXT NOT NULL DEFAULT 'FileText'
);

-- Coding profiles
CREATE TABLE IF NOT EXISTS coding_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL
);

-- Dashboard quick stats (auto-computed from other tables; kept for extensibility)
CREATE TABLE IF NOT EXISTS dashboard_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  icon TEXT NOT NULL
);

-- Dashboard radar chart values (derived from skills)
CREATE TABLE IF NOT EXISTS radar_axes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value INTEGER NOT NULL
);

-- AI Recommendations (dashboard pills)
CREATE TABLE IF NOT EXISTS recommendations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'violet',
  navigates_to TEXT
);

-- Recommended projects
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'Beginner'
);

-- AI verification columns for manually added projects (added later by migration)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS repo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ongoing';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS recommended_by_ai BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_verification TEXT NOT NULL DEFAULT '';

-- Peer comparison skill benchmarks
CREATE TABLE IF NOT EXISTS skill_benchmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  user_score INTEGER NOT NULL,
  cohort_avg INTEGER NOT NULL DEFAULT 60,
  top10_avg INTEGER NOT NULL DEFAULT 90
);

-- Comparison cohorts (shared reference data)
CREATE TABLE IF NOT EXISTS cohorts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  total_students INTEGER NOT NULL,
  user_rank INTEGER NOT NULL
);

-- Cohort leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  name TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  xp INTEGER NOT NULL DEFAULT 0,
  is_user BOOLEAN NOT NULL DEFAULT FALSE
);

-- Resume analysis data
CREATE TABLE IF NOT EXISTS resume_analysis (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ats_score INTEGER NOT NULL DEFAULT 0,
  score_delta TEXT NOT NULL DEFAULT '',
  target_role TEXT NOT NULL DEFAULT '',
  strengths TEXT[] NOT NULL DEFAULT '{}',
  additions TEXT[] NOT NULL DEFAULT '{}'
);
ALTER TABLE resume_analysis ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE resume_analysis ADD COLUMN IF NOT EXISTS resume_no INTEGER NOT NULL DEFAULT 0;

-- Resume actionable improvements
CREATE TABLE IF NOT EXISTS improvements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Check',
  type TEXT NOT NULL DEFAULT 'quantify'
);

-- Chat messages (per user)
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group chatroom (peer-to-peer messages shared by all students)
CREATE TABLE IF NOT EXISTS clubs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '💬',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default college clubs (idempotent seed, safe to run repeatedly)
INSERT INTO clubs (name, description, emoji) VALUES
  ('DSA Paglu', 'LeetCode grinders ki maha-sabha — problems, patterns aur rank charcha', '🤓'),
  ('Senior Bitching', 'Seniors ki latest tips, gossip aur college ke andar ki baatein', '😏'),
  ('Placement Charcha', 'Drives, packages aur interview experiences — sab kuch', '🎯'),
  ('Exam Ki Tension', 'Assignments, internals aur viva ka darr — yahan sab saath hain', '🥶'),
  ('Canteen & Chai', 'Khaane-peene ki recommendations aur chai pe charcha', '☕'),
  ('Hackathon Warriors', 'Hackathons, team building aur all-nighters ke shahid', '💻'),
  ('Doubt Buddy', 'Coding doubts — koi bhi pucho, anonymously', '🆘'),
  ('Late Night Memes', 'Raat 2 baje ke memes aur sleepy-heads club', '😴')
ON CONFLICT (name) DO NOTHING;

-- Anonymous club membership (identity is never exposed)
CREATE TABLE IF NOT EXISTS club_members (
  id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, user_id)
);

-- Anonymous club chat messages (text + emoji only, no identity stored)
CREATE TABLE IF NOT EXISTS club_messages (
  id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Club managers (appointed by super admin; moderate their clubs' messages)
CREATE TABLE IF NOT EXISTS club_managers (
  id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, user_id)
);

-- Club blocks: super admin blocks a user from joining / posting in a club
CREATE TABLE IF NOT EXISTS club_blocks (
  id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, user_id)
);

-- On-campus placement drives (shared college feed)
CREATE TABLE IF NOT EXISTS placement_drives (
  id SERIAL PRIMARY KEY,
  company TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  package TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Placement company question bank: PO / super admin share questions for a
-- specific company (with frequency), every student can browse them
CREATE TABLE IF NOT EXISTS placement_company_questions (
  id SERIAL PRIMARY KEY,
  company TEXT NOT NULL,
  question TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 1 CHECK (frequency >= 1),
  added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS placement_company_questions_company_idx
  ON placement_company_questions (LOWER(company));
ALTER TABLE placement_company_questions ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE placement_company_questions ADD COLUMN IF NOT EXISTS year TEXT NOT NULL DEFAULT '';
ALTER TABLE placement_company_questions ADD COLUMN IF NOT EXISTS pdf_url TEXT NOT NULL DEFAULT '';

-- Placement applications: student applies to a drive, PO/super admin moves it
-- through applied -> waiting -> selected (or rejected). Drives the "kis
-- placement mein baitha hai / kiski wait kar raha hai" view for the admin.
CREATE TABLE IF NOT EXISTS placement_applications (
  id SERIAL PRIMARY KEY,
  drive_id INTEGER NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (drive_id, user_id)
);
CREATE INDEX IF NOT EXISTS placement_applications_user_idx ON placement_applications (user_id);

-- ---------------------------------------------------------------------------
-- IDEMPOTENT ADDITIONS FOR THE 2026 USER-CENTRIC REDESIGN
-- (ALTER ... ADD COLUMN IF NOT EXISTS is safe to run repeatedly at startup)
-- ---------------------------------------------------------------------------

-- Extend profiles with academic + career target fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_semester TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_cgpa TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_company_type TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_company_name TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timeline_current TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timeline_next TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_type TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_url TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';

-- Extend skills: platform, checkpoint progression, mastery, required, benchmark refs
ALTER TABLE skills ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE skills ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT '';
ALTER TABLE skills ADD COLUMN IF NOT EXISTS questions_solved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS total_questions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS mastery INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS checked_topics TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE skills ADD COLUMN IF NOT EXISTS required_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS cohort_avg INTEGER NOT NULL DEFAULT 60;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS top_avg INTEGER NOT NULL DEFAULT 90;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Extend projects: repository link, status, progress, AI recommendation flag
ALTER TABLE projects ADD COLUMN IF NOT EXISTS repo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ongoing';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS recommended_by_ai BOOLEAN NOT NULL DEFAULT FALSE;

-- Extend coding_profiles: platform + URL constraints (max 3 validated in app)
ALTER TABLE coding_profiles ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT '';
ALTER TABLE coding_profiles ADD COLUMN IF NOT EXISTS unique_key TEXT NOT NULL DEFAULT '';

-- Certificates (photo upload + AI verification)
CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  improved_skill TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  check_summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS organization TEXT NOT NULL DEFAULT '';

-- Resumes (uploaded file store)
CREATE TABLE IF NOT EXISTS resumedocs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE resumedocs ADD COLUMN IF NOT EXISTS resume_no INTEGER NOT NULL DEFAULT 0;

-- Notifications (compare matrix, skills, projects, certificates ...)
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Skill checkpoints (basic -> advanced progression), one row per mastery step
CREATE TABLE IF NOT EXISTS checkpoints (
  id SERIAL PRIMARY KEY,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  done BOOLEAN NOT NULL DEFAULT FALSE
);

-- Reference DSA platforms list
CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT ''
);

-- RAG knowledge chunks (embeddings stored as JSON array, cosine sim in app layer)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  embedding TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_user ON rag_chunks (user_id);
