import { searchKnowledgeBase, formatKnowledgeReply, notFoundAck } from "./src/knowledge-base.js";

const python = searchKnowledgeBase("how to learn python");
console.log("== PYTHON (in PDF) ==");
console.log(formatKnowledgeReply(python, "Anisk"));

console.log("\n== RUST (not in PDF) ==");
console.log(notFoundAck("Rust programming", "Anisk"));

console.log("\n== GSAP (not in PDF) ==");
console.log(searchKnowledgeBase("gsap")?.name || "NULL");

console.log("\n== DSA ==");
const dsa = searchKnowledgeBase("data structures and algorithms");
console.log("matched:", dsa?.name, "| resources:", dsa?.resources.length);
console.log(formatKnowledgeReply(dsa, "Anisk").slice(0, 300));

process.exit(0);
