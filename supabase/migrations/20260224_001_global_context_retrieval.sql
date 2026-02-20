alter table gym_app.document_chunks
  alter column focus_id drop not null;

alter table gym_app.document_embeddings
  alter column focus_id drop not null;

create index if not exists idx_documents_scope_focus_status
  on gym_app.documents(scope, focus_id, status);

create or replace function gym_app.match_document_chunks(
  query_embedding_text text,
  match_focus_id uuid,
  match_count int default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  category text,
  chunk_text text,
  score double precision
)
language sql
stable
as $$
  select
    de.chunk_id,
    de.document_id,
    d.title,
    dc.category,
    dc.chunk_text,
    1 - (de.embedding <=> (query_embedding_text::vector)) as score
  from gym_app.document_embeddings de
  join gym_app.document_chunks dc on dc.id = de.chunk_id
  join gym_app.documents d on d.id = de.document_id
  where (
      d.scope = 'global'
      or
      (match_focus_id is not null and de.focus_id = match_focus_id)
    )
    and d.status = 'ready'
    and de.embedding is not null
  order by de.embedding <=> (query_embedding_text::vector)
  limit greatest(match_count, 1);
$$;

create or replace function gym_app.lexical_document_chunks(
  query_text text,
  match_focus_id uuid,
  match_count int default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  category text,
  chunk_text text,
  score double precision
)
language sql
stable
as $$
  select
    dc.id as chunk_id,
    dc.document_id,
    d.title,
    dc.category,
    dc.chunk_text,
    ts_rank_cd(to_tsvector('english', dc.chunk_text), websearch_to_tsquery('english', query_text))::double precision as score
  from gym_app.document_chunks dc
  join gym_app.documents d on d.id = dc.document_id
  where (
      d.scope = 'global'
      or
      (match_focus_id is not null and dc.focus_id = match_focus_id)
    )
    and d.status = 'ready'
    and to_tsvector('english', dc.chunk_text) @@ websearch_to_tsquery('english', query_text)
  order by score desc
  limit greatest(match_count, 1);
$$;

grant execute on function gym_app.match_document_chunks(text, uuid, int) to authenticated, service_role;
grant execute on function gym_app.lexical_document_chunks(text, uuid, int) to authenticated, service_role;

