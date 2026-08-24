-- ═══════════════════════════════════════════════════════════════════════
-- RATTRAPAGE #2 — trouvé en comparant le nombre de tables entre le replay
-- local (37/37 réussi via `supabase db reset`, stack officielle CLI+Docker)
-- et la production : 77 tables en prod contre 74 en local. Trois tables
-- existent en prod sans avoir jamais été capturées par une migration.
--
-- En creusant ces trois tables, deux failles réelles ont aussi été
-- trouvées et corrigées séparément en production (voir migrations
-- player_profiles_lockdown et npcs_lockdown, déjà appliquées) :
--   - player_profiles avait INSERT/UPDATE/DELETE ouverts à `anon` — accès
--     total sans authentification au XP/argent/réputation de N'IMPORTE
--     QUEL joueur. Confirmé exploitable par un curl PATCH réel avant
--     correction.
--   - npcs (table non utilisée par le code actuel) avait la même
--     ouverture totale pour anon ET authenticated.
-- Ce fichier documente le SCHÉMA (colonnes) tel que trouvé en prod ; les
-- verrous de sécurité sont dans les deux migrations dédiées ci-dessus,
-- déjà appliquées, pour garder chaque changement de comportement
-- clairement séparé de la pure capture de structure.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.life_feed_events (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,
  emoji        text not null default '🔥',
  body         text not null,
  player_name  text,
  player_emoji text default '🧢',
  location     text,
  is_npc       boolean default false,
  is_star      boolean default false,
  created_at   timestamptz default now()
);
alter table public.life_feed_events enable row level security;
revoke all on public.life_feed_events from anon, authenticated;
grant select on public.life_feed_events to anon, authenticated;
grant insert on public.life_feed_events to anon, authenticated;
create policy "feed_public_read" on public.life_feed_events for select using (true);
create policy "feed_public_insert" on public.life_feed_events for insert with check (true);

create table if not exists public.npcs (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null,
  avatar_emoji  text not null,
  backstory     text,
  personality   text,
  current_mood  text default 'chill',
  home_quartier text,
  status        text default 'free',
  lat           double precision,
  lng           double precision,
  level         integer default 1,
  is_star       boolean default false,
  last_action   text,
  schedule      jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table public.npcs enable row level security;
revoke all on public.npcs from anon, authenticated;
grant select on public.npcs to anon, authenticated;
create policy "npc_read_npcs" on public.npcs for select using (true);

create table if not exists public.player_profiles (
  id           uuid primary key default gen_random_uuid(),
  player_id    text not null unique,
  display_name text not null,
  player_emoji text default '🧢',
  level        integer default 1,
  player_xp    integer default 0,
  money        integer default 0,
  reputation   integer default 0,
  streak       integer default 0,
  housing      text default 'squat',
  crew_id      uuid,
  is_premium   boolean default false,
  last_seen    timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.player_profiles enable row level security;
revoke all on public.player_profiles from anon, authenticated;
grant select on public.player_profiles to anon, authenticated;
grant insert, update on public.player_profiles to authenticated;
create policy "profiles_read" on public.player_profiles for select using (true);
create policy "profiles_upsert" on public.player_profiles for insert to authenticated with check (true);
create policy "profiles_update" on public.player_profiles for update to authenticated using (true);

create table if not exists public.account_deletions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  reason     text,
  deleted_at timestamptz default now()
);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon, authenticated;

create table if not exists public.bastion_checkins (
  id            uuid primary key default gen_random_uuid(),
  zone_id       uuid not null,
  player_name   text not null,
  bl_earned     integer not null default 0,
  checked_in_at timestamptz not null default now()
);
alter table public.bastion_checkins enable row level security;
revoke all on public.bastion_checkins from anon, authenticated;
grant select on public.bastion_checkins to authenticated;
create policy "bastion_checkins_read" on public.bastion_checkins for select to authenticated using (true);

create table if not exists public.bastion_takeover_events (
  id             uuid primary key default gen_random_uuid(),
  bastion_name   text not null,
  new_crew_tag   text not null,
  new_crew_color text not null default '#FFD600',
  new_crew_emoji text not null default '🏰',
  lat            double precision not null,
  lng            double precision not null,
  created_at     timestamptz not null default now()
);
alter table public.bastion_takeover_events enable row level security;
revoke all on public.bastion_takeover_events from anon;
grant select on public.bastion_takeover_events to anon, authenticated;
grant insert on public.bastion_takeover_events to authenticated;
create policy "bastion_takeover_read" on public.bastion_takeover_events for select using (true);
create policy "bastion_takeover_insert" on public.bastion_takeover_events for insert to authenticated with check (true);
