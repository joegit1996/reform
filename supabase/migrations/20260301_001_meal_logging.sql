create table if not exists gym_app.user_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_date date not null,
  meal_time timestamptz not null default now(),
  source_type text not null check (source_type in ('ai_photo', 'manual')),
  image_path text,
  notes text,
  total_calories int not null default 0,
  total_protein_g numeric(8,2) not null default 0,
  total_carbs_g numeric(8,2) not null default 0,
  total_fats_g numeric(8,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists gym_app.user_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references gym_app.user_meals(id) on delete cascade,
  name text not null,
  estimated_weight_g numeric(8,2),
  quantity_text text,
  protein_g numeric(8,2) not null default 0,
  carbs_g numeric(8,2) not null default 0,
  fats_g numeric(8,2) not null default 0,
  calories numeric(8,2) not null default 0,
  confidence numeric(4,3),
  sort_order int not null default 0
);

create index if not exists idx_user_meals_user_date on gym_app.user_meals(user_id, meal_date desc, meal_time desc);
create index if not exists idx_user_meal_items_meal_id on gym_app.user_meal_items(meal_id, sort_order);

alter table gym_app.user_meals enable row level security;
alter table gym_app.user_meal_items enable row level security;

drop policy if exists "user_meals_owner_rw" on gym_app.user_meals;
create policy "user_meals_owner_rw" on gym_app.user_meals
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_meal_items_owner_rw" on gym_app.user_meal_items;
create policy "user_meal_items_owner_rw" on gym_app.user_meal_items
for all
using (
  exists (
    select 1
    from gym_app.user_meals m
    where m.id = meal_id and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from gym_app.user_meals m
    where m.id = meal_id and m.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('meal_images', 'meal_images', true)
on conflict (id) do nothing;

drop policy if exists "meal_images_owner_insert" on storage.objects;
create policy "meal_images_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'meal_images'
  and exists (
    select 1 from gym_app.profiles p where p.id = auth.uid()
  )
);

drop policy if exists "meal_images_owner_select" on storage.objects;
create policy "meal_images_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'meal_images'
  and exists (
    select 1 from gym_app.profiles p where p.id = auth.uid()
  )
);

drop policy if exists "meal_images_owner_delete" on storage.objects;
create policy "meal_images_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'meal_images'
  and exists (
    select 1 from gym_app.profiles p where p.id = auth.uid()
  )
);
