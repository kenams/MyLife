-- ═══════════════════════════════════════════════════════════════════════
-- SAISON 1 — TOULOUSE S'ÉVEILLE
-- Schéma versionné : une saison est une ligne, pas une famille de tables.
-- Une Saison 2 s'ajoute par une nouvelle ligne dans `seasons` + de nouvelles
-- `mission_definitions`/`badges` qui y pointent — aucune table à modifier.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.seasons (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  description  text not null default '',
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       text not null default 'upcoming' check (status in ('upcoming','active','ended')),
  rules        jsonb not null default '{}'::jsonb,
  theme_color  text not null default '#FFD600',
  version      int not null default 1,
  created_at   timestamptz not null default now()
);
alter table public.seasons enable row level security;
revoke all on public.seasons from anon, authenticated;
grant select on public.seasons to authenticated, anon;
create policy "seasons_read" on public.seasons for select using (true);

-- Quartiers réels de la Life Map (distinct de `neighborhoods`, qui sert au
-- système de logement du life-sim — deux concepts différents, pas de fusion).
create table if not exists public.districts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  emoji        text not null default '📍',
  center_lat   double precision not null,
  center_lng   double precision not null,
  created_at   timestamptz not null default now()
);
alter table public.districts enable row level security;
revoke all on public.districts from anon, authenticated;
grant select on public.districts to authenticated, anon;
create policy "districts_read" on public.districts for select using (true);

insert into public.districts (slug, name, emoji, center_lat, center_lng) values
  ('capitole', 'Capitole', '🏛️', 43.6047, 1.4442),
  ('saint-cyprien', 'Saint-Cyprien', '🌊', 43.5995, 1.4380),
  ('carmes', 'Carmes', '🧺', 43.5985, 1.4480),
  ('compans', 'Compans-Caffarelli', '🏢', 43.6115, 1.4380),
  ('minimes', 'Les Minimes', '🌳', 43.6200, 1.4320),
  ('rangueil', 'Rangueil', '🎓', 43.5660, 1.4680),
  ('mirail', 'Mirail', '🏘️', 43.5780, 1.4060),
  ('empalot', 'Empalot', '🏙️', 43.5860, 1.4500),
  ('bagatelle', 'Bagatelle', '🌿', 43.5940, 1.4200),
  ('bonnefoy', 'Bonnefoy', '🍷', 43.6050, 1.4640),
  ('croix-daurade', 'Croix-Daurade', '⚽', 43.6230, 1.4420),
  ('la-vache', 'La Vache', '🎨', 43.6300, 1.4200)
on conflict (slug) do nothing;

-- Appartenance de quartier — séparée du crew, cooldown de changement.
create table if not exists public.player_districts (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  district_id   uuid not null references public.districts(id),
  joined_at     timestamptz not null default now(),
  change_count  int not null default 0,
  last_change_at timestamptz not null default now()
);
alter table public.player_districts enable row level security;
revoke all on public.player_districts from anon, authenticated;
grant select on public.player_districts to authenticated;
create policy "player_districts_read_own" on public.player_districts for select to authenticated using (user_id = auth.uid());
create policy "player_districts_read_public" on public.player_districts for select to anon using (true);

create table if not exists public.player_district_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  district_id   uuid not null references public.districts(id),
  changed_at    timestamptz not null default now()
);
alter table public.player_district_history enable row level security;
revoke all on public.player_district_history from anon, authenticated;
grant select on public.player_district_history to authenticated;
create policy "player_district_history_own" on public.player_district_history for select to authenticated using (user_id = auth.uid());

-- ── Missions ────────────────────────────────────────────────────────────
create table if not exists public.mission_definitions (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references public.seasons(id) on delete cascade,
  category       text not null check (category in ('explore','move','social')),
  title          text not null,
  description    text not null default '',
  district_id    uuid references public.districts(id),
  approx_lat     double precision,
  approx_lng     double precision,
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz not null,
  conditions     jsonb not null default '{}'::jsonb,
  capacity       int,
  reward_xp      int not null default 0,
  reward_money   int not null default 0,
  reward_reputation int not null default 0,
  cooldown_hours int not null default 0,
  repeatable     boolean not null default false,
  difficulty     text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  status         text not null default 'available' check (status in ('available','expired','disabled')),
  organizer      text not null default 'MyLife',
  linked_event_id uuid references public.flash_events(id),
  created_at     timestamptz not null default now()
);
alter table public.mission_definitions enable row level security;
revoke all on public.mission_definitions from anon, authenticated;
grant select on public.mission_definitions to authenticated, anon;
create policy "mission_definitions_read" on public.mission_definitions for select using (true);

create table if not exists public.mission_participations (
  id            uuid primary key default gen_random_uuid(),
  mission_id    uuid not null references public.mission_definitions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'joined'
                 check (status in ('joined','in_progress','validatable','validated','rewarded','expired','abandoned','rejected')),
  progress      jsonb not null default '{}'::jsonb,
  joined_at     timestamptz not null default now(),
  validated_at  timestamptz,
  rewarded_at   timestamptz,
  unique (mission_id, user_id)
);
alter table public.mission_participations enable row level security;
revoke all on public.mission_participations from anon, authenticated;
grant select on public.mission_participations to authenticated;
create policy "mission_participations_own" on public.mission_participations for select to authenticated using (user_id = auth.uid());

-- ── Économie — ledger protégé, source de vérité unique ────────────────────
create table if not exists public.season_reward_ledger (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  source                text not null,          -- 'mission', 'badge', ...
  source_id             uuid not null,
  xp                    int not null default 0,
  money                 int not null default 0,
  reputation            int not null default 0,
  district_contribution int not null default 0,
  crew_contribution     int not null default 0,
  idempotency_key       text not null unique,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);
alter table public.season_reward_ledger enable row level security;
revoke all on public.season_reward_ledger from anon, authenticated;
grant select on public.season_reward_ledger to authenticated;
create policy "season_reward_ledger_own" on public.season_reward_ledger for select to authenticated using (user_id = auth.uid());

-- ── Quartiers vivants ───────────────────────────────────────────────────
create table if not exists public.district_progress (
  district_id        uuid not null references public.districts(id),
  season_id          uuid not null references public.seasons(id) on delete cascade,
  xp                  int not null default 0,
  level               int not null default 1,
  missions_completed  int not null default 0,
  weekly_goal         int not null default 1000,
  weekly_progress     int not null default 0,
  updated_at          timestamptz not null default now(),
  primary key (district_id, season_id)
);
alter table public.district_progress enable row level security;
revoke all on public.district_progress from anon, authenticated;
grant select on public.district_progress to authenticated, anon;
create policy "district_progress_read" on public.district_progress for select using (true);

-- ── Badges ──────────────────────────────────────────────────────────────
create table if not exists public.badges (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  description   text not null default '',
  icon          text not null default '🏅',
  rarity        text not null default 'common' check (rarity in ('common','rare','epic')),
  season_id     uuid references public.seasons(id),  -- null = permanent
  created_at    timestamptz not null default now()
);
alter table public.badges enable row level security;
revoke all on public.badges from anon, authenticated;
grant select on public.badges to authenticated, anon;
create policy "badges_read" on public.badges for select using (true);

create table if not exists public.badge_awards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  badge_id      uuid not null references public.badges(id) on delete cascade,
  awarded_at    timestamptz not null default now(),
  unique (user_id, badge_id)
);
alter table public.badge_awards enable row level security;
revoke all on public.badge_awards from anon, authenticated;
grant select on public.badge_awards to authenticated;
create policy "badge_awards_own" on public.badge_awards for select to authenticated using (user_id = auth.uid());
create policy "badge_awards_public" on public.badge_awards for select to anon using (true);

insert into public.badges (code, name, description, icon, rarity, season_id) values
  ('first-step',    'Premier pas',            'Rejoindre ta première mission',            '👣', 'common', null),
  ('explorer-tls',  'Explorateur de Toulouse', 'Valider une mission Explorer',             '🧭', 'common', null),
  ('team-spirit',   'Esprit d''équipe',        'Contribuer à un crew via une mission',     '🤝', 'rare',   null),
  ('organizer',     'Organisateur',            'Créer un événement rejoint par 3+ joueurs','📣', 'rare',   null),
  ('local-regular', 'Habitué du quartier',     'Valider 5 missions dans le même quartier', '🏘️', 'rare',   null),
  ('mylife-meet',   'Rencontre MyLife',        'Ta première Feeling mutuelle',             '💫', 'common', null)
on conflict (code) do nothing;

-- Saison 1
insert into public.seasons (slug, name, description, starts_at, ends_at, status, theme_color)
values ('season-1', 'Toulouse s''éveille', 'Explore, bouge, connecte-toi — la ville prend vie.', now(), now() + interval '90 days', 'active', '#FFD600')
on conflict (slug) do nothing;
