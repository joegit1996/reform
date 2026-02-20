alter table gym_app.profiles
  add column if not exists preferred_weight_unit text not null default 'lb'
    check (preferred_weight_unit in ('kg', 'lb')),
  add column if not exists preferred_distance_unit text not null default 'km'
    check (preferred_distance_unit in ('km', 'mi'));
