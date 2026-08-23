-- Trouvé pendant la revalidation post-lockdown demandée par Kenams (point 8
-- de sa dernière consigne) : lib/crews.ts:transferLeader faisait encore un
-- .update({role:"founder"}) direct sur crew_members. La policy
-- crew_members_update autorise "user_id = auth.uid() OR is_crew_officer" —
-- donc n'importe quel membre pouvait appeler transferLeader(crewId, X, sonPropreNom)
-- et s'auto-promouvoir founder, contournant totalement la protection déjà
-- posée dans set_crew_member_role ("le rôle founder ne peut jamais être
-- réassigné par cette voie"). Faille de prise de contrôle de crew réelle et
-- exploitable depuis l'écran crews.tsx (bouton "Transférer le leadership").
--
-- Fix en deux temps :
--   1. Un trigger bloque désormais TOUTE UPDATE qui fixe role='founder',
--      sauf si un flag de session est explicitement posé par la RPC dédiée.
--   2. Nouvelle RPC transfer_crew_leadership : seul le founder actuel peut
--      l'appeler, la cible doit être un membre existant du même crew, jamais
--      soi-même.

create or replace function public.crew_members_block_self_founder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'founder' and old.role is distinct from 'founder'
     and coalesce(current_setting('mylife.allow_founder_transfer', true), '') <> 'true' then
    raise exception 'Transfert de leadership interdit par cette voie';
  end if;
  return new;
end;
$$;

drop trigger if exists crew_members_block_self_founder_trg on public.crew_members;
create trigger crew_members_block_self_founder_trg
before update on public.crew_members
for each row execute function public.crew_members_block_self_founder();

create or replace function public.transfer_crew_leadership(p_crew_id uuid, p_new_founder_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if p_new_founder_user_id is null or p_new_founder_user_id = auth.uid() then
    raise exception 'Cible invalide';
  end if;

  select role into v_caller_role from public.crew_members
    where crew_id = p_crew_id and user_id = auth.uid();
  if v_caller_role is distinct from 'founder' then
    raise exception 'Seul le founder actuel peut transférer le leadership';
  end if;

  if not exists (
    select 1 from public.crew_members where crew_id = p_crew_id and user_id = p_new_founder_user_id
  ) then
    raise exception 'Ce joueur n''est pas dans le crew';
  end if;

  perform set_config('mylife.allow_founder_transfer', 'true', true);
  update public.crew_members set role = 'officer' where crew_id = p_crew_id and user_id = auth.uid();
  update public.crew_members set role = 'founder' where crew_id = p_crew_id and user_id = p_new_founder_user_id;
  perform set_config('mylife.allow_founder_transfer', 'false', true);

  update public.crews set founder = (
    select player_name from public.crew_members where crew_id = p_crew_id and user_id = p_new_founder_user_id
  ) where id = p_crew_id;
end;
$$;

grant execute on function public.transfer_crew_leadership(uuid, uuid) to authenticated;

-- Défense en profondeur : crew_wars était grand ouvert en INSERT/UPDATE/DELETE
-- pour authenticated (n'importe qui pouvait fabriquer ou supprimer des
-- guerres de territoire). La création automatique de guerre
-- (checkAndTriggerWars côté client) est de toute façon déjà cassée depuis le
-- verrouillage de flash_events plus tôt — fonctionnalité à reconstruire en
-- RPC plus tard, pas urgente. On verrouille en attendant.
revoke insert, update, delete on public.crew_wars from authenticated;
