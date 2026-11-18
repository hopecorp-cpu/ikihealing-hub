
insert into departments (id, name, color) values
  ('11111111-1111-1111-1111-111111111101', 'Ban Điều Hành', '#10B981'),
  ('11111111-1111-1111-1111-111111111102', 'Kinh Doanh & Sale', '#1a73e8'),
  ('11111111-1111-1111-1111-111111111103', 'Marketing', '#F97316'),
  ('11111111-1111-1111-1111-111111111104', 'Tài Chính', '#FCD34D'),
  ('11111111-1111-1111-1111-111111111105', 'Kho & Hỗ Trợ', '#86EFAC');

insert into cycles (id, name, type, start_date, end_date, status) values
  ('22222222-2222-2222-2222-222222222201', 'T5/2026', 'month', '2026-05-01', '2026-05-31', 'active');

-- Dữ liệu mẫu cho một công ty giả (chỉ dùng khi chạy thử trên máy).
-- Mọi người dùng mẫu có mật khẩu: matkhau-demo
-- Ngày tháng tính theo ngày chạy seed, nên mở app lên là thấy số của tháng hiện tại.

do $$
declare
  u record;
begin
  for u in select * from (values
    ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'admin@example.com', 'Quản trị Demo', 'admin', '11111111-1111-1111-1111-111111111101'::uuid, 'Giám đốc'),
    ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'son@example.com',   'Phạm Văn Sơn',  'manager', '11111111-1111-1111-1111-111111111102'::uuid, 'Leader Sale'),
    ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'cuc@example.com',   'Lê Thị Cúc',    'employee', '11111111-1111-1111-1111-111111111102'::uuid, 'Sale'),
    ('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'dao@example.com',   'Hoàng Thị Đào', 'employee', '11111111-1111-1111-1111-111111111102'::uuid, 'Sale'),
    ('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'hang@example.com',  'Nguyễn Thu Hằng','employee', '11111111-1111-1111-1111-111111111103'::uuid, 'Marketing'),
    ('aaaaaaaa-0000-0000-0000-000000000006'::uuid, 'lan@example.com',   'Đỗ Thị Lan',    'employee', '11111111-1111-1111-1111-111111111104'::uuid, 'Kế toán')
  ) as t(id, email, ten, vai, phong, chuc) loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('matkhau-demo', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.ten), now(), now(), '', '', '', '')
    on conflict (id) do nothing;
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now())
    on conflict do nothing;
    update public.users set role = u.vai, department_id = u.phong, position = u.chuc, full_name = u.ten,
      active = true, hire_date = current_date - 400, base_salary = 8000000
    where id = u.id;
  end loop;
end $$;

update cycles set name = 'Tháng ' || to_char(current_date, 'MM/YYYY'),
  start_date = date_trunc('month', current_date)::date,
  end_date = (date_trunc('month', current_date) + interval '1 month - 1 day')::date
where id = '22222222-2222-2222-2222-222222222201';

select setseed(0.42);

insert into customers (full_name, phone, source, total_spent, total_orders, created_at)
select 'Khách mẫu ' || g, '0901' || lpad(g::text, 6, '0'),
  (array['facebook','zalo','gioi-thieu','website'])[1 + (g % 4)], 0, 0, now() - (g || ' days')::interval
from generate_series(1, 120) g;

insert into tg_orders (chat_id, message_id, sale, khach, sdt, tinh, san_pham, gia_goc, giam_gia, khach_tra, kieu_ship, phi_ship, ngay, sent_at, nguon)
select '-100000000001', 1000 + row_number() over (), d.sale, 'Khách mẫu ' || d.k, '0901' || lpad(d.k::text, 6, '0'),
  (array['Hà Nội','TP HCM','Đà Nẵng','Cần Thơ'])[1 + (d.k % 4)],
  jsonb_build_array(jsonb_build_object('ten', d.ten, 'sl', d.sl, 'thanh_tien', d.gia * d.sl)),
  d.gia * d.sl, 0, d.gia * d.sl, 'COD', 30000, d.ngay, d.ngay + interval '10 hours', 'demo'
from (
  select n.ngay, (array['Sơn','Cúc','Đào'])[1 + floor(random() * 3)::int] as sale,
    1 + floor(random() * 120)::int as k, 1 + floor(random() * 3)::int as sl,
    p.ten, p.gia
  from generate_series(current_date - 89, current_date, interval '1 day') as n(ngay)
  cross join lateral generate_series(1, 2 + floor(random() * 5)::int) as x(i)
  cross join lateral (select * from (values ('Sản phẩm A', 500000), ('Sản phẩm B', 200000), ('Sản phẩm C', 150000)) v(ten, gia)
                      order by random() limit 1) p
) d;

update customers c set total_orders = s.so, total_spent = s.tien
from (select khach, count(*) so, sum(khach_tra) tien from tg_orders group by khach) s
where s.khach = c.full_name;

insert into leads (created_at, customer_name, phone, source, product, channel, assignee_id, assigned_at, first_contact_at, status, month)
select t, 'Lead mẫu ' || g, '0902' || lpad(g::text, 6, '0'),
  (array['facebook','quiz','email','zalo'])[1 + (g % 4)],
  (array['Sản phẩm A','Sản phẩm B','Sản phẩm C'])[1 + (g % 3)], 'inbox',
  (array['aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000004'])[1 + (g % 3)]::uuid,
  t + interval '5 minutes',
  case when g % 5 = 0 then null else t + interval '40 minutes' end,
  case when g % 5 = 0 then 'new' when g % 3 = 0 then 'won' else 'contacted' end,
  to_char(t, 'YYYY-MM')
from (select g, now() - ((g * 7) || ' hours')::interval as t from generate_series(1, 200) g) s;

insert into tasks (title, assigner_id, assignee_id, priority, status, due_date, created_at, nguon)
select v.title, 'aaaaaaaa-0000-0000-0000-000000000001', v.nguoi::uuid, v.uu, v.tt, current_date + v.han, now() - interval '2 days', 'ui'
from (values
  ('Gọi lại 20 lead chưa liên hệ hôm qua', 'aaaaaaaa-0000-0000-0000-000000000003', 'high', 'todo', 0),
  ('Chuẩn bị kịch bản chốt đơn Sản phẩm A', 'aaaaaaaa-0000-0000-0000-000000000002', 'medium', 'doing', 2),
  ('Lên lịch đăng bài tuần sau', 'aaaaaaaa-0000-0000-0000-000000000005', 'medium', 'todo', 3),
  ('Đối soát tiền COD tuần trước', 'aaaaaaaa-0000-0000-0000-000000000006', 'high', 'doing', 1),
  ('Rà danh sách khách lâu chưa mua', 'aaaaaaaa-0000-0000-0000-000000000004', 'low', 'review', 4),
  ('Tổng kết số tháng trước', 'aaaaaaaa-0000-0000-0000-000000000006', 'medium', 'done', -3),
  ('Cập nhật bảng giá mới lên kho kiến thức', 'aaaaaaaa-0000-0000-0000-000000000005', 'low', 'todo', -1)
) v(title, nguoi, uu, tt, han);

insert into attendance (user_id, date, check_in_time, check_out_time, status, late_minutes, work_location)
select u.id, d::date, d + interval '1 hour 55 minutes' + (random() * interval '20 minutes'), d + interval '10 hours 30 minutes',
  case when random() < 0.1 then 'late' else 'normal' end, 0, 'office'
from public.users u
cross join generate_series(current_date - 20, current_date - 1, interval '1 day') d
where u.id::text like 'aaaaaaaa-%' and extract(isodow from d) < 7;

insert into kpis (user_id, cycle_id, title, metric_unit, target_value, current_value, weight_percent, status)
select u.id, '22222222-2222-2222-2222-222222222201', 'Doanh số tháng', 'VND', 100000000,
  coalesce((select sum(khach_tra) from tg_orders o where o.sale = split_part(u.full_name, ' ', 3)
            and o.ngay >= date_trunc('month', current_date)), 0), 100, 'active'
from public.users u where u.id::text in ('aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000004');
