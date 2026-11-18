
ALTER TABLE users   ADD COLUMN IF NOT EXISTS hourly_rate  INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS hours_worked NUMERIC(6,1)  NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.hourly_rate   IS 'Tiền công/giờ cho NV part-time theo giờ (0 = không áp dụng, dùng lương tháng)';
COMMENT ON COLUMN payroll.hours_worked IS 'Số giờ làm trong tháng (NV part-time theo giờ). Lương = hourly_rate × hours_worked';


