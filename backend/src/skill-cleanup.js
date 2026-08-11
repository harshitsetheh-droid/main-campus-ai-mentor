import pool from "./db.js";
import { GoogleGenAI } from "@google/genai";

// ---------------------------------------------------------------------------
// AI-assisted dedup/cleanup for a user's existing skills.
//
// Rules (user preference):
//   1. Umbrella-vs-sub-skills: keep the SPECIFIC sub-skills, REMOVE the broad
//      umbrella skill (e.g. drop "Web Development", keep "Frontend
//      Development", "Backend Development", "HTML", "CSS", "JavaScript",
//      "React", "Node.js", "REST API").
//   2. Synonym duplicates: keep ONE canonical name ("JavaScript" over "JS",
//      "Object-Oriented Programming" over "OOPS", "Frontend Development"
//      over "Frontend"). Same mastery carries over because we keep the row
//      that already has progress.
//   3. Exact duplicates (same name many times): keep one row per name.
// ---------------------------------------------------------------------------

function dedupeIdsByKey(rows) {
  const toDelete = new Set();
  const byKey = new Map();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  for (const list of byKey.values()) {
    if (list.length > 1) {
      // keep the row with most progress (mastery, then questions solved)
      list.sort((a, b) => (b.mastery || 0) - (a.mastery || 0) || b.questions_solved - a.questions_solved);
      list.slice(1).forEach((r) => toDelete.add(r.id));
    }
  }
  return toDelete;
}

async function aiRemovals(names) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || names.length < 2) return [];
  const ai = new GoogleGenAI({ apiKey });
  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [{
        text:
          `Here is the list of skills a student currently has on their profile (extracted from resumes):\n${JSON.stringify(names)}\n\n` +
          `It contains duplicate and overlapping entries. Decide which are redundant and should be deleted. Rules:\n` +
          `1. Umbrella vs sub-skills: if a broad skill ALSO has its concrete sub-skills in the list, the student wants to keep the SUB-SKILLS and DELETE the broad umbrella. ` +
          `Examples: "Web Development" is an umbrella over "Frontend Development","Backend Development","HTML","CSS","JavaScript","React","Node.js","REST API". ` +
          `"Machine Learning" is an umbrella over "Regression","Classification","EDA","Pandas","NumPy". ` +
          `Delete the umbrella, keep the sub-skills.\n` +
          `2. Same-skill-different-name duplicates: keep ONE canonical name, delete the rest. ` +
          `Examples: "JS"==>delete, "JavaScript" keep; "DBMS"==>delete, "Database Management Systems" keep one; "OOPS"==>"delete" Object-Oriented Programming; "Frontend" vs "Frontend Development" keep the longer explicit one.\n` +
          `3. Do NOT include anything that is genuinely distinct, or skills with no true overlap.\n` +
          `4. Never delete a whole semantic group entirely -- always leave at least one representative.\n` +
          `Return ONLY a JSON array, in this exact shape:\n` +
          `[{"remove":["exact name from input","..."],"keep":["exact name from input that stays"]}]` +
          `\n` +
          `The "remove" names MUST be EXACT strings present in the input list (verbatim, case-sensitive from the list above). ` +
          `"keep" names must also be EXACT input strings. Only include groups that actually contain something to delete. ` +
          `Return ONLY the JSON array, no markdown, no explanation.`
      }],
    }],
  });
  const text = resp.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  const parsed = JSON.parse(m[0]);
  if (!Array.isArray(parsed)) return [];
  const removals = new Set();
  for (const g of parsed) {
    const rm = Array.isArray(g?.remove) ? g.remove : [];
    for (const name of rm) {
      if (typeof name === "string" && names.includes(name)) removals.add(name);
    }
  }
  return [...removals];
}

export async function cleanupDuplicateSkills(uid) {
  const res = await pool.query(
    "SELECT id, name, category, platform, questions_solved, mastery FROM skills WHERE user_id=$1 ORDER BY id",
    [uid]
  );
  const rows = res.rows;
  if (rows.length === 0) return { deleted: 0, removedNames: [], totalBefore: 0, totalAfter: 0 };

  const toDelete = new Set();

  // pass 1: exact duplicate names - keep one row per name
  dedupeIdsByKey(rows).forEach((id) => toDelete.add(id));

  // pass 2: AI semantic cleanup on the remaining unique names
  const keptRows = rows.filter((r) => !toDelete.has(r.id));
  const uniqueNames = [...new Set(keptRows.map((r) => r.name))];
  let aiRemoved = [];
  try {
    aiRemoved = await aiRemovals(uniqueNames);
  } catch (err) {
    console.error("AI skill cleanup error:", err.message);
  }
  const aiSet = new Set(aiRemoved.map((n) => n.toLowerCase()));
  for (const r of keptRows) {
    if (aiSet.has(r.name.trim().toLowerCase())) toDelete.add(r.id);
  }

  const removedNames = rows.filter((r) => toDelete.has(r.id)).map((r) => r.name);
  if (toDelete.size) {
    await pool.query("DELETE FROM skills WHERE id = ANY($1::int[]) AND user_id=$2", [[...toDelete], uid]);
  }
  return {
    deleted: removedNames.length,
    deletedSkills: removedNames,
    totalBefore: rows.length,
    totalAfter: rows.length - removedNames.length,
  };
}