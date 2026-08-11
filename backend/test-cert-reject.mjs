process.env.JWT_SECRET = 'campus-ai-mentor-dev-secret-change-me';
const { signToken } = await import('./src/auth.js');

async function tryUpload(token, title, fileUrl) {
  const r = await fetch('http://localhost:5000/api/profile/certificates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ title, category: 'Course', fileUrl, improvedSkill: 'Python' }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

const token = signToken(9, 'parth1');

console.log('--- Test 1: random avatar/photo as certificate ---');
const t1 = await tryUpload(token, 'Machine Learning Certificate', '/uploads/9/up-1786096787952-19p46z.avif');
console.log('status:', t1.status, JSON.stringify(t1.body));

console.log('--- Test 2: quote graphic as certificate ---');
const t2 = await tryUpload(token, 'Python Certificate', '/uploads/9/up-1786096881122-a6t60p.jpg');
console.log('status:', t2.status, JSON.stringify(t2.body));