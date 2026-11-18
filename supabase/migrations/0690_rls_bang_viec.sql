

alter table public.tasks                    enable row level security;
alter table public.task_comments            enable row level security;
alter table public.recurring_task_templates enable row level security;
alter table public.daily_reports            enable row level security;
alter table public.agent_runs               enable row level security;

drop policy if exists p069_tasks_doc on public.tasks;
create policy p069_tasks_doc on public.tasks for select to authenticated
  using (assignee_id = auth.uid() or assigner_id = auth.uid() or public.is_manager_or_above());

drop policy if exists p069_task_comments_doc on public.task_comments;
create policy p069_task_comments_doc on public.task_comments for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_manager_or_above()
    or exists (select 1 from public.tasks t where t.id = task_comments.task_id)
  );

drop policy if exists p069_recurring_doc on public.recurring_task_templates;
create policy p069_recurring_doc on public.recurring_task_templates for select to authenticated
  using (assignee_id = auth.uid() or assigner_id = auth.uid() or public.is_manager_or_above());

drop policy if exists p069_daily_reports_doc on public.daily_reports;
create policy p069_daily_reports_doc on public.daily_reports for select to authenticated
  using (user_id = auth.uid() or public.is_manager_or_above());

drop policy if exists p069_agent_runs_doc on public.agent_runs;
create policy p069_agent_runs_doc on public.agent_runs for select to authenticated
  using (public.is_manager_or_above());
