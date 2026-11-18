

ALTER TABLE mshopkeeper_line_items ADD COLUMN IF NOT EXISTS cost_amount   NUMERIC DEFAULT 0;
ALTER TABLE mshopkeeper_line_items ADD COLUMN IF NOT EXISTS profit_amount NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS customer_care_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone  TEXT NOT NULL,
  customer_name   TEXT,
  sale_name       TEXT,
  flow_type       TEXT DEFAULT 'bought',
  current_day     INT  DEFAULT 0,
  last_contact    DATE,
  next_due        DATE,
  status          TEXT DEFAULT 'active',
  note            TEXT,
  updated_by      TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_phone)
);
CREATE INDEX IF NOT EXISTS idx_care_sale ON customer_care_log(sale_name);
CREATE INDEX IF NOT EXISTS idx_care_due  ON customer_care_log(next_due);
