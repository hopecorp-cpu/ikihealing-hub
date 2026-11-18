

create table if not exists email_gui_nhat_ky (
  id            bigint generated always as identity primary key,
  gui_luc       timestamptz not null default now(),
  email_chuan   text not null,
  luong         text not null,
  mau           text not null,
  neu_san_pham  boolean not null default false,
  resend_id     text,
  meta          jsonb
);
create index if not exists email_gui_nhat_ky_email_idx on email_gui_nhat_ky (email_chuan, gui_luc desc);

create unique index if not exists email_gui_nhat_ky_thu0_uq on email_gui_nhat_ky (email_chuan) where luong = 'blog-nurture' and mau = 'ngay-0';

alter table email_gui_nhat_ky enable row level security;

