

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'departments' and column_name = 'ma')
     or to_regclass('public.vai_tro_kiem_nhiem') is null then
    raise exception 'Chưa chạy 066 (cột departments.ma / bảng vai_tro_kiem_nhiem). Chạy 066, 067, 068 trước rồi mới chạy 070.';
  end if;
  if to_regclass('public.agents') is null then
    raise exception 'Chưa chạy 067 (bảng agents). Chạy 067, 068 trước rồi mới chạy 070.';
  end if;
end $$;

do $$
begin
  raise notice 'TRUOC: departments=%, departments co ma=%, agents=%, vai_tro_kiem_nhiem=%, users=%',
    (select count(*) from public.departments),
    (select count(*) from public.departments where ma is not null),
    (select count(*) from public.agents),
    (select count(*) from public.vai_tro_kiem_nhiem),
    (select count(*) from public.users);
end $$;

update public.departments d
set ma = v.ma
from (values
  ('Ban Điều Hành',        'BDH'),
  ('Kinh Doanh & Sale',    'KD'),
  ('Marketing',            'MKT'),
  ('Chăm Sóc Khách Hàng',  'CSKH'),
  ('Kho & Hỗ Trợ',         'KHO'),
  ('Tài Chính',            'TC'),
  ('Pháp Lý',              'PL')
) as v(ten, ma)
where d.name = v.ten
  and d.ma is null
  and not exists (select 1 from public.departments x where x.ma = v.ma);

insert into public.departments (name, ma, parent_id, loai)
select v.ten, v.ma, cha.id, 'phong'
from (values
  ('Thương hiệu & Truyền thông', 'TH', 'MKT'),
  ('Nhân sự & Văn hóa',          'NS', 'BDH'),
  ('Kỹ thuật & Dữ liệu',         'KT', 'BDH')
) as v(ten, ma, ma_cha)
join public.departments cha on cha.ma = v.ma_cha
where not exists (select 1 from public.departments x where x.ma = v.ma);

insert into public.agents (id, loai, ten, grok_agent_id, phong_id, department_id, kenh, noi_chay, ghi_chu)
select v.id, v.loai, v.ten, v.grok::uuid, v.phong_id,
       (select d.id from public.departments d where d.ma = v.ma_phong),
       v.kenh, v.noi_chay, v.ghi_chu
from (values

  ('tlgd',     'tro_ly', 'Trợ lý Giám đốc',            '00000000-0000-0000-0000-000000000001', null, 'BDH',  null, 'box', null),
  ('grok-bot', 'router', 'Grok Bot',                   '00000000-0000-0000-0000-000000000002', null, 'BDH',  null, 'box', null),
  ('th',       'phong',  'Thương hiệu & Truyền thông', '00000000-0000-0000-0000-000000000003', null, 'TH',   null, 'box', null),
  ('mkt',      'phong',  'Marketing tăng trưởng',      '00000000-0000-0000-0000-000000000004', null, 'MKT',  null, 'box', null),
  ('kd',       'phong',  'Kinh doanh',                 '00000000-0000-0000-0000-000000000005', null, 'KD',   null, 'box', null),
  ('cskh',     'phong',  'Chăm sóc khách hàng',        '00000000-0000-0000-0000-000000000006', null, 'CSKH', null, 'box', null),
  ('vhsp',     'phong',  'Vận hành & Sản phẩm',        '00000000-0000-0000-0000-000000000007', null, 'KHO',  null, 'box', null),
  ('ns',       'phong',  'Nhân sự & Văn hóa',          '00000000-0000-0000-0000-000000000008', null, 'NS',   null, 'box', null),
  ('tc',       'phong',  'Tài chính & Gọi vốn',        '00000000-0000-0000-0000-000000000009', null, 'TC',   null, 'box', null),
  ('kt',       'phong',  'Kỹ thuật & Dữ liệu',         '00000000-0000-0000-0000-000000000010', null, 'KT',   null, 'box', null),

  ('tro-ly', 'bot', 'Trợ lý AI', null, 'tlgd', 'BDH', 'Telegram', 'telegram', 'Trợ lý, bot brain'),
  ('alex',     'bot', 'Cố vấn AI',     null, 'tc',   'TC',  'Telegram', 'telegram', 'Cố vấn vận hành; TLGD và TC cùng giữ'),
  ('tieu-my',  'bot', 'Trợ lý Mac',  null, 'kt',   'KT',  'Telegram', 'mac',      'Bot của KT'),

  ('strategy',        'may', 'Chiến lược',               null, null,   null,  null, 'vercel', 'Ghi chú mẫu'),
  ('research',        'may', 'Research',                 null, 'mkt',  'MKT', null, 'vercel', 'Ghi chú mẫu'),
  ('dispatch',        'may', 'Dispatch — Hub điều phối', null, 'mkt',  'MKT', null, 'vercel', 'Ghi chú mẫu'),
  ('plan',            'may', 'Kế hoạch',                 null, null,   null,  null, 'vercel', 'Ghi chú mẫu'),
  ('content',         'may', 'Content',                  null, 'mkt',  'MKT', null, 'vercel', 'Ghi chú mẫu'),
  ('blog',            'may', 'Máy viết blog NOVA',        null, 'mkt',  'MKT', null, 'vercel', 'Ghi chú mẫu'),
  ('donhang',         'may', 'Máy bóc đơn Telegram',     null, 'vhsp', 'KHO', null, 'vercel', 'Ghi chú mẫu'),
  ('design',          'may', 'Design',                   null, 'mkt',  'MKT', null, 'vercel', 'Ghi chú mẫu'),
  ('performance',     'may', 'Performance',              null, 'mkt',  'MKT', null, 'vercel', 'Ghi chú mẫu'),
  ('content_bu',      'may', 'Lớp bù bài fanpage',       null, 'mkt',  'MKT', null, 'vercel', 'Ghi chú mẫu'),
  ('blog_bu',         'may', 'Lớp bù bài blog',          null, 'mkt',  'MKT', null, 'vercel', 'Ghi chú mẫu'),
  ('dangcheo',        'may', 'Máy soạn bài đăng chéo',   null, 'mkt',  'MKT', null, 'vercel', 'Ghi chú mẫu'),
  ('catruc',          'may', 'Ca trực AI',               null, 'cskh', 'CSKH', null, 'vercel', 'Ghi chú mẫu'),
  ('zalonhac',        'may', 'Máy nhắc khách chờ Zalo',  null, 'cskh', 'CSKH', null, 'vercel', 'Ghi chú mẫu'),
  ('report',          'may', 'Báo cáo',                  null, 'tlgd', 'BDH', null, 'vercel', 'Ghi chú mẫu'),
  ('hocthegioi',      'may', 'Máy học thế giới',         null, null,   null,  null, 'vercel', 'Ghi chú mẫu'),
  ('cowork',          'may', 'Cowork — Tự động hoá',     null, 'kt',   'KT',  null, 'vercel', 'Ghi chú mẫu'),
  ('brandbible',      'may', 'Brand Bible + SOP',        null, 'th',   'TH',  null, 'vercel', 'Ghi chú mẫu'),
  ('campaign_memory', 'may', 'Campaign Memory',          null, null,   null,  null, 'vercel', 'Ghi chú mẫu')
) as v(id, loai, ten, grok, phong_id, ma_phong, kenh, noi_chay, ghi_chu)
on conflict (id) do update set
  loai = excluded.loai,
  ten = excluded.ten,
  grok_agent_id = excluded.grok_agent_id,
  phong_id = excluded.phong_id,
  department_id = excluded.department_id,
  kenh = excluded.kenh,
  noi_chay = excluded.noi_chay,
  ghi_chu = excluded.ghi_chu,
  updated_at = now();

do $$
declare
  r record;
  n int;
  uid uuid;
  kd uuid := (select id from public.departments where ma = 'KD');
  cskh uuid := (select id from public.departments where ma = 'CSKH');
begin
  if kd is null or cskh is null then
    raise notice 'Bo qua kiem nhiem: chua co ma KD hoac CSKH';
    return;
  end if;
  for r in select * from (values ('Sale mẫu A', 'A'), ('Sale mẫu B', 'B')) as t(ten, ca) loop
    select count(*), min(u.id::text)::uuid into n, uid
    from public.users u
    where u.active is true and u.department_id = kd and u.full_name like '%' || r.ten;
    if n = 1 then
      insert into public.vai_tro_kiem_nhiem (user_id, department_id, vai_tro, ca, ghi_chu)
      values (uid, cskh, 'truc_cskh', r.ca, 'Thuộc KD, kiêm trực inbox CSKH (CSKH-01)')
      on conflict (user_id, department_id, vai_tro) do nothing;
    else
      raise notice 'Bo qua kiem nhiem ca %: khop % nguoi (can dung 1)', r.ca, n;
    end if;
  end loop;
end $$;

do $$
begin
  raise notice 'SAU: departments=%, departments co ma=%, agents=%, vai_tro_kiem_nhiem=%, users=%',
    (select count(*) from public.departments),
    (select count(*) from public.departments where ma is not null),
    (select count(*) from public.agents),
    (select count(*) from public.vai_tro_kiem_nhiem),
    (select count(*) from public.users);
end $$;

commit;

select
  (select count(*) from public.departments)                             as departments,
  (select count(*) from public.departments where ma is not null)        as phong_co_ma,
  (select count(*) from public.departments where parent_id is not null) as nut_con,
  (select count(*) from public.agents)                                  as agents,
  (select count(*) from public.agents where department_id is not null)  as agents_co_phong,
  (select count(*) from public.vai_tro_kiem_nhiem)                      as kiem_nhiem,
  (select count(*) from public.users)                                   as users;
