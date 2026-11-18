

CREATE TABLE IF NOT EXISTS employment_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  contract_type TEXT NOT NULL CHECK (contract_type IN (
    'thu_viec',
    'xac_dinh_1_nam',
    'xac_dinh_2_nam',
    'khong_xac_dinh',
    'ctv',
    'khoan_viec'
  )),
  effective_date DATE NOT NULL,
  end_date DATE,
  probation_end_date DATE,

  position TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  work_location TEXT DEFAULT '63/253 đường Ngô Quyền, P. Lê Thanh Nghị, Hải Phòng',
  work_hours TEXT DEFAULT '08:00-12:00 / 13:30-17:30, T2-T7',

  base_salary NUMERIC(15,0) NOT NULL,
  salary_pct INT DEFAULT 100,
  insurance_salary NUMERIC(15,0) NOT NULL,
  bonus_max NUMERIC(15,0) DEFAULT 0,
  allowance NUMERIC(15,0) DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending_signatures',
    'signed_by_employee',
    'signed_by_employer',
    'active',
    'expired',
    'terminated'
  )),

  employee_signed_at TIMESTAMPTZ,
  employer_signed_at TIMESTAMPTZ,
  employer_signed_by UUID REFERENCES users(id),

  custom_terms JSONB,
  pdf_url TEXT,

  terminated_at DATE,
  termination_reason TEXT,

  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_user ON employment_contracts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_active ON employment_contracts(status, end_date)
  WHERE status IN ('active', 'pending_signatures');

CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TEXT AS $$
DECLARE
  yr INT := EXTRACT(YEAR FROM NOW())::INT;
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(contract_number FROM '\d+$')::INT), 0) + 1
  INTO next_num
  FROM employment_contracts
  WHERE contract_number LIKE 'HD-' || yr || '-%';
  RETURN 'HD-' || yr || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
