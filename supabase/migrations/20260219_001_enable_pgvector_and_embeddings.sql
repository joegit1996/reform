create extension if not exists vector;

create table if not exists gym_app.document_embeddings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references gym_app.documents(id) on delete cascade,
  chunk_id uuid not null unique references gym_app.document_chunks(id) on delete cascade,
  focus_id uuid not null references gym_app.focuses(id) on delete cascade,
  embedding vector(1536),
  token_count int,
  model text not null default 'text-embedding-3-small',
  created_at timestamptz not null default now()
);

create index if not exists idx_document_embeddings_focus_id on gym_app.document_embeddings(focus_id);
create index if not exists idx_document_chunks_fts on gym_app.document_chunks using gin (to_tsvector('english', chunk_text));
create index if not exists idx_document_embeddings_hnsw on gym_app.document_embeddings using hnsw (embedding vector_cosine_ops);

alter table gym_app.document_embeddings enable row level security;

drop policy if exists "document_embeddings_authenticated_read" on gym_app.document_embeddings;
create policy "document_embeddings_authenticated_read" on gym_app.document_embeddings
for select using (auth.role() = 'authenticated');

drop policy if exists "admin_document_embeddings_write" on gym_app.document_embeddings;
create policy "admin_document_embeddings_write" on gym_app.document_embeddings
for all using (
  exists (
    select 1 from gym_app.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from gym_app.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);
