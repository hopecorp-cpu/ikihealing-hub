
CREATE TABLE IF NOT EXISTS part_time_shifts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date           date NOT NULL,
  check_in_time  timestamptz NOT NULL,
  check_out_time timestamptz,
  note           text,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pts_user_date ON part_time_shifts(user_id, date);
