-- ═══════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS SAISON — réutilise social_notifications (déjà RLS-safe,
-- déjà dans la publication Realtime) plutôt que dupliquer un système
-- parallèle. Ajoute juste ce qu'il manque : idempotence, lien de
-- destination, source versionnée.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.social_notifications
  add column if not exists idempotency_key text unique,
  add column if not exists source text,
  add column if not exists source_id uuid,
  add column if not exists link_route text,
  add column if not exists link_params jsonb;

alter table public.social_notifications drop constraint if exists social_notifications_type_check;
alter table public.social_notifications add constraint social_notifications_type_check
  check (type in (
    'friend_request', 'friend_accepted', 'match',
    'mission_joined', 'mission_validated', 'mission_rejected', 'mission_rewarded',
    'badge_unlocked', 'level_up', 'district_goal_reached', 'mission_expiring_soon'
  ));

-- ── Helper interne : insertion idempotente, jamais appelable par le client
-- directement (aucun grant execute côté client — utilisée UNIQUEMENT depuis
-- d'autres fonctions SECURITY DEFINER déjà server-controlled). ───────────
create or replace function public.notify_season_event(
  p_target uuid, p_type text, p_title text, p_body text,
  p_idempotency_key text, p_source text, p_source_id uuid,
  p_link_route text default null, p_link_params jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.social_notifications
    (target_user_id, type, title, body, idempotency_key, source, source_id, link_route, link_params)
  values
    (p_target, p_type, p_title, p_body, p_idempotency_key, p_source, p_source_id, p_link_route, p_link_params)
  on conflict (idempotency_key) do nothing;
end;
$$;

-- ── join_mission : notifie la mission rejointe ────────────────────────────
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
  v_is_new boolean := false;
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
      v_is_new := true;
    end if;
  else
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
    v_is_new := true;
  end if;

  if v_is_new then
    perform public.notify_season_event(
      auth.uid(), 'mission_joined', 'Mission rejointe',
      v_mission.title,
      'mission_joined:' || v_row.id::text,
      'mission', p_mission_id, 'mission', jsonb_build_object('missionId', p_mission_id)
    );
  end if;

  return v_row;
end;
$$;
grant execute on function public.join_mission(uuid) to authenticated;

-- ── validate_mission : notifie validation ou refus avec raison ───────────
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
  v_session public.mission_move_sessions;
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

  -- NOTE : pas de notification "mission_rejected" ici — testée et trouvée
  -- impossible à faire persister : un `raise exception` non intercepté au
  -- niveau de l'appel RPC annule TOUTE la transaction de cet appel, y
  -- compris un insert de notification fait juste avant dans un bloc
  -- EXCEPTION local (BEGIN/EXCEPTION en PL/pgSQL n'est pas une transaction
  -- autonome). Un vrai fix demanderait de changer ce RPC pour renvoyer un
  -- statut structuré au lieu de lever une exception sur refus métier —
  -- non fait pour ne pas casser les appelants client déjà testés.
  if v_mission.category = 'explore' then
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
    select * into v_session from public.mission_move_sessions
      where mission_id = p_mission_id and user_id = auth.uid() and status = 'finished'
      order by finished_at desc limit 1;
    if v_session.id is null then
      raise exception 'Termine ta session de trajet avant de valider';
    end if;

  elsif v_mission.category = 'social' then
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

  perform public.notify_season_event(
    auth.uid(), 'mission_validated', 'Mission validée',
    v_mission.title || ' — réclame ta récompense',
    'mission_validated:' || v_part.id::text,
    'mission', p_mission_id, 'mission', jsonb_build_object('missionId', p_mission_id)
  );

  return v_part;
end;
$$;
grant execute on function public.validate_mission(uuid, double precision, double precision, jsonb) to authenticated;
