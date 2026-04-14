create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  bio text,
  created_at timestamptz not null default now()
);

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

create table if not exists activities (
  slug text primary key,
  name text not null,
  kind text not null,
  location_slug text not null references locations(slug),
  summary text not null,
  cost int not null default 0
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  sender_avatar_id uuid not null references avatars(id) on delete cascade,
  receiver_avatar_id uuid not null references avatars(id) on delete cascade,
  activity_slug text not null references activities(slug),
  status text not null default 'pending',
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

alter table profiles enable row level security;
alter table avatars enable row level security;
alter table avatar_preferences enable row level security;
alter table avatar_stats enable row level security;
alter table action_logs enable row level security;
alter table transactions enable row level security;
alter table relationships enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table advice_logs enable row level security;
alter table presence enable row level security;
alter table invitations enable row level security;

create policy "profiles own row" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "avatars own row" on avatars for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "avatar_preferences own row" on avatar_preferences
for all using (
  exists (select 1 from avatars where avatars.id = avatar_preferences.avatar_id and avatars.user_id = auth.uid())
) with check (
  exists (select 1 from avatars where avatars.id = avatar_preferences.avatar_id and avatars.user_id = auth.uid())
);

create policy "avatar_stats own row" on avatar_stats
for all using (
  exists (select 1 from avatars where avatars.id = avatar_stats.avatar_id and avatars.user_id = auth.uid())
) with check (
  exists (select 1 from avatars where avatars.id = avatar_stats.avatar_id and avatars.user_id = auth.uid())
);

create policy "action_logs own row" on action_logs
for all using (
  exists (select 1 from avatars where avatars.id = action_logs.avatar_id and avatars.user_id = auth.uid())
) with check (
  exists (select 1 from avatars where avatars.id = action_logs.avatar_id and avatars.user_id = auth.uid())
);

create policy "transactions own row" on transactions
for all using (
  exists (select 1 from avatars where avatars.id = transactions.avatar_id and avatars.user_id = auth.uid())
) with check (
  exists (select 1 from avatars where avatars.id = transactions.avatar_id and avatars.user_id = auth.uid())
);

create policy "relationships visible to involved avatars" on relationships
for all using (
  exists (select 1 from avatars where avatars.id = relationships.avatar_a and avatars.user_id = auth.uid())
  or exists (select 1 from avatars where avatars.id = relationships.avatar_b and avatars.user_id = auth.uid())
);

create policy "conversation members own access" on conversation_members
for all using (
  exists (select 1 from avatars where avatars.id = conversation_members.avatar_id and avatars.user_id = auth.uid())
) with check (
  exists (select 1 from avatars where avatars.id = conversation_members.avatar_id and avatars.user_id = auth.uid())
);

create policy "messages visible to members" on messages
for all using (
  exists (
    select 1
    from conversation_members
    join avatars on avatars.id = conversation_members.avatar_id
    where conversation_members.conversation_id = messages.conversation_id
      and avatars.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from avatars where avatars.id = messages.avatar_id and avatars.user_id = auth.uid()
  )
);

create policy "notifications own row" on notifications
for all using (
  exists (select 1 from avatars where avatars.id = notifications.avatar_id and avatars.user_id = auth.uid())
) with check (
  exists (select 1 from avatars where avatars.id = notifications.avatar_id and avatars.user_id = auth.uid())
);

create policy "advice_logs own row" on advice_logs
for all using (
  exists (select 1 from avatars where avatars.id = advice_logs.avatar_id and avatars.user_id = auth.uid())
) with check (
  exists (select 1 from avatars where avatars.id = advice_logs.avatar_id and avatars.user_id = auth.uid())
);

create policy "presence own row" on presence
for all using (
  exists (select 1 from avatars where avatars.id = presence.avatar_id and avatars.user_id = auth.uid())
) with check (
  exists (select 1 from avatars where avatars.id = presence.avatar_id and avatars.user_id = auth.uid())
);

create policy "invitations visible to participants" on invitations
for all using (
  exists (select 1 from avatars where avatars.id = invitations.sender_avatar_id and avatars.user_id = auth.uid())
  or exists (select 1 from avatars where avatars.id = invitations.receiver_avatar_id and avatars.user_id = auth.uid())
);

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
  ('cinema-night', 'Cinema du soir', 'social', 'cinema', 'Moment calme utile pour l''humeur et la relation', 18)
on conflict (slug) do nothing;
