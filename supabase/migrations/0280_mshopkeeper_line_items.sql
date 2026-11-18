

CREATE TABLE IF NOT EXISTS mshopkeeper_line_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code     TEXT NOT NULL,
  order_date     DATE,
  status         TEXT,
  sku            TEXT,
  product_name   TEXT,
  unit           TEXT,
  quantity       NUMERIC DEFAULT 0,
  unit_price     NUMERIC DEFAULT 0,
  gross_amount   NUMERIC DEFAULT 0,
  discount       NUMERIC DEFAULT 0,
  net_amount     NUMERIC DEFAULT 0,
  customer_phone TEXT,
  customer_name  TEXT,
  sale_name      TEXT,
  source_file    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (order_code, sku)
);

CREATE INDEX IF NOT EXISTS idx_mski_date  ON mshopkeeper_line_items(order_date);
CREATE INDEX IF NOT EXISTS idx_mski_phone ON mshopkeeper_line_items(customer_phone);
CREATE INDEX IF NOT EXISTS idx_mski_sku   ON mshopkeeper_line_items(sku);
CREATE INDEX IF NOT EXISTS idx_mski_sale  ON mshopkeeper_line_items(sale_name);
