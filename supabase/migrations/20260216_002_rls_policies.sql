alter table gym_app.profiles enable row level security;
alter table gym_app.focuses enable row level security;
alter table gym_app.documents enable row level security;
alter table gym_app.document_chunks enable row level security;
alter table gym_app.training_plans enable row level security;
alter table gym_app.plan_weeks enable row level security;
alter table gym_app.plan_days enable row level security;
alter table gym_app.plan_exercises enable row level security;
alter table gym_app.user_day_overrides enable row level security;
alter table gym_app.user_exercise_overrides enable row level security;
alter table gym_app.user_exercise_progress enable row level security;
alter table gym_app.user_day_progress enable row level security;
alter table gym_app.user_set_logs enable row level security;
alter table gym_app.chat_messages enable row level security;

drop policy if exists "profiles_self_read" on gym_app.profiles;
create policy "profiles_self_read" on gym_app.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_self_update" on gym_app.profiles;
create policy "profiles_self_update" on gym_app.profiles
for update using (auth.uid() = id);

drop policy if exists "focuses_authenticated_read" on gym_app.focuses;
create policy "focuses_authenticated_read" on gym_app.focuses
for select using (auth.role() = 'authenticated');

drop policy if exists "training_plans_authenticated_read" on gym_app.training_plans;
create policy "training_plans_authenticated_read" on gym_app.training_plans
for select using (auth.role() = 'authenticated');

drop policy if exists "plan_weeks_authenticated_read" on gym_app.plan_weeks;
create policy "plan_weeks_authenticated_read" on gym_app.plan_weeks
for select using (auth.role() = 'authenticated');

drop policy if exists "plan_days_authenticated_read" on gym_app.plan_days;
create policy "plan_days_authenticated_read" on gym_app.plan_days
for select using (auth.role() = 'authenticated');

drop policy if exists "plan_exercises_authenticated_read" on gym_app.plan_exercises;
create policy "plan_exercises_authenticated_read" on gym_app.plan_exercises
for select using (auth.role() = 'authenticated');

drop policy if exists "documents_authenticated_read" on gym_app.documents;
create policy "documents_authenticated_read" on gym_app.documents
for select using (auth.role() = 'authenticated');

drop policy if exists "document_chunks_authenticated_read" on gym_app.document_chunks;
create policy "document_chunks_authenticated_read" on gym_app.document_chunks
for select using (auth.role() = 'authenticated');

drop policy if exists "user_day_overrides_owner_rw" on gym_app.user_day_overrides;
create policy "user_day_overrides_owner_rw" on gym_app.user_day_overrides
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_exercise_overrides_owner_rw" on gym_app.user_exercise_overrides;
create policy "user_exercise_overrides_owner_rw" on gym_app.user_exercise_overrides
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_exercise_progress_owner_rw" on gym_app.user_exercise_progress;
create policy "user_exercise_progress_owner_rw" on gym_app.user_exercise_progress
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_day_progress_owner_rw" on gym_app.user_day_progress;
create policy "user_day_progress_owner_rw" on gym_app.user_day_progress
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_set_logs_owner_rw" on gym_app.user_set_logs;
create policy "user_set_logs_owner_rw" on gym_app.user_set_logs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chat_messages_owner_rw" on gym_app.chat_messages;
create policy "chat_messages_owner_rw" on gym_app.chat_messages
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin_documents_write" on gym_app.documents;
create policy "admin_documents_write" on gym_app.documents
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

drop policy if exists "admin_document_chunks_write" on gym_app.document_chunks;
create policy "admin_document_chunks_write" on gym_app.document_chunks
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

drop policy if exists "admin_focuses_write" on gym_app.focuses;
create policy "admin_focuses_write" on gym_app.focuses
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
