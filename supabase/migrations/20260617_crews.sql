-- ── Crews ────────────────────────────────────────────────────────────────────
create table if not exists public.crews (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  tag           text not null,
  emoji         text not null default '🔥',
  color         text not null default '#FF3B3B',
  description   text,
  founder       text not null,
  member_count  int  not null default 1,
  reputation    int  not null default 0,
  created_at    timestamptz not null default now()
);

-- ── Crew members ─────────────────────────────────────────────────────────────
create table if not exists public.crew_members (
  id           uuid primary key default gen_random_uuid(),
  crew_id      uuid not null references public.crews(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  player_name  text not null,
  player_emoji text not null default '🧢',
  role         text not null default 'member' check (role in ('founder','officer','member')),
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz,
  unique(crew_id, player_name)
);

-- ── Crew zones ────────────────────────────────────────────────────────────────
create table if not exists public.crew_zones (
  id               uuid primary key default gen_random_uuid(),
  crew_id          uuid not null references public.crews(id) on delete cascade,
  name             text not null,
  lat              float8 not null,
  lng              float8 not null,
  radius           int not null default 250,
  claimed_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '7 days'),
  last_activity_at timestamptz
);

-- ── Crew wars ─────────────────────────────────────────────────────────────────
create table if not exists public.crew_wars (
  id          uuid primary key default gen_random_uuid(),
  crew_a_id   uuid not null references public.crews(id) on delete cascade,
  crew_b_id   uuid not null references public.crews(id) on delete cascade,
  zone_a_id   uuid references public.crew_zones(id) on delete set null,
  zone_b_id   uuid references public.crew_zones(id) on delete set null,
  status      text not null default 'active' check (status in ('active','won','lost','draw')),
  winner_id   uuid references public.crews(id),
  started_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- ── Crew alliances ────────────────────────────────────────────────────────────
create table if not exists public.crew_alliances (
  id           uuid primary key default gen_random_uuid(),
  crew_a_id    uuid not null references public.crews(id) on delete cascade,
  crew_b_id    uuid not null references public.crews(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','active','broken')),
  proposed_by  uuid not null references public.crews(id),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  unique(crew_a_id, crew_b_id)
);

-- ── Leader votes ──────────────────────────────────────────────────────────────
create table if not exists public.crew_leader_votes (
  id           uuid primary key default gen_random_uuid(),
  crew_id      uuid not null references public.crews(id) on delete cascade,
  voter_name   text not null,
  candidate    text not null,
  created_at   timestamptz not null default now(),
  unique(crew_id, voter_name)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists crew_members_crew_id_idx on public.crew_members(crew_id);
create index if not exists crew_members_player_name_idx on public.crew_members(player_name);
create index if not exists crew_zones_crew_id_idx on public.crew_zones(crew_id);
create index if not exists crew_zones_expires_idx on public.crew_zones(expires_at);
create index if not exists crew_wars_crew_a_idx on public.crew_wars(crew_a_id);
create index if not exists crew_wars_crew_b_idx on public.crew_wars(crew_b_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.crews           enable row level security;
alter table public.crew_members    enable row level security;
alter table public.crew_zones      enable row level security;
alter table public.crew_wars       enable row level security;
alter table public.crew_alliances  enable row level security;
alter table public.crew_leader_votes enable row level security;

-- Lecture publique
create policy "crews_read"            on public.crews           for select using (true);
create policy "crew_members_read"     on public.crew_members    for select using (true);
create policy "crew_zones_read"       on public.crew_zones      for select using (true);
create policy "crew_wars_read"        on public.crew_wars       for select using (true);
create policy "crew_alliances_read"   on public.crew_alliances  for select using (true);
create policy "crew_votes_read"       on public.crew_leader_votes for select using (true);

-- Écriture authentifiée
create policy "crews_insert"          on public.crews           for insert with check (auth.uid() is not null);
create policy "crew_members_insert"   on public.crew_members    for insert with check (auth.uid() is not null);
create policy "crew_members_delete"   on public.crew_members    for delete using (auth.uid() is not null);
create policy "crew_members_update"   on public.crew_members    for update using (auth.uid() is not null);
create policy "crews_update"          on public.crews           for update using (auth.uid() is not null);
create policy "crew_zones_insert"     on public.crew_zones      for insert with check (auth.uid() is not null);
create policy "crew_zones_update"     on public.crew_zones      for update using (auth.uid() is not null);
create policy "crew_wars_insert"      on public.crew_wars       for insert with check (auth.uid() is not null);
create policy "crew_wars_update"      on public.crew_wars       for update using (auth.uid() is not null);
create policy "crew_alliances_insert" on public.crew_alliances  for insert with check (auth.uid() is not null);
create policy "crew_alliances_update" on public.crew_alliances  for update using (auth.uid() is not null);
create policy "crew_votes_insert"     on public.crew_leader_votes for insert with check (auth.uid() is not null);
create policy "crew_votes_delete"     on public.crew_leader_votes for delete using (auth.uid() is not null);

-- ── Realtime ──────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.crews;
alter publication supabase_realtime add table public.crew_members;
alter publication supabase_realtime add table public.crew_zones;
alter publication supabase_realtime add table public.crew_wars;
