insert into storage.buckets (id, name, public)
values ('knowledge_docs', 'knowledge_docs', true)
on conflict (id) do nothing;

drop policy if exists "knowledge_docs_admin_insert" on storage.objects;
create policy "knowledge_docs_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'knowledge_docs'
  and exists (
    select 1
    from gym_app.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "knowledge_docs_admin_update" on storage.objects;
create policy "knowledge_docs_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'knowledge_docs'
  and exists (
    select 1
    from gym_app.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  bucket_id = 'knowledge_docs'
  and exists (
    select 1
    from gym_app.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "knowledge_docs_admin_delete" on storage.objects;
create policy "knowledge_docs_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'knowledge_docs'
  and exists (
    select 1
    from gym_app.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "knowledge_docs_authenticated_read" on storage.objects;
create policy "knowledge_docs_authenticated_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'knowledge_docs');
