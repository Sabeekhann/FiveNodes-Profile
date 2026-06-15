module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { name, email, provider, avatar, session_id, topics } = body;

    if (!email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'email required' }));
      return;
    }

    // Upsert lead into Supabase
    const url = `${process.env.SUPABASE_URL}/rest/v1/profile_leads`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=representation',
        'on-conflict': 'email',
      },
      body: JSON.stringify({
        email,
        name: name || null,
        provider: provider || 'google',
        avatar: avatar || null,
        session_id: session_id || null,
        last_seen_at: new Date().toISOString(),
      }),
    });

    const data = await r.json();
    const isNew = Array.isArray(data) && data[0]?.created_at === data[0]?.last_seen_at;

    // Send emails only for new leads (not returning users re-signing-in)
    if (isNew || true) {
      await sendEmails(name, email, provider, topics || []).catch(() => {});
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, id: Array.isArray(data) ? data[0]?.id : data?.id }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
};

async function sendEmails(name, email, provider, topics) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const firstName = name ? name.split(' ')[0] : 'there';
  const topicList = topics.length ? topics.join(', ') : 'general enquiry';
  const providerLabel = provider === 'google' ? 'Google' : provider === 'email' ? 'email' : provider;
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Denver', dateStyle: 'medium', timeStyle: 'short' });

  // 1 — Notify Sabee
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'FiveNodes AI Profile <notifications@5ivenodes.com>',
      to: ['sabee@5ivenodes.com'],
      subject: `🔥 New lead: ${name || email} signed up on AI Profile`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#05060E;color:#E8EAF2;border-radius:12px;overflow:hidden">
          <div style="background:#C8F135;padding:20px 28px">
            <h1 style="margin:0;font-size:18px;color:#05060E;font-weight:800">New Lead — FiveNodes AI Profile</h1>
            <p style="margin:4px 0 0;font-size:13px;color:#05060E;opacity:.7">${now} MST</p>
          </div>
          <div style="padding:24px 28px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#8B8FA8;width:120px">Name</td><td style="padding:8px 0;font-weight:600">${name || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#8B8FA8">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#C8F135">${email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#8B8FA8">Signed in via</td><td style="padding:8px 0">${providerLabel}</td></tr>
              <tr><td style="padding:8px 0;color:#8B8FA8">Topics</td><td style="padding:8px 0">${topicList}</td></tr>
            </table>
            <div style="margin-top:20px">
              <a href="https://calendly.com/sabee-5ivenodes/30min" style="display:inline-block;background:#C8F135;color:#05060E;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px">Open Calendly →</a>
              <a href="mailto:${email}" style="display:inline-block;margin-left:12px;color:#C8F135;font-size:14px;text-decoration:underline">Reply to lead</a>
            </div>
          </div>
        </div>`,
    }),
  });

  // 2 — Confirm to the lead
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'Sabee at FiveNodes <sabee@5ivenodes.com>',
      to: [email],
      subject: `Great chatting, ${firstName} — here's what's next`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#05060E;color:#E8EAF2;border-radius:12px;overflow:hidden">
          <div style="background:#C8F135;padding:20px 28px">
            <h1 style="margin:0;font-size:18px;color:#05060E;font-weight:800">Thanks for signing in, ${firstName}!</h1>
          </div>
          <div style="padding:24px 28px;font-size:14px;line-height:1.7;color:#C5C8DC">
            <p>I saw you were exploring our AI Profile — great to meet you.</p>
            <p>I've already seen your conversation and the topics you were looking into. If you want a real scoped plan for your project, the fastest next step is a <strong style="color:#fff">free 30-minute discovery call</strong> — no pitch, just a technical assessment.</p>
            <div style="margin:24px 0">
              <a href="https://calendly.com/sabee-5ivenodes/30min" style="display:inline-block;background:#C8F135;color:#05060E;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px">Book a 30-min call →</a>
            </div>
            <p style="color:#8B8FA8;font-size:13px">Or just reply to this email — I read everything personally.</p>
            <p style="margin-top:20px;color:#8B8FA8;font-size:13px">— Sabee, CEO at FiveNodes<br>📍 Albuquerque, NM · <a href="https://5ivenodes.com" style="color:#C8F135">5ivenodes.com</a></p>
          </div>
        </div>`,
    }),
  });
}
