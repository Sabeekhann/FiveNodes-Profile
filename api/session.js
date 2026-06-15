const setCors = require('./_cors');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET') {
    const params = new URL(req.url, 'http://x').searchParams;
    const email = params.get('email');

    if (!email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'email required' }));
      return;
    }

    try {
      const url = `${process.env.SUPABASE_URL}/rest/v1/lead_sessions?email=eq.${encodeURIComponent(email)}&select=messages,topics_covered,sidebar_clicks,updated_at&order=updated_at.desc&limit=1`;
      const r = await fetch(url, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        },
      });
      if (!r.ok) {
        res.writeHead(r.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database error' }));
        return;
      }
      const data = await r.json();
      const row = Array.isArray(data) ? data[0] : null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, session: row || null }));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, messages, topics_covered, sidebar_clicks, session_id } = body;

    if (!email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'email required' }));
      return;
    }

    const url = `${process.env.SUPABASE_URL}/rest/v1/lead_sessions`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
        'on-conflict': 'email',
      },
      body: JSON.stringify({
        email,
        messages: JSON.stringify(messages || []),
        topics_covered: topics_covered || [],
        sidebar_clicks: sidebar_clicks || [],
        session_id: session_id || null,
        updated_at: new Date().toISOString(),
      }),
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
};
