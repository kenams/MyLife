-- Security hardening for public application tables flagged by the Supabase linter.
--
-- `daily_challenge_templates` is catalog data: clients may read it, never mutate it.
-- `username_lookup_attempts` is internal rate-limit/audit state and must not be
-- directly accessible from anon/authenticated clients.
--
-- We intentionally do not alter `spatial_ref_sys`: it is owned/managed by the
-- PostGIS extension and changing its RLS behavior can break extension semantics.

alter table public.daily_challenge_templates enable row level security;

drop policy if exists daily_challenge_templates_read on public.daily_challenge_templates;
create policy daily_challenge_templates_read
  on public.daily_challenge_templates
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate, references, trigger
  on public.daily_challenge_templates
  from anon, authenticated;

grant select on public.daily_challenge_templates to anon, authenticated;

alter table public.username_lookup_attempts enable row level security;
revoke all on public.username_lookup_attempts from anon, authenticated;
