
CREATE TABLE IF NOT EXISTS product_revenue_monthly (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month        TEXT NOT NULL,
  sku          TEXT,
  product_name TEXT NOT NULL,
  unit         TEXT,
  quantity     NUMERIC(15,2) DEFAULT 0,
  gross_amount NUMERIC(15,0) DEFAULT 0,
  discount     NUMERIC(15,0) DEFAULT 0,
  tax          NUMERIC(15,0) DEFAULT 0,
  net_revenue  NUMERIC(15,0) DEFAULT 0,
  source       TEXT DEFAULT 'misa',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (month, sku)
);
CREATE INDEX IF NOT EXISTS idx_prod_rev_month ON product_revenue_monthly(month);
ALTER TABLE product_revenue_monthly ENABLE ROW LEVEL SECURITY;
