create schema if not exists gym_app;

create extension if not exists "pgcrypto";

create table if not exists gym_app.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists gym_app.focuses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists gym_app.documents (
  id uuid primary key default gen_random_uuid(),
  focus_id uuid not null references gym_app.focuses(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('markdown', 'pdf')),
  storage_path text not null,
  raw_text text not null,
  status text not null default 'ready' check (status in ('processing', 'ready', 'error')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists gym_app.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references gym_app.documents(id) on delete cascade,
  focus_id uuid not null references gym_app.focuses(id) on delete cascade,
  category text not null,
  chunk_text text not null,
  chunk_order int not null,
  created_at timestamptz not null default now()
);

create table if not exists gym_app.training_plans (
  id uuid primary key default gen_random_uuid(),
  focus_id uuid not null references gym_app.focuses(id) on delete cascade,
  name text not null,
  duration_weeks int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists gym_app.plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references gym_app.training_plans(id) on delete cascade,
  week_number int not null,
  title text not null,
  phase text not null,
  unique(plan_id, week_number)
);

create table if not exists gym_app.plan_days (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references gym_app.plan_weeks(id) on delete cascade,
  day_number int not null check (day_number between 1 and 7),
  label text not null,
  protocol text,
  duration_load text,
  is_rest_day boolean not null default false,
  notes text,
  unique(week_id, day_number)
);

create table if not exists gym_app.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references gym_app.plan_days(id) on delete cascade,
  name text not null,
  description text,
  duration_min int,
  load_info text,
  sort_order int not null default 0
);

create table if not exists gym_app.user_day_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_day_id uuid not null references gym_app.plan_days(id) on delete cascade,
  is_rest_day boolean,
  notes text,
  updated_at timestamptz not null default now(),
  unique(user_id, plan_day_id)
);

create table if not exists gym_app.user_exercise_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_exercise_id uuid references gym_app.plan_exercises(id) on delete cascade,
  plan_day_id uuid not null references gym_app.plan_days(id) on delete cascade,
  action text not null check (action in ('add', 'update', 'remove')),
  name text,
  description text,
  duration_min int,
  load_info text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists gym_app.user_exercise_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_exercise_id uuid not null references gym_app.plan_exercises(id) on delete cascade,
  target_date date not null,
  done_at timestamptz,
  unique(user_id, plan_exercise_id, target_date)
);

create table if not exists gym_app.user_day_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_day_id uuid not null references gym_app.plan_days(id) on delete cascade,
  target_date date not null,
  completed_at timestamptz,
  unique(user_id, plan_day_id, target_date)
);

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

create table if not exists gym_app.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  focus_id uuid not null references gym_app.focuses(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_focus_id on gym_app.documents(focus_id);
create index if not exists idx_document_chunks_focus_id on gym_app.document_chunks(focus_id);
create index if not exists idx_plan_weeks_plan_id on gym_app.plan_weeks(plan_id);
create index if not exists idx_plan_days_week_id on gym_app.plan_days(week_id);
create index if not exists idx_plan_exercises_day_id on gym_app.plan_exercises(day_id);
create index if not exists idx_user_set_logs_user_date on gym_app.user_set_logs(user_id, target_date desc);
create index if not exists idx_chat_messages_user_focus_created on gym_app.chat_messages(user_id, focus_id, created_at desc);
