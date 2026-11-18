

create extension if not exists vector;

create table if not exists covan_knowledge (
  id           bigint generated always as identity primary key,
  source       text not null,
  chunk_index  int  not null,
  content      text not null,
  embedding    vector(768),
  created_at   timestamptz default now(),
  unique (source, chunk_index)
);

create index if not exists covan_knowledge_embedding_idx
  on covan_knowledge using hnsw (embedding vector_cosine_ops);

create or replace function match_covan_knowledge(
  query_embedding vector(768),
  match_count int default 8
)
returns table (source text, content text, similarity float)
language sql stable
as $$
  select
    k.source,
    k.content,
    1 - (k.embedding <=> query_embedding) as similarity
  from covan_knowledge k
  where k.embedding is not null
  order by k.embedding <=> query_embedding
  limit match_count;
$$;
