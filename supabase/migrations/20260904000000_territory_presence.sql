-- ═══════════════════════════════════════════════════════════════════════
-- TERRITORY PRESENCE (spec V2 §5) — sécurisé par conception (§6)
-- ═══════════════════════════════════════════════════════════════════════
-- INVARIANT ABSOLU : un Crew peut savoir que son territoire est contesté ;
-- il ne doit JAMAIS pouvoir retrouver physiquement le contestataire.
--
-- Rien ici ne stocke : position, rue, distance, mouvement, avatar, heure
-- précise, historique de déplacements, ni user_id d'un rival. Le contest
-- log est agrégé au CREW et à la JOURNÉE, et n'est lisible que le lendemain
-- (retard volontaire). Les missions d'influence ne peuvent pas faire
-- basculer un territoire (plafond serveur).

create table if not exists public.territory_influence_missions (
  id           uuid primary key default gen_random_uuid(),
  territory_id uuid not null references public.territories(id) on delete cascade,
  user_id      uuid not null default auth.uid(),
  crew_id      uuid not null references public.crews(id) on delete cascade,
  target       int not null default 2,
  progress     int not null default 0,
  status       text not null default 'active' check (status in ('active', 'done', 'claimed', 'expired')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '24 hours'
);

-- Une seule mission d'influence ACTIVE par (territoire, joueur).
create unique index if not exists tim_one_active
  on public.territory_influence_missions (territory_id, user_id)
  where status = 'active';

-- Agrégat : combien de crews rivaux actifs sur un territoire, par jour.
-- Aucune granularité individuelle. Lisible seulement J+1 par le crew proprio.
create table if not exists public.territory_contest_log (
  territory_id   uuid not null references public.territories(id) on delete cascade,
  rival_crew_id  uuid not null references public.crews(id) on delete cascade,
  day            date not null default current_date,
  activity_count int not null default 1,
  primary key (territory_id, rival_crew_id, day)
);

alter table public.territory_influence_missions enable row level security;
alter table public.territory_contest_log enable row level security;
revoke all on public.territory_influence_missions, public.territory_contest_log from anon, authenticated;
grant select on public.territory_influence_missions to authenticated;

do $$ begin
  create policy tim_own on public.territory_influence_missions for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Le contest log n'est PAS exposé en direct : lecture via RPC agrégée + retardée.

-- ── Signaler une activité sur un territoire (appelé après une action IRL) ──
-- Renvoie l'état de la mission d'influence du joueur (créée si besoin).
create or replace function public.report_territory_activity(p_district_id uuid)
returns public.territory_influence_missions
language plpgsql security definer set search_path = public as $$
declare
  v_terr    public.territories;
  v_my_crew uuid;
  v_mission public.territory_influence_missions;
begin
  select * into v_terr from public.territories where district_id = p_district_id;
  if not found then raise exception 'Territoire inconnu'; end if;
  select crew_id into v_my_crew from public.crew_members where user_id = auth.uid() limit 1;

  -- Territoire neutre ou à moi : rien de clandestin.
  if v_terr.owner_crew_id is null or v_terr.owner_crew_id = v_my_crew then
    return null;
  end if;
  if v_my_crew is null then
    return null;
  end if;

  -- Agrégat au crew + jour (jamais l'individu).
  insert into public.territory_contest_log (territory_id, rival_crew_id, day, activity_count)
  values (v_terr.id, v_my_crew, current_date, 1)
  on conflict (territory_id, rival_crew_id, day)
  do update set activity_count = territory_contest_log.activity_count + 1;

  -- Mission d'influence perso.
  select * into v_mission from public.territory_influence_missions
  where territory_id = v_terr.id and user_id = auth.uid() and status = 'active';
  if not found then
    insert into public.territory_influence_missions (territory_id, crew_id)
    values (v_terr.id, v_my_crew) returning * into v_mission;
  end if;

  update public.territory_influence_missions
  set progress = least(target, progress + 1),
      status = case when progress + 1 >= target then 'done' else 'active' end
  where id = v_mission.id returning * into v_mission;

  return v_mission;
end;
$$;

-- ── Réclamer une mission d'influence terminée ─────────────────────────
create or replace function public.claim_influence_mission(p_mission_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_m     public.territory_influence_missions;
  v_terr  public.territories;
  v_gain  int := 30; -- Wory
begin
  select * into v_m from public.territory_influence_missions
  where id = p_mission_id and user_id = auth.uid() for update;
  if not found then raise exception 'Mission introuvable'; end if;
  if v_m.status <> 'done' then raise exception 'Mission non terminée'; end if;

  update public.territory_influence_missions set status = 'claimed' where id = v_m.id;

  -- Petit effet d'influence, PLAFONNÉ : ne peut jamais faire basculer le
  -- territoire (min 1 %, jamais en dessous, jamais de changement de proprio).
  select * into v_terr from public.territories where id = v_m.territory_id for update;
  update public.territories
  set influence = greatest(1, least(99, influence - 2)), updated_at = now()
  where id = v_terr.id and owner_crew_id is not null and owner_crew_id <> v_m.crew_id;

  perform public.record_wory(
    auth.uid(), null, v_gain, 'exploration',
    'wory:influence:' || p_mission_id::text, 'territory_influence_mission', p_mission_id,
    '{}'::jsonb
  );

  return jsonb_build_object('wory', v_gain, 'territory', v_terr.district_id);
end;
$$;

-- ── Résumé de contestation pour le crew proprio (agrégé + RETARDÉ J+1) ──
create or replace function public.territory_contest_summary()
returns table (district_id uuid, district_name text, rival_crews int, total_activity int, last_day date)
language sql security definer set search_path = public as $$
  with my as (select crew_id from public.crew_members where user_id = auth.uid() limit 1)
  select d.id, d.name,
         count(distinct l.rival_crew_id)::int,
         sum(l.activity_count)::int,
         max(l.day)
  from public.territory_contest_log l
  join public.territories t on t.id = l.territory_id
  join public.districts d on d.id = t.district_id
  where t.owner_crew_id = (select crew_id from my)
    and l.day < current_date                    -- retard volontaire : jamais le jour même
    and l.day >= current_date - interval '7 days'
  group by d.id, d.name
  having sum(l.activity_count) > 0;
$$;

revoke all on function public.report_territory_activity(uuid) from anon, authenticated;
revoke all on function public.claim_influence_mission(uuid) from anon, authenticated;
grant execute on function public.report_territory_activity(uuid) to authenticated;
grant execute on function public.claim_influence_mission(uuid) to authenticated;
grant execute on function public.territory_contest_summary() to authenticated;
