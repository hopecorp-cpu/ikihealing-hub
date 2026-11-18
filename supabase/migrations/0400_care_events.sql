

CREATE TABLE IF NOT EXISTS care_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_phone  TEXT NOT NULL,
  customer_name   TEXT,
  sale_name       TEXT,
  sale_id         UUID REFERENCES users(id) ON DELETE SET NULL,

  kind            TEXT NOT NULL,
  channel         TEXT,
  content         TEXT,
  outcome         TEXT,

  flow_type       TEXT,
  day_index       INT,
  meta            JSONB,
  month           TEXT
);

CREATE INDEX IF NOT EXISTS idx_care_events_phone   ON care_events(customer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_events_sale    ON care_events(sale_name);
CREATE INDEX IF NOT EXISTS idx_care_events_created ON care_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_events_month   ON care_events(month);
CREATE INDEX IF NOT EXISTS idx_care_events_outcome ON care_events(outcome) WHERE outcome IS NOT NULL;

ALTER TABLE care_events ENABLE ROW LEVEL SECURITY;
