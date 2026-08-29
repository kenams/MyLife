-- Battle Rewards / Gages / Trophies.
-- Server-authoritative rewards for Territory Wars. No direct ledger writes.

create table if not exists public.crew_trophies (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  kind        text not null check (kind in ('territory_win', 'territory_defense', 'prestige')),
  label       text not null,
  district_id uuid references public.districts(id) on delete set null,
  battle_id   uuid references public.territory_battles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists crew_trophies_crew_idx on public.crew_trophies (crew_id, created_at desc);
create unique index if not exists crew_trophies_battle_once_idx
  on public.crew_trophies (battle_id) where battle_id is not null;

create table if not exists public.crew_gages (
  id             uuid primary key default gen_random_uuid(),
  target_crew_id uuid not null references public.crews(id) on delete cascade,
  imposed_by_crew_id uuid references public.crews(id) on delete set null,
  gage_code      text not null,
  label          text not null,
  emoji          text not null,
  from_battle_id uuid references public.territory_battles(id) on delete set null,
  expires_at     timestamptz not null default now() + interval '24 hours',
  created_at     timestamptz not null default now(),
  constraint crew_gages_expire_after_create check (expires_at > created_at)
);
create index if not exists crew_gages_active_idx on public.crew_gages (target_crew_id, expires_at);
create unique index if not exists crew_gages_battle_once_idx
  on public.crew_gages (from_battle_id) where from_battle_id is not null;

create table if not exists public.crew_title_grants (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  title       text not null,
  kind        text not null default 'territory_battle'
              check (kind in ('territory_battle', 'season', 'event')),
  district_id uuid references public.districts(id) on delete set null,
  battle_id   uuid references public.territory_battles(id) on delete set null,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists crew_title_grants_active_idx on public.crew_title_grants (crew_id, expires_at);
create unique index if not exists crew_title_grants_battle_once_idx
  on public.crew_title_grants (battle_id) where battle_id is not null;

create table if not exists public.crew_badges (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  badge_code  text not null,
  label       text not null,
  source      text not null default 'territory_battle',
  source_id   uuid,
  created_at  timestamptz not null default now(),
  unique (crew_id, badge_code, source_id)
);
create index if not exists crew_badges_crew_idx on public.crew_badges (crew_id, created_at desc);

alter table public.crew_trophies enable row level security;
alter table public.crew_gages enable row level security;
alter table public.crew_title_grants enable row level security;
alter table public.crew_badges enable row level security;

revoke all on public.crew_trophies, public.crew_gages, public.crew_title_grants, public.crew_badges
  from anon, authenticated;
grant select on public.crew_trophies, public.crew_gages, public.crew_title_grants, public.crew_badges
  to authenticated, anon;

do $$ begin
  create policy crew_trophies_read on public.crew_trophies for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy crew_gages_read on public.crew_gages for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy crew_title_grants_read on public.crew_title_grants for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy crew_badges_read on public.crew_badges for select using (true);
exception when duplicate_object then null; end $$;

create or replace function public.battle_gage_options()
returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('code','poulets',   'emoji','POU', 'label','Poulets de Compans',      'hours',24),
    jsonb_build_object('code','touristes', 'emoji','TOU', 'label','Touristes de Toulouse',   'hours',24),
    jsonb_build_object('code','ecrases',   'emoji','KO', 'label','Ecrases en Battle',       'hours',24)
  );
$$;

create or replace function public.apply_battle_gage(p_battle_id uuid, p_gage_code text)
returns public.crew_gages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b      public.territory_battles;
  v_my     uuid;
  v_loser  uuid;
  v_opt    jsonb;
  v_hours  int;
  v_row    public.crew_gages;
begin
  select * into v_b from public.territory_battles where id = p_battle_id;
  if not found or v_b.status <> 'resolved' then
    raise exception 'Battle non resolue';
  end if;
  if v_b.winner_crew is null then
    raise exception 'Battle sans vainqueur';
  end if;
  if v_b.resolved_at is null or v_b.resolved_at < now() - interval '24 hours' then
    raise exception 'Trop tard pour le gage';
  end if;

  select crew_id into v_my from public.crew_members where user_id = auth.uid() limit 1;
  if v_my is null or v_my <> v_b.winner_crew or not public.is_crew_officer(v_my) then
    raise exception 'Reserve a un officier du crew vainqueur';
  end if;

  v_loser := case
    when v_b.winner_crew = v_b.attacker_crew then v_b.defender_crew
    else v_b.attacker_crew
  end;
  if v_loser is null then
    raise exception 'Pas de perdant pour cette Battle';
  end if;

  select value into v_opt
  from jsonb_array_elements(public.battle_gage_options()) value
  where value->>'code' = p_gage_code;
  if v_opt is null then
    raise exception 'Gage inconnu';
  end if;
  v_hours := greatest(1, least(24, coalesce((v_opt->>'hours')::int, 24)));

  insert into public.crew_gages (
    target_crew_id, imposed_by_crew_id, gage_code, label, emoji, from_battle_id, expires_at
  )
  values (
    v_loser, v_b.winner_crew, p_gage_code, v_opt->>'label', v_opt->>'emoji',
    p_battle_id, now() + make_interval(hours => v_hours)
  )
  on conflict (from_battle_id) where from_battle_id is not null
  do update set target_crew_id = public.crew_gages.target_crew_id
  returning * into v_row;

  return v_row;
end;
$$;

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
  v_dname   text;
  v_kind    text;
  r         record;
begin
  select * into v_b from public.territory_battles where id = p_battle_id for update;
  if not found then
    raise exception 'Battle introuvable';
  end if;
  if v_b.status = 'resolved' then
    return v_b;
  end if;

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
    declare
      v_score numeric;
    begin
      v_score := coalesce(r.r1,0) * (v_cfg->>'r1_weight')::numeric
               + coalesce(r.r2,0) * (v_cfg->>'r2_weight')::numeric
               + coalesce(r.r3,0) * (v_cfg->>'r3_weight')::numeric;
      v_score := v_score * (1 + least(0.15, (r.n - 1) * 0.02));
      if r.crew_id = v_b.attacker_crew then
        v_att := v_score;
      elsif r.crew_id = v_b.defender_crew then
        v_def := v_score;
      end if;
      insert into public.battle_round_log (battle_id, round, crew_id, points)
      values (p_battle_id, 0, r.crew_id, round(v_score * 1000));
    end;
  end loop;

  if v_b.defender_crew is null then
    v_def := 0;
    if v_att = 0 then
      v_att := 0.0001;
    end if;
  end if;

  v_att_tot := greatest(v_att, 0.0001);
  v_def_tot := greatest(v_def, 0.0001);
  v_sum := v_att_tot + v_def_tot;
  v_att_pct := round(v_att_tot / v_sum * 100, 2);
  v_def_pct := round(100 - v_att_pct, 2);
  v_winner := case
    when v_att_tot >= v_def_tot then v_b.attacker_crew
    else coalesce(v_b.defender_crew, v_b.attacker_crew)
  end;

  update public.territory_battles set
    status = 'resolved',
    current_round = 3,
    winner_crew = v_winner,
    attacker_pct = v_att_pct,
    defender_pct = v_def_pct,
    resolved_at = now()
  where id = p_battle_id
  returning * into v_b;

  perform public.resolve_territory_battle(
    v_b.district_id,
    v_winner,
    round(case when v_winner = v_b.attacker_crew then v_att_pct else v_def_pct end)::int,
    'battle:' || p_battle_id::text
  );

  for r in
    select user_id, crew_id
    from public.battle_participants
    where battle_id = p_battle_id
  loop
    perform public.record_wory(
      r.user_id,
      null,
      case
        when r.crew_id = v_winner then (v_cfg->>'reward_wory_win')::bigint
        else (v_cfg->>'reward_wory_lose')::bigint
      end,
      'battle',
      'wory:user:' || r.user_id::text || ':battle:' || p_battle_id::text,
      'territory_battle',
      p_battle_id,
      jsonb_build_object('won', r.crew_id = v_winner, 'npc', false)
    );
  end loop;

  select name into v_dname from public.districts where id = v_b.district_id;
  v_dname := coalesce(v_dname, 'Territoire');
  v_kind := case when v_winner = v_b.defender_crew then 'territory_defense' else 'territory_win' end;

  insert into public.crew_trophies (crew_id, kind, label, district_id, battle_id)
  values (
    v_winner,
    v_kind,
    case when v_kind = 'territory_defense' then v_dname || ' defendu' else v_dname || ' conquis' end,
    v_b.district_id,
    p_battle_id
  )
  on conflict (battle_id) where battle_id is not null do nothing;

  insert into public.crew_title_grants (crew_id, title, kind, district_id, battle_id, expires_at)
  values (
    v_winner,
    'Maitres de ' || v_dname,
    'territory_battle',
    v_b.district_id,
    p_battle_id,
    now() + interval '7 days'
  )
  on conflict (battle_id) where battle_id is not null do nothing;

  insert into public.crew_badges (crew_id, badge_code, label, source, source_id)
  values (
    v_winner,
    case when v_kind = 'territory_defense' then 'territory_defender' else 'territory_conqueror' end,
    case when v_kind = 'territory_defense' then 'Defense territoriale' else 'Conquete territoriale' end,
    'territory_battle',
    p_battle_id
  )
  on conflict (crew_id, badge_code, source_id) do nothing;

  update public.crews
  set reputation = reputation + (v_cfg->>'reward_rep_win')::int
  where id = v_winner;

  return v_b;
end;
$$;

create or replace function public.crew_titles(p_crew_id uuid)
returns table (title text, expires_at timestamptz, source text)
language sql stable security definer set search_path = public as $$
  select title, expires_at, 'temporary'::text
  from public.crew_title_grants
  where crew_id = p_crew_id and (expires_at is null or expires_at > now())
  union all
  select 'Maitres de ' || d.name, null::timestamptz, 'territory'::text
  from public.territories t
  join public.districts d on d.id = t.district_id
  where t.owner_crew_id = p_crew_id and t.prestige >= 2
  order by expires_at nulls last
  limit 3;
$$;

create or replace function public.battle_reward_summary(p_battle_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'battle_id', b.id,
    'winner_crew', b.winner_crew,
    'resolved_at', b.resolved_at,
    'trophies', coalesce((
      select jsonb_agg(jsonb_build_object('crew_id', crew_id, 'kind', kind, 'label', label))
      from public.crew_trophies where battle_id = p_battle_id
    ), '[]'::jsonb),
    'titles', coalesce((
      select jsonb_agg(jsonb_build_object('crew_id', crew_id, 'title', title, 'expires_at', expires_at))
      from public.crew_title_grants where battle_id = p_battle_id
    ), '[]'::jsonb),
    'gages', coalesce((
      select jsonb_agg(jsonb_build_object('target_crew_id', target_crew_id, 'label', label, 'expires_at', expires_at))
      from public.crew_gages where from_battle_id = p_battle_id
    ), '[]'::jsonb)
  )
  from public.territory_battles b
  where b.id = p_battle_id;
$$;

revoke all on function public.apply_battle_gage(uuid, text) from anon, authenticated;
revoke all on function public.resolve_territory_battle_war(uuid) from anon, authenticated;
grant execute on function public.apply_battle_gage(uuid, text) to authenticated;
grant execute on function public.battle_gage_options() to authenticated, anon;
grant execute on function public.crew_titles(uuid) to authenticated, anon;
grant execute on function public.battle_reward_summary(uuid) to authenticated, anon;

do $$ begin
  alter publication supabase_realtime add table public.crew_trophies;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.crew_gages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.crew_title_grants;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.crew_badges;
exception when duplicate_object then null; end $$;
