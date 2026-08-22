-- Durcissement RLS crews : les policies update/delete d'origine vérifiaient
-- seulement "auth.uid() is not null" — n'importe quel joueur connecté pouvait
-- modifier/supprimer les membres, zones, guerres et alliances de N'IMPORTE
-- QUEL crew, pas juste le sien (IDOR). Trouvé par revue de sécurité auto,
-- corrigé avant toute donnée réelle (base vide suite à l'incident du 22/08).

-- Helper : l'utilisateur courant est-il founder/officer de ce crew ?
create or replace function public.is_crew_officer(p_crew_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.crew_members m
    where m.crew_id = p_crew_id
      and m.user_id = auth.uid()
      and m.role in ('founder', 'officer')
  );
$$;

grant execute on function public.is_crew_officer(uuid) to authenticated;

-- crew_members : quitter soi-même OK, sinon il faut être officer/founder du crew
drop policy if exists "crew_members_delete" on public.crew_members;
create policy "crew_members_delete" on public.crew_members
  for delete using (
    user_id = auth.uid()
    or public.is_crew_officer(crew_id)
  );

drop policy if exists "crew_members_update" on public.crew_members;
create policy "crew_members_update" on public.crew_members
  for update using (
    user_id = auth.uid()
    or public.is_crew_officer(crew_id)
  );

-- crews : seul un officer/founder du crew concerné peut le modifier
drop policy if exists "crews_update" on public.crews;
create policy "crews_update" on public.crews
  for update using (public.is_crew_officer(id));

-- crew_zones : idem, scope au crew propriétaire de la zone
drop policy if exists "crew_zones_update" on public.crew_zones;
create policy "crew_zones_update" on public.crew_zones
  for update using (public.is_crew_officer(crew_id));

-- crew_wars : un officer de l'un des deux crews impliqués peut mettre à jour
drop policy if exists "crew_wars_update" on public.crew_wars;
create policy "crew_wars_update" on public.crew_wars
  for update using (
    public.is_crew_officer(crew_a_id)
    or public.is_crew_officer(crew_b_id)
  );

-- crew_alliances : idem
drop policy if exists "crew_alliances_update" on public.crew_alliances;
create policy "crew_alliances_update" on public.crew_alliances
  for update using (
    public.is_crew_officer(crew_a_id)
    or public.is_crew_officer(crew_b_id)
  );

-- crew_leader_votes : on ne peut retirer que son propre vote
drop policy if exists "crew_votes_delete" on public.crew_leader_votes;
create policy "crew_votes_delete" on public.crew_leader_votes
  for delete using (
    exists (
      select 1 from public.crew_members m
      where m.crew_id = crew_leader_votes.crew_id
        and m.user_id = auth.uid()
        and m.player_name = crew_leader_votes.voter_name
    )
  );

-- reports_admin (safety.sql) : la vue n'avait aucune restriction propre,
-- exposant tous les signalements à n'importe quel utilisateur authentifié
-- (contournement de la policy RLS "service_role only" sur `reports`).
alter view public.reports_admin set (security_invoker = true);
revoke all on public.reports_admin from anon, authenticated;
grant select on public.reports_admin to service_role;
