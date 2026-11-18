

ALTER TABLE payroll ADD COLUMN IF NOT EXISTS allowance_phone      NUMERIC DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS allowance_attendance NUMERIC DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS allowance_lunch      NUMERIC DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS allowance_fuel       NUMERIC DEFAULT 0;

COMMENT ON COLUMN payroll.allowance_phone      IS 'Phụ cấp điện thoại (không chịu thuế/BH)';
COMMENT ON COLUMN payroll.allowance_attendance IS 'Phụ cấp chuyên cần (không chịu thuế/BH)';
COMMENT ON COLUMN payroll.allowance_lunch      IS 'Phụ cấp ăn trưa (không chịu thuế/BH)';
COMMENT ON COLUMN payroll.allowance_fuel       IS 'Phụ cấp xăng xe / đi lại (không chịu thuế/BH)';
