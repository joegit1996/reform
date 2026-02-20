grant usage on schema gym_app to authenticated;

grant select, insert, update, delete on all tables in schema gym_app to authenticated;

alter default privileges in schema gym_app
grant select, insert, update, delete on tables to authenticated;
