

CREATE TABLE IF NOT EXISTS zalo_bridge_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  own_id        TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  sale_name     TEXT,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zalo_bridge_contacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  own_id         TEXT NOT NULL,
  zalo_uid       TEXT NOT NULL,
  display_name   TEXT,
  phone          TEXT,
  phone_norm     TEXT,
  first_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  last_msg_at    TIMESTAMPTZ,
  last_in_at     TIMESTAMPTZ,
  last_out_at    TIMESTAMPTZ,
  unreplied      BOOLEAN DEFAULT FALSE,
  msg_count      INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (own_id, zalo_uid)
);
CREATE INDEX IF NOT EXISTS idx_zbc_phone   ON zalo_bridge_contacts (phone_norm);
CREATE INDEX IF NOT EXISTS idx_zbc_unrep   ON zalo_bridge_contacts (unreplied, last_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_zbc_lastmsg ON zalo_bridge_contacts (last_msg_at DESC);

CREATE TABLE IF NOT EXISTS zalo_bridge_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_id       TEXT UNIQUE NOT NULL,
  own_id       TEXT NOT NULL,
  thread_id    TEXT NOT NULL,
  thread_type  TEXT NOT NULL,
  zalo_uid     TEXT,
  direction    TEXT NOT NULL,
  content      TEXT,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_zbm_thread ON zalo_bridge_messages (own_id, thread_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_zbm_sent   ON zalo_bridge_messages (sent_at DESC);

ALTER TABLE zalo_bridge_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE zalo_bridge_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE zalo_bridge_messages ENABLE ROW LEVEL SECURITY;
