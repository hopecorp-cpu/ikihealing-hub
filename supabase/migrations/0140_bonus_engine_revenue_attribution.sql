DROP TABLE IF EXISTS bonus_rules CASCADE;



CREATE TABLE IF NOT EXISTS bonus_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('individual','team_lead','group')),
  product_category TEXT,
  revenue_min NUMERIC(15,0) NOT NULL DEFAULT 0,
  revenue_max NUMERIC(15,0),
  bonus_rate NUMERIC(5,4) NOT NULL,
  fixed_bonus NUMERIC(12,0) DEFAULT 0,
  applies_to_contract TEXT[],
  contract_modifier JSONB DEFAULT '{"Thử việc":0.85}'::jsonb,
  trigger_condition TEXT,
  active BOOLEAN DEFAULT TRUE,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_bonus_rules_scope ON bonus_rules(scope, active);

INSERT INTO bonus_rules (name, scope, product_category, revenue_min, revenue_max, bonus_rate, applies_to_contract, priority, notes) VALUES
  ('Bậc 1 (mẫu)', 'individual', 'san_pham_a',         0, 100000000, 0.010, ARRAY['Chính thức','Thử việc'], 10, 'Mức mẫu'),
  ('Bậc 2 (mẫu)', 'individual', 'san_pham_a', 100000000,      NULL, 0.020, ARRAY['Chính thức'],            20, 'Mức mẫu')
ON CONFLICT DO NOTHING;

ALTER TABLE bonus_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY bonus_read ON bonus_rules FOR SELECT USING (true);
CREATE POLICY bonus_admin_modify ON bonus_rules FOR ALL USING (public.is_admin_or_ceo()) WITH CHECK (public.is_admin_or_ceo());

CREATE TABLE IF NOT EXISTS revenue_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  month TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  attribution_type TEXT CHECK (attribution_type IN ('direct','team_split','manager_override','manual_add','manual_remove')),
  attribution_pct NUMERIC(5,2) DEFAULT 100,
  revenue_amount NUMERIC(15,0) NOT NULL,
  source_platform TEXT,
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rev_attr_user_month ON revenue_attribution(user_id, month);
CREATE INDEX IF NOT EXISTS idx_rev_attr_order ON revenue_attribution(order_id);

ALTER TABLE payroll
  ADD COLUMN IF NOT EXISTS auto_calc_data JSONB,
  ADD COLUMN IF NOT EXISTS manual_adjustments JSONB,
  ADD COLUMN IF NOT EXISTS bonus_auto NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_override NUMERIC(12,0),
  ADD COLUMN IF NOT EXISTS group_bonus_share NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calc_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS calc_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calc_locked_by UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS bonus_calc_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,
  triggered_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'preview' CHECK (status IN ('preview','committed','locked')),
  total_revenue NUMERIC(15,0),
  total_bonus NUMERIC(12,0),
  total_payroll_cost NUMERIC(15,0),
  users_count INT,
  team_bonus_triggered BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  committed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bonus_runs_month ON bonus_calc_runs(month DESC);

CREATE TABLE IF NOT EXISTS payroll_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID REFERENCES payroll(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  edited_by UUID REFERENCES users(id),
  field TEXT NOT NULL,
  old_value NUMERIC(15,2),
  new_value NUMERIC(15,2),
  delta NUMERIC(15,2),
  reason TEXT NOT NULL,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_edits ON payroll_edits(payroll_id);

CREATE TABLE IF NOT EXISTS revenue_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  commission_modifier NUMERIC(4,3) DEFAULT 1.0,
  attributable_to_sale BOOLEAN DEFAULT TRUE,
  vat_rate NUMERIC(4,3) DEFAULT 0.08,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO revenue_channels (code, name, attributable_to_sale, vat_rate) VALUES
  ('manual',     'Nhập thủ công',              TRUE,  0.08),
  ('misa_eshop', 'MISA eShop',                 TRUE,  0.08),
  ('shopee',     'Shopee Mall',                FALSE, 0.08),
  ('lazada',     'Lazada',                     FALSE, 0.08),
  ('tiktok_shop','TikTok Shop',                FALSE, 0.08),
  ('pancake',    'Pancake (inbox FB)',         TRUE,  0.08),
  ('live',       'Livestream',                 TRUE,  0.08),
  ('referral',   'Khách giới thiệu',           TRUE,  0.08),
  ('course',     'Khoá học Trần Văn Bình',     FALSE, 0)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS channel_code TEXT,
  ADD COLUMN IF NOT EXISTS counts_for_bonus BOOLEAN DEFAULT TRUE;

UPDATE orders SET channel_code = COALESCE(channel_code, channel, 'manual') WHERE channel_code IS NULL;

CREATE OR REPLACE VIEW v_user_monthly_revenue AS
SELECT
  o.salesperson_id AS user_id,
  TO_CHAR(o.order_date, 'YYYY-MM') AS month,
  o.channel AS channel,
  COUNT(o.id) AS order_count,
  SUM(o.final_revenue) AS gross_revenue,
  SUM(o.net_revenue) AS net_revenue,
  NULL::numeric AS profit
FROM orders o
WHERE o.salesperson_id IS NOT NULL
  AND o.status NOT IN ('cancelled','refunded')
  AND o.counts_for_bonus = TRUE
GROUP BY o.salesperson_id, TO_CHAR(o.order_date, 'YYYY-MM'), o.channel;

COMMENT ON TABLE bonus_rules IS 'Bậc thưởng — editable, replaces hardcoded constants';
COMMENT ON TABLE revenue_attribution IS 'Chia/gán doanh thu thủ công khi cần (team split, manager override)';
COMMENT ON TABLE bonus_calc_runs IS 'Mỗi lần admin chạy "Tính lương tháng X"';
COMMENT ON TABLE payroll_edits IS 'Audit trail cho mọi sửa đổi sau commit';
COMMENT ON VIEW v_user_monthly_revenue IS 'Tổng hợp DT per user per month — input cho bonus engine';
