

alter table tg_orders add column if not exists nguon text;

comment on column tg_orders.nguon is
  'Nguồn đơn sale ghi trong tin (fb|zalo|web|khach-cu|gioi-thieu|san|khac). Null = tin không có dòng Nguồn. Bóc bởi lib/nguon-don.ts.';

notify pgrst, 'reload schema';
