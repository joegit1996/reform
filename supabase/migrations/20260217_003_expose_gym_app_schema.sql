grant usage on schema gym_app to anon, authenticated, service_role;

grant select on all tables in schema gym_app to authenticated;
grant select, insert, update, delete on all tables in schema gym_app to service_role;

alter default privileges in schema gym_app grant select on tables to authenticated;
alter default privileges in schema gym_app grant select, insert, update, delete on tables to service_role;

alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public,gym_app';
notify pgrst, 'reload config';
