-- ═══════════════════════════════════════════════════════════════════════
-- MISSION BOUGER — protocole de session serveur (start/checkpoint/finish)
-- Remplace la confiance aveugle dans un p_progress envoyé par le client :
-- validate_mission('move') lisait un distance_m/duration_s fourni tel quel.
-- Ici chaque segment est vérifié au fur et à mesure (vitesse plausible,
-- bruit GPS ignoré), et un seul point (le dernier) est conservé — jamais
-- l'historique complet du trajet.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.mission_move_sessions (
  id                uuid primary key default gen_random_uuid(),
  mission_id        uuid not null references public.mission_definitions(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  status            text not null default 'active' check (status in ('active','finished','abandoned','expired')),
  started_at        timestamptz not null default now(),
  last_checkpoint_at timestamptz not null default now(),
  last_lat          double precision,
  last_lng          double precision,
  distance_m        double precision not null default 0,
  checkpoint_count   int not null default 0,
  speed_flag_count   int not null default 0,   -- nb de segments rejetés (vitesse implausible) — juste un signal de confiance
  finished_at        timestamptz
);
-- Un seul appareil/session active à la fois : contrainte au niveau app
-- (vérifiée dans start_move_session), index partiel pour l'accélérer.
create index if not exists mission_move_sessions_active_idx
  on public.mission_move_sessions (user_id) where status = 'active';

alter table public.mission_move_sessions enable row level security;
revoke all on public.mission_move_sessions from anon, authenticated;
grant select on public.mission_move_sessions to authenticated;
create policy "mission_move_sessions_own" on public.mission_move_sessions for select to authenticated using (user_id = auth.uid());

-- ── start_move_session ─────────────────────────────────────────────────
create or replace function public.start_move_session(p_mission_id uuid)
returns public.mission_move_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.mission_definitions;
  v_part public.mission_participations;
  v_existing public.mission_move_sessions;
  v_row public.mission_move_sessions;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  select * into v_mission from public.mission_definitions where id = p_mission_id;
  if v_mission.id is null or v_mission.category <> 'move' then
    raise exception 'Mission Bouger introuvable';
  end if;
  if now() > v_mission.ends_at then raise exception 'Mission expirée'; end if;

  select * into v_part from public.mission_participations
    where mission_id = p_mission_id and user_id = auth.uid();
  if v_part.id is null or v_part.status not in ('joined','in_progress') then
    raise exception 'Rejoins la mission avant de démarrer';
  end if;

  -- Une seule session active : réutilise si elle existe déjà pour CETTE
  -- mission, bloque sinon (règle retenue : un seul trajet à la fois, tous
  -- appareils confondus).
  select * into v_existing from public.mission_move_sessions
    where user_id = auth.uid() and status = 'active';
  if v_existing.id is not null then
    if v_existing.mission_id = p_mission_id then
      return v_existing;
    end if;
    raise exception 'Une autre session Bouger est déjà active';
  end if;

  update public.mission_participations set status = 'in_progress' where id = v_part.id;

  insert into public.mission_move_sessions (mission_id, user_id)
  values (p_mission_id, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;
grant execute on function public.start_move_session(uuid) to authenticated;

-- ── report_move_checkpoint : un point à la fois, vérifié, jamais stocké
-- en historique (seul le dernier point est conservé). ─────────────────────
create or replace function public.report_move_checkpoint(p_session_id uuid, p_lat double precision, p_lng double precision)
returns public.mission_move_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.mission_move_sessions;
  v_elapsed_s double precision;
  v_step_m double precision;
  v_speed_ms double precision;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Coordonnées invalides';
  end if;

  select * into v_session from public.mission_move_sessions
    where id = p_session_id and user_id = auth.uid() for update;
  if v_session.id is null or v_session.status <> 'active' then
    raise exception 'Session inactive';
  end if;

  -- Horloge serveur uniquement (jamais un timestamp client) — élimine la
  -- classe entière d'attaques "rejouer d'anciens points" avec un faux ts.
  v_elapsed_s := extract(epoch from (now() - v_session.last_checkpoint_at));
  if v_elapsed_s < 2 then
    -- Points trop rapprochés (double-clic, deux onglets) : on met juste à
    -- jour la position sans compter de distance, pas d'erreur bruyante.
    update public.mission_move_sessions
      set last_lat = p_lat, last_lng = p_lng
      where id = p_session_id
      returning * into v_session;
    return v_session;
  end if;

  if v_session.last_lat is not null then
    v_step_m := 111320 * sqrt(
      power(p_lat - v_session.last_lat, 2) +
      power((p_lng - v_session.last_lng) * cos(radians(v_session.last_lat)), 2)
    );
    -- Bruit GPS typique en dessous de 3m : ignoré, ne compte pas comme
    -- déplacement.
    if v_step_m < 3 then
      update public.mission_move_sessions set last_checkpoint_at = now() where id = p_session_id
        returning * into v_session;
      return v_session;
    end if;

    v_speed_ms := v_step_m / v_elapsed_s;
    if v_speed_ms > 2.8 then
      -- Vitesse implausible pour de la marche : segment rejeté, mais la
      -- session continue (un flag de confiance s'incrémente, pas de
      -- sanction brutale — un saut GPS isolé arrive sur mobile).
      update public.mission_move_sessions
        set last_lat = p_lat, last_lng = p_lng, last_checkpoint_at = now(),
            speed_flag_count = speed_flag_count + 1
        where id = p_session_id
        returning * into v_session;
      return v_session;
    end if;

    update public.mission_move_sessions
      set distance_m = distance_m + v_step_m,
          last_lat = p_lat, last_lng = p_lng, last_checkpoint_at = now(),
          checkpoint_count = checkpoint_count + 1
      where id = p_session_id
      returning * into v_session;
  else
    update public.mission_move_sessions
      set last_lat = p_lat, last_lng = p_lng, last_checkpoint_at = now(), checkpoint_count = checkpoint_count + 1
      where id = p_session_id
      returning * into v_session;
  end if;

  return v_session;
end;
$$;
grant execute on function public.report_move_checkpoint(uuid, double precision, double precision) to authenticated;

-- ── finish_move_session ────────────────────────────────────────────────
create or replace function public.finish_move_session(p_session_id uuid)
returns public.mission_move_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.mission_move_sessions;
  v_mission public.mission_definitions;
  v_target_m numeric;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  select * into v_session from public.mission_move_sessions
    where id = p_session_id and user_id = auth.uid() for update;
  if v_session.id is null or v_session.status <> 'active' then
    raise exception 'Session inactive';
  end if;

  select * into v_mission from public.mission_definitions where id = v_session.mission_id;
  v_target_m := coalesce((v_mission.conditions->>'target_distance_m')::numeric, 500);

  if v_session.distance_m < v_target_m then
    raise exception 'Objectif de distance pas encore atteint (% m sur % m requis)',
      round(v_session.distance_m), v_target_m;
  end if;

  update public.mission_move_sessions
    set status = 'finished', finished_at = now()
    where id = p_session_id
    returning * into v_session;

  return v_session;
end;
$$;
grant execute on function public.finish_move_session(uuid) to authenticated;

create or replace function public.abandon_move_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mission_move_sessions
    set status = 'abandoned'
    where id = p_session_id and user_id = auth.uid() and status = 'active';
end;
$$;
grant execute on function public.abandon_move_session(uuid) to authenticated;

-- ── validate_mission('move') s'appuie désormais sur la session serveur,
-- plus jamais sur un p_progress envoyé par le client. ─────────────────────
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
    -- Session server-side requise et terminée (finish_move_session) — la
    -- distance/vitesse a déjà été vérifiée segment par segment, jamais
    -- confiance dans une valeur globale envoyée d'un coup.
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

  return v_part;
end;
$$;
grant execute on function public.validate_mission(uuid, double precision, double precision, jsonb) to authenticated;
