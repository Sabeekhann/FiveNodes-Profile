// Shared CORS helper — files prefixed _ are not exposed as Vercel endpoints
const ALLOWED = [
  'https://five-nodes-profile.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
];

module.exports = function setCors(req, res) {
  const origin = req.headers.origin || '';
  // Allow exact matches + any Vercel preview deployments for this project
  const isAllowed = ALLOWED.includes(origin) ||
    /^https:\/\/five-nodes-profile-[a-z0-9]+-sabeekhann\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : ALLOWED[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Vary', 'Origin');
  return isAllowed || !origin; // true = origin is allowed or same-origin request
};
