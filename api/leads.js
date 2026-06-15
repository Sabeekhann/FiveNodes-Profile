const setCors = require('./_cors');

const _rl = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const max = 10;
  if (_rl.size > 5000) {
    const cutoff = now - window * 2;
    for (const [k, e] of _rl.entries()) { if (e.reset < cutoff) _rl.delete(k); }
  }
  const entry = _rl.get(ip) || { count: 0, reset: now + window };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + window; }
  entry.count++;
  _rl.set(ip, entry);
  return entry.count > max;
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimit(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many requests' }));
    return;
  }

  const secret = process.env.ADMIN_SECRET;
  const provided = req.headers['authorization']?.replace('Bearer ', '').trim();

  if (!secret || provided !== secret) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const [leadsRes, sessionsRes] = await Promise.all([
      fetch(`${process.env.SUPABASE_URL}/rest/v1/profile_leads?select=*&order=created_at.desc&limit=200`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }),
      fetch(`${process.env.SUPABASE_URL}/rest/v1/lead_sessions?select=email,topics_covered,sidebar_clicks,updated_at,messages&order=updated_at.desc&limit=200`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      }),
    ]);

    const leads = await leadsRes.json();
    const sessions = await sessionsRes.json();

    const sessionMap = {};
    if (Array.isArray(sessions)) {
      sessions.forEach(s => { sessionMap[s.email] = s; });
    }

    const merged = Array.isArray(leads) ? leads.map(l => ({
      ...l,
      topics_covered: sessionMap[l.email]?.topics_covered || [],
      sidebar_clicks: sessionMap[l.email]?.sidebar_clicks || [],
      last_active: sessionMap[l.email]?.updated_at || l.last_seen_at,
      message_count: (() => {
        try {
          const msgs = sessionMap[l.email]?.messages;
          const parsed = typeof msgs === 'string' ? JSON.parse(msgs) : msgs;
          return Array.isArray(parsed) ? Math.floor(parsed.length / 2) : 0;
        } catch { return 0; }
      })(),
    })) : [];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, leads: merged, total: merged.length }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
};
