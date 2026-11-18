

create table if not exists tts_tokens (
  open_id                   text primary key,
  shop_id                   text,
  shop_cipher               text,
  seller_name               text,
  region                    text,
  access_token              text not null,
  access_token_expires_at   timestamptz not null,
  refresh_token             text not null,
  refresh_token_expires_at  timestamptz not null,
  scopes                    jsonb,
  last_refresh_error        text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
alter table tts_tokens enable row level security;

create table if not exists tts_orders (
  order_id          text primary key,
  shop_id           text,
  status            text,
  buyer_name        text,
  buyer_message     text,
  recipient         jsonb,
  line_items        jsonb,
  item_count        int,
  total_amount      numeric,
  currency          text,
  paid_at           timestamptz,
  create_time       timestamptz,
  update_time       timestamptz,
  package_ids       jsonb,
  tracking_number   text,
  shipping_provider text,
  notified_at       timestamptz,
  label_sent_at     timestamptz,
  ship_status       text,
  ship_attempted_at timestamptz,
  ship_note         text,
  flags             jsonb not null default '{}'::jsonb,
  raw               jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists tts_orders_status_idx on tts_orders (status, ship_status);
create index if not exists tts_orders_paid_idx   on tts_orders (paid_at desc);
create index if not exists tts_orders_update_idx on tts_orders (update_time desc);
alter table tts_orders enable row level security;

create table if not exists tts_events (
  id                   bigserial primary key,
  tts_notification_id  text not null unique,
  type                 text not null,
  type_code            int,
  shop_id              text,
  payload              jsonb not null,
  status               text not null default 'pending',
  attempts             int not null default 0,
  error                text,
  received_at          timestamptz not null default now(),
  processed_at         timestamptz
);
create index if not exists tts_events_pending_idx on tts_events (status, received_at) where status = 'pending';
create index if not exists tts_events_received_idx on tts_events (received_at desc);
alter table tts_events enable row level security;

