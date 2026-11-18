

CREATE TABLE IF NOT EXISTS recurring_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  estimated_hours NUMERIC(5,1),
  tags TEXT[],

  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('daily','weekdays','weekly','monthly')),
  recurrence_day_of_week SMALLINT CHECK (recurrence_day_of_week BETWEEN 1 AND 7),
  recurrence_day_of_month SMALLINT CHECK (recurrence_day_of_month BETWEEN 1 AND 31),

  due_hours_after_create INT DEFAULT 24,

  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_tmpl_active ON recurring_task_templates(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_recurring_tmpl_assignee ON recurring_task_templates(assignee_id);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_template_id UUID REFERENCES recurring_task_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_recurring_tmpl ON tasks(recurring_template_id) WHERE recurring_template_id IS NOT NULL;

CREATE OR REPLACE FUNCTION touch_recurring_tmpl_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recurring_tmpl_updated ON recurring_task_templates;
CREATE TRIGGER trg_recurring_tmpl_updated BEFORE UPDATE ON recurring_task_templates
  FOR EACH ROW EXECUTE FUNCTION touch_recurring_tmpl_updated_at();
