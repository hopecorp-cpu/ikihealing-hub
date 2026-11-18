

alter table zalo_bridge_messages
  add column if not exists media_type  text,
  add column if not exists media_url   text,
  add column if not exists media_thumb text,
  add column if not exists media_goc   text,
  add column if not exists media_ten   text,

  add column if not exists cli_msg_id text;

create index if not exists zalo_msg_cli_idx
  on zalo_bridge_messages (cli_msg_id) where cli_msg_id is not null;

create index if not exists zalo_msg_media_idx
  on zalo_bridge_messages (own_id, media_type) where media_type is not null;

insert into storage.buckets (id, name, public)
values ('zalo-media', 'zalo-media', false)
on conflict (id) do nothing;
