-- Migration 002 — Tables manquantes + index perf
-- À appliquer sur une DB qui a déjà la migration 001.

-- Currencies : ledger monétaire dédié
create table if not exists currencies (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  kind text not null default 'coins',
  delta int not null default 0,
  source text not null,
  balance_after int not null default 0,
  created_at timestamptz not null default now()
);

-- Inventory : items généraux
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  item_kind text not null default 'cosmetic',
  quantity int not null default 1,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (avatar_id, item_id)
);

-- Studies : formation / XP
create table if not exists studies (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  course_slug text not null,
  course_name text not null,
  progress_pct int not null default 0 check (progress_pct between 0 and 100),
  level int not null default 1,
  xp int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (avatar_id, course_slug)
);

-- Events : journal des events quotidiens
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  choice text,
  effects jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Reports : signalements
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  reported_message_id uuid,
  reason text not null,
  details text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Blocks : blocage utilisateur
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_user_id, blocked_user_id)
);

-- Analytics events
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}',
  platform text not null default 'mobile',
  app_version text,
  created_at timestamptz not null default now()
);

-- Colonne expires_at sur rooms (pour secret rooms)
alter table rooms add column if not exists expires_at timestamptz;

-- RLS
alter table currencies enable row level security;
alter table inventory enable row level security;
alter table studies enable row level security;
alter table events enable row level security;
alter table reports enable row level security;
alter table blocks enable row level security;
alter table analytics_events enable row level security;

create policy "currencies own row" on currencies
  for all using (
    exists (select 1 from avatars where avatars.id = currencies.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = currencies.avatar_id and avatars.user_id = auth.uid())
  );

create policy "inventory own row" on inventory
  for all using (
    exists (select 1 from avatars where avatars.id = inventory.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = inventory.avatar_id and avatars.user_id = auth.uid())
  );

create policy "studies own row" on studies
  for all using (
    exists (select 1 from avatars where avatars.id = studies.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = studies.avatar_id and avatars.user_id = auth.uid())
  );

create policy "events own row" on events
  for all using (
    exists (select 1 from avatars where avatars.id = events.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = events.avatar_id and avatars.user_id = auth.uid())
  );

create policy "reports create" on reports
  for insert with check (auth.uid() = reporter_user_id);
create policy "reports own read" on reports
  for select using (auth.uid() = reporter_user_id);

create policy "blocks own row" on blocks
  for all using (auth.uid() = blocker_user_id) with check (auth.uid() = blocker_user_id);

create policy "analytics insert" on analytics_events
  for insert with check (auth.uid() = user_id or user_id is null);
create policy "analytics own read" on analytics_events
  for select using (auth.uid() = user_id);

-- Index perf
create index if not exists idx_action_logs_avatar on action_logs(avatar_id, created_at desc);
create index if not exists idx_messages_conv on messages(conversation_id, created_at asc);
create index if not exists idx_room_messages_room on room_messages(room_id, created_at asc);
create index if not exists idx_notifications_avatar on notifications(avatar_id, read_at, created_at desc);
create index if not exists idx_analytics_event_name on analytics_events(event_name, created_at desc);
create index if not exists idx_currencies_avatar on currencies(avatar_id, kind, created_at desc);
create index if not exists idx_events_avatar on events(avatar_id, created_at desc);
create index if not exists idx_studies_avatar on studies(avatar_id);
create index if not exists idx_world_presence_location on world_presence(location_slug, updated_at desc);
