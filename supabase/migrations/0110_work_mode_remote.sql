

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS work_mode TEXT DEFAULT 'office'
  CHECK (work_mode IN ('office', 'remote', 'hybrid'));

COMMENT ON COLUMN users.work_mode IS 'Chế độ làm việc: office (bắt buộc ở VP), remote (làm từ xa), hybrid (cả hai)';

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS work_location TEXT DEFAULT 'office'
  CHECK (work_location IN ('office', 'remote', 'business_trip', 'other'));

COMMENT ON COLUMN attendance.work_location IS 'Nơi chấm công thực tế của ngày: office/remote/business_trip/other';

UPDATE users
SET work_mode = 'remote'
WHERE work_mode = 'office'
  AND (
    contract_type = 'HĐ CTV'
    OR position ILIKE '%CTV%'
    OR position ILIKE '%Remote%'
    OR position ILIKE '%Cộng tác viên%'
  );

CREATE INDEX IF NOT EXISTS idx_users_work_mode ON users(work_mode);
CREATE INDEX IF NOT EXISTS idx_attendance_work_location ON attendance(work_location);
