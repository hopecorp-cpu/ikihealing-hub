

alter table cv_jobs add column if not exists public_token text;
alter table cv_jobs add column if not exists is_public   boolean default false;
alter table cv_jobs add column if not exists public_desc  text default '';

create unique index if not exists cv_jobs_public_token_idx on cv_jobs(public_token) where public_token is not null;

alter table cv_screenings add column if not exists source  text    default 'upload';
alter table cv_screenings add column if not exists consent boolean default false;

