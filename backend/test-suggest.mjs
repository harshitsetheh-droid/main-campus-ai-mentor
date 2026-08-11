process.env.JWT_SECRET = 'campus-ai-mentor-dev-secret-change-me';
const { signToken } = await import('./src/auth.js');
const token = signToken(14, 'anisk');
const r = await fetch('http://localhost:5000/api/projects/suggest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({ skills: [], role: 'data scientist' }),
});
console.log(r.status);
const body = await r.json();
console.log('role:', body.role);
for (const s of body.suggestions || []) {
  console.log('•', s.title, '[' + s.level + ']');
  console.log('   skillsUsed:', (s.skillsUsed || []).join(', '));
}