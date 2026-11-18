

create table if not exists shopee_tokens (
  shop_id                   bigint primary key,
  shop_name                 text,
  access_token              text not null,
  access_token_expires_at   timestamptz not null,
  refresh_token             text not null,
  refresh_token_expires_at  timestamptz not null,
  last_refresh_error        text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
alter table shopee_tokens enable row level security;
