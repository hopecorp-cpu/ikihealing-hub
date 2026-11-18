
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS gps_unverified BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN attendance.gps_unverified IS 'Check-in không có GPS (office mode) → chờ admin xác minh vị trí';
