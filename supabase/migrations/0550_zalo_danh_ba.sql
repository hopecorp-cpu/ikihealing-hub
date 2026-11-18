

ALTER TABLE zalo_bridge_contacts
  ADD COLUMN IF NOT EXISTS zalo_name    TEXT,
  ADD COLUMN IF NOT EXISTS ngay_sinh    TEXT,
  ADD COLUMN IF NOT EXISTS trang_thai   TEXT,
  ADD COLUMN IF NOT EXISTS global_id    TEXT,
  ADD COLUMN IF NOT EXISTS la_ban_be    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nhan_sale    TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_zbc_global ON zalo_bridge_contacts (global_id) WHERE global_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zbc_nhan   ON zalo_bridge_contacts USING GIN (nhan_sale);

CREATE TABLE IF NOT EXISTS zalo_nhan (
  id         BIGINT PRIMARY KEY,
  ten        TEXT NOT NULL,
  mau        TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE zalo_nhan ENABLE ROW LEVEL SECURITY;
