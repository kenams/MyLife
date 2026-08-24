-- ═══════════════════════════════════════════════════════════════════════
-- RATTRAPAGE — dérive de schéma trouvée par le replay à froid (demande
-- explicite de Kenams : "aucun Postgres local ne doit devenir un abandon
-- permanent"). Docker était disponible ; un vrai replay depuis zéro sur
-- postgis/postgis:16-3.4 (avec rôles anon/authenticated/service_role,
-- schéma extensions, publication supabase_realtime recréés manuellement,
-- comme le fait `supabase start`) a échoué sur ces objets : ils existent
-- en production mais n'ont JAMAIS été capturés dans une migration —
-- créés directement en base à un moment non tracé.
--
-- flash_events / flash_event_participants : base des events IRL, modifiée
-- par 20260823220000_flash_events_lifecycle.sql mais jamais créée par
-- aucune migration (le fichier ne fait que des ALTER TABLE).
-- purge_old_feed / decay_inactive_crew_zones / cleanup_old_takeovers /
-- purge_expired_flash_events : fonctions référencées (ALTER FUNCTION dans
-- le hardening search_path) mais jamais définies par CREATE FUNCTION.
--
-- Toutes les définitions ci-dessous sont exactement celles trouvées en
-- production (pg_get_functiondef / information_schema.columns), pas des
-- reconstructions approximatives. IF NOT EXISTS / OR REPLACE partout :
-- aucun changement de comportement sur la prod, seulement la mise sous
-- version control de ce qui existait déjà.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.flash_events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text not null,
  emoji         text not null default '⚡',
  location      text,
  location_lat  double precision,
  location_lng  double precision,
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz not null default (now() + interval '2 hours'),
  reward_xp     integer default 50,
  reward_money  integer default 0,
  max_players   integer default 100,
  kind          text not null default 'challenge',
  is_active     boolean default true,
  created_by    uuid
);

create table if not exists public.flash_event_participants (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid references public.flash_events(id) on delete cascade,
  player_name       text not null,
  player_emoji      text default '🧢',
  joined_at         timestamptz default now(),
  user_id           uuid,
  status            text not null default 'joined',
  checked_in_at     timestamptz,
  reward_claimed_at timestamptz
);

create or replace function public.purge_old_feed()
returns trigger
language plpgsql
set search_path to 'public'
as $$
BEGIN
  DELETE FROM life_feed_events WHERE created_at < NOW() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$;

create or replace function public.decay_inactive_crew_zones()
returns void
language plpgsql
set search_path to 'public'
as $$
BEGIN
  UPDATE crew_zones
  SET radius = GREATEST(100, ROUND(radius * 0.9))
  WHERE last_activity_at < NOW() - INTERVAL '24 hours'
    AND expires_at > NOW();
END;
$$;

create or replace function public.cleanup_old_takeovers()
returns trigger
language plpgsql
set search_path to 'public'
as $$
BEGIN
  DELETE FROM bastion_takeover_events
  WHERE id NOT IN (
    SELECT id FROM bastion_takeover_events ORDER BY created_at DESC LIMIT 100
  );
  RETURN NEW;
END;
$$;

create or replace function public.purge_expired_flash_events()
returns trigger
language plpgsql
set search_path to 'public'
as $$
BEGIN
  DELETE FROM flash_events WHERE ends_at < NOW() - INTERVAL '1 hour';
  RETURN NULL;
END;
$$;
