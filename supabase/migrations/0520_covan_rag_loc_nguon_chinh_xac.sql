

create or replace function match_covan_knowledge_nguon(
  query_embedding vector(768),
  match_count int default 8,
  nguon_gom text[] default null,
  nguon_tru text[] default null
)
returns table (source text, content text, similarity float)
language sql
stable
set enable_indexscan = off
set enable_bitmapscan = off
as $$
  select
    k.source,
    k.content,
    1 - (k.embedding <=> query_embedding) as similarity
  from covan_knowledge k
  where k.embedding is not null
    and (nguon_gom is null or k.source = any(nguon_gom))
    and (nguon_tru is null or not (k.source = any(nguon_tru)))
  order by k.embedding <=> query_embedding
  limit match_count;
$$;
