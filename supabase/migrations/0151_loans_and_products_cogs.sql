

CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_code TEXT UNIQUE,
  lender TEXT NOT NULL,
  lender_phone TEXT,
  lender_account TEXT,
  principal_amount NUMERIC(15,0) NOT NULL,
  interest_rate NUMERIC(5,4) NOT NULL,
  withholding_tax_rate NUMERIC(4,3) DEFAULT 0.05,
  start_date DATE NOT NULL,
  end_date DATE,
  payment_frequency TEXT DEFAULT 'quarterly' CHECK (payment_frequency IN ('monthly','quarterly','semi-annually','annually')),
  outstanding_principal NUMERIC(15,0) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paid_off','overdue','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('principal','interest','combined')),
  period TEXT,
  period_start DATE,
  period_end DATE,
  due_date DATE,
  paid_date DATE,
  days_in_period INT,
  gross_amount NUMERIC(15,0),
  withholding_tax NUMERIC(15,0),
  net_amount NUMERIC(15,0),
  payment_method TEXT,
  ref_code TEXT,
  bank_txn_id UUID REFERENCES bank_transactions(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id, due_date);
CREATE INDEX IF NOT EXISTS idx_loan_payments_status ON loan_payments(status, due_date);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(4,3) DEFAULT 0.08,
  ADD COLUMN IF NOT EXISTS supplier TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'hộp',
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

COMMENT ON TABLE loans IS 'Hợp đồng vay vốn — gốc + lãi suất + dư nợ';
COMMENT ON TABLE loan_payments IS 'Lịch sử thanh toán gốc/lãi + thuế TNCN 5%';
