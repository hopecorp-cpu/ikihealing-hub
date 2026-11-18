

create or replace function public.is_admin_or_ceo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and role in ('admin','ceo'));
$$;

drop policy if exists users_admin_modify on users;
drop policy if exists users_select on users;

drop policy if exists users_self_or_admin_read on users;
drop policy if exists users_admin_insert on users;
drop policy if exists users_self_or_admin_update on users;
drop policy if exists users_admin_delete on users;

create policy users_self_or_admin_read on users for select
  using (id = auth.uid() or public.is_admin_or_ceo());

create policy users_admin_insert on users for insert
  with check (public.is_admin_or_ceo());
create policy users_self_or_admin_update on users for update
  using (id = auth.uid() or public.is_admin_or_ceo());
create policy users_admin_delete on users for delete
  using (public.is_admin_or_ceo());

alter table public.users enable row level security;

