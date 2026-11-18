

create table if not exists cv_jobs (
  id          bigint generated always as identity primary key,
  title       text not null,
  jd_text     text not null,
  must_have   text default '',
  nice_have   text default '',
  status      text default 'open',
  created_by  text default '',
  created_at  timestamptz default now()
);

create table if not exists cv_screenings (
  id           bigint generated always as identity primary key,
  job_id       bigint references cv_jobs(id) on delete cascade,
  name         text default '',
  email        text default '',
  phone        text default '',
  score        int  default 0,
  verdict      text default '',
  strengths    jsonb default '[]'::jsonb,
  concerns     jsonb default '[]'::jsonb,
  red_flags    jsonb default '[]'::jsonb,
  culture_fit  text default '',
  summary      text default '',
  cv_excerpt   text default '',
  stage        text default 'new',
  created_at   timestamptz default now()
);

create index if not exists cv_screenings_job_idx on cv_screenings(job_id, score desc);

alter table cv_jobs       enable row level security;
alter table cv_screenings enable row level security;

