

create table if not exists public.thanh_vien_doi_qua (
  id          uuid primary key,
  sdt         text        not null,
  qua_id      text        not null,
  diem        integer     not null check (diem > 0),
  luc         timestamptz not null default now(),
  trang_thai  text        not null default 'cho_xu_ly' check (trang_thai in ('cho_xu_ly', 'da_gui', 'tu_choi')),
  ghi_chu     text
);
create index if not exists thanh_vien_doi_qua_sdt_idx on public.thanh_vien_doi_qua (sdt);
create index if not exists thanh_vien_doi_qua_tt_idx  on public.thanh_vien_doi_qua (trang_thai, luc desc);

alter table public.thanh_vien_doi_qua enable row level security;
