-- Correctifs trouvés par la revue de sécurité automatique juste après le
-- commit précédent, corrigés avant tout usage réel :
--   1. p_destination_verified était accepté tel quel du client — un joueur
--      pouvait forcer le bonus "sécurité" en envoyant true sans que ce soit
--      vrai. Ignoré désormais : on relit location_verified directement sur
--      life_map_players pour la vraie cible.
--   2. Aucune limite de fréquence : rien n'empêchait d'appeler la RPC en
--      boucle avec le même couple distance/durée plausible sans jamais
--      avoir bougé. Cooldown de 5 min entre deux trajets crédités + plafond
--      de 300 XP/24h par joueur.
--   3. Aucune vérification que la cible n'est pas soi-même.
create or replace function public.claim_travel_reward(
  p_target_id uuid, p_distance_m integer, p_duration_s integer, p_destination_verified boolean default false
)
returns public.travel_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_speed_ms double precision;
  v_xp int;
  v_row public.travel_log;
  v_verified boolean;
  v_recent_count int;
  v_daily_xp int;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if p_target_id is null or p_target_id = auth.uid() then
    raise exception 'Cible invalide';
  end if;
  if p_distance_m < 80 then
    raise exception 'Trajet trop court pour être récompensé';
  end if;
  if p_duration_s <= 0 then
    raise exception 'Durée invalide';
  end if;

  v_speed_ms := p_distance_m::double precision / p_duration_s;
  if v_speed_ms > 2.8 then
    raise exception 'Trajet non crédité (vitesse implausible)';
  end if;

  select count(*) into v_recent_count
  from public.travel_log
  where user_id = auth.uid() and created_at > now() - interval '5 minutes';
  if v_recent_count > 0 then
    raise exception 'Trop tôt pour un nouveau trajet';
  end if;

  select coalesce(sum(xp_awarded), 0) into v_daily_xp
  from public.travel_log
  where user_id = auth.uid() and created_at > now() - interval '24 hours';
  if v_daily_xp >= 300 then
    raise exception 'Plafond quotidien de trajet atteint';
  end if;

  select location_verified into v_verified
  from public.life_map_players
  where user_id = p_target_id;
  v_verified := coalesce(v_verified, false);

  v_xp := least(100, p_distance_m / 50);
  v_xp := least(v_xp, 300 - v_daily_xp);
  if v_verified then
    v_xp := v_xp + (v_xp / 5);
  end if;

  insert into public.travel_log (user_id, target_id, distance_m, duration_s, xp_awarded, safety_bonus)
  values (auth.uid(), p_target_id, p_distance_m, p_duration_s, v_xp, v_verified)
  returning * into v_row;

  return v_row;
end;
$$;
