
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text,
  phone text,
  source text,
  product text,
  channel text,
  assignee_id uuid references users(id) on delete set null,
  assigned_at timestamptz,
  first_contact_at timestamptz,
  status text not null default 'new',
  share_count int not null default 1,
  last_reassign_at timestamptz,
  pancake_link text,
  external_id text,
  note text,
  month text
);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_assignee on leads(assignee_id);
create index if not exists idx_leads_created on leads(created_at desc);
create index if not exists idx_leads_month on leads(month);
create unique index if not exists idx_leads_external on leads(external_id) where external_id is not null;
