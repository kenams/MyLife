-- ═══════════════════════════════════════════════════════════════════════
-- SAISON 1 — Classements (calculés à la volée, jamais stockés dénormalisés)
-- Exclut QA/NPC/démo. Basé sur les récompenses réelles du ledger, jamais
-- sur les Feelings/popularité.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.leaderboard_players(p_season_id uuid, p_period text default 'season', p_limit int default 50, p_offset int default 0)
returns table (rank bigint, user_id uuid, display_name text, score bigint)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by sum(l.xp) desc) as rank,
    l.user_id,
    coalesce(lmp.display_name, 'Joueur') as display_name,
    sum(l.xp)::bigint as score
  from public.season_reward_ledger l
  join public.mission_definitions md on md.id = l.source_id and l.source = 'mission'
  left join public.life_map_players lmp on lmp.user_id = l.user_id
  where md.season_id = p_season_id
    and not exists (select 1 from public.qa_test_accounts qa where qa.user_id = l.user_id)
    and l.created_at > case when p_period = 'week' then now() - interval '7 days' else '-infinity'::timestamptz end
  group by l.user_id, lmp.display_name
  order by score desc
  limit p_limit offset p_offset;
$$;
grant execute on function public.leaderboard_players(uuid, text, int, int) to authenticated, anon;

create or replace function public.leaderboard_districts(p_season_id uuid)
returns table (rank bigint, district_id uuid, district_name text, xp int, level int)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by dp.xp desc) as rank,
    dp.district_id, d.name as district_name, dp.xp, dp.level
  from public.district_progress dp
  join public.districts d on d.id = dp.district_id
  where dp.season_id = p_season_id
  order by dp.xp desc;
$$;
grant execute on function public.leaderboard_districts(uuid) to authenticated, anon;

create or replace function public.leaderboard_crews(p_season_id uuid, p_limit int default 50)
returns table (rank bigint, crew_id uuid, crew_name text, crew_tag text, score bigint)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by sum(l.crew_contribution) desc) as rank,
    cm.crew_id, c.name as crew_name, c.tag as crew_tag,
    sum(l.crew_contribution)::bigint as score
  from public.season_reward_ledger l
  join public.mission_definitions md on md.id = l.source_id and l.source = 'mission'
  join public.crew_members cm on cm.user_id = l.user_id
  join public.crews c on c.id = cm.crew_id
  where md.season_id = p_season_id
    and not exists (select 1 from public.qa_test_accounts qa where qa.user_id = l.user_id)
    and l.crew_contribution > 0
  group by cm.crew_id, c.name, c.tag
  order by score desc
  limit p_limit;
$$;
grant execute on function public.leaderboard_crews(uuid, int) to authenticated, anon;
