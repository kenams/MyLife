-- `spatial_ref_sys` is owned by PostGIS. We deliberately leave its extension-managed
-- RLS state untouched, but client roles must never be able to mutate its contents.
-- Keep read access for PostGIS/client compatibility and revoke all write-capable grants.

revoke insert, update, delete, truncate, references, trigger
  on public.spatial_ref_sys
  from anon, authenticated;

grant select on public.spatial_ref_sys to anon, authenticated;
