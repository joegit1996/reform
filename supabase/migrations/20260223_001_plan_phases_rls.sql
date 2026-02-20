alter table gym_app.plan_phases enable row level security;

drop policy if exists "plan_phases_authenticated_read" on gym_app.plan_phases;
create policy "plan_phases_authenticated_read" on gym_app.plan_phases
for select using (auth.role() = 'authenticated');

drop policy if exists "admin_plan_phases_write" on gym_app.plan_phases;
create policy "admin_plan_phases_write" on gym_app.plan_phases
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

