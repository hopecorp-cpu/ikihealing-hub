
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS livestream_bonus INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN payroll.livestream_bonus IS 'Tổng thưởng livestream trong tháng (cộng vào thu nhập)';

CREATE TABLE IF NOT EXISTS livestream_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  headcount    int  NOT NULL DEFAULT 1,
  amount       int  NOT NULL,
  note         text,
  created_by   uuid,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_livestream_user_date ON livestream_sessions(user_id, session_date);

