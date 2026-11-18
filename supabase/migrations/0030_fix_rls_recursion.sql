

drop policy if exists users_select on users;
drop policy if exists users_admin_modify on users;
drop policy if exists att_self_select on attendance;
drop policy if exists att_self_insert on attendance;
drop policy if exists att_self_update on attendance;
drop policy if exists lv_self_select on leaves;
drop policy if exists lv_self_insert on leaves;
drop policy if exists lv_manager_update on leaves;
drop policy if exists py_self_select on payroll;
drop policy if exists py_admin_all on payroll;
drop policy if exists kpi_self_select on kpis;
drop policy if exists kpi_self_insert on kpis;
drop policy if exists kpi_manager_update on kpis;
drop policy if exists ci_self_select on checkins;
drop policy if exists ci_self_insert on checkins;
drop policy if exists fb_select on feedbacks;
drop policy if exists fb_manager_insert on feedbacks;
drop policy if exists sales_select on sales_revenue;
drop policy if exists sales_admin_all on sales_revenue;
drop policy if exists notif_self on notifications;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin_or_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.users where id = auth.uid() and role in ('admin','ceo'));
$$;

create or replace function public.is_manager_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.users where id = auth.uid() and role in ('admin','ceo','manager'));
$$;

create policy users_read_all on users for select using (true);
create policy users_admin_insert on users for insert with check (public.is_admin_or_ceo());
create policy users_self_or_admin_update on users for update using (id = auth.uid() or public.is_admin_or_ceo());
create policy users_admin_delete on users for delete using (public.is_admin_or_ceo());

create policy att_read on attendance for select using (
  user_id = auth.uid() or public.is_manager_or_above()
);
create policy att_insert_self on attendance for insert with check (user_id = auth.uid());
create policy att_update_self on attendance for update using (user_id = auth.uid() or public.is_admin_or_ceo());

create policy lv_read on leaves for select using (
  user_id = auth.uid() or approver_id = auth.uid() or public.is_manager_or_above()
);
create policy lv_insert_self on leaves for insert with check (user_id = auth.uid());
create policy lv_update_manager on leaves for update using (public.is_manager_or_above());

create policy py_read on payroll for select using (
  user_id = auth.uid() or public.is_admin_or_ceo()
);
create policy py_admin_modify on payroll for all using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());

create policy kpi_read on kpis for select using (
  user_id = auth.uid() or public.is_manager_or_above()
);
create policy kpi_insert_self on kpis for insert with check (user_id = auth.uid() or public.is_manager_or_above());
create policy kpi_update on kpis for update using (user_id = auth.uid() or public.is_manager_or_above());
create policy kpi_delete on kpis for delete using (public.is_manager_or_above());

create policy ci_read on checkins for select using (
  user_id = auth.uid() or public.is_manager_or_above()
);
create policy ci_insert_self on checkins for insert with check (user_id = auth.uid());
create policy ci_update_self on checkins for update using (user_id = auth.uid());

create policy fb_read on feedbacks for select using (true);
create policy fb_manager_insert on feedbacks for insert with check (public.is_manager_or_above());

create policy sales_read on sales_revenue for select using (
  user_id = auth.uid() or public.is_manager_or_above()
);
create policy sales_admin_modify on sales_revenue for all using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());

create policy notif_self on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table departments enable row level security;
alter table cycles enable row level security;
alter table bonus_rules enable row level security;
alter table config enable row level security;
alter table leave_balances enable row level security;

create policy dept_read on departments for select using (true);
create policy dept_admin_modify on departments for all using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());

create policy cycle_read on cycles for select using (true);
create policy cycle_admin_modify on cycles for all using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());

create policy bonus_read on bonus_rules for select using (true);
create policy bonus_admin_modify on bonus_rules for all using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());

create policy config_read on config for select using (true);
create policy config_admin_modify on config for all using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());

create policy lb_read on leave_balances for select using (
  user_id = auth.uid() or public.is_manager_or_above()
);
create policy lb_admin_modify on leave_balances for all using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());
