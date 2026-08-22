-- Life Map : positions live des joueurs
-- PostGIS doit être activé sur le projet Supabase

create extension if not exists postgis;

create table if not exists public.life_map_players (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_emoji  text default '🧢',
  status        text not null default 'ghost'
                  check (status in ('free','vibe','charo','taken','ghost')),
  lat           double precision,
  lng           double precision,
  location_name text,          -- "Belleville", "République", etc.
  location_verified boolean default false,
  last_action   text,          -- dernière action du game loop
  is_star       boolean default false,
  level         int default 1,
  updated_at    timestamptz default now(),
  created_at    timestamptz default now()
);

-- Index géospatial
create index if not exists life_map_players_geo
  on public.life_map_players using gist (
    st_point(lng, lat)
  );

-- Un seul enregistrement par user
create unique index if not exists life_map_players_user_unique
  on public.life_map_players (user_id);

-- RLS
alter table public.life_map_players enable row level security;

-- Lecture : visible si pas ghost
create policy "Visible si pas ghost"
  on public.life_map_players for select
  using (status != 'ghost');

-- Insert/update : uniquement son propre enregistrement
create policy "Insert own"
  on public.life_map_players for insert
  with check (auth.uid() = user_id);

create policy "Update own"
  on public.life_map_players for update
  using (auth.uid() = user_id);

-- Fonction : joueurs dans un rayon (km)
create or replace function public.players_nearby(
  ref_lat double precision,
  ref_lng double precision,
  radius_km double precision default 5
)
returns setof public.life_map_players
language sql stable
as $$
  select *
  from public.life_map_players
  where status != 'ghost'
    and st_dwithin(
      st_point(lng, lat)::geography,
      st_point(ref_lng, ref_lat)::geography,
      radius_km * 1000
    )
  order by st_distance(
    st_point(lng, lat)::geography,
    st_point(ref_lng, ref_lat)::geography
  );
$$;

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger life_map_updated_at
  before update on public.life_map_players
  for each row execute function public.set_updated_at();
