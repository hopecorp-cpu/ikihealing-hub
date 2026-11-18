

alter table public.users drop constraint if exists users_role_check;

do $$
declare ten text;
begin
  select c.conname into ten
  from pg_constraint c
  where c.conrelid = 'public.users'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%admin%'
    and pg_get_constraintdef(c.oid) ilike '%employee%'
    and pg_get_constraintdef(c.oid) ilike '%role%';
  if ten is not null then
    execute format('alter table public.users drop constraint %I', ten);
  end if;
end $$;

alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'ceo', 'manager', 'employee', 'bod', 'bod_viewer'));
