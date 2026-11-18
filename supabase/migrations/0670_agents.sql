

create table if not exists public.agents (
  id            text primary key,
  loai          text not null check (loai in ('phong','tro_ly','router','bot','may')),
  ten           text not null,
  grok_agent_id uuid,
  phong_id      text references public.agents(id),
  department_id uuid references public.departments(id),
  kenh          text,
  noi_chay      text,
  trang_thai    text not null default 'song' check (trang_thai in ('song','yeu','hong','tam_dung','chet')),
  kpi_chinh     text,
  nguoi_cham    text references public.agents(id),
  ghi_chu       text,
  updated_at    timestamptz not null default now()
);

alter table public.agents add column if not exists department_id uuid references public.departments(id);
create index if not exists agents_department_idx on public.agents (department_id);

create table if not exists public.agent_feedback (
  id           bigserial primary key,
  agent_id     text not null references public.agents(id),
  loai         text not null check (loai in ('ket_qua','cham_diem','bai_hoc_tuan')),
  ma_viec      text,
  viec         text not null,
  ket_qua      text,
  bang_chung   text,
  so_luong     int default 0,
  don_vi       text,
  tu_danh_gia  smallint check (tu_danh_gia between 1 and 5),
  diem         smallint check (diem between 1 and 5),
  dat          boolean,
  ly_do        text,
  nguoi_cham   text,
  cham_luc     timestamptz,
  bai_hoc      text,
  ap_dung_tu   date,
  tuan         date,
  created_at   timestamptz not null default now()
);
create index if not exists agent_feedback_agent_idx on public.agent_feedback (agent_id, created_at desc);
create index if not exists agent_feedback_chocham_idx on public.agent_feedback (created_at desc)
  where loai = 'ket_qua' and cham_luc is null;

alter table public.agents enable row level security;
alter table public.agent_feedback enable row level security;

create or replace view public.v_diem_tuan
with (security_invoker = true) as
select agent_id, date_trunc('week', created_at)::date as tuan,
       count(*) filter (where loai = 'ket_qua') as so_viec,
       count(*) filter (where dat) as dat,
       count(*) filter (where dat = false) as chua_dat,
       round(avg(diem)::numeric, 2) as diem_tb
from public.agent_feedback
group by 1, 2;

revoke all on public.v_diem_tuan from anon, authenticated;
