
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS fields JSONB DEFAULT '{}'::jsonb;
