
CREATE TABLE IF NOT EXISTS seeding_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_date   DATE NOT NULL,
  group_key   TEXT NOT NULL,
  time_slot   TEXT NOT NULL,
  title       TEXT,
  assigned_to TEXT,
  done        BOOLEAN DEFAULT FALSE,
  note        TEXT,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (task_date, group_key, time_slot)
);
CREATE INDEX IF NOT EXISTS idx_seedtask_date ON seeding_tasks(task_date);
