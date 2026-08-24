-- Trouvé pendant l'audit de dérive de schéma : bastion_checkins et
-- bastion_takeover_events étaient grandes ouvertes en écriture pour
-- anon ET authenticated. La logique de cooldown/récompense de
-- bastionCheckin() vivait entièrement côté client (lib/crews.ts) — un
-- appel direct pouvait injecter n'importe quel bl_earned, ignorer le
-- cooldown 24h, ou vider la trésorerie d'un crew sans jamais passer par
-- le check "reward > 0 && treasury < reward".
create or replace function public.bastion_checkin(p_zone_id uuid, p_crew_id uuid)
returns public.bastion_checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_recent timestamptz;
  v_reward int;
  v_treasury int;
  v_row public.bastion_checkins;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  select coalesce(display_name, 'Joueur') into v_name from public.life_map_players where user_id = auth.uid();

  select checked_in_at into v_recent from public.bastion_checkins
    where zone_id = p_zone_id and player_name = v_name
    order by checked_in_at desc limit 1;
  if v_recent is not null and v_recent > now() - interval '24 hours' then
    raise exception 'Déjà check-in aujourd''hui';
  end if;

  select visitor_reward, treasury into v_reward, v_treasury from public.crews where id = p_crew_id;
  v_reward := coalesce(v_reward, 0);
  v_treasury := coalesce(v_treasury, 0);
  if v_reward > 0 and v_treasury < v_reward then
    raise exception 'Trésorerie insuffisante';
  end if;

  insert into public.bastion_checkins (zone_id, player_name, bl_earned)
  values (p_zone_id, v_name, v_reward)
  returning * into v_row;

  if v_reward > 0 then
    update public.crews set treasury = treasury - v_reward where id = p_crew_id;
  end if;

  return v_row;
end;
$$;
grant execute on function public.bastion_checkin(uuid, uuid) to authenticated;

revoke insert, update, delete on public.bastion_checkins from anon, authenticated;
revoke insert, update, delete on public.bastion_takeover_events from anon;
-- L'insertion d'événement de prise de bastion reste appelée directement par
-- resolveSiege() côté client (broadcast informatif, pas économique) —
-- restreinte à authenticated en attendant une RPC dédiée à resolveSiege.
