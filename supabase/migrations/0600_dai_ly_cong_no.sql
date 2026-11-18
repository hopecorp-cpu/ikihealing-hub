

create table if not exists dai_ly_cong_no (
  id          text primary key,
  ma_dai_ly   text not null,
  loai        text not null check (loai in ('no', 'tra')),
  ngay        date not null,
  so_tien     numeric not null check (so_tien > 0),
  ma_don      text,
  kenh        text,
  ghi_chu     text,
  tao_luc     timestamptz not null default now(),
  tao_boi     text
);
create index if not exists dai_ly_cong_no_ma on dai_ly_cong_no (ma_dai_ly, ngay);

alter table dai_ly_cong_no enable row level security;
revoke all on table dai_ly_cong_no from anon, authenticated;

