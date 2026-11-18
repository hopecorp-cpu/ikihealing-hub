

create table if not exists tg_messages (
  id          bigserial primary key,
  chat_id     text        not null,
  chat_name   text,
  message_id  bigint      not null,
  from_name   text,
  from_id     text,
  noi_dung    text,
  sent_at     timestamptz not null,
  da_boc      boolean     not null default false,
  created_at  timestamptz not null default now(),
  unique (chat_id, message_id)
);
create index if not exists tg_messages_sent_idx on tg_messages (sent_at desc);
create index if not exists tg_messages_chuaboc_idx on tg_messages (da_boc, sent_at) where da_boc = false;

create table if not exists tg_orders (
  id          bigserial primary key,
  chat_id     text        not null,
  message_id  bigint      not null,
  sale        text,
  khach       text,
  sdt         text,
  dia_chi     text,
  tinh        text,
  san_pham    jsonb       not null default '[]'::jsonb,
  qua         jsonb       not null default '[]'::jsonb,
  gia_goc     bigint      not null default 0,
  giam_gia    bigint      not null default 0,
  khach_tra   bigint      not null default 0,
  kieu_ship   text,
  phi_ship    bigint      not null default 0,
  ghi_chu     text,
  ngay        date        not null,
  sent_at     timestamptz,
  nguoi_gui   text,
  boc_at      timestamptz not null default now(),
  unique (chat_id, message_id)
);
create index if not exists tg_orders_ngay_idx  on tg_orders (ngay desc);
create index if not exists tg_orders_sale_idx  on tg_orders (sale, ngay desc);
create index if not exists tg_orders_sdt_idx   on tg_orders (sdt);

alter table tg_messages enable row level security;
alter table tg_orders   enable row level security;

comment on table tg_messages is 'Tin thô nhóm Telegram đơn hàng — nguồn gốc để bóc đơn (thay sổ WhatsApp từ 01/08/2026)';
comment on table tg_orders   is 'Đơn đã bóc từ tin Telegram — nguồn doanh thu chính, không còn phụ thuộc MISA';
