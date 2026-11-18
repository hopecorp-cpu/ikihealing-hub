

alter table zalo_bridge_contacts
  add column if not exists avatar_url  text,
  add column if not exists thu_hoi_so  integer not null default 0,
  add column if not exists thu_hoi_luc timestamptz;

create index if not exists zalo_bridge_contacts_thu_hoi_idx
  on zalo_bridge_contacts (thu_hoi_luc desc) where thu_hoi_so > 0;
