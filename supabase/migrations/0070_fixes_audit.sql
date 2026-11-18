

CREATE TABLE IF NOT EXISTS salary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  changed_by UUID REFERENCES users(id),
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_salary_history_user ON salary_history(user_id, changed_at DESC);

ALTER TABLE payroll ADD COLUMN IF NOT EXISTS allowances NUMERIC DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS allowances_note TEXT;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS deductions NUMERIC DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS deductions_note TEXT;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;

CREATE OR REPLACE FUNCTION update_leave_balance()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_year INT;
BEGIN
  current_year := EXTRACT(YEAR FROM COALESCE(NEW.from_date, OLD.from_date));

  IF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' AND NEW.type = 'phep' THEN
    -- Đơn phép được approve → cộng vào used_days
    INSERT INTO leave_balances (user_id, year, total_days, used_days)
    VALUES (NEW.user_id, current_year, 12, NEW.days)
    ON CONFLICT (user_id, year) DO UPDATE SET used_days = leave_balances.used_days + NEW.days;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status != 'approved' AND NEW.type = 'phep' THEN
    -- Đơn phép bị reject sau khi approve → trừ ra
    UPDATE leave_balances SET used_days = GREATEST(0, used_days - NEW.days)
    WHERE user_id = NEW.user_id AND year = current_year;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leave_balance ON leaves;
CREATE TRIGGER trg_leave_balance
AFTER UPDATE ON leaves
FOR EACH ROW EXECUTE FUNCTION update_leave_balance();

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID, p_type TEXT, p_title TEXT, p_content TEXT, p_action_url TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, content, action_url, read)
  VALUES (p_user_id, p_type, p_title, p_content, p_action_url, false)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION notify_new_leave()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  user_name TEXT;
  manager_record RECORD;
BEGIN
  SELECT full_name INTO user_name FROM users WHERE id = NEW.user_id;
  FOR manager_record IN
    SELECT id FROM users WHERE role IN ('admin','ceo','manager') AND active = true AND id != NEW.user_id
  LOOP
    PERFORM create_notification(
      manager_record.id, 'leave_new',
      'Đơn nghỉ mới',
      user_name || ' xin nghỉ ' || NEW.days || ' ngày — ' || COALESCE(NEW.reason, ''),
      '/xin-nghi'
    );
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_leave ON leaves;
CREATE TRIGGER trg_notify_new_leave
AFTER INSERT ON leaves
FOR EACH ROW EXECUTE FUNCTION notify_new_leave();

CREATE OR REPLACE FUNCTION notify_leave_decision()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved','rejected') THEN
    PERFORM create_notification(
      NEW.user_id, 'leave_decided',
      CASE WHEN NEW.status = 'approved' THEN '✅ Đơn nghỉ được duyệt' ELSE '❌ Đơn nghỉ bị từ chối' END,
      'Đơn nghỉ ' || NEW.days || ' ngày từ ' || NEW.from_date || COALESCE(' — ' || NEW.approver_note, ''),
      '/xin-nghi'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_leave_decision ON leaves;
CREATE TRIGGER trg_notify_leave_decision
AFTER UPDATE ON leaves
FOR EACH ROW EXECUTE FUNCTION notify_leave_decision();

ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sh_read ON salary_history;
DROP POLICY IF EXISTS sh_admin_insert ON salary_history;
CREATE POLICY sh_read ON salary_history FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin_or_ceo());
CREATE POLICY sh_admin_insert ON salary_history FOR INSERT
  WITH CHECK (public.is_admin_or_ceo());
