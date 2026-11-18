

ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS password_enc   text,
  ADD COLUMN IF NOT EXISTS password_last4 text,
  ADD COLUMN IF NOT EXISTS two_fa_enc     text,
  ADD COLUMN IF NOT EXISTS two_fa_last4   text;

CREATE TABLE IF NOT EXISTS platform_accounts_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid,
  platform     text,
  field        text,
  action       text NOT NULL,
  user_id      uuid,
  user_email   text,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_acc_log_time ON platform_accounts_log (created_at DESC);

ALTER TABLE platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_accounts_log ENABLE ROW LEVEL SECURITY;
