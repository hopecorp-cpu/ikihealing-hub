

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manager_id uuid,
  color text default '#3B82F6',
  created_at timestamptz default now()
);

create table users (
  id uuid primary key default auth.uid(),
  email text unique not null,
  full_name text not null,
  role text check (role in ('admin','ceo','manager','employee')) default 'employee',
  department_id uuid references departments(id),
  manager_id uuid references users(id),
  position text,
  contract_type text default 'Chính thức',
  hire_date date,
  base_salary numeric default 0,
  insurance_salary numeric default 0,
  max_bonus numeric default 0,
  dependent_count int default 0,
  cccd text,
  tax_code text,
  phone text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table departments add constraint departments_manager_fk
  foreign key (manager_id) references users(id);

create table cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('month','quarter','year')) not null,
  start_date date not null,
  end_date date not null,
  status text default 'active' check (status in ('draft','active','closed')),
  created_at timestamptz default now()
);

create table kpis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  cycle_id uuid references cycles(id) not null,
  title text not null,
  description text,
  metric_unit text,
  target_value numeric,
  current_value numeric default 0,
  weight_percent numeric not null check (weight_percent between 0 and 100),
  status text default 'draft' check (status in ('draft','pending','active','completed')),
  approved_by uuid references users(id),
  deadline date,
  created_at timestamptz default now()
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  week_number int not null,
  year int not null,
  q1_done text,
  q2_blockers text,
  q3_next_week text,
  submitted_at timestamptz default now(),
  unique (user_id, week_number, year)
);

create table feedbacks (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid references checkins(id) on delete cascade not null,
  manager_id uuid references users(id) not null,
  content text not null,
  created_at timestamptz default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  date date not null,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_lat numeric,
  check_in_lng numeric,
  check_out_lat numeric,
  check_out_lng numeric,
  note text,
  status text default 'normal' check (status in ('normal','late','early_leave','absent')),
  unique (user_id, date)
);

create table leaves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  type text check (type in ('phep','om','khong_luong','ot','cong_tac','hieu_hi')) not null,
  from_date date not null,
  to_date date not null,
  days numeric(4,1) not null,
  reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  approver_id uuid references users(id),
  approver_note text,
  created_at timestamptz default now(),
  decided_at timestamptz
);

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  year int not null,
  total_days numeric(4,1) default 12,
  used_days numeric(4,1) default 0,
  unique (user_id, year)
);

create table sales_revenue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  cycle_id uuid references cycles(id) not null,
  product_line text default 'Đạm Mẫu',
  gross_revenue numeric not null,
  cr_percent numeric,
  refund_percent numeric,
  created_at timestamptz default now()
);

create table bonus_rules (
  id uuid primary key default gen_random_uuid(),
  min_completion_percent numeric not null,
  max_completion_percent numeric not null,
  bonus_multiplier numeric not null,
  description text
);

create table payroll (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  month char(7) not null,
  base_salary numeric default 0,
  gross_salary numeric default 0,
  working_days_standard int default 26,
  working_days_actual int default 0,
  salary_by_workdays numeric default 0,
  sales_revenue_net numeric default 0,
  bonus_amount numeric default 0,
  total_income numeric default 0,
  employee_insurance numeric default 0,
  personal_deduction numeric default 15500000,
  dependent_count int default 0,
  dependent_deduction numeric default 0,
  taxable_income numeric default 0,
  personal_income_tax numeric default 0,
  advance_payment numeric default 0,
  net_salary numeric default 0,
  employer_insurance numeric default 0,
  total_company_cost numeric default 0,
  status text default 'draft' check (status in ('draft','approved','paid')),
  approved_by uuid references users(id),
  paid_at timestamptz,
  note text,
  unique (user_id, month)
);

create table config (
  key text primary key,
  value text not null,
  description text
);

insert into config (key, value, description) values
  ('nc_chuan', '26', 'Ngày công chuẩn/tháng'),
  ('gtgt_bt', '15500000', 'Giảm trừ bản thân (NQ 110/2025)'),
  ('gtgt_npt', '6200000', 'Giảm trừ người phụ thuộc'),
  ('ltt_vung_1', '5310000', 'Lương tối thiểu vùng I 2026'),
  ('vat_rate', '0.08', 'Thuế GTGT Đạm Mẫu'),
  ('sale_target', '100000000', 'Target DS net Sale/tháng'),
  ('team_bonus_threshold', '300000000', 'Ngưỡng DS nhóm');

insert into bonus_rules (min_completion_percent, max_completion_percent, bonus_multiplier, description) values
  (0, 60, 0, 'Dưới 60%: không thưởng'),
  (60, 80, 0.4, '60–80%: 40% bonus'),
  (80, 100, 0.7, '80–100%: 70% bonus'),
  (100, 999, 1.0, '100%+: 100% bonus');

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  type text not null,
  content text not null,
  read boolean default false,
  created_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  timestamp timestamptz default now()
);

create index idx_attendance_user_date on attendance(user_id, date desc);
create index idx_leaves_status on leaves(status, created_at desc);
create index idx_payroll_month on payroll(month, user_id);
create index idx_kpis_user_cycle on kpis(user_id, cycle_id);
create index idx_notifications_user_read on notifications(user_id, read, created_at desc);

alter table users enable row level security;
alter table attendance enable row level security;
alter table leaves enable row level security;
alter table payroll enable row level security;
alter table kpis enable row level security;
alter table checkins enable row level security;
alter table feedbacks enable row level security;
alter table sales_revenue enable row level security;
alter table notifications enable row level security;

create policy users_select on users for select using (true);

create policy users_admin_modify on users for all
  using (exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo')))
  with check (exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo')));

create policy att_self_select on attendance for select using (
  user_id = auth.uid()
  or exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo','manager'))
);
create policy att_self_insert on attendance for insert with check (user_id = auth.uid());
create policy att_self_update on attendance for update using (user_id = auth.uid());

create policy lv_self_select on leaves for select using (
  user_id = auth.uid()
  or approver_id = auth.uid()
  or exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo','manager'))
);
create policy lv_self_insert on leaves for insert with check (user_id = auth.uid());
create policy lv_manager_update on leaves for update using (
  exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo','manager'))
);

create policy py_self_select on payroll for select using (
  user_id = auth.uid()
  or exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo'))
);
create policy py_admin_all on payroll for all using (
  exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo'))
) with check (
  exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo'))
);

create policy kpi_self_select on kpis for select using (
  user_id = auth.uid()
  or exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo','manager'))
);
create policy kpi_self_insert on kpis for insert with check (user_id = auth.uid());
create policy kpi_manager_update on kpis for update using (
  user_id = auth.uid()
  or exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo','manager'))
);

create policy ci_self_select on checkins for select using (
  user_id = auth.uid()
  or exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo','manager'))
);
create policy ci_self_insert on checkins for insert with check (user_id = auth.uid());

create policy fb_select on feedbacks for select using (true);
create policy fb_manager_insert on feedbacks for insert with check (
  exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo','manager'))
);

create policy sales_select on sales_revenue for select using (
  user_id = auth.uid()
  or exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo','manager'))
);
create policy sales_admin_all on sales_revenue for all using (
  exists(select 1 from users u where u.id = auth.uid() and u.role in ('admin','ceo'))
);

create policy notif_self on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
