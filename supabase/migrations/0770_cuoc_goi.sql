

create table if not exists cuoc_goi (
  id               bigint generated always as identity primary key,
  may_ma           text not null,
  sale             text,
  ma_tren_may      text not null,
  sdt              text,
  chieu            text not null,
  bat_dau          timestamptz not null,
  thoi_luong_giay  int not null default 0,
  file_path        text not null,
  file_bytes       bigint,
  trang_thai       text not null default 'cho_chep',
  loi              text,
  so_lan_thu       int not null default 0,
  ban_chep         text,
  cham             jsonb,
  diem             int,
  cham_luc         timestamptz,
  tao_luc          timestamptz not null default now(),
  unique (may_ma, ma_tren_may)
);
create index if not exists cuoc_goi_trang_thai_idx on cuoc_goi (trang_thai, bat_dau);
create index if not exists cuoc_goi_sdt_idx on cuoc_goi (sdt, bat_dau);
create index if not exists cuoc_goi_bat_dau_idx on cuoc_goi (bat_dau desc);

alter table cuoc_goi enable row level security;

insert into storage.buckets (id, name, public, file_size_limit)
values ('ghi-am-cuoc-goi', 'ghi-am-cuoc-goi', false, 52428800)
on conflict (id) do nothing;
