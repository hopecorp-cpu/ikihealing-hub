
CREATE TABLE IF NOT EXISTS empire_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scored_by UUID REFERENCES users(id) NOT NULL,
  period TEXT NOT NULL,
  scope TEXT DEFAULT 'company',
  offer_score INT CHECK (offer_score BETWEEN 1 AND 10),
  offer_note TEXT,
  pricing_score INT CHECK (pricing_score BETWEEN 1 AND 10),
  pricing_note TEXT,
  customer_score INT CHECK (customer_score BETWEEN 1 AND 10),
  customer_note TEXT,
  channel_score INT CHECK (channel_score BETWEEN 1 AND 10),
  channel_note TEXT,
  funnel_score INT CHECK (funnel_score BETWEEN 1 AND 10),
  funnel_note TEXT,
  brand_score INT CHECK (brand_score BETWEEN 1 AND 10),
  brand_note TEXT,
  product_score INT CHECK (product_score BETWEEN 1 AND 10),
  product_note TEXT,
  team_score INT CHECK (team_score BETWEEN 1 AND 10),
  team_note TEXT,
  cash_score INT CHECK (cash_score BETWEEN 1 AND 10),
  cash_note TEXT,
  moat_score INT CHECK (moat_score BETWEEN 1 AND 10),
  moat_note TEXT,
  total_score INT GENERATED ALWAYS AS (
    COALESCE(offer_score,0) + COALESCE(pricing_score,0) + COALESCE(customer_score,0) +
    COALESCE(channel_score,0) + COALESCE(funnel_score,0) + COALESCE(brand_score,0) +
    COALESCE(product_score,0) + COALESCE(team_score,0) + COALESCE(cash_score,0) +
    COALESCE(moat_score,0)
  ) STORED,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','final')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empire_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  signed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '90 days'),
  business_name TEXT NOT NULL,
  current_revenue NUMERIC,
  current_revenue_note TEXT,
  goal_90days TEXT NOT NULL,
  goal_target_revenue NUMERIC,
  commitment_to_drop TEXT NOT NULL,
  signature_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','expired','cancelled')),
  result_revenue NUMERIC,
  result_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empire_declarations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  declarations_read BOOLEAN DEFAULT TRUE,
  reflection TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_audit_period ON empire_audits(period, scored_by);
CREATE INDEX IF NOT EXISTS idx_commit_user ON empire_commitments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_decl_user_date ON empire_declarations_log(user_id, date DESC);

ALTER TABLE empire_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE empire_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE empire_declarations_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_read ON empire_audits FOR SELECT USING (true);
CREATE POLICY audit_insert ON empire_audits FOR INSERT WITH CHECK (scored_by = auth.uid());
CREATE POLICY audit_update ON empire_audits FOR UPDATE USING (scored_by = auth.uid() OR public.is_admin_or_ceo());

CREATE POLICY commit_read ON empire_commitments FOR SELECT USING (user_id = auth.uid() OR public.is_manager_or_above());
CREATE POLICY commit_insert ON empire_commitments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY commit_update ON empire_commitments FOR UPDATE USING (user_id = auth.uid() OR public.is_admin_or_ceo());

CREATE POLICY decl_all ON empire_declarations_log FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
