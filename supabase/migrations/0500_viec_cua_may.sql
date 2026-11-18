

create table if not exists agent_runs (
  id           bigserial   primary key,
  agent        text        not null,
  agent_ten    text,
  viec         text        not null,

  trang_thai   text        not null check (trang_thai in ('xong','khong_co_gi','hong')),
  so_luong     int         not null default 0,
  don_vi       text,
  chi_tiet     text,
  link         text,

  giay         numeric(8,2),
  chi_phi_vnd  numeric(12,2),

  can_duyet    boolean     not null default false,
  duyet_boi    uuid        references users(id),
  duyet_luc    timestamptz,
  duyet_ok     boolean,
  duyet_ghi_chu text,

  created_at   timestamptz not null default now()
);

create index if not exists agent_runs_moi_idx   on agent_runs (created_at desc);
create index if not exists agent_runs_agent_idx on agent_runs (agent, created_at desc);

create index if not exists agent_runs_choduyet_idx on agent_runs (created_at desc)
  where can_duyet = true and duyet_luc is null;

