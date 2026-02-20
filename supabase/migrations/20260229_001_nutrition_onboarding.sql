create table if not exists gym_app.user_nutrition_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sex text not null check (sex in ('male', 'female')),
  age int not null check (age between 13 and 99),
  height_cm numeric(6,2) not null check (height_cm between 120 and 240),
  weight_kg numeric(6,2) not null check (weight_kg between 35 and 300),
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'very_active', 'athlete')),
  goal text not null check (goal in ('fat_loss', 'maintenance', 'muscle_gain')),
  daily_calories int not null check (daily_calories between 1000 and 6000),
  protein_g int not null check (protein_g >= 0),
  carbs_g int not null check (carbs_g >= 0),
  fats_g int not null check (fats_g >= 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_nutrition_profiles_goal on gym_app.user_nutrition_profiles(goal);

alter table gym_app.user_nutrition_profiles enable row level security;

drop policy if exists "user_nutrition_profiles_owner_rw" on gym_app.user_nutrition_profiles;
create policy "user_nutrition_profiles_owner_rw" on gym_app.user_nutrition_profiles
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "profiles_self_insert" on gym_app.profiles;
create policy "profiles_self_insert" on gym_app.profiles
for insert with check (auth.uid() = id and role = 'user');
