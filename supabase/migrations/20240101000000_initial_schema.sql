-- Migration 001 — Schema initial (baseline)
-- Correspond à la v1 deployée avant le sprint infrastructure.
-- Si tu pars de zéro, utilise supabase/schema.sql directement.

create extension if not exists "pgcrypto";

create table if not exists neighborhoods (
  slug text primary key,
  name text not null,
  vibe text not null,
  lifestyle text not null,
  cost_level text not null default 'balanced'
);

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

create table if not exists activities (
  slug text primary key,
  name text not null,
  kind text not null,
  location_slug text not null references locations(slug),
  summary text not null,
  cost int not null default 0
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  bio text,
  created_at timestamptz not null default now()
);

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

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  kind text not null,
  amount int not null,
  description text not null,
  created_at timestamptz not null default now()
);

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

create table if not exists presence (
  avatar_id uuid primary key references avatars(id) on delete cascade,
  status text not null default 'online',
  location_slug text references locations(slug),
  updated_at timestamptz not null default now()
);

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

create table if not exists user_premium (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null,
  expires_at timestamptz not null,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

create table if not exists social_transfers (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references avatars(id) on delete cascade,
  to_resident_id text,
  amount int not null,
  description text not null default '',
  created_at timestamptz not null default now()
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
