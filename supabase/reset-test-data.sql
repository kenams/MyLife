-- MyLife test reset
-- Destructive: clears all users, avatars, chats, rooms, notifications, presence,
-- economy/social/game progress data and Supabase Auth accounts.
--
-- Keeps reference/world tables:
-- - public.neighborhoods
-- - public.locations
-- - public.jobs
-- - public.activities
--
-- Run this in Supabase Dashboard > SQL Editor for the test project only.

begin;

do $$
declare
  reset_tables text[] := array[
    'messages',
    'conversation_members',
    'conversations',
    'room_messages',
    'room_members',
    'rooms',
    'world_presence',
    'presence',
    'notifications',
    'advice_logs',
    'reports',
    'blocks',
    'analytics_events',
    'push_tokens',
    'user_premium',
    'avatar_preferences',
    'avatar_stats',
    'action_logs',
    'transactions',
    'currencies',
    'social_transfers',
    'inventory',
    'active_boosts',
    'equipped_cosmetics',
    'studies',
    'events',
    'relationships',
    'invitations',
    'date_plans',
    'avatars',
    'profiles'
  ];
  table_list text;
begin
  select string_agg(format('%I.%I', table_schema, table_name), ', ')
    into table_list
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
    and table_name = any(reset_tables);

  if table_list is not null then
    execute 'truncate table ' || table_list || ' restart identity cascade';
  end if;
end $$;

delete from auth.users;

commit;

-- Verification: all these counts should be 0 after the reset.
select 'auth.users' as table_name, count(*) as row_count from auth.users
union all select 'public.profiles', count(*) from public.profiles
union all select 'public.avatars', count(*) from public.avatars
union all select 'public.conversations', count(*) from public.conversations
union all select 'public.messages', count(*) from public.messages
union all select 'public.rooms', count(*) from public.rooms
union all select 'public.room_messages', count(*) from public.room_messages
union all select 'public.notifications', count(*) from public.notifications
union all select 'public.presence', count(*) from public.presence
union all select 'public.world_presence', count(*) from public.world_presence
order by table_name;
