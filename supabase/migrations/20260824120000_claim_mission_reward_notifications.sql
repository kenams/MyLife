-- Étend claim_mission_reward avec les notifications récompense/badge/niveau,
-- sans changer sa logique de récompense existante (idempotence via
-- idempotency_key déjà en place, inchangée).
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
  v_new_badge record;
  v_xp_before int;
  v_xp_after int;
  v_level_before int;
  v_level_after int;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  select * into v_mission from public.mission_definitions where id = p_mission_id;
  select * into v_part from public.mission_participations
    where mission_id = p_mission_id and user_id = auth.uid() for update;

  if v_part.id is null or v_part.status <> 'validated' then
    raise exception 'Validation requise avant réclamation';
  end if;

  v_idem := 'mission:' || p_mission_id::text || ':' || auth.uid()::text;

  select coalesce(sum(xp), 0) into v_xp_before from public.season_reward_ledger where user_id = auth.uid();

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

  perform public.notify_season_event(
    auth.uid(), 'mission_rewarded', 'Récompense obtenue',
    '+' || coalesce(v_mission.reward_xp,0) || ' XP · +' || coalesce(v_mission.reward_money,0) || ' BL — ' || v_mission.title,
    'mission_rewarded:' || v_part.id::text,
    'mission', p_mission_id, 'profile', null
  );

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
  -- RETURNING permet de ne notifier QUE les badges réellement nouveaux.
  for v_new_badge in
    insert into public.badge_awards (user_id, badge_id)
      select auth.uid(), id from public.badges where code = 'first-step'
      on conflict do nothing
      returning badge_id
  loop
    perform public.notify_season_event(
      auth.uid(), 'badge_unlocked', 'Badge débloqué',
      'Premier pas', 'badge:' || v_new_badge.badge_id::text || ':' || auth.uid()::text,
      'badge', v_new_badge.badge_id, 'profile', null
    );
  end loop;

  if v_mission.category = 'explore' then
    for v_new_badge in
      insert into public.badge_awards (user_id, badge_id)
        select auth.uid(), id from public.badges where code = 'explorer-tls'
        on conflict do nothing
        returning badge_id
    loop
      perform public.notify_season_event(
        auth.uid(), 'badge_unlocked', 'Badge débloqué',
        'Explorateur de Toulouse', 'badge:' || v_new_badge.badge_id::text || ':' || auth.uid()::text,
        'badge', v_new_badge.badge_id, 'profile', null
      );
    end loop;
  end if;

  if v_my_crew is not null then
    for v_new_badge in
      insert into public.badge_awards (user_id, badge_id)
        select auth.uid(), id from public.badges where code = 'team-spirit'
        on conflict do nothing
        returning badge_id
    loop
      perform public.notify_season_event(
        auth.uid(), 'badge_unlocked', 'Badge débloqué',
        'Esprit d''équipe', 'badge:' || v_new_badge.badge_id::text || ':' || auth.uid()::text,
        'badge', v_new_badge.badge_id, 'profile', null
      );
    end loop;
  end if;

  if v_mission.district_id is not null then
    select count(*) into v_district_count from public.mission_participations mp
      join public.mission_definitions md on md.id = mp.mission_id
      where mp.user_id = auth.uid() and mp.status = 'rewarded' and md.district_id = v_mission.district_id;
    if v_district_count >= 5 then
      for v_new_badge in
        insert into public.badge_awards (user_id, badge_id)
          select auth.uid(), id from public.badges where code = 'local-regular'
          on conflict do nothing
          returning badge_id
      loop
        perform public.notify_season_event(
          auth.uid(), 'badge_unlocked', 'Badge débloqué',
          'Habitué du quartier', 'badge:' || v_new_badge.badge_id::text || ':' || auth.uid()::text,
          'badge', v_new_badge.badge_id, 'profile', null
        );
      end loop;
    end if;
  end if;

  -- Niveau de saison — même palier que l'affichage client (XP_PER_LEVEL=200)
  select coalesce(sum(xp), 0) into v_xp_after from public.season_reward_ledger where user_id = auth.uid();
  v_level_before := greatest(1, (v_xp_before / 200) + 1);
  v_level_after  := greatest(1, (v_xp_after / 200) + 1);
  if v_level_after > v_level_before then
    perform public.notify_season_event(
      auth.uid(), 'level_up', 'Niveau supérieur !',
      'Tu passes niveau ' || v_level_after,
      'levelup:' || auth.uid()::text || ':' || v_level_after::text,
      'level', null, 'profile', null
    );
  end if;

  return v_ledger;
end;
$$;
grant execute on function public.claim_mission_reward(uuid) to authenticated;
