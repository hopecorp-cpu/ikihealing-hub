

ALTER TABLE leads

  ADD COLUMN IF NOT EXISTS push_count INT NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS last_push_at TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS product_suggested BOOLEAN NOT NULL DEFAULT FALSE,

  ADD COLUMN IF NOT EXISTS is_existing_customer BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_leads_push_cycle ON leads(status, push_count, last_push_at);

COMMENT ON COLUMN leads.push_count IS 'Số lần sale đã push chốt (tối đa 3, hết thì đẩy sang sale khác)';
COMMENT ON COLUMN leads.last_push_at IS 'Lần push gần nhất — dùng để giãn cách, tránh dồn dập';
COMMENT ON COLUMN leads.product_suggested IS 'Sale đã chào sản phẩm chưa — chưa chào thì là bỏ giữa chừng, xử lý khác';
COMMENT ON COLUMN leads.is_existing_customer IS 'Khách đã mua trong MISA chưa (đối chiếu SĐT). NULL = chưa biết';
