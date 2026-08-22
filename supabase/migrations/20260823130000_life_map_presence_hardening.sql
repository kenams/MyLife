-- Présence réelle + réconciliation d'un schema drift constaté en base live.
--
-- 1) is_npc / crew_color / crew_tag / crew_cooldown_until existent déjà sur
--    le projet Supabase (ajoutés hors migration, probablement via le
--    dashboard SQL editor) mais n'étaient tracés dans aucun fichier ici —
--    exactement le type de dérive schéma/git qui a compliqué le diagnostic
--    de l'incident du 22/08. On les rend idempotents et versionnés.
-- 2) La policy RLS "Visible si pas ghost" ne faisait AUCUNE distinction
--    entre les statuts : le statut "taken" est affiché dans l'UI comme
--    "Amis et crew seulement" (STATUS_CONFIG.taken.desc) mais n'importe
--    quel utilisateur authentifié pouvait le lire — une fausse promesse de
--    confidentialité. Corrigé : "taken" n'est visible que par soi-même et
--    les membres du même crew (table crew_members, déjà réelle).
-- 3) Aucune expiration : un joueur qui ferme l'app sans repasser Ghost
--    restait affiché indéfiniment. Ajout d'une fenêtre de fraîcheur
--    (5 min) appliquée par la RLS elle-même, pas seulement côté client.

alter table public.life_map_players add column if not exists is_npc boolean not null default false;
alter table public.life_map_players add column if not exists crew_color text;
alter table public.life_map_players add column if not exists crew_tag text;
alter table public.life_map_players add column if not exists crew_cooldown_until timestamptz;

create index if not exists life_map_players_status_updated_idx
  on public.life_map_players (status, updated_at desc);

drop policy if exists "Visible si pas ghost" on public.life_map_players;

-- NB (correctif appliqué en base le 23/08 après une régression réelle
-- constatée par test) : le `user_id = auth.uid()` doit être une branche OR
-- de tête, jamais imbriqué seulement dans le cas "taken". Postgres exige
-- qu'une ligne modifiée par UPDATE reste visible à sa propre policy SELECT
-- même sans RETURNING/WITH CHECK explicite — sans cette branche, un joueur
-- ne peut plus jamais passer sa propre ligne en statut 'ghost' (l'UPDATE
-- échoue en 42501 car la ligne résultante ne satisferait plus la policy
-- SELECT). Ça a cassé le bouton Ghost pour tout le monde jusqu'au fix.
create policy "Visible si actif, frais et autorisé"
  on public.life_map_players for select
  using (
    user_id = auth.uid()
    or (
      status != 'ghost'
      and updated_at > now() - interval '5 minutes'
      and (
        status != 'taken'
        or exists (
          select 1
          from public.crew_members me
          join public.crew_members them on them.crew_id = me.crew_id
          where me.user_id = auth.uid()
            and them.user_id = life_map_players.user_id
        )
      )
    )
  );

-- players_nearby() doit respecter la même règle de fraîcheur + visibilité crew
create or replace function public.players_nearby(
  ref_lat double precision,
  ref_lng double precision,
  radius_km double precision default 5
)
returns setof public.life_map_players
language sql stable
as $$
  select *
  from public.life_map_players
  where status != 'ghost'
    and updated_at > now() - interval '5 minutes'
    and (
      status != 'taken'
      or user_id = auth.uid()
      or exists (
        select 1
        from public.crew_members me
        join public.crew_members them on them.crew_id = me.crew_id
        where me.user_id = auth.uid()
          and them.user_id = life_map_players.user_id
      )
    )
    and st_dwithin(
      st_point(lng, lat)::geography,
      st_point(ref_lng, ref_lat)::geography,
      radius_km * 1000
    )
  order by st_distance(
    st_point(lng, lat)::geography,
    st_point(ref_lng, ref_lat)::geography
  );
$$;
