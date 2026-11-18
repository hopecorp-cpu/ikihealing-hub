
CREATE TABLE IF NOT EXISTS salework_chat_analysis (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    TEXT UNIQUE NOT NULL,
  account_id         TEXT,
  account_name       TEXT,
  customer_name      TEXT,
  phone              TEXT,
  msg_count          INT,
  score              INT,
  customer_need      TEXT,
  did_well           JSONB,
  weaknesses         JSONB,
  missed             JSONB,
  suggestions        JSONB,
  last_message_time  TIMESTAMPTZ,
  analyzed_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_swchat_score ON salework_chat_analysis(score);
CREATE INDEX IF NOT EXISTS idx_swchat_account ON salework_chat_analysis(account_name);
