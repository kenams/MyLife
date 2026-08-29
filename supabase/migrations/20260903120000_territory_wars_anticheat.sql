-- ═══════════════════════════════════════════════════════════════════════
-- TERRITORY WARS — durcissement anti-cheat (revue sécurité §7)
-- ═══════════════════════════════════════════════════════════════════════
--  1. Le quiz (manche 2) est tiré et corrigé CÔTÉ SERVEUR. Le client ne
--     soumet que ses choix ; il ne voit jamais les bonnes réponses ni ne
--     déclare son score.
--  2. Manche 3 : intervalle minimum entre hits + hit obligatoirement dans
--     la fenêtre de synchro calculée serveur.
--  3. Chaque action de manche vérifie status = 'live', la bonne manche et
--     que la manche n'a pas expiré (60 s).
--  4. On ne peut plus rejoindre une Battle après le début de la manche 2.

alter table public.territory_battles add column if not exists quiz jsonb;
alter table public.territory_battles add column if not exists quiz_answers int[];
alter table public.battle_participants add column if not exists r3_last_at timestamptz;

-- ── Pool de questions (serveur) ───────────────────────────────────────
create or replace function public.battle_quiz_pool()
returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('q','Quel fleuve traverse Toulouse ?','choices',jsonb_build_array('La Garonne','Le Rhône','La Loire','La Seine'),'answer',0),
    jsonb_build_object('q','Surnom de Toulouse ?','choices',jsonb_build_array('La ville blanche','La ville rose','La ville bleue','La ville verte'),'answer',1),
    jsonb_build_object('q','Quel avionneur est basé à Toulouse ?','choices',jsonb_build_array('Boeing','Airbus','Embraer','Dassault seul'),'answer',1),
    jsonb_build_object('q','Le Capitole abrite surtout…','choices',jsonb_build_array('Un musée d''art','L''hôtel de ville','Une gare','Une université'),'answer',1),
    jsonb_build_object('q','Quelle basilique romane célèbre à Toulouse ?','choices',jsonb_build_array('Saint-Sernin','Notre-Dame','Saint-Michel','Sacré-Cœur'),'answer',0),
    jsonb_build_object('q','Le canal qui rejoint la Garonne à la Méditerranée ?','choices',jsonb_build_array('Canal du Nord','Canal du Midi','Canal Saint-Martin','Canal de Bourgogne'),'answer',1),
    jsonb_build_object('q','Couleur dominante des briques toulousaines ?','choices',jsonb_build_array('Grise','Ocre-rose','Noire','Beige clair'),'answer',1),
    jsonb_build_object('q','Le club de rugby de la ville ?','choices',jsonb_build_array('Stade Toulousain','RC Toulon','ASM','UBB'),'answer',0),
    jsonb_build_object('q','Place centrale à côté du Capitole ?','choices',jsonb_build_array('Place Wilson','Place du Capitole','Place Esquirol','Place Saint-Georges'),'answer',1),
    jsonb_build_object('q','La Cité de l''espace, c''est…','choices',jsonb_build_array('L''histoire médiévale','L''astronomie et le spatial','La gastronomie','L''art moderne'),'answer',1)
  );
$$;

-- Prépare le quiz d'une Battle (idempotent : ne fait rien si déjà posé).
create or replace function public.battle_prepare_quiz(p_battle_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pool  jsonb := public.battle_quiz_pool();
  v_pub   jsonb := '[]'::jsonb;
  v_ans   int[] := '{}';
  r record;
begin
  if exists (select 1 from public.territory_battles where id = p_battle_id and quiz is not null) then
    return;
  end if;
  for r in
    select value, ordinality
    from jsonb_array_elements(v_pool) with ordinality
    order by md5(p_battle_id::text || ordinality::text)
    limit 3
  loop
    v_pub := v_pub || jsonb_build_array(jsonb_build_object('q', r.value->>'q', 'choices', r.value->'choices'));
    v_ans := v_ans || (r.value->>'answer')::int;
  end loop;
  update public.territory_battles set quiz = v_pub, quiz_answers = v_ans where id = p_battle_id;
end;
$$;

-- ── Garde commune : la Battle est-elle dans la bonne manche, non expirée ? ──
create or replace function public.battle_round_open(p_battle_id uuid, p_round int)
returns public.territory_battles language plpgsql security definer set search_path = public as $$
declare v_b public.territory_battles;
begin
  select * into v_b from public.territory_battles where id = p_battle_id;
  if not found then raise exception 'Battle introuvable'; end if;
  if v_b.status <> 'live' then raise exception 'Battle non active'; end if;
  if v_b.current_round <> p_round then raise exception 'Mauvaise manche'; end if;
  if v_b.round_started_at is null
     or clock_timestamp() - v_b.round_started_at > interval '60 seconds' then
    raise exception 'Manche terminée';
  end if;
  return v_b;
end;
$$;

-- ── Créer une Battle : prépare aussi le quiz ──────────────────────────
create or replace function public.create_territory_battle(
  p_district_id uuid,
  p_scheduled_at timestamptz
) returns public.territory_battles
language plpgsql security definer set search_path = public as $$
declare
  v_my_crew uuid;
  v_owner   uuid;
  v_battle  public.territory_battles;
begin
  select crew_id into v_my_crew from public.crew_members where user_id = auth.uid() limit 1;
  if v_my_crew is null then raise exception 'Aucun crew'; end if;
  if not public.is_crew_officer(v_my_crew) then raise exception 'Réservé aux officiers'; end if;
  if p_scheduled_at < now() then raise exception 'Date dans le passé'; end if;

  select owner_crew_id into v_owner from public.territories where district_id = p_district_id;
  if v_owner = v_my_crew then raise exception 'Vous contrôlez déjà ce territoire'; end if;

  if exists (
    select 1 from public.territory_battles
    where district_id = p_district_id and status in ('scheduled', 'live')
  ) then
    raise exception 'Une Battle est déjà prévue sur ce territoire';
  end if;

  insert into public.territory_battles (district_id, attacker_crew, defender_crew, scheduled_at)
  values (p_district_id, v_my_crew, v_owner, p_scheduled_at)
  returning * into v_battle;

  perform public.battle_prepare_quiz(v_battle.id);
  perform public.schedule_territory_battle(p_district_id, p_scheduled_at);
  select * into v_battle from public.territory_battles where id = v_battle.id;
  return v_battle;
end;
$$;

-- ── Rejoindre : interdit après le début de la manche 2 ────────────────
create or replace function public.join_territory_battle(p_battle_id uuid)
returns public.battle_participants
language plpgsql security definer set search_path = public as $$
declare
  v_my_crew uuid;
  v_battle  public.territory_battles;
  v_row     public.battle_participants;
begin
  select crew_id into v_my_crew from public.crew_members where user_id = auth.uid() limit 1;
  if v_my_crew is null then raise exception 'Aucun crew'; end if;
  select * into v_battle from public.territory_battles where id = p_battle_id;
  if not found then raise exception 'Battle introuvable'; end if;
  if v_battle.status not in ('scheduled', 'live') then raise exception 'Battle terminée'; end if;
  if v_battle.status = 'live' and v_battle.current_round > 1 then
    raise exception 'Trop tard pour rejoindre cette Battle';
  end if;
  if v_my_crew not in (v_battle.attacker_crew, v_battle.defender_crew) then
    raise exception 'Ton crew ne participe pas à cette Battle';
  end if;

  insert into public.battle_participants (battle_id, user_id, crew_id)
  values (p_battle_id, auth.uid(), v_my_crew)
  on conflict (battle_id, user_id) do update set crew_id = excluded.crew_id
  returning * into v_row;
  return v_row;
end;
$$;

-- ── R1 : tap (garde de manche + plafond + anti-autoclick) ─────────────
create or replace function public.battle_tap(p_battle_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_cfg jsonb := public.battle_config();
  v_p   public.battle_participants;
  v_now timestamptz := clock_timestamp();
begin
  perform public.battle_round_open(p_battle_id, 1);
  select * into v_p from public.battle_participants
  where battle_id = p_battle_id and user_id = auth.uid() for update;
  if not found then raise exception 'Rejoins la Battle d''abord'; end if;
  if v_p.r1_taps >= (v_cfg->>'r1_cap')::int then return v_p.r1_taps; end if;
  if v_p.r1_last_at is not null
     and v_now - v_p.r1_last_at < ((v_cfg->>'r1_min_ms')::int || ' milliseconds')::interval then
    return v_p.r1_taps;
  end if;
  update public.battle_participants set r1_taps = r1_taps + 1, r1_last_at = v_now
  where battle_id = p_battle_id and user_id = auth.uid() returning * into v_p;
  return v_p.r1_taps;
end;
$$;

-- ── R2 : quiz corrigé serveur (le client soumet des index de réponse) ──
create or replace function public.battle_get_quiz(p_battle_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_quiz jsonb;
begin
  select quiz into v_quiz from public.territory_battles where id = p_battle_id;
  return coalesce(v_quiz, '[]'::jsonb);
end;
$$;

drop function if exists public.battle_submit_quiz(uuid, int);
create or replace function public.battle_submit_quiz(p_battle_id uuid, p_answers int[])
returns int language plpgsql security definer set search_path = public as $$
declare
  v_b       public.territory_battles;
  v_correct int := 0;
  i         int;
begin
  v_b := public.battle_round_open(p_battle_id, 2);
  for i in 1 .. coalesce(array_length(v_b.quiz_answers, 1), 0) loop
    if coalesce(p_answers[i], -1) = v_b.quiz_answers[i] then
      v_correct := v_correct + 1;
    end if;
  end loop;

  update public.battle_participants
  set r2_score = v_correct
  where battle_id = p_battle_id and user_id = auth.uid() and r2_score = 0;
  if not found then
    if exists (select 1 from public.battle_participants where battle_id = p_battle_id and user_id = auth.uid()) then
      raise exception 'Quiz déjà soumis';
    end if;
    raise exception 'Rejoins la Battle d''abord';
  end if;
  return v_correct;
end;
$$;

-- ── R3 : sync (intervalle mini + fenêtre serveur) ────────────────────
create or replace function public.battle_sync_hit(p_battle_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_b     public.territory_battles;
  v_p     public.battle_participants;
  v_now   timestamptz := clock_timestamp();
  v_cycle int;
begin
  v_b := public.battle_round_open(p_battle_id, 3);
  select * into v_p from public.battle_participants
  where battle_id = p_battle_id and user_id = auth.uid() for update;
  if not found then raise exception 'Rejoins la Battle d''abord'; end if;

  -- fenêtre de synchro : cycle de 4 s, GO sur les 1,2 dernières secondes
  v_cycle := (extract(epoch from (v_now - v_b.round_started_at)) * 1000)::bigint % 4000;
  if v_cycle < 2800 then
    return v_p.r3_hits; -- hors fenêtre : ignoré
  end if;
  if v_p.r3_last_at is not null and v_now - v_p.r3_last_at < interval '900 milliseconds' then
    return v_p.r3_hits; -- trop rapproché : ignoré
  end if;

  update public.battle_participants set r3_hits = least(15, r3_hits + 1), r3_last_at = v_now
  where battle_id = p_battle_id and user_id = auth.uid() returning * into v_p;
  return v_p.r3_hits;
end;
$$;

revoke all on function public.battle_submit_quiz(uuid, int[]) from anon, authenticated;
grant execute on function public.battle_submit_quiz(uuid, int[]) to authenticated;
grant execute on function public.battle_get_quiz(uuid) to authenticated;
grant execute on function public.battle_quiz_pool() to authenticated, anon;

-- Rétro-remplit le quiz des Battles créées avant ce durcissement.
do $$
declare r record;
begin
  for r in select id from public.territory_battles where quiz is null loop
    perform public.battle_prepare_quiz(r.id);
  end loop;
end $$;
