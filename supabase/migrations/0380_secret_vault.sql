

CREATE TABLE IF NOT EXISTS secret_vault (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  label       text,
  category    text NOT NULL DEFAULT 'Khác',
  value_enc   text,
  last4       text,
  note        text,
  status      text NOT NULL DEFAULT 'active',
  sort        int DEFAULT 100,
  updated_by  uuid,
  updated_at  timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS secret_vault_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name  text,
  action       text NOT NULL,
  user_id      uuid,
  user_email   text,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_secret_log_time ON secret_vault_log (created_at DESC);

ALTER TABLE secret_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_vault_log ENABLE ROW LEVEL SECURITY;

INSERT INTO secret_vault (category, name, label, sort) VALUES
  ('AI/LLM','anthropic_api_key','Claude API (Anthropic)',10),
  ('AI/LLM','gemini_api_key','Google Gemini API',11),
  ('Gửi tin','resend_api_key','Resend (email)',20),
  ('Gửi tin','telegram_bot_token','Telegram Bot Token',21),
  ('Gửi tin','telegram_brain_bot_token','Telegram BRAIN Bot Token',22),
  ('Thanh toán','payos_client_id','PayOS Client ID',30),
  ('Thanh toán','payos_api_key','PayOS API Key',31),
  ('Thanh toán','payos_checksum_key','PayOS Checksum Key',32),
  ('Hạ tầng','leads_token','Webhook token nhận lead',40)
ON CONFLICT (name) DO NOTHING;
