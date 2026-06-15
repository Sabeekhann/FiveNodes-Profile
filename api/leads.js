module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }

  // Simple password protection via Authorization header or ?secret= query param
  const secret = process.env.ADMIN_SECRET;
  const provided = req.headers['authorization']?.replace('Bearer ', '') ||
    new URL(req.url, 'http://x').searchParams.get('secret');

  if (!secret || provided !== secret) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    // Fetch leads joined with session data
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

    // Merge session data into leads
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
