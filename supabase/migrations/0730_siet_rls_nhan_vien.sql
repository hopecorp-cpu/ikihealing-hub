

create or replace function public.users_chan_tu_sua_cot_quyen()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cho_phep constant text[] := array['full_name', 'phone', 'avatar_url'];
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if public.is_admin_or_ceo() then
    return new;
  end if;
  if (to_jsonb(new) - cho_phep) is distinct from (to_jsonb(old) - cho_phep) then
    raise exception 'Chỉ admin/ceo được đổi quyền, lương, phòng ban, trạng thái trên users'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists users_chan_tu_sua_cot_quyen on public.users;
create trigger users_chan_tu_sua_cot_quyen
  before update on public.users
  for each row execute function public.users_chan_tu_sua_cot_quyen();

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'customers', 'products', 'orders', 'order_items', 'courses', 'students', 'content_items',
    'job_postings', 'candidates', 'projects', 'project_tasks', 'config'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
        and (qual = 'true' or with_check = 'true')
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

drop policy if exists config_read on public.config;

do $$
declare
  t text;
begin
  foreach t in array array[
    'bank_statements', 'bank_transactions', 'expenses', 'loans', 'loan_payments',
    'employment_contracts', 'payroll_edits', 'attendance_edits', 'attendance_correction_requests',
    'bonus_calc_runs', 'revenue_attribution', 'one_on_ones', 'part_time_shifts', 'livestream_sessions',
    'customer_care_log', 'salework_contacts', 'salework_chat_analysis', 'leads',
    'jt_waybills', 'jt_summary', 'misa_daily_profit', 'misa_sync_log', 'mshopkeeper_line_items',
    'tg_orders', 'tg_messages', 'audit_logs'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

