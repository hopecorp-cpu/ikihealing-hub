

ALTER TABLE leaves DROP CONSTRAINT IF EXISTS leaves_type_check;
ALTER TABLE leaves ADD CONSTRAINT leaves_type_check
  CHECK (type IN ('phep','om','khong_luong','ot','cong_tac','hieu_hi','ra_ngoai'));

ALTER TABLE leaves ADD COLUMN IF NOT EXISTS from_time TIME;
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS to_time TIME;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_minutes INT DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS early_leave_minutes INT DEFAULT 0;

INSERT INTO config (key, value, description) VALUES
  ('work_morning_start', '08:00', 'Giờ vào sáng'),
  ('work_morning_end', '12:00', 'Giờ tan sáng'),
  ('work_afternoon_start', '13:30', 'Giờ vào chiều'),
  ('work_afternoon_end', '17:30', 'Giờ tan chiều'),
  ('work_hours_per_day', '8', 'Số giờ làm/ngày'),
  ('grace_minutes', '5', 'Số phút trễ được chấp nhận (không tính phạt)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;
