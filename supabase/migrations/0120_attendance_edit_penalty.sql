

CREATE TABLE IF NOT EXISTS attendance_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  edited_by UUID REFERENCES users(id),
  user_id UUID REFERENCES users(id),
  old_check_in TIMESTAMPTZ,
  new_check_in TIMESTAMPTZ,
  old_check_out TIMESTAMPTZ,
  new_check_out TIMESTAMPTZ,
  old_late_minutes INT,
  new_late_minutes INT,
  old_early_leave_minutes INT,
  new_early_leave_minutes INT,
  reason TEXT NOT NULL,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_att_edits_user ON attendance_edits(user_id);
CREATE INDEX IF NOT EXISTS idx_att_edits_att ON attendance_edits(attendance_id);

CREATE TABLE IF NOT EXISTS attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  request_type TEXT CHECK (request_type IN ('missed_checkin','missed_checkout','wrong_time','other')),
  requested_check_in TIMESTAMPTZ,
  requested_check_out TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_corr_user_status ON attendance_correction_requests(user_id, status);

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS missed_checkin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS missed_checkout BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_reason TEXT;

CREATE TABLE IF NOT EXISTS penalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT UNIQUE NOT NULL,
  amount NUMERIC(12,0) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO penalty_config (rule_key, amount, description) VALUES
  ('missed_checkin',  50000, 'Quên check-in (Face ID) khi đến VP — phạt 50k/lần'),
  ('missed_checkout', 50000, 'Quên check-out cuối ngày — phạt 50k/lần'),
  ('late_over_30min', 100000, 'Đi muộn trên 30 phút — phạt 100k/lần'),
  ('absent_no_notice', 500000, 'Vắng mặt không xin phép — phạt 500k/lần')
ON CONFLICT (rule_key) DO NOTHING;

ALTER TABLE payroll
  ADD COLUMN IF NOT EXISTS deduction_penalty NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_breakdown JSONB;

CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_by UUID REFERENCES users(id),
  bank_name TEXT,
  account_number TEXT,
  period_from DATE,
  period_to DATE,
  file_url TEXT,
  total_credit NUMERIC(15,0) DEFAULT 0,
  total_debit NUMERIC(15,0) DEFAULT 0,
  txn_count INT DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID REFERENCES bank_statements(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL,
  amount NUMERIC(15,0) NOT NULL,
  type TEXT CHECK (type IN ('credit','debit')),
  description TEXT,
  counterparty TEXT,
  ref_code TEXT,
  category TEXT,
  matched_order_id UUID REFERENCES orders(id),
  matched_expense_id UUID,
  reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_txn_date ON bank_transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_bank_txn_category ON bank_transactions(category);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL,
  amount NUMERIC(15,0) NOT NULL,
  category TEXT NOT NULL,
  vendor TEXT,
  description TEXT,
  receipt_url TEXT,
  payment_method TEXT,
  bank_txn_id UUID REFERENCES bank_transactions(id),
  paid_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

CREATE TABLE IF NOT EXISTS misa_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT,
  sync_from TIMESTAMPTZ,
  sync_to TIMESTAMPTZ,
  records_synced INT,
  records_new INT,
  records_updated INT,
  error_message TEXT,
  status TEXT,
  triggered_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS misa_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_platform TEXT DEFAULT 'manual';
CREATE INDEX IF NOT EXISTS idx_orders_misa ON orders(misa_id) WHERE misa_id IS NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS misa_id TEXT;

COMMENT ON TABLE attendance_edits IS 'Audit log mỗi lần admin sửa chấm công của NV';
COMMENT ON TABLE attendance_correction_requests IS 'Đơn NV xin sửa chấm công (do quên/thao tác sai)';
COMMENT ON TABLE penalty_config IS 'Cấu hình mức phạt — admin chỉnh được, default 50k cho quên Face ID';
COMMENT ON TABLE bank_statements IS 'Upload sao kê ngân hàng để đối soát doanh thu + chi phí';
COMMENT ON TABLE expenses IS 'Quản lý chi phí — link với bank_transactions để đối soát';
