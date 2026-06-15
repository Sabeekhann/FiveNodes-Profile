-- Run this in your Supabase SQL Editor

-- Visitor tracking
CREATE TABLE IF NOT EXISTS visitors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page        text,
  referrer    text,
  session_id  text,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Leads from the chatbot signup modal
CREATE TABLE IF NOT EXISTS profile_leads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text UNIQUE NOT NULL,
  name         text,
  provider     text DEFAULT 'google',
  avatar       text,
  session_id   text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS visitors_session_idx  ON visitors  (session_id);
CREATE INDEX IF NOT EXISTS visitors_created_idx  ON visitors  (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_email_idx       ON profile_leads (email);
CREATE INDEX IF NOT EXISTS leads_created_idx     ON profile_leads (created_at DESC);
