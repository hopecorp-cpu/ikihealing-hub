

drop policy if exists p069_tasks_doc          on public.tasks;
drop policy if exists p069_task_comments_doc  on public.task_comments;
drop policy if exists p069_recurring_doc      on public.recurring_task_templates;
drop policy if exists p069_daily_reports_doc  on public.daily_reports;
drop policy if exists p069_agent_runs_doc     on public.agent_runs;

alter table public.tasks                    disable row level security;
alter table public.task_comments            disable row level security;
alter table public.recurring_task_templates disable row level security;
alter table public.daily_reports            disable row level security;
alter table public.agent_runs               disable row level security;
