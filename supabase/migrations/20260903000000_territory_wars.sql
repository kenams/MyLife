-- ═══════════════════════════════════════════════════════════════════════
-- TERRITORY WARS (spec V2 §7) — UNE Territory War complète.
-- ═══════════════════════════════════════════════════════════════════════
-- RDV live connus à l'avance. 3-5 min, 3 manches :
--   1. INFLUENCE RUSH  — tactile, plafonné + anti-autoclick côté serveur
--   2. CHALLENGE       — quiz Toulouse (bonnes réponses = points)
--   3. CREW SYNC       — coordination : agir dans la fenêtre commune
-- Score final = somme pondérée normalisée en %. Le nombre de membres aide
-- mais ne garantit rien. Les joueurs jouent depuis leur téléphone, jamais
-- besoin de rencontrer l'adversaire (invariant sécurité §6).

create table if not exists public.territory_battles (
  id             uuid primary key default gen_random_uuid(),
  district_id    uuid not null references public.districts(id) on delete cascade,
  attacker_crew  uuid not null references public.crews(id) on delete cascade,
  defender_crew  uuid references public.crews(id) on delete set null,
  scheduled_at   timestamptz not null,
  status         text not null default 'scheduled'
                 check (status in ('scheduled', 'live', 'resolved', 'cancelled')),
  current_round  int not null default 0 check (current_round between 0 and 3),
  round_started_at timestamptz,
  winner_crew    uuid references public.crews(id) on delete set null,
  attacker_pct   numeric(5,2),
  defender_pct   numeric(5,2),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create index if not exists territory_battles_sched_idx on public.territory_battles (scheduled_at desc);
create index if not exists territory_battles_status_idx on public.territory_battles (status);

create table if not exists public.battle_participants (
  battle_id  uuid not null references public.territory_battles(id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  crew_id    uuid not null references public.crews(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  -- anti-autoclick / plafond : état par manche
  r1_taps    int not null default 0,
  r1_last_at timestamptz,
  r2_score   int not null default 0,
  r3_hits    int not null default 0,
  primary key (battle_id, user_id)
);

create table if not exists public.battle_round_log (
  id         uuid primary key default gen_random_uuid(),
  battle_id  uuid not null references public.territory_battles(id) on delete cascade,
  round      int not null,
  crew_id    uuid not null,
  points     int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists battle_round_log_idx on public.battle_round_log (battle_id, round);

alter table public.territory_battles enable row level security;
alter table public.battle_participants enable row level security;
alter table public.battle_round_log enable row level security;
revoke all on public.territory_battles, public.battle_participants, public.battle_round_log from anon, authenticated;
grant select on public.territory_battles, public.battle_participants, public.battle_round_log to authenticated, anon;

-- Battles : info publique (comme les territoires).
do $$ begin
  create policy territory_battles_read on public.territory_battles for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy battle_participants_read on public.battle_participants for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy battle_round_log_read on public.battle_round_log for select using (true);
exception when duplicate_object then null; end $$;
-- Aucune écriture directe : tout via RPC SECURITY DEFINER.

-- ── Constantes d'équilibrage ───────────────────────────────────────────
-- Poids des manches, plafond de taps R1, garde anti-autoclick (ms).
create or replace function public.battle_config()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'r1_weight', 0.34, 'r2_weight', 0.33, 'r3_weight', 0.33,
    'r1_cap', 60, 'r1_min_ms', 45, 'r2_max', 3, 'r3_window_ms', 1200,
    'reward_wory_win', 250, 'reward_wory_lose', 60, 'reward_rep_win', 40
  );
$$;

-- ── Créer une Battle (officier attaquant) ──────────────────────────────
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

  perform public.schedule_territory_battle(p_district_id, p_scheduled_at);
  return v_battle;
end;
$$;

-- ── Rejoindre une Battle ──────────────────────────────────────────────
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

-- ── Avancer la Battle (n'importe quel participant peut déclencher le tick) ──
create or replace function public.tick_territory_battle(p_battle_id uuid)
returns public.territory_battles
language plpgsql security definer set search_path = public as $$
declare v_b public.territory_battles;
begin
  select * into v_b from public.territory_battles where id = p_battle_id for update;
  if not found then raise exception 'Battle introuvable'; end if;

  if v_b.status = 'scheduled' and now() >= v_b.scheduled_at then
    update public.territory_battles set status = 'live', current_round = 1, round_started_at = now()
    where id = p_battle_id returning * into v_b;
  elsif v_b.status = 'live' and v_b.round_started_at is not null then
    -- chaque manche dure 60 s
    if now() - v_b.round_started_at >= interval '60 seconds' then
      if v_b.current_round >= 3 then
        v_b := public.resolve_territory_battle_war(p_battle_id);
      else
        update public.territory_battles set current_round = v_b.current_round + 1, round_started_at = now()
        where id = p_battle_id returning * into v_b;
      end if;
    end if;
  end if;
  return v_b;
end;
$$;

-- ── Actions de manche ─────────────────────────────────────────────────
-- R1 : un tap. Renvoie le compteur courant. Plafond + anti-autoclick serveur.
create or replace function public.battle_tap(p_battle_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_cfg   jsonb := public.battle_config();
  v_p     public.battle_participants;
  v_now   timestamptz := clock_timestamp();
begin
  select * into v_p from public.battle_participants
  where battle_id = p_battle_id and user_id = auth.uid() for update;
  if not found then raise exception 'Rejoins la Battle d''abord'; end if;
  if v_p.r1_taps >= (v_cfg->>'r1_cap')::int then return v_p.r1_taps; end if;
  if v_p.r1_last_at is not null
     and v_now - v_p.r1_last_at < ((v_cfg->>'r1_min_ms')::int || ' milliseconds')::interval then
    return v_p.r1_taps; -- tap trop rapide : ignoré (autoclick)
  end if;
  update public.battle_participants set r1_taps = r1_taps + 1, r1_last_at = v_now
  where battle_id = p_battle_id and user_id = auth.uid() returning * into v_p;
  return v_p.r1_taps;
end;
$$;

-- R2 : soumettre le nombre de bonnes réponses au quiz (0..r2_max).
create or replace function public.battle_submit_quiz(p_battle_id uuid, p_correct int)
returns void language plpgsql security definer set search_path = public as $$
declare v_cfg jsonb := public.battle_config();
begin
  update public.battle_participants
  set r2_score = least((v_cfg->>'r2_max')::int, greatest(0, p_correct))
  where battle_id = p_battle_id and user_id = auth.uid()
    and r2_score = 0; -- une seule soumission
  if not found then raise exception 'Rejoins la Battle d''abord'; end if;
end;
$$;

-- R3 : un hit synchro réussi.
create or replace function public.battle_sync_hit(p_battle_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_p public.battle_participants;
begin
  update public.battle_participants set r3_hits = least(10, r3_hits + 1)
  where battle_id = p_battle_id and user_id = auth.uid() returning * into v_p;
  if not found then raise exception 'Rejoins la Battle d''abord'; end if;
  return v_p.r3_hits;
end;
$$;

-- ── Résolution ───────────────────────────────────────────────────────
create or replace function public.resolve_territory_battle_war(p_battle_id uuid)
returns public.territory_battles
language plpgsql security definer set search_path = public as $$
declare
  v_b       public.territory_battles;
  v_cfg     jsonb := public.battle_config();
  v_att     numeric := 0;
  v_def     numeric := 0;
  v_att_tot numeric; v_def_tot numeric; v_sum numeric;
  v_att_pct numeric; v_def_pct numeric;
  v_winner  uuid;
  r record;
begin
  select * into v_b from public.territory_battles where id = p_battle_id for update;
  if v_b.status = 'resolved' then return v_b; end if;

  -- Score par crew = moyenne normalisée des 3 manches, pondérée.
  for r in
    select crew_id,
           avg(r1_taps)::numeric / (v_cfg->>'r1_cap')::numeric        as r1,
           avg(r2_score)::numeric / (v_cfg->>'r2_max')::numeric       as r2,
           avg(r3_hits)::numeric / 8.0                                as r3,
           count(*)                                                   as n
    from public.battle_participants where battle_id = p_battle_id group by crew_id
  loop
    declare v_score numeric;
    begin
      v_score := coalesce(r.r1,0) * (v_cfg->>'r1_weight')::numeric
               + coalesce(r.r2,0) * (v_cfg->>'r2_weight')::numeric
               + coalesce(r.r3,0) * (v_cfg->>'r3_weight')::numeric;
      -- petit bonus de nombre, plafonné (le nombre aide sans garantir)
      v_score := v_score * (1 + least(0.15, (r.n - 1) * 0.02));
      if r.crew_id = v_b.attacker_crew then v_att := v_score;
      elsif r.crew_id = v_b.defender_crew then v_def := v_score;
      end if;
      insert into public.battle_round_log (battle_id, round, crew_id, points)
      values (p_battle_id, 0, r.crew_id, round(v_score * 1000));
    end;
  end loop;

  -- Défenseur absent (territoire neutre) : l'attaquant gagne s'il a marqué.
  if v_b.defender_crew is null then
    v_def := 0;
    if v_att = 0 then v_att := 0.0001; end if;
  end if;

  v_att_tot := greatest(v_att, 0.0001);
  v_def_tot := greatest(v_def, 0.0001);
  v_sum := v_att_tot + v_def_tot;
  v_att_pct := round(v_att_tot / v_sum * 100, 2);
  v_def_pct := round(100 - v_att_pct, 2);
  v_winner := case when v_att_tot >= v_def_tot then v_b.attacker_crew else coalesce(v_b.defender_crew, v_b.attacker_crew) end;

  update public.territory_battles set
    status = 'resolved', current_round = 3, winner_crew = v_winner,
    attacker_pct = v_att_pct, defender_pct = v_def_pct, resolved_at = now()
  where id = p_battle_id returning * into v_b;

  -- Applique au territoire (idempotent via la clé = battle id).
  perform public.resolve_territory_battle(
    v_b.district_id, v_winner,
    round(case when v_winner = v_b.attacker_crew then v_att_pct else v_def_pct end)::int,
    'battle:' || p_battle_id::text
  );

  -- Récompenses Wory (ledger unifié) : joueurs du crew gagnant / perdant.
  for r in select user_id, crew_id from public.battle_participants where battle_id = p_battle_id loop
    perform public.record_wory(
      r.user_id, null,
      case when r.crew_id = v_winner then (v_cfg->>'reward_wory_win')::bigint
           else (v_cfg->>'reward_wory_lose')::bigint end,
      'battle', 'wory:user:' || r.user_id::text || ':battle:' || p_battle_id::text,
      'territory_battle', p_battle_id,
      jsonb_build_object('won', r.crew_id = v_winner)
    );
  end loop;

  return v_b;
end;
$$;

revoke all on function public.create_territory_battle(uuid, timestamptz) from anon, authenticated;
revoke all on function public.resolve_territory_battle_war(uuid) from anon, authenticated;
grant execute on function public.create_territory_battle(uuid, timestamptz) to authenticated;
grant execute on function public.join_territory_battle(uuid) to authenticated;
grant execute on function public.tick_territory_battle(uuid) to authenticated;
grant execute on function public.battle_tap(uuid) to authenticated;
grant execute on function public.battle_submit_quiz(uuid, int) to authenticated;
grant execute on function public.battle_sync_hit(uuid) to authenticated;
grant execute on function public.battle_config() to authenticated, anon;

do $$ begin
  alter publication supabase_realtime add table public.territory_battles;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.battle_participants;
exception when duplicate_object then null; end $$;
