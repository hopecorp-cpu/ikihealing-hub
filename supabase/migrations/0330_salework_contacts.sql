
CREATE TABLE IF NOT EXISTS salework_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT UNIQUE NOT NULL,
  phone           TEXT,
  name            TEXT,
  account_id      TEXT,
  hotline         TEXT,
  last_message    TEXT,
  last_contact    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_swcontact_phone   ON salework_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_swcontact_hotline ON salework_contacts(hotline);
CREATE INDEX IF NOT EXISTS idx_swcontact_last    ON salework_contacts(last_contact);
