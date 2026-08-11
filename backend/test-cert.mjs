process.env.JWT_SECRET = 'campus-ai-mentor-dev-secret-change-me';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
async function analyzeCertificate(filePath, userTitle) {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new (await import('@google/genai')).GoogleGenAI({ apiKey });
  const abs = path.join(process.cwd(), 'src', 'uploads', filePath.replace(/^\/uploads\//, ''));
  const b64 = fs.readFileSync(abs).toString('base64');
  const mime = filePath.toLowerCase().endsWith('.png') ? 'image/png'
    : filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg') ? 'image/jpeg'
    : filePath.toLowerCase().endsWith('.webp') ? 'image/webp'
    : filePath.toLowerCase().endsWith('.avif') ? 'image/webp'
    : 'image/png';
  const prompt =
    `You are a strict, careful certificate verifier for CampusAI Mentor (MBM University). ` +
    `The student uploaded an image and claims it is a certificate with this title: "${userTitle}".\n\n` +
    `IMPORTANT - verify in this order:\n` +
    `1. FIRST decide if the image is a genuine certificate/document at all. A real certificate or award document has clear markers such as: an official header ("Certificate of Completion", "Certificate of Achievement", "Letter of Recommendation", "Internship Certificate", "Participation Certificate"), an issuing organization's name/logo, a seal/stamp or signature block, a student name, a date, and a border/graphic design. ` +
    `REJECT (isCertificateDocument=false) anything that is NOT such a document: random photos, selfies, memes, screenshots of apps/WhatsApp/messages, handwritten notes, blank papers, ID photos, posters, or images with no certificate text/marks.\n` +
    `2. Then, if it IS a certificate document: extract the exact title on it (detectedTitle) and the organization that issued it (organization).\n` +
    `3. Determine matches: true ONLY IF the extracted title clearly includes the same skill/topic/technical text as the claimed title (e.g. claimed "Python" vs document "Python Programming Certificate" = match; claimed "Hackathon Winner" vs document "Webinar" = NO match). Typo-level differences are OK, but a totally different topic must be false.\n` +
    `4. verified is TRUE only if BOTH: isCertificateDocument === true AND matches === true. In any doubt, choose false. Be conservative - approving a fake certificate is worse than rejecting a real one.\n\n` +
    `Return ONLY a JSON object, no markdown, in this exact shape:\n` +
    `{"isCertificateDocument": true|false, "detectedTitle": "exact text seen on the document or ''", "organization": "issuing org seen or ''", "topic": "main topic/subject of the certificate", "matches": true|false, "verified": true|false, "improvedSkill": "main skill this cert proves, or ''", "summary": "1-2 sentence verdict: what the image appears to be, the detected title/org, and the exact reason for verified true or false."}`;
  const resp = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: b64 } }] }], config: { temperature: 0 } });
  const text = resp.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { raw: text };
  const parsed = JSON.parse(m[0]);
  const isDoc = parsed.isCertificateDocument === true;
  const matches = parsed.matches !== false;
  return { ...parsed, verifiedFinal: isDoc && matches && parsed.verified === true };
}
// Test 1: an uploaded avatar/random JPG (parth1's photo)
console.log('--- random photo (parth1 avatar) claiming "Machine Learning Certificate" ---');
try {
  const r1 = await analyzeCertificate('/uploads/9/up-1786096787952-19p46z.avif', 'Machine Learning Certificate');
  console.log(JSON.stringify(r1, null, 2));
} catch (e) { console.log('ERR1', e.message); }

// Test 2: a real certificate image uploaded under user 3/9 if exists
console.log('--- test random JPG (user 9) claiming "Machine Learning Certificate" ---');
try {
  const r2 = await analyzeCertificate('/uploads/9/up-1786096881122-a6t60p.jpg', 'Machine Learning Certificate');
  console.log(JSON.stringify(r2, null, 2));
} catch (e) { console.log('ERR2', e.message); }