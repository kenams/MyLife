-- Rattrapage complet publication Realtime — trouvé en comparant
-- pg_publication_tables entre le replay local (37/37 réussi) et la
-- production : 7 tables divergentes dans les deux sens.
--
-- 20260616211300_live_chat.sql contenait les ALTER PUBLICATION pour
-- dm_messages/quartier_messages EN COMMENTAIRE (jamais exécutés) — elles
-- ont été ajoutées directement en production à un moment non tracé, comme
-- bastion_takeover_events, life_map_players, crew_alliances,
-- mission_definitions et mission_participations (cette dernière paire déjà
-- rattrapée dans 20260824090000).
--
-- À l'inverse, 20260617182900_crews.sql AJOUTE bien crews/crew_members/
-- crew_zones/crew_wars à la publication — mais aucune des quatre n'était
-- présente en production (le ALTER PUBLICATION a dû échouer silencieusement
-- ou être défait plus tard). Restaurées en production également : sans ça,
-- les écrans crew (membres, zones, guerres) ne se mettaient jamais à jour
-- en direct pour les autres joueurs, seulement au reload.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='dm_messages') then
    alter publication supabase_realtime add table public.dm_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='quartier_messages') then
    alter publication supabase_realtime add table public.quartier_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='bastion_takeover_events') then
    alter publication supabase_realtime add table public.bastion_takeover_events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='life_map_players') then
    alter publication supabase_realtime add table public.life_map_players;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='crew_alliances') then
    alter publication supabase_realtime add table public.crew_alliances;
  end if;
end $$;
