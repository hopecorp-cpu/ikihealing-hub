
CREATE TABLE IF NOT EXISTS jt_waybills (
  waybill_no        TEXT PRIMARY KEY,
  customer_order_id TEXT,
  status_code       TEXT,
  status_name       TEXT,
  status_group      TEXT,
  receiver_name     TEXT,
  receiver_phone    TEXT,
  receiver_address  TEXT,
  goods_name        TEXT,
  goods_items       JSONB,
  cod_value         NUMERIC DEFAULT 0,
  real_cod_value    NUMERIC DEFAULT 0,
  freight           NUMERIC DEFAULT 0,
  settlement_code   TEXT,
  is_void           BOOLEAN DEFAULT FALSE,
  order_create_time TIMESTAMPTZ,
  collect_time      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jt_phone   ON jt_waybills(receiver_phone);
CREATE INDEX IF NOT EXISTS idx_jt_created ON jt_waybills(order_create_time DESC);
CREATE INDEX IF NOT EXISTS idx_jt_group   ON jt_waybills(status_group);

CREATE TABLE IF NOT EXISTS jt_summary (
  id INT PRIMARY KEY DEFAULT 1,
  data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
