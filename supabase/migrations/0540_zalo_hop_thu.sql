

ALTER TABLE zalo_bridge_contacts
  ADD COLUMN IF NOT EXISTS thread_type   TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS unread_count  INT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_content  TEXT,
  ADD COLUMN IF NOT EXISTS last_type     TEXT;

CREATE INDEX IF NOT EXISTS idx_zbc_type   ON zalo_bridge_contacts (thread_type, last_msg_at DESC);
CREATE INDEX IF NOT EXISTS idx_zbc_unread ON zalo_bridge_contacts (unread_count) WHERE unread_count > 0;
