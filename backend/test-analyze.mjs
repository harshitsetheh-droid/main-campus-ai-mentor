process.env.JWT_SECRET = 'campus-ai-mentor-dev-secret-change-me';
import fs from 'fs';
const { signToken } = await import('./src/auth.js');
const token = signToken(9, 'parth1');

async function upload(token, filePath, name) {
  const data = fs.readFileSync(filePath).toString('base64');
  const r = await fetch('http://localhost:5000/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ data: `data:application/pdf;base64,${data}`, filename: name }),
  });
  return r.json();
}

async function analyze(token, url) {
  const r = await fetch('http://localhost:5000/api/profile/certificates/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ fileUrl: url }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

const up = await upload(token, 'D:/campus-ai-mentor-main/assets/test-cert.pdf', 'test-cert.pdf');
console.log('uploaded:', up);
const res = await analyze(token, up.url);
console.log('analyze status:', res.status);
console.log(JSON.stringify(res.body, null, 2));

// now save it with the extracted title (simulating the UI save step)
const save = await fetch('http://localhost:5000/api/profile/certificates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({ title: res.body.detectedTitle || 'Python for Data Science', category: res.body.certType, fileUrl: up.url, improvedSkill: res.body.improvedSkill, organization: res.body.organization }),
});
console.log('save status:', save.status);
console.log(await save.text());