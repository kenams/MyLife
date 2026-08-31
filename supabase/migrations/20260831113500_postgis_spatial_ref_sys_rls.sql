-- Supabase exposes public tables through PostgREST roles. PostGIS keeps
-- `spatial_ref_sys` in public, so enforce read-only client access at the RLS
-- layer as a defense-in-depth boundary. PostGIS owner/admin operations bypass
-- RLS and remain unaffected.

alter table public.spatial_ref_sys enable row level security;

drop policy if exists spatial_ref_sys_read_only on public.spatial_ref_sys;
create policy spatial_ref_sys_read_only
  on public.spatial_ref_sys
  for select
  to anon, authenticated
  using (true);
