-- ═══════════════════════════════════════════════════════════════════════
-- SAISON 1 — moteur RPC (toutes les transitions d'état côté serveur)
-- ═══════════════════════════════════════════════════════════════════════

-- ── Choix de quartier — cooldown 24h, historique minimal ──────────────────
create or replace function public.choose_district(p_district_id uuid)
returns public.player_districts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.player_districts;
  v_row public.player_districts;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  if not exists (select 1 from public.districts where id = p_district_id) then
    raise exception 'Quartier invalide';
  end if;

  select * into v_current from public.player_districts where user_id = auth.uid();

  if v_current.user_id is not null then
    if v_current.district_id = p_district_id then
      return v_current;
    end if;
    if v_current.last_change_at > now() - interval '24 hours' then
      raise exception 'Change de quartier trop récemment — réessaie plus tard';
    end if;
  end if;

  insert into public.player_districts (user_id, district_id, joined_at, change_count, last_change_at)
  values (auth.uid(), p_district_id, now(), coalesce(v_current.change_count, 0) + (case when v_current.user_id is null then 0 else 1 end), now())
  on conflict (user_id) do update set
    district_id = excluded.district_id,
    change_count = public.player_districts.change_count + 1,
    last_change_at = now()
  returning * into v_row;

  insert into public.player_district_history (user_id, district_id) values (auth.uid(), p_district_id);

  return v_row;
end;
$$;
grant execute on function public.choose_district(uuid) to authenticated;

-- ── join_mission : disponible -> rejointe ──────────────────────────────
create or replace function public.join_mission(p_mission_id uuid)
returns public.mission_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.mission_definitions;
  v_row public.mission_participations;
  v_count int;
  v_recent_validated timestamptz;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  select * into v_mission from public.mission_definitions where id = p_mission_id;
  if v_mission.id is null or v_mission.status <> 'available' then
    raise exception 'Mission indisponible';
  end if;
  if now() < v_mission.starts_at or now() > v_mission.ends_at then
    raise exception 'Mission hors période';
  end if;

  if v_mission.capacity is not null then
    select count(*) into v_count from public.mission_participations
      where mission_id = p_mission_id and status not in ('abandoned','rejected','expired');
    if v_count >= v_mission.capacity then
      raise exception 'Mission complète';
    end if;
  end if;

  select * into v_row from public.mission_participations
    where mission_id = p_mission_id and user_id = auth.uid();
  if v_row.id is not null then
    if v_row.status in ('validated','rewarded') and not v_mission.repeatable then
      raise exception 'Mission déjà accomplie';
    end if;
    if v_row.status = 'abandoned' or v_row.status = 'expired' then
      update public.mission_participations
        set status = 'joined', joined_at = now(), progress = '{}'::jsonb, validated_at = null
        where id = v_row.id
        returning * into v_row;
    end if;
    return v_row;
  end if;

  if v_mission.cooldown_hours > 0 then
    select max(rewarded_at) into v_recent_validated from public.mission_participations
      where mission_id = p_mission_id and user_id = auth.uid() and status = 'rewarded';
    if v_recent_validated is not null and v_recent_validated > now() - (v_mission.cooldown_hours || ' hours')::interval then
      raise exception 'Cooldown de mission actif';
    end if;
  end if;

  insert into public.mission_participations (mission_id, user_id, status)
  values (p_mission_id, auth.uid(), 'joined')
  returning * into v_row;

  return v_row;
end;
$$;
grant execute on function public.join_mission(uuid) to authenticated;

-- ── validate_mission : vérifie zone/fenêtre/statut, jamais confiance
-- aveugle dans une donnée client. Niveau de confiance variable selon le
-- type de mission (voir commentaires dans chaque branche).
create or replace function public.validate_mission(
  p_mission_id uuid, p_lat double precision default null, p_lng double precision default null,
  p_progress jsonb default null
)
returns public.mission_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.mission_definitions;
  v_part public.mission_participations;
  v_dist_m double precision;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  select * into v_mission from public.mission_definitions where id = p_mission_id;
  if v_mission.id is null then raise exception 'Mission introuvable'; end if;

  select * into v_part from public.mission_participations
    where mission_id = p_mission_id and user_id = auth.uid() for update;
  if v_part.id is null or v_part.status not in ('joined','in_progress') then
    raise exception 'Mission non rejointe ou déjà validée';
  end if;
  if now() > v_mission.ends_at then
    update public.mission_participations set status = 'expired' where id = v_part.id returning * into v_part;
    raise exception 'Mission expirée';
  end if;

  if v_mission.category = 'explore' then
    -- Confiance : moyenne. Zone large (500m) autour du point public de la
    -- mission, une seule validation possible (contrainte unique
    -- mission_id+user_id + statut), aucune coordonnée exacte conservée
    -- au-delà de ce calcul de distance.
    if p_lat is null or p_lng is null then raise exception 'Position requise'; end if;
    if v_mission.approx_lat is not null then
      v_dist_m := 111320 * sqrt(
        power(p_lat - v_mission.approx_lat, 2) +
        power((p_lng - v_mission.approx_lng) * cos(radians(v_mission.approx_lat)), 2)
      );
      if v_dist_m > 500 then
        raise exception 'Hors de la zone de la mission';
      end if;
    end if;

  elsif v_mission.category = 'move' then
    -- Confiance : FAIBLE — la distance/durée vient du client (GPS mobile,
    -- falsifiable trivialement). MVP volontairement prudent : on applique
    -- le même garde-fou de vitesse plausible que claim_travel_reward
    -- (<=2.8 m/s) et on PLAFONNE la récompense côté claim, jamais calculée
    -- depuis une valeur envoyée telle quelle.
    if p_progress is null or (p_progress->>'distance_m') is null or (p_progress->>'duration_s') is null then
      raise exception 'Progression manquante';
    end if;
    if (p_progress->>'distance_m')::numeric / greatest((p_progress->>'duration_s')::numeric, 1) > 2.8 then
      raise exception 'Vitesse implausible — validation refusée';
    end if;
    if (p_progress->>'distance_m')::numeric < 300 then
      raise exception 'Distance insuffisante';
    end if;

  elsif v_mission.category = 'social' then
    -- Confiance : haute — réutilise le flux event déjà validé serveur
    -- (checkin_flash_event géo-vérifié). On exige juste que l'event lié
    -- soit bien check-in par ce joueur.
    if v_mission.linked_event_id is null then raise exception 'Mission mal configurée'; end if;
    if not exists (
      select 1 from public.flash_event_participants
      where event_id = v_mission.linked_event_id and user_id = auth.uid() and status = 'checked_in'
    ) then
      raise exception 'Check-in event requis avant validation';
    end if;
  end if;

  update public.mission_participations
    set status = 'validated', validated_at = now(),
        progress = coalesce(p_progress, progress)
    where id = v_part.id
    returning * into v_part;

  return v_part;
end;
$$;
grant execute on function public.validate_mission(uuid, double precision, double precision, jsonb) to authenticated;

-- ── claim_mission_reward : validée -> récompensée, idempotent ─────────────
create or replace function public.claim_mission_reward(p_mission_id uuid)
returns public.season_reward_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.mission_definitions;
  v_part public.mission_participations;
  v_ledger public.season_reward_ledger;
  v_idem text;
  v_my_crew uuid;
  v_district_count int;
  v_badge_code text;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  select * into v_mission from public.mission_definitions where id = p_mission_id;
  select * into v_part from public.mission_participations
    where mission_id = p_mission_id and user_id = auth.uid() for update;

  if v_part.id is null or v_part.status <> 'validated' then
    raise exception 'Validation requise avant réclamation';
  end if;

  v_idem := 'mission:' || p_mission_id::text || ':' || auth.uid()::text;

  select crew_id into v_my_crew from public.crew_members where user_id = auth.uid() limit 1;

  insert into public.season_reward_ledger
    (user_id, source, source_id, xp, money, reputation, district_contribution, crew_contribution, idempotency_key)
  values (
    auth.uid(), 'mission', p_mission_id,
    coalesce(v_mission.reward_xp, 0), coalesce(v_mission.reward_money, 0), coalesce(v_mission.reward_reputation, 0),
    coalesce(v_mission.reward_xp, 0), case when v_my_crew is not null then coalesce(v_mission.reward_xp, 0) / 2 else 0 end,
    v_idem
  )
  on conflict (idempotency_key) do nothing;

  select * into v_ledger from public.season_reward_ledger where idempotency_key = v_idem;

  update public.mission_participations
    set status = 'rewarded', rewarded_at = now()
    where id = v_part.id and status = 'validated';

  if v_mission.district_id is not null then
    insert into public.district_progress (district_id, season_id, xp, missions_completed, weekly_progress)
    values (v_mission.district_id, v_mission.season_id, coalesce(v_mission.reward_xp,0), 1, coalesce(v_mission.reward_xp,0))
    on conflict (district_id, season_id) do update set
      xp = public.district_progress.xp + coalesce(v_mission.reward_xp,0),
      missions_completed = public.district_progress.missions_completed + 1,
      weekly_progress = public.district_progress.weekly_progress + coalesce(v_mission.reward_xp,0),
      level = greatest(1, ((public.district_progress.xp + coalesce(v_mission.reward_xp,0)) / 2000) + 1),
      updated_at = now();
  end if;

  -- Badges — attribution serveur uniquement, idempotente (unique user+badge).
  insert into public.badge_awards (user_id, badge_id)
    select auth.uid(), id from public.badges where code = 'first-step'
    on conflict do nothing;

  if v_mission.category = 'explore' then
    insert into public.badge_awards (user_id, badge_id)
      select auth.uid(), id from public.badges where code = 'explorer-tls'
      on conflict do nothing;
  end if;

  if v_my_crew is not null then
    insert into public.badge_awards (user_id, badge_id)
      select auth.uid(), id from public.badges where code = 'team-spirit'
      on conflict do nothing;
  end if;

  if v_mission.district_id is not null then
    select count(*) into v_district_count from public.mission_participations mp
      join public.mission_definitions md on md.id = mp.mission_id
      where mp.user_id = auth.uid() and mp.status = 'rewarded' and md.district_id = v_mission.district_id;
    if v_district_count >= 5 then
      insert into public.badge_awards (user_id, badge_id)
        select auth.uid(), id from public.badges where code = 'local-regular'
        on conflict do nothing;
    end if;
  end if;

  return v_ledger;
end;
$$;
grant execute on function public.claim_mission_reward(uuid) to authenticated;

-- ── abandon_mission ────────────────────────────────────────────────────
create or replace function public.abandon_mission(p_mission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mission_participations
    set status = 'abandoned'
    where mission_id = p_mission_id and user_id = auth.uid() and status in ('joined','in_progress');
end;
$$;
grant execute on function public.abandon_mission(uuid) to authenticated;
