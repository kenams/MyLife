-- Migration 004 — Table push_tokens
-- Stocke les tokens Expo Push par avatar (utilisé par le Cloudflare Worker).

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,                     -- "ExponentPushToken[...]"
  platform text not null default 'mobile', -- 'ios' | 'android'
  updated_at timestamptz not null default now(),
  unique (avatar_id)   -- un seul token actif par avatar (dernier enregistré)
);

alter table push_tokens enable row level security;

create policy "push_tokens own row" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_push_tokens_avatar on push_tokens(avatar_id);
