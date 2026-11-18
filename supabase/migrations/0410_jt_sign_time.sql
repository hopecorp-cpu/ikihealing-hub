

alter table if exists public.jt_waybills
  add column if not exists sign_time timestamptz;

comment on column public.jt_waybills.sign_time is
  'Ngày ký nhận thành công (J&T signTime / 签收时间). Dùng cột NÀY để khớp kỳ bảng kê COD — KHÔNG dùng collect_time (đó là ngày lấy hàng).';

create index if not exists jt_waybills_sign_time_idx on public.jt_waybills (sign_time);
