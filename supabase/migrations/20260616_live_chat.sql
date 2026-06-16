-- Chat live par quartier + DM entre joueurs
-- Supabase Realtime activé sur ces tables

-- Messages de quartier (broadcast par zone géo)
create table if not exists public.quartier_messages (
  id           uuid primary key default gen_random_uuid(),
  quartier     text not null,           -- "Belleville", "République", etc.
  user_id      uuid references auth.users(id) on delete set null,
  display_name text not null,
  avatar_emoji text default '🧢',
  body         text not null check (char_length(body) <= 500),
  is_star      boolean default false,
  created_at   timestamptz default now()
);

-- Index pour récupérer les 50 derniers par quartier
create index if not exists quartier_messages_quartier_idx
  on public.quartier_messages (quartier, created_at desc);

-- TTL : les messages expirent après 24h (cron job ou trigger)
create or replace function public.delete_old_quartier_messages()
returns void language sql as $$
  delete from public.quartier_messages
  where created_at < now() - interval '24 hours';
$$;

-- RLS
alter table public.quartier_messages enable row level security;

create policy "Lecture quartier messages"
  on public.quartier_messages for select using (true);

create policy "Insert own quartier message"
  on public.quartier_messages for insert
  with check (auth.uid() = user_id);

-- DM directs entre joueurs
create table if not exists public.dm_messages (
  id           uuid primary key default gen_random_uuid(),
  room_id      text not null,           -- "{uid_a}_{uid_b}" trié alphabétiquement
  sender_id    uuid references auth.users(id) on delete set null,
  sender_name  text not null,
  sender_emoji text default '🧢',
  body         text not null check (char_length(body) <= 1000),
  read_at      timestamptz,
  created_at   timestamptz default now()
);

create index if not exists dm_messages_room_idx
  on public.dm_messages (room_id, created_at asc);

alter table public.dm_messages enable row level security;

-- Seuls les participants peuvent lire leur room
create policy "Read own DM"
  on public.dm_messages for select
  using (room_id like '%' || auth.uid()::text || '%');

create policy "Insert own DM"
  on public.dm_messages for insert
  with check (auth.uid() = sender_id);

-- Activer Realtime sur les deux tables
-- (à faire dans le dashboard Supabase : Table Editor → Realtime → Enable)
-- alter publication supabase_realtime add table public.quartier_messages;
-- alter publication supabase_realtime add table public.dm_messages;
