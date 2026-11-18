

ALTER TABLE users ADD COLUMN IF NOT EXISTS terminated_at DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS termination_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_terminated ON users(terminated_at, active);



