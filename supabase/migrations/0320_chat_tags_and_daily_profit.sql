

ALTER TABLE salework_chat_analysis ADD COLUMN IF NOT EXISTS tags JSONB;

CREATE TABLE IF NOT EXISTS misa_daily_profit (
  ref_date     DATE PRIMARY KEY,
  revenue      NUMERIC DEFAULT 0,
  cogs         NUMERIC DEFAULT 0,
  gross_profit NUMERIC DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
