alter table gym_app.focuses
  add column if not exists image_url text,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order int not null default 0;

create index if not exists idx_focuses_active_sort on gym_app.focuses(is_active, sort_order, created_at);

alter table gym_app.profiles
  add column if not exists current_focus_id uuid references gym_app.focuses(id);

create index if not exists idx_profiles_current_focus on gym_app.profiles(current_focus_id);

update gym_app.profiles
set current_focus_id = coalesce(
  (select id from gym_app.focuses where slug = 'mountaineering' limit 1),
  (select id from gym_app.focuses order by created_at asc limit 1)
)
where current_focus_id is null;

alter table gym_app.documents
  add column if not exists scope text not null default 'focus' check (scope in ('focus', 'global'));

alter table gym_app.documents
  alter column focus_id drop not null;

alter table gym_app.documents
  drop constraint if exists documents_scope_focus_consistency;

alter table gym_app.documents
  add constraint documents_scope_focus_consistency
  check (
    (scope = 'global' and focus_id is null)
    or
    (scope = 'focus' and focus_id is not null)
  );

create table if not exists gym_app.plan_phases (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references gym_app.training_plans(id) on delete cascade,
  phase_number int not null check (phase_number >= 1),
  title text not null,
  description text,
  unique(plan_id, phase_number)
);

create index if not exists idx_plan_phases_plan_id on gym_app.plan_phases(plan_id);

alter table gym_app.plan_weeks
  add column if not exists phase_id uuid references gym_app.plan_phases(id) on delete cascade;

insert into gym_app.plan_phases (plan_id, phase_number, title, description)
select p.id, 1, 'Phase 1', 'Default phase'
from gym_app.training_plans p
where not exists (
  select 1 from gym_app.plan_phases ph where ph.plan_id = p.id
);

update gym_app.plan_weeks w
set phase_id = ph.id
from gym_app.plan_phases ph
where ph.plan_id = w.plan_id
  and ph.phase_number = 1
  and w.phase_id is null;

alter table gym_app.plan_exercises
  add column if not exists exercise_type text
    check (exercise_type in ('weight_lifting', 'cardio', 'stairmaster')),
  add column if not exists set_count int check (set_count is null or set_count >= 1),
  add column if not exists rep_min int check (rep_min is null or rep_min >= 1),
  add column if not exists rep_max int check (rep_max is null or rep_max >= rep_min),
  add column if not exists target_duration_min numeric(8,2) check (target_duration_min is null or target_duration_min > 0),
  add column if not exists target_distance numeric(8,2) check (target_distance is null or target_distance >= 0),
  add column if not exists target_floors int check (target_floors is null or target_floors >= 0),
  add column if not exists target_pace text;

update gym_app.plan_exercises
set exercise_type = case
  when lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '(stairmaster|stairs|floors|incline treadmill)' then 'stairmaster'
  when lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '(cardio|aerobic|hike|jog|run|cycling|swimming|treadmill|zone|recovery)' then 'cardio'
  else 'weight_lifting'
end
where exercise_type is null;

update gym_app.plan_exercises
set set_count = coalesce(set_count, 3)
where exercise_type = 'weight_lifting';

update gym_app.plan_exercises
set rep_min = coalesce(rep_min, 8),
    rep_max = coalesce(rep_max, 12)
where exercise_type = 'weight_lifting';

