

alter table tg_orders add column if not exists ma_ctv text;
create index if not exists tg_orders_ma_ctv on tg_orders (ma_ctv) where ma_ctv is not null;
