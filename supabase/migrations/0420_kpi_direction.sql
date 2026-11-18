

alter table kpis add column if not exists is_lower_better boolean not null default false;

alter table kpis alter column current_value drop default;
alter table kpis alter column current_value drop not null;

update kpis set is_lower_better = true
where title ilike '%đóng gói sai%' or title ilike '%đơn hoàn%' or title ilike '%tỉ lệ lỗi%';

