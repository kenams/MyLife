-- Feature flags + kill switches.
-- Permet de désactiver instantanément une mécanique sans redéployer l'app.
-- Lecture ouverte à tous les authentifiés, écriture réservée aux admins.

create table if not exists public.feature_flags (
  code text primary key,
  enabled boolean not null default true,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

drop policy if exists "flags_read_all" on public.feature_flags;
create policy "flags_read_all"
  on public.feature_flags
  for select
  to authenticated
  using (true);

drop policy if exists "flags_write_admin" on public.feature_flags;
create policy "flags_write_admin"
  on public.feature_flags
  for all
  to authenticated
  using (public.is_staff('admin'))
  with check (public.is_staff('admin'));

revoke insert, update, delete on public.feature_flags from anon, authenticated;

-- Propagation temps réel : un kill switch prend effet chez tous les clients connectés.
do $$
begin
  alter publication supabase_realtime add table public.feature_flags;
exception
  when duplicate_object then null;
end $$;

insert into public.feature_flags (code, enabled, description) values
  ('daily_hub',    true,  'Bloc « Ta journée » sur l''accueil'),
  ('gain_toast',   true,  'Pastille de gain flottante (+XP / +BL / +rép)'),
  ('season_hub',   true,  'Hub Saison 1 « Toulouse s''éveille »'),
  ('flash_events', true,  'Événements éclair sur la Life Map'),
  ('crew_life',    false, 'Crew Life — QG, présence live, sorties IRL (en développement)'),
  ('rare_events',  false, 'Événements rares dans Toulouse (en développement)')
on conflict (code) do nothing;
