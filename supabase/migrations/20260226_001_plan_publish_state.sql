alter table gym_app.training_plans
  add column if not exists status text not null default 'draft';

alter table gym_app.training_plans
  add column if not exists published_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'training_plans_status_check'
      and conrelid = 'gym_app.training_plans'::regclass
  ) then
    alter table gym_app.training_plans
      add constraint training_plans_status_check
      check (status in ('draft', 'published'));
  end if;
end
$$;

update gym_app.training_plans
set status = case when is_active then 'published' else 'draft' end,
    published_at = case when is_active then coalesce(published_at, now()) else null end
where status not in ('draft', 'published')
   or published_at is null and is_active = true;

create index if not exists idx_training_plans_focus_status
  on gym_app.training_plans(focus_id, status);
