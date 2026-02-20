create table if not exists gym_app.user_set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_exercise_id uuid not null references gym_app.plan_exercises(id) on delete cascade,
  segment_key text not null default 'main',
  target_date date not null,
  set_number int not null default 1 check (set_number >= 1),
  reps_completed int,
  weight_value numeric(8,2),
  weight_unit text check (weight_unit in ('kg', 'lb')),
  duration_min numeric(8,2),
  pace text,
  distance numeric(8,2),
  distance_unit text check (distance_unit in ('km', 'mi')),
  floors int,
  completed_at timestamptz,
  unique(user_id, plan_exercise_id, segment_key, target_date, set_number)
);

create index if not exists idx_user_set_logs_user_date on gym_app.user_set_logs(user_id, target_date desc);

alter table gym_app.user_set_logs enable row level security;

drop policy if exists "user_set_logs_owner_rw" on gym_app.user_set_logs;
create policy "user_set_logs_owner_rw" on gym_app.user_set_logs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

