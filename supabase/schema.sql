-- ============================================================
-- MyLife — Schema complet v2
-- À appliquer via Supabase Dashboard > SQL Editor
-- ou : supabase db push (Supabase CLI)
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── Référence : neighborhoods ───────────────────────────────────────────────

create table if not exists neighborhoods (
  slug text primary key,
  name text not null,
  vibe text not null,
  lifestyle text not null,
  cost_level text not null default 'balanced'
);

-- ─── Référence : locations ───────────────────────────────────────────────────

create table if not exists locations (
  slug text primary key,
  neighborhood_slug text not null references neighborhoods(slug) on delete cascade,
  name text not null,
  kind text not null,
  summary text not null,
  cost_hint text not null,
  social_energy int not null default 0,
  capacity int not null default 120
);

-- ─── Référence : jobs ────────────────────────────────────────────────────────

create table if not exists jobs (
  slug text primary key,
  name text not null,
  reward_coins int not null default 0,
  energy_cost int not null default 0,
  hunger_cost int not null default 0,
  stress_cost int not null default 0,
  discipline_reward int not null default 0,
  reputation_reward int not null default 0
);

-- ─── Référence : activities ──────────────────────────────────────────────────

create table if not exists activities (
  slug text primary key,
  name text not null,
  kind text not null,
  location_slug text not null references locations(slug),
  summary text not null,
  cost int not null default 0
);

-- ─── Utilisateurs ────────────────────────────────────────────────────────────

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  bio text,
  created_at timestamptz not null default now()
);

-- ─── Avatars ─────────────────────────────────────────────────────────────────

create table if not exists avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  display_name text not null,
  age_range text not null,
  gender text not null,
  origin_style text not null,
  photo_style text not null,
  bio text not null default '',
  height_cm int not null default 170,
  weight_kg numeric(5,2) not null default 70,
  body_frame text not null,
  skin_tone text not null,
  hair_type text not null,
  hair_color text not null,
  hair_length text not null,
  eye_color text not null,
  outfit_style text not null,
  facial_hair text not null,
  silhouette text not null,
  personality_trait text not null,
  sociability_style text not null,
  ambition text not null,
  life_rhythm text not null,
  relationship_style text not null,
  personal_goal text not null,
  life_habit text not null,
  starter_job text not null references jobs(slug),
  reputation int not null default 50,
  district_slug text not null references neighborhoods(slug),
  location_slug text not null references locations(slug),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists avatar_preferences (
  avatar_id uuid primary key references avatars(id) on delete cascade,
  interests text[] not null default '{}',
  leisure_styles text[] not null default '{}',
  looking_for text[] not null default '{}',
  favorite_activities text[] not null default '{}',
  favorite_outings text[] not null default '{}',
  appreciated_traits text[] not null default '{}',
  preferred_vibe text not null default 'calme',
  friendship_intent text not null default '',
  romance_intent text not null default ''
);

create table if not exists avatar_stats (
  avatar_id uuid primary key references avatars(id) on delete cascade,
  hunger int not null default 80,
  hydration int not null default 75,
  energy int not null default 80,
  hygiene int not null default 78,
  mood int not null default 75,
  sociability int not null default 65,
  health int not null default 76,
  fitness int not null default 55,
  stress int not null default 28,
  money int not null default 180,
  social_rank_score int not null default 45,
  reputation int not null default 50,
  discipline int not null default 52,
  motivation int not null default 60,
  weight numeric(5,2) not null default 70,
  attractiveness int not null default 50,
  mental_stability text not null default 'stable',
  streak int not null default 0,
  last_decay_at timestamptz not null default now(),
  last_meal_at timestamptz not null default now(),
  last_workout_at timestamptz not null default now(),
  last_social_at timestamptz not null default now()
);

-- ─── Économie ─────────────────────────────────────────────────────────────────

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  kind text not null,
  amount int not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- Ledger dédié currencies (coins / gems / tokens)
create table if not exists currencies (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  kind text not null default 'coins',   -- 'coins' | 'gems' | 'tokens'
  delta int not null default 0,          -- positif = gain, négatif = dépense
  source text not null,                  -- 'work' | 'bonus' | 'purchase' | 'gift' | 'decay'
  balance_after int not null default 0,  -- solde cumulé après delta
  created_at timestamptz not null default now()
);

create table if not exists social_transfers (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  to_resident_id text,
  amount int not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

-- ─── Inventaire ───────────────────────────────────────────────────────────────

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  item_kind text not null default 'cosmetic',  -- 'cosmetic' | 'boost' | 'consumable'
  quantity int not null default 1,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (avatar_id, item_id)
);

create table if not exists active_boosts (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  boost_id text not null,
  boost_name text not null,
  multiplier numeric(4,2) not null default 1,
  active_until timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists equipped_cosmetics (
  avatar_id uuid not null references avatars(id) on delete cascade,
  cosmetic_id text not null,
  equipped_at timestamptz not null default now(),
  primary key (avatar_id, cosmetic_id)
);

-- ─── Formations / Études ──────────────────────────────────────────────────────

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

-- ─── Événements quotidiens ────────────────────────────────────────────────────

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  kind text not null,   -- 'opportunity' | 'encounter' | 'setback' | 'windfall' | 'social'
  title text not null,
  body text not null,
  choice text,          -- 'accepted' | 'skipped' | null si non résolu
  effects jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── Journaux d'actions ───────────────────────────────────────────────────────

create table if not exists action_logs (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  action_type text not null,
  location_slug text references locations(slug),
  money_delta int not null default 0,
  energy_delta int not null default 0,
  hunger_delta int not null default 0,
  hygiene_delta int not null default 0,
  mood_delta int not null default 0,
  sociability_delta int not null default 0,
  fitness_delta int not null default 0,
  stress_delta int not null default 0,
  created_at timestamptz not null default now()
);

-- ─── Social ───────────────────────────────────────────────────────────────────

create table if not exists relationships (
  id uuid primary key default gen_random_uuid(),
  avatar_a uuid not null references avatars(id) on delete cascade,
  avatar_b uuid not null references avatars(id) on delete cascade,
  status text not null default 'contact',
  score int not null default 0,
  is_following boolean not null default false,
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (avatar_a, avatar_b)
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  sender_avatar_id uuid not null references avatars(id) on delete cascade,
  receiver_avatar_id uuid not null references avatars(id) on delete cascade,
  activity_slug text not null references activities(slug),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists date_plans (
  id uuid primary key default gen_random_uuid(),
  initiator_avatar_id uuid not null references avatars(id) on delete cascade,
  target_avatar_id uuid not null references avatars(id) on delete cascade,
  venue_kind text not null,
  venue_label text not null,
  activity_slug text not null references activities(slug),
  status text not null default 'proposed',
  scheduled_moment text not null,
  note text not null default '',
  bridge_to_real_life text not null default '',
  created_at timestamptz not null default now()
);

-- ─── Messagerie ───────────────────────────────────────────────────────────────

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  location_slug text references locations(slug),
  created_at timestamptz not null default now()
);

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  avatar_id uuid not null references avatars(id) on delete cascade,
  primary key (conversation_id, avatar_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  avatar_id uuid not null references avatars(id) on delete cascade,
  body text not null,
  kind text not null default 'message',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── Rooms ────────────────────────────────────────────────────────────────────

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'public',
  code text unique not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null,
  location_slug text references locations(slug),
  member_count int not null default 1,
  max_members int not null default 20,
  description text not null default '',
  is_active boolean not null default true,
  expires_at timestamptz,   -- null = permanent, timestamptz = secret room TTL
  created_at timestamptz not null default now()
);

create table if not exists room_members (
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  avatar_name text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  body text not null,
  kind text not null default 'message',
  created_at timestamptz not null default now()
);

-- ─── Présence world ───────────────────────────────────────────────────────────

create table if not exists presence (
  avatar_id uuid primary key references avatars(id) on delete cascade,
  status text not null default 'online',
  location_slug text references locations(slug),
  updated_at timestamptz not null default now()
);

create table if not exists world_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_name text not null,
  location_slug text references locations(slug),
  action text not null default 'idle',
  mood int not null default 50,
  pos_x numeric(5,2) not null default 50,
  pos_y numeric(5,2) not null default 50,
  updated_at timestamptz not null default now()
);

-- ─── Notifications ────────────────────────────────────────────────────────────

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists advice_logs (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  category text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ─── Premium ──────────────────────────────────────────────────────────────────

create table if not exists user_premium (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null,
  expires_at timestamptz not null,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

-- ─── Modération ───────────────────────────────────────────────────────────────

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  reported_message_id uuid,   -- référence libre (messages ou room_messages)
  reason text not null,        -- 'spam' | 'harassment' | 'inappropriate' | 'other'
  details text not null default '',
  status text not null default 'pending',  -- 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  created_at timestamptz not null default now()
);

create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_user_id, blocked_user_id)
);

-- ─── Analytics ────────────────────────────────────────────────────────────────

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,          -- 'action_performed' | 'screen_viewed' | 'outing_done' | ...
  properties jsonb not null default '{}',
  platform text not null default 'mobile',  -- 'ios' | 'android' | 'web'
  app_version text,
  created_at timestamptz not null default now()
);

-- ─── Push tokens (Expo — utilisé par Cloudflare Worker) ─────────────────────

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'mobile',
  updated_at timestamptz not null default now(),
  unique (avatar_id)
);

-- ─── Index perf ───────────────────────────────────────────────────────────────

create index if not exists idx_action_logs_avatar on action_logs(avatar_id, created_at desc);
create index if not exists idx_messages_conv on messages(conversation_id, created_at asc);
create index if not exists idx_room_messages_room on room_messages(room_id, created_at asc);
create index if not exists idx_notifications_avatar on notifications(avatar_id, read_at, created_at desc);
create index if not exists idx_analytics_event_name on analytics_events(event_name, created_at desc);
create index if not exists idx_currencies_avatar on currencies(avatar_id, kind, created_at desc);
create index if not exists idx_events_avatar on events(avatar_id, created_at desc);
create index if not exists idx_studies_avatar on studies(avatar_id);
create index if not exists idx_world_presence_location on world_presence(location_slug, updated_at desc);
create index if not exists idx_push_tokens_avatar on push_tokens(avatar_id);

-- ─── RLS (Row Level Security) ─────────────────────────────────────────────────

alter table profiles enable row level security;
alter table avatars enable row level security;
alter table avatar_preferences enable row level security;
alter table avatar_stats enable row level security;
alter table action_logs enable row level security;
alter table transactions enable row level security;
alter table currencies enable row level security;
alter table inventory enable row level security;
alter table studies enable row level security;
alter table events enable row level security;
alter table relationships enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table advice_logs enable row level security;
alter table presence enable row level security;
alter table invitations enable row level security;
alter table date_plans enable row level security;
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table room_messages enable row level security;
alter table world_presence enable row level security;
alter table user_premium enable row level security;
alter table social_transfers enable row level security;
alter table active_boosts enable row level security;
alter table equipped_cosmetics enable row level security;
alter table reports enable row level security;
alter table blocks enable row level security;
alter table analytics_events enable row level security;
alter table push_tokens enable row level security;

-- Profils
create policy "profiles own row" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Avatars
create policy "avatars own row" on avatars
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Avatar preferences
create policy "avatar_preferences own row" on avatar_preferences
  for all using (
    exists (select 1 from avatars where avatars.id = avatar_preferences.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = avatar_preferences.avatar_id and avatars.user_id = auth.uid())
  );

-- Avatar stats
create policy "avatar_stats own row" on avatar_stats
  for all using (
    exists (select 1 from avatars where avatars.id = avatar_stats.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = avatar_stats.avatar_id and avatars.user_id = auth.uid())
  );

-- Action logs
create policy "action_logs own row" on action_logs
  for all using (
    exists (select 1 from avatars where avatars.id = action_logs.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = action_logs.avatar_id and avatars.user_id = auth.uid())
  );

-- Transactions
create policy "transactions own row" on transactions
  for all using (
    exists (select 1 from avatars where avatars.id = transactions.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = transactions.avatar_id and avatars.user_id = auth.uid())
  );

-- Currencies
create policy "currencies own row" on currencies
  for all using (
    exists (select 1 from avatars where avatars.id = currencies.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = currencies.avatar_id and avatars.user_id = auth.uid())
  );

-- Inventory
create policy "inventory own row" on inventory
  for all using (
    exists (select 1 from avatars where avatars.id = inventory.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = inventory.avatar_id and avatars.user_id = auth.uid())
  );

-- Studies
create policy "studies own row" on studies
  for all using (
    exists (select 1 from avatars where avatars.id = studies.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = studies.avatar_id and avatars.user_id = auth.uid())
  );

-- Events
create policy "events own row" on events
  for all using (
    exists (select 1 from avatars where avatars.id = events.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = events.avatar_id and avatars.user_id = auth.uid())
  );

-- Relationships
create policy "relationships visible to involved avatars" on relationships
  for all using (
    exists (select 1 from avatars where avatars.id = relationships.avatar_a and avatars.user_id = auth.uid())
    or exists (select 1 from avatars where avatars.id = relationships.avatar_b and avatars.user_id = auth.uid())
  );

-- Conversation members
create policy "conversation members own access" on conversation_members
  for all using (
    exists (select 1 from avatars where avatars.id = conversation_members.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = conversation_members.avatar_id and avatars.user_id = auth.uid())
  );

-- Messages
create policy "messages visible to members" on messages
  for all using (
    exists (
      select 1 from conversation_members
      join avatars on avatars.id = conversation_members.avatar_id
      where conversation_members.conversation_id = messages.conversation_id
        and avatars.user_id = auth.uid()
    )
  ) with check (
    exists (select 1 from avatars where avatars.id = messages.avatar_id and avatars.user_id = auth.uid())
  );

-- Notifications
create policy "notifications own row" on notifications
  for all using (
    exists (select 1 from avatars where avatars.id = notifications.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = notifications.avatar_id and avatars.user_id = auth.uid())
  );

-- Advice logs
create policy "advice_logs own row" on advice_logs
  for all using (
    exists (select 1 from avatars where avatars.id = advice_logs.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = advice_logs.avatar_id and avatars.user_id = auth.uid())
  );

-- Presence
create policy "presence own row" on presence
  for all using (
    exists (select 1 from avatars where avatars.id = presence.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = presence.avatar_id and avatars.user_id = auth.uid())
  );

-- Invitations
create policy "invitations visible to participants" on invitations
  for all using (
    exists (select 1 from avatars where avatars.id = invitations.sender_avatar_id and avatars.user_id = auth.uid())
    or exists (select 1 from avatars where avatars.id = invitations.receiver_avatar_id and avatars.user_id = auth.uid())
  );

-- Date plans
create policy "date_plans visible to participants" on date_plans
  for all using (
    exists (select 1 from avatars where avatars.id = date_plans.initiator_avatar_id and avatars.user_id = auth.uid())
    or exists (select 1 from avatars where avatars.id = date_plans.target_avatar_id and avatars.user_id = auth.uid())
  );

-- Rooms
create policy "rooms public read" on rooms
  for select using (kind = 'public' or kind = 'event' or owner_id = auth.uid());
create policy "rooms owner write" on rooms
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "room_members visible" on room_members
  for all using (user_id = auth.uid());
create policy "room_messages visible to members" on room_messages
  for all using (
    exists (select 1 from room_members where room_members.room_id = room_messages.room_id and room_members.user_id = auth.uid())
    or exists (select 1 from rooms where rooms.id = room_messages.room_id and rooms.kind = 'public')
  );

-- World presence
create policy "world_presence own row" on world_presence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "world_presence read all" on world_presence
  for select using (true);

-- Premium
create policy "user_premium own row" on user_premium
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Social transfers
create policy "social_transfers own row" on social_transfers
  for all using (
    exists (select 1 from avatars where avatars.id = social_transfers.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = social_transfers.avatar_id and avatars.user_id = auth.uid())
  );

-- Active boosts
create policy "active_boosts own row" on active_boosts
  for all using (
    exists (select 1 from avatars where avatars.id = active_boosts.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = active_boosts.avatar_id and avatars.user_id = auth.uid())
  );

-- Equipped cosmetics
create policy "equipped_cosmetics own row" on equipped_cosmetics
  for all using (
    exists (select 1 from avatars where avatars.id = equipped_cosmetics.avatar_id and avatars.user_id = auth.uid())
  ) with check (
    exists (select 1 from avatars where avatars.id = equipped_cosmetics.avatar_id and avatars.user_id = auth.uid())
  );

-- Reports (un user peut créer un report et voir les siens)
create policy "reports create" on reports
  for insert with check (auth.uid() = reporter_user_id);
create policy "reports own read" on reports
  for select using (auth.uid() = reporter_user_id);

-- Blocks
create policy "blocks own row" on blocks
  for all using (auth.uid() = blocker_user_id) with check (auth.uid() = blocker_user_id);

-- Analytics (insert uniquement depuis le client authentifié)
create policy "analytics insert" on analytics_events
  for insert with check (auth.uid() = user_id or user_id is null);
create policy "analytics own read" on analytics_events
  for select using (auth.uid() = user_id);

-- Push tokens
create policy "push_tokens own row" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Trigger : création automatique du profil à l'inscription ────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Trigger : updated_at auto ────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_avatars_updated_at on avatars;
create trigger set_avatars_updated_at
  before update on avatars
  for each row execute function public.set_updated_at();

drop trigger if exists set_studies_updated_at on studies;
create trigger set_studies_updated_at
  before update on studies
  for each row execute function public.set_updated_at();

-- ─── Seed data ────────────────────────────────────────────────────────────────

insert into neighborhoods (slug, name, vibe, lifestyle, cost_level) values
  ('central-district', 'Central District', 'dense et social', 'sorties, carriere, rencontres rapides', 'balanced'),
  ('riverside', 'Riverside', 'calme et sain', 'bien-etre, marche, respiration', 'accessible'),
  ('studio-heights', 'Studio Heights', 'creatif et premium', 'style, image, ambition et reseau', 'premium')
on conflict (slug) do nothing;

insert into locations (slug, neighborhood_slug, name, kind, summary, cost_hint, social_energy, capacity) values
  ('home', 'central-district', 'Home Suite', 'home', 'Base de recuperation et d''hygiene', 'gratuit', 0, 1),
  ('market', 'central-district', 'Fresh Market', 'food', 'Gerer ses repas et son budget sans fragiliser sa sante', 'economique', 10, 120),
  ('cafe', 'central-district', 'Social Cafe', 'social', 'Hub de conversation et de nouvelles rencontres', 'accessible', 70, 120),
  ('office', 'central-district', 'Focus Office', 'work', 'Lieu de travail et de progression sociale', 'productif', 20, 120),
  ('park', 'riverside', 'Riverside Park', 'public', 'Respirer, marcher et faire baisser le stress', 'gratuit', 30, 120),
  ('gym', 'riverside', 'Pulse Gym', 'wellness', 'Salle utile pour discipline et forme physique', 'moyen', 24, 80),
  ('restaurant', 'studio-heights', 'Maison Ember', 'food', 'Sorties plus premium et image sociale plus forte', 'premium', 55, 80),
  ('cinema', 'studio-heights', 'Luma Cinema', 'social', 'Sorties calmes a deux ou en petit groupe', 'moyen', 44, 90)
on conflict (slug) do nothing;

insert into jobs (slug, name, reward_coins, energy_cost, hunger_cost, stress_cost, discipline_reward, reputation_reward) values
  ('office-assistant', 'Assistant de bureau', 48, 18, 12, 8, 8, 3),
  ('support-tech', 'Support tech', 56, 20, 12, 10, 9, 4),
  ('creator-studio', 'Creator studio', 52, 16, 10, 7, 7, 5),
  ('cafe-host', 'Cafe host', 44, 15, 11, 5, 6, 4),
  ('wellness-guide', 'Wellness guide', 46, 14, 9, 4, 8, 4)
on conflict (slug) do nothing;

insert into activities (slug, name, kind, location_slug, summary, cost) values
  ('walk', 'Marche active', 'wellness', 'park', 'Marcher, souffler et relancer la forme', 0),
  ('gym-session', 'Session salle', 'wellness', 'gym', 'Discipline, forme et image personnelle', 14),
  ('coffee-meetup', 'Cafe a deux', 'social', 'cafe', 'Sortie legere pour ouvrir ou renforcer un lien', 10),
  ('restaurant-date', 'Diner au restaurant', 'romantic', 'restaurant', 'Sortie premium, sobre et relationnelle', 26),
  ('cinema-night', 'Cinema du soir', 'social', 'cinema', 'Moment calme utile pour l''humeur et la relation', 18),
  ('evening-walk', 'Balade du soir', 'solo', 'park', 'Sortie legere pour souffler et reconnecter avec soi', 0),
  ('group-outing', 'Sortie en groupe', 'social', 'cafe', 'Sortie de groupe utile pour la sociabilite', 16),
  ('party-night', 'Soiree festive', 'social', 'cinema', 'Sortie intense avec forte depense sociale et budgetaire', 38),
  ('solo-cafe', 'Cafe solo', 'solo', 'cafe', 'Moment discret pour souffler ou lire hors de chez soi', 8)
on conflict (slug) do nothing;
