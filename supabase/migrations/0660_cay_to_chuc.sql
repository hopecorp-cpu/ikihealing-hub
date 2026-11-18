

alter table public.departments add column if not exists parent_id uuid references public.departments(id) on delete set null;
alter table public.departments add column if not exists ma text unique;
alter table public.departments add column if not exists loai text check (loai in ('khoi','phong','tang'));
alter table public.departments add column if not exists thu_tu int;
alter table public.departments add column if not exists active boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'departments_khong_tu_lam_cha') then
    alter table public.departments
      add constraint departments_khong_tu_lam_cha check (parent_id is null or parent_id <> id);
  end if;
end $$;

create index if not exists departments_parent_idx on public.departments (parent_id);

create table if not exists public.vai_tro_kiem_nhiem (
  id            bigserial primary key,
  user_id       uuid not null references public.users(id),
  department_id uuid not null references public.departments(id),
  vai_tro       text not null,
  ca            text,
  ghi_chu       text,
  created_at    timestamptz not null default now(),
  unique (user_id, department_id, vai_tro)
);

alter table public.vai_tro_kiem_nhiem enable row level security;
