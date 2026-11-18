

alter table public.tasks add column if not exists ma_viec text unique;
alter table public.tasks add column if not exists assignee_agent_id text references public.agents(id);
alter table public.tasks add column if not exists nguon text check (nguon in ('ui','bang-viec','cron'));
create index if not exists idx_tasks_assignee_agent on public.tasks (assignee_agent_id, status)
  where assignee_agent_id is not null;

alter table public.recurring_task_templates
  add column if not exists target_agent_id text references public.agents(id);

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.recurring_task_templates'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%target_type%'
  loop
    execute format('alter table public.recurring_task_templates drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.recurring_task_templates
  add constraint recurring_task_templates_target_type_check
  check (target_type in ('individual','department','agent'));
