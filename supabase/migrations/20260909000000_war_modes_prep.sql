-- ═══════════════════════════════════════════════════════════════════════
-- §17 — ARCHITECTURE EXTENSIBLE POUR LES FUTURS MODES (préparer, pas activer)
-- ═══════════════════════════════════════════════════════════════════════
-- On NE développe PAS les autres Crew Wars ni la Guerre de Toulouse
-- maintenant. On rend juste le socle prêt : une Battle porte un `mode` et
-- peut appartenir à un « méga-événement » multi-crews.

alter table public.territory_battles
  add column if not exists mode text not null default 'territory_war'
  check (mode in ('territory_war','street_rush','brain_war','conquest','wory_rush','crew_sync','social_war','chaos_night'));

-- Méga-événement mensuel (« Guerre de Toulouse ») — coquille, inactif.
create table if not exists public.mega_events (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Guerre de Toulouse',
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     text not null default 'draft' check (status in ('draft','scheduled','live','finished')),
  winner_crew uuid references public.crews(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.territory_battles
  add column if not exists mega_event_id uuid references public.mega_events(id) on delete set null;

alter table public.mega_events enable row level security;
revoke all on public.mega_events from anon, authenticated;
grant select on public.mega_events to authenticated, anon;
do $$ begin
  create policy mega_events_read on public.mega_events for select
    using (status in ('scheduled','live','finished'));
exception when duplicate_object then null; end $$;
