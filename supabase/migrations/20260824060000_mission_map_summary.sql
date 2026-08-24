-- RPC publique et sûre pour afficher les missions sur la Life Map : compteur
-- de participants agrégé (mission_participations est RLS own-row-only, un
-- simple select client ne peut pas compter les autres joueurs) + nom de
-- quartier, sans jamais exposer une position privée ou l'identité des
-- participants.
create or replace function public.mission_map_summary(p_season_id uuid)
returns table (
  mission_id uuid, participant_count bigint
)
language sql
security definer
set search_path = public
as $$
  select md.id, count(mp.id) filter (where mp.status not in ('abandoned','rejected','expired'))
  from public.mission_definitions md
  left join public.mission_participations mp on mp.mission_id = md.id
  where md.season_id = p_season_id
  group by md.id;
$$;
grant execute on function public.mission_map_summary(uuid) to authenticated, anon;
