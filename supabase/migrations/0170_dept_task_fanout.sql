

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_dept_summary BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_dept_summary ON tasks(target_department_id, is_dept_summary)
  WHERE is_dept_summary = TRUE;

ALTER TABLE tasks ALTER COLUMN assignee_id DROP NOT NULL;

ALTER TABLE recurring_task_templates
  ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (target_type IN ('individual','department'));
ALTER TABLE recurring_task_templates
  ADD COLUMN IF NOT EXISTS target_department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE recurring_task_templates ALTER COLUMN assignee_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_tmpl_dept ON recurring_task_templates(target_department_id)
  WHERE target_type = 'department';

CREATE OR REPLACE VIEW v_dept_task_progress AS
SELECT
  p.id AS parent_id,
  p.title,
  p.target_department_id,
  p.due_date,
  p.priority,
  COUNT(c.id) AS total_children,
  COUNT(c.id) FILTER (WHERE c.status = 'done') AS done_children,
  COUNT(c.id) FILTER (WHERE c.status = 'doing') AS doing_children,
  COUNT(c.id) FILTER (WHERE c.status = 'blocked') AS blocked_children
FROM tasks p
LEFT JOIN tasks c ON c.parent_task_id = p.id
WHERE p.is_dept_summary = TRUE
GROUP BY p.id;
