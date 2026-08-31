-- `spatial_ref_sys` is extension-owned on hosted Supabase. Production migrations
-- run as `postgres`, which is not necessarily the table owner and therefore
-- cannot ALTER its RLS state. Keep this migration safe and non-blocking across
-- local/hosted environments instead of breaking `db push`.
--
-- Application-owned public tables are hardened separately. PostGIS metadata is
-- treated as an extension/platform concern until the owning role can apply the
-- policy through a supported administrative path.

do $$
declare
  v_owner text;
begin
  select pg_get_userbyid(c.relowner)
    into v_owner
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'spatial_ref_sys';

  if v_owner = current_user then
    execute 'alter table public.spatial_ref_sys enable row level security';
    execute 'drop policy if exists spatial_ref_sys_read_only on public.spatial_ref_sys';
    execute 'create policy spatial_ref_sys_read_only on public.spatial_ref_sys for select to anon, authenticated using (true)';
  else
    raise notice 'Skipping spatial_ref_sys RLS hardening: owner is %, migration role is %', v_owner, current_user;
  end if;
end $$;
