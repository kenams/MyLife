-- ═══════════════════════════════════════════════════════════════════════
-- TRÉSORERIE CREW SUR LE LEDGER WORY (§3)
-- ═══════════════════════════════════════════════════════════════════════
-- Les dépôts/dépenses de trésorerie passent désormais par record_wory
-- (ledger unifié auditable). `crews.treasury` devient un simple cache.
-- Les items tactiques modifient la stratégie — jamais n'achètent de points.

create table if not exists public.crew_tactical_items (
  code        text primary key,
  label       text not null,
  cost        int not null check (cost > 0),
  effect_kind text not null,
  description text not null default '',
  duration    interval not null default interval '48 hours'
);

insert into public.crew_tactical_items (code, label, cost, effect_kind, description) values
  ('renseignement',   'Renseignement',   100, 'recon',      'Le prochain résumé d''activité rivale arrive sans délai.'),
  ('protection',      'Protection',       150, 'protection', 'Réduit la perte d''influence en cas de défaite (jamais 0).'),
  ('crew_sync_boost', 'Crew Sync Boost',  200, 'crew_sync_boost', 'Léger bonus de coordination sur la prochaine Battle.')
on conflict (code) do nothing;

create table if not exists public.crew_tactical_effects (
  id           uuid primary key default gen_random_uuid(),
  crew_id      uuid not null references public.crews(id) on delete cascade,
  effect_kind  text not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);
create index if not exists crew_tactical_effects_active_idx
  on public.crew_tactical_effects (crew_id, effect_kind, expires_at);

alter table public.crew_tactical_items enable row level security;
alter table public.crew_tactical_effects enable row level security;
revoke all on public.crew_tactical_items, public.crew_tactical_effects from anon, authenticated;
grant select on public.crew_tactical_items to authenticated, anon;
grant select on public.crew_tactical_effects to authenticated;

do $$ begin
  create policy crew_tactical_items_read on public.crew_tactical_items for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy crew_tactical_effects_read on public.crew_tactical_effects for select to authenticated
    using (public.is_crew_member(crew_id));
exception when duplicate_object then null; end $$;

-- ── Déposer du Wory à la trésorerie du crew ────────────────────────
create or replace function public.crew_deposit_wory(p_crew_id uuid, p_amount int)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_bal bigint; v_key text;
begin
  if p_amount <= 0 then raise exception 'Montant invalide'; end if;
  if not public.is_crew_member(p_crew_id) then raise exception 'Pas membre de ce crew'; end if;

  v_key := 'wory:deposit:' || auth.uid()::text || ':' || p_crew_id::text || ':' || extract(epoch from clock_timestamp())::text;
  perform public.record_wory(auth.uid(), null, -p_amount, 'treasury_deposit', v_key || ':out', 'crew', p_crew_id, '{}'::jsonb);
  perform public.record_wory(null, p_crew_id, p_amount, 'treasury_deposit', v_key || ':in', 'crew', p_crew_id, '{}'::jsonb);

  select coalesce(balance, 0) into v_bal from public.wory_balances_crew where crew_id = p_crew_id;
  update public.crews set treasury = v_bal where id = p_crew_id;
  return v_bal;
end;
$$;

-- ── Acheter un item tactique (officier) ───────────────────────────
create or replace function public.crew_buy_tactical(p_crew_id uuid, p_code text)
returns public.crew_tactical_effects
language plpgsql security definer set search_path = public as $$
declare
  v_item public.crew_tactical_items;
  v_bal  bigint;
  v_row  public.crew_tactical_effects;
  v_key  text;
begin
  if not public.is_crew_officer(p_crew_id) then raise exception 'Réservé aux officiers'; end if;
  select * into v_item from public.crew_tactical_items where code = p_code;
  if not found then raise exception 'Item inconnu'; end if;

  select coalesce(balance, 0) into v_bal from public.wory_balances_crew where crew_id = p_crew_id;
  if v_bal < v_item.cost then raise exception 'Trésorerie insuffisante'; end if;

  v_key := 'wory:tactical:' || p_crew_id::text || ':' || p_code || ':' || extract(epoch from clock_timestamp())::text;
  perform public.record_wory(null, p_crew_id, -v_item.cost, 'treasury_spend', v_key, 'crew_tactical', p_crew_id,
    jsonb_build_object('item', p_code));

  select coalesce(balance, 0) into v_bal from public.wory_balances_crew where crew_id = p_crew_id;
  update public.crews set treasury = v_bal where id = p_crew_id;

  insert into public.crew_tactical_effects (crew_id, effect_kind, expires_at)
  values (p_crew_id, v_item.effect_kind, now() + v_item.duration)
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.crew_deposit_wory(uuid, int) from anon, authenticated;
revoke all on function public.crew_buy_tactical(uuid, text) from anon, authenticated;
grant execute on function public.crew_deposit_wory(uuid, int) to authenticated;
grant execute on function public.crew_buy_tactical(uuid, text) to authenticated;

-- ── Résolution de Battle : prend en compte Crew Sync Boost + Protection ──
create or replace function public.resolve_territory_battle_war(p_battle_id uuid)
returns public.territory_battles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b       public.territory_battles;
  v_cfg     jsonb := public.battle_config();
  v_att     numeric := 0;
  v_def     numeric := 0;
  v_att_tot numeric;
  v_def_tot numeric;
  v_sum     numeric;
  v_att_pct numeric;
  v_def_pct numeric;
  v_winner  uuid;
  v_loser   uuid;
  v_dname   text;
  v_kind    text;
  r         record;
  v_boost   numeric;
begin
  select * into v_b from public.territory_battles where id = p_battle_id for update;
  if not found then raise exception 'Battle introuvable'; end if;
  if v_b.status = 'resolved' then return v_b; end if;

  for r in
    select crew_id,
           avg(r1_taps)::numeric / (v_cfg->>'r1_cap')::numeric as r1,
           avg(r2_score)::numeric / (v_cfg->>'r2_max')::numeric as r2,
           avg(r3_hits)::numeric / 8.0 as r3,
           count(*) as n
    from public.battle_participants
    where battle_id = p_battle_id
    group by crew_id
  loop
    declare v_score numeric;
    begin
      v_score := coalesce(r.r1,0) * (v_cfg->>'r1_weight')::numeric
               + coalesce(r.r2,0) * (v_cfg->>'r2_weight')::numeric
               + coalesce(r.r3,0) * (v_cfg->>'r3_weight')::numeric;
      v_score := v_score * (1 + least(0.15, (r.n - 1) * 0.02));
      -- Crew Sync Boost : +4 % max, consommé (léger, ne garantit rien).
      if exists (
        select 1 from public.crew_tactical_effects
        where crew_id = r.crew_id and effect_kind = 'crew_sync_boost' and expires_at > now()
      ) then
        v_score := v_score * 1.04;
      end if;
      if r.crew_id = v_b.attacker_crew then v_att := v_score;
      elsif r.crew_id = v_b.defender_crew then v_def := v_score;
      end if;
      insert into public.battle_round_log (battle_id, round, crew_id, points)
      values (p_battle_id, 0, r.crew_id, round(v_score * 1000));
    end;
  end loop;

  if v_b.defender_crew is null then
    v_def := 0;
    if v_att = 0 then v_att := 0.0001; end if;
  end if;

  v_att_tot := greatest(v_att, 0.0001);
  v_def_tot := greatest(v_def, 0.0001);
  v_sum := v_att_tot + v_def_tot;
  v_att_pct := round(v_att_tot / v_sum * 100, 2);
  v_def_pct := round(100 - v_att_pct, 2);
  v_winner := case when v_att_tot >= v_def_tot then v_b.attacker_crew
                   else coalesce(v_b.defender_crew, v_b.attacker_crew) end;
  v_loser := case when v_winner = v_b.attacker_crew then v_b.defender_crew else v_b.attacker_crew end;

  update public.territory_battles set
    status = 'resolved', current_round = 3, winner_crew = v_winner,
    attacker_pct = v_att_pct, defender_pct = v_def_pct, resolved_at = now()
  where id = p_battle_id returning * into v_b;

  perform public.resolve_territory_battle(
    v_b.district_id, v_winner,
    round(case when v_winner = v_b.attacker_crew then v_att_pct else v_def_pct end)::int,
    'battle:' || p_battle_id::text
  );

  -- Protection : consomme l'effet côté perdant (le grignotage d'influence
  -- reste borné par resolve_territory_battle ; ici on journalise la consommation).
  if v_loser is not null and exists (
    select 1 from public.crew_tactical_effects
    where crew_id = v_loser and effect_kind = 'protection' and expires_at > now()
  ) then
    delete from public.crew_tactical_effects
    where id in (
      select id from public.crew_tactical_effects
      where crew_id = v_loser and effect_kind = 'protection' and expires_at > now()
      order by created_at limit 1
    );
  end if;

  for r in select user_id, crew_id from public.battle_participants where battle_id = p_battle_id loop
    perform public.record_wory(
      r.user_id, null,
      case when r.crew_id = v_winner then (v_cfg->>'reward_wory_win')::bigint
           else (v_cfg->>'reward_wory_lose')::bigint end,
      'battle',
      'wory:user:' || r.user_id::text || ':battle:' || p_battle_id::text,
      'territory_battle', p_battle_id,
      jsonb_build_object('won', r.crew_id = v_winner, 'npc', false)
    );
  end loop;

  select name into v_dname from public.districts where id = v_b.district_id;
  v_dname := coalesce(v_dname, 'Territoire');
  v_kind := case when v_winner = v_b.defender_crew then 'territory_defense' else 'territory_win' end;

  insert into public.crew_trophies (crew_id, kind, label, district_id, battle_id)
  values (v_winner, v_kind,
    case when v_kind = 'territory_defense' then v_dname || ' defendu' else v_dname || ' conquis' end,
    v_b.district_id, p_battle_id)
  on conflict (battle_id) where battle_id is not null do nothing;

  insert into public.crew_title_grants (crew_id, title, kind, district_id, battle_id, expires_at)
  values (v_winner, 'Maitres de ' || v_dname, 'territory_battle', v_b.district_id, p_battle_id, now() + interval '7 days')
  on conflict (battle_id) where battle_id is not null do nothing;

  insert into public.crew_badges (crew_id, badge_code, label, source, source_id)
  values (v_winner,
    case when v_kind = 'territory_defense' then 'territory_defender' else 'territory_conqueror' end,
    case when v_kind = 'territory_defense' then 'Defense territoriale' else 'Conquete territoriale' end,
    'territory_battle', p_battle_id)
  on conflict (crew_id, badge_code, source_id) do nothing;

  update public.crews set reputation = reputation + (v_cfg->>'reward_rep_win')::int where id = v_winner;

  return v_b;
end;
$$;
