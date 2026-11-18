

CREATE TABLE IF NOT EXISTS consultations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  slot_date       DATE NOT NULL,
  slot_time       TEXT NOT NULL,
  staff_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  staff_name      TEXT,

  customer_name   TEXT NOT NULL,
  customer_phone  TEXT,
  channel         TEXT DEFAULT 'zalo',
  source          TEXT,
  note            TEXT,

  status          TEXT NOT NULL DEFAULT 'dat',
  reminded_at     TIMESTAMPTZ,
  outcome         TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE (slot_date, slot_time, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_consultations_date ON consultations(slot_date);
CREATE INDEX IF NOT EXISTS idx_consultations_phone ON consultations(customer_phone);

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consultations_all ON consultations;
CREATE POLICY consultations_all ON consultations FOR ALL TO authenticated USING (true) WITH CHECK (true);
