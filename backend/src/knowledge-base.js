import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_PATH = path.join(__dirname, "curated_resources.json");

let parsedTopics = null;

function normalize(str = "") {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9+.#&\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function topicTokens(name) {
  const t = normalize(name);
  return t.split(" ").filter((w) => w.length > 2);
}

// Load the curated resources that live inside the system (no PDF parsing needed).
// To add more topics/resources, edit backend/src/curated_resources.json directly.
export function buildTopics() {
  if (parsedTopics) return parsedTopics;
  try {
    const raw = JSON.parse(fs.readFileSync(KB_PATH, "utf8"));
    parsedTopics = Array.isArray(raw.topics) ? raw.topics : [];
  } catch (e) {
    console.error("Failed to load curated resources:", e.message);
    parsedTopics = [];
  }
  return parsedTopics;
}

// Best-effort topic lookup by name (exact, contains, token overlap).
export function searchKnowledgeBase(query) {
  const topics = buildTopics();
  // Strip common prefixes like "how to learn", "i want to learn", "teach me"
  const cleaned = String(query || "")
    .replace(/^(how|i|tell|teach|explain|help|guide|best way|ways)\b/i, "")
    .replace(/^(can|could|do|should|want|need|would|have|has)\b.*?\b(to|learn|start|master|study|prepare|understand)\b/i, "")
    .replace(/\b(learn|learning|to learn|start learning|master|study|prepare for|understand|resources for|tutorial for)\b/gi, " ")
    .replace(/\?/g, "");
  const q = normalize(cleaned);
  const qTokens = q.split(" ").filter((w) => w.length > 2);
  if (!qTokens.length) return null;

  let best = null;
  let bestScore = 0;

  for (const topic of topics) {
    const t = normalize(topic.name);
    let score = 0;

    if (t === q) score = 100;
    else if (t.includes(q) && q.length >= 3) score = 85;
    else if (q.includes(t)) score = 80;
    else {
      const tTok = topicTokens(topic.name);
      for (const tok of qTokens) {
        if (tTok.some((x) => x.includes(tok) || tok.includes(x))) score += 20;
      }
      // bonus for matching the first (most significant) query token
      if (score && qTokens[0] && tTok.some((x) => x.includes(qTokens[0]) || qTokens[0].includes(x))) score += 10;
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }

  return best && bestScore >= 25 ? best : null;
}

// Build the "curated link" reply for a matched topic.
export function formatKnowledgeReply(topic, username) {
  const curried = topic.resources.filter((r) => r.url).slice(0, 12);
  if (!curried.length) {
    return `Hi ${username}! "${topic.name}" is listed in our curated resources, but the exact links for it weren't added yet. Happy learning! 🎓`;
  }

  const beginnerLinks = curried
    .filter((r) => r.level === "beginner")
    .slice(0, 5)
    .map((r) => `- **${r.name}**: ${r.url}`);
  const others = curried
    .filter((r) => r.level !== "beginner")
    .slice(0, 5)
    .map((r) => `- **${r.name}**: ${r.url}`);

  const lines = [];
  lines.push(`Hi ${username}! 👋 **${topic.name}** is right there in our curated resources! Here are the best links to start:`);
  if (beginnerLinks.length) {
    lines.push(`\n**🚀 Beginner (start here):**\n${beginnerLinks.join("\n")}`);
  }
  if (others.length) {
    lines.push(`\n**📈 Next level:**\n${others.join("\n")}`);
  }
  lines.push(`\nHappy learning! 🎓`);
  return lines.join("\n");
}

// Acknowledge "topic not in curated resources" (Hinglish) and let the roadmap generator take over.
export function notFoundAck(query, username) {
  return (
    `Hi ${username}! Yeh topic (**${query}**) abhi hamari curated resources/PDF list mein available nahi hai, ` +
    `par ek AI mentor hone ke naate main aapke liye iska ek complete roadmap aur resources yahan generate kar raha hoon:\n`
  );
}
