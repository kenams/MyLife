-- Fix (trouvé Phase 7) : leaderboard_players ne comptait que les XP dont
-- source='mission' (jointure sur mission_definitions), donc tout XP venant
-- des défis quotidiens (source='daily_challenge') ou d'une future source
-- (badge bonus, etc.) était invisible au classement alors qu'il compte bien
-- dans les totaux personnels (fetchMySeasonTotals lit tout le ledger).
-- Vérifié : un compte QA avec 20 XP de défi quotidien et 0 XP de mission
-- claimée sortait avec un classement vide.
-- Fix : filtrer par fenêtre temporelle de la saison (season_reward_ledger
-- n'a pas de season_id, mais l'attribution par date de saison est fiable
-- puisqu'une seule saison est active à la fois) au lieu de la jointure
-- mission_definitions.
create or replace function public.leaderboard_players(
  p_season_id uuid, p_period text default 'season', p_limit int default 50, p_offset int default 0
)
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
  join public.seasons s on s.id = p_season_id
  left join public.life_map_players lmp on lmp.user_id = l.user_id
  where l.created_at >= s.starts_at
    and l.created_at <= s.ends_at
    and not exists (select 1 from public.qa_test_accounts qa where qa.user_id = l.user_id)
    and l.created_at > case when p_period = 'week' then now() - interval '7 days' else '-infinity'::timestamptz end
  group by l.user_id, lmp.display_name
  order by score desc
  limit p_limit offset p_offset;
$$;
