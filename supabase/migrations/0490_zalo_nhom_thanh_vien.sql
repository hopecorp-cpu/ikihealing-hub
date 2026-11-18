

create table if not exists zalo_group_snapshots (
  id          bigserial primary key,
  group_id    text        not null,
  ten_nhom    text,
  so_tv       integer     not null,
  ngay        date        not null,
  chup_at     timestamptz not null default now(),
  unique (group_id, ngay)
);
create index if not exists zalo_group_snap_ngay_idx on zalo_group_snapshots (ngay desc);
create index if not exists zalo_group_snap_gr_idx  on zalo_group_snapshots (group_id, ngay desc);

create table if not exists zalo_group_posts (
  id          bigserial primary key,
  group_id    text        not null,
  ten_nhom    text,
  nguoi_dang  text,
  noi_dung    text,
  dang_at     timestamptz not null,
  ngay        date        not null,
  created_at  timestamptz not null default now()
);
create index if not exists zalo_group_posts_ngay_idx on zalo_group_posts (ngay desc);
create index if not exists zalo_group_posts_gr_idx   on zalo_group_posts (group_id, dang_at desc);

alter table zalo_group_snapshots enable row level security;
alter table zalo_group_posts     enable row level security;

comment on table zalo_group_snapshots is 'Ảnh chụp số thành viên nhóm Zalo mỗi ngày — nền để đo khách rời nhóm';
comment on table zalo_group_posts     is 'Bài sale/máy đăng vào nhóm Zalo — ghép với ảnh chụp để biết bài nào làm mất người';
