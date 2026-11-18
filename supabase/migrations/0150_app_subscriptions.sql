

create table if not exists app_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_name text,
  email text,
  phone text,
  platform text not null check (platform in ('web','ios','android')),
  plan text not null check (plan in ('monthly','yearly')),
  plan_price bigint not null default 0,
  currency text not null default 'VND',
  status text not null default 'active'
    check (status in ('trial','active','cancelled','expired','refunded')),
  auto_renew boolean not null default true,
  started_at date not null default current_date,
  current_period_end date,
  renew_count int not null default 0,
  source text not null default 'manual'
    check (source in ('manual','app_store','google_play','web')),
  external_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_app_subs_status     on app_subscriptions(status);
create index if not exists idx_app_subs_platform   on app_subscriptions(platform);
create index if not exists idx_app_subs_period_end on app_subscriptions(current_period_end);

create unique index if not exists uq_app_subs_external
  on app_subscriptions(source, external_id) where external_id is not null;

create table if not exists app_sync_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  ran_at timestamptz not null default now(),
  fetched int default 0,
  upserted int default 0,
  status text default 'ok',
  message text
);

