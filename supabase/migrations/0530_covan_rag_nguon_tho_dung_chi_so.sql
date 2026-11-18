

create or replace function match_covan_knowledge_tho(
  query_embedding vector(768),
  match_count int default 1,
  nguon_gom text[] default null
)
returns table (source text, content text, similarity float)
language sql
stable
as $$
  select
    k.source,
    k.content,
    1 - (k.embedding <=> query_embedding) as similarity
  from covan_knowledge k
  where k.embedding is not null
    and (nguon_gom is null or k.source = any(nguon_gom))
  order by k.embedding <=> query_embedding
  limit match_count;
$$;

