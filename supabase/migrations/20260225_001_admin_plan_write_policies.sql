drop policy if exists "admin_training_plans_write" on gym_app.training_plans;
create policy "admin_training_plans_write" on gym_app.training_plans
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

drop policy if exists "admin_plan_weeks_write" on gym_app.plan_weeks;
create policy "admin_plan_weeks_write" on gym_app.plan_weeks
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

drop policy if exists "admin_plan_days_write" on gym_app.plan_days;
create policy "admin_plan_days_write" on gym_app.plan_days
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

drop policy if exists "admin_plan_exercises_write" on gym_app.plan_exercises;
create policy "admin_plan_exercises_write" on gym_app.plan_exercises
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
