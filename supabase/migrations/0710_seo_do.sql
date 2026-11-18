

create table if not exists public.seo_url_ngay (
  ngay                 date        not null,
  url                  text        not null,
  ngon_ngu             text        not null default 'vi' check (ngon_ngu in ('vi','en','ja')),
  site                 text,
  clicks               integer,
  impressions          integer,
  ctr                  numeric(7,4),
  vi_tri               numeric(7,2),
  ga4_phien            integer,
  ga4_phien_tuong_tac  integer,
  ga4_nguoi_dung       integer,
  ga4_luot_xem         integer,
  ga4_tg_tuong_tac_s   numeric(12,1),
  ga4_tg_doc_tb_s      numeric(9,1),
  cap_nhat_luc         timestamptz not null default now(),
  primary key (ngay, url)
);

create table if not exists public.seo_truy_van_ngay (
  ngay          date        not null,
  url           text        not null,
  truy_van      text        not null,
  hang          smallint    not null check (hang between 1 and 10),
  ngon_ngu      text        not null default 'vi' check (ngon_ngu in ('vi','en','ja')),
  site          text,
  clicks        integer     not null default 0,
  impressions   integer     not null default 0,
  ctr           numeric(7,4),
  vi_tri        numeric(7,2),
  cap_nhat_luc  timestamptz not null default now(),
  primary key (ngay, url, truy_van)
);

comment on table public.seo_url_ngay is 'SEO từng bài blog theo ngày: Search Console + GA4 (scripts/seo-do, KT 07/10/2026)';
comment on table public.seo_truy_van_ngay is 'Top 10 truy vấn Search Console mỗi bài blog mỗi ngày (scripts/seo-do, KT 07/10/2026)';

create index if not exists seo_url_ngay_url_ngay_idx on public.seo_url_ngay (url, ngay desc);
create index if not exists seo_truy_van_ngay_url_ngay_idx on public.seo_truy_van_ngay (url, ngay desc);
create index if not exists seo_truy_van_ngay_truy_van_idx on public.seo_truy_van_ngay (truy_van);

alter table public.seo_url_ngay      enable row level security;
alter table public.seo_truy_van_ngay enable row level security;

drop policy if exists p071_seo_url_ngay_doc on public.seo_url_ngay;
create policy p071_seo_url_ngay_doc on public.seo_url_ngay for select to authenticated using (true);

drop policy if exists p071_seo_truy_van_ngay_doc on public.seo_truy_van_ngay;
create policy p071_seo_truy_van_ngay_doc on public.seo_truy_van_ngay for select to authenticated using (true);

grant select on public.seo_url_ngay, public.seo_truy_van_ngay to authenticated;
revoke all on public.seo_url_ngay, public.seo_truy_van_ngay from anon;

select
  (select count(*) from pg_tables where schemaname = 'public' and tablename in ('seo_url_ngay','seo_truy_van_ngay'))::int as bang,
  (select count(*) from pg_class where relname in ('seo_url_ngay','seo_truy_van_ngay') and relrowsecurity)::int as rls_bat,
  (select count(*) from pg_policies where policyname like 'p071_%')::int as policy;
