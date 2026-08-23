-- join_crew_open : l'écran crews.tsx existant permet de rejoindre un crew
-- publiquement (pas seulement sur invitation officer). Ajouté en RPC pour
-- rester cohérent avec le verrou "insert direct interdit" posé dans
-- 20260823200000_crew_lifecycle.sql — sinon la migration précédente cassait
-- purement et simplement la création/adhésion existante côté client
-- (lib/crews.ts createCrew/joinCrew faisaient un insert direct).
create or replace function public.join_crew_open(p_crew_id uuid)
returns public.crew_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_row public.crew_members;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if exists (select 1 from public.crew_members where crew_id = p_crew_id and user_id = auth.uid()) then
    raise exception 'Déjà membre';
  end if;

  select coalesce(username, 'Membre') into v_name from public.profiles where id = auth.uid();

  insert into public.crew_members (crew_id, user_id, player_name, role)
  values (p_crew_id, auth.uid(), v_name, 'recruit')
  returning * into v_row;

  update public.crews set member_count = member_count + 1 where id = p_crew_id;

  return v_row;
end;
$$;

grant execute on function public.join_crew_open(uuid) to authenticated;
