-- ═══════════════════════════════════════════════════════════════════════
-- TERRITORIES V2 (spec V2 §4) — les quartiers deviennent des territoires
-- persistants : propriétaire crew, influence, prestige, historique.
-- ═══════════════════════════════════════════════════════════════════════
-- Info PUBLIQUE : la Life Map montre à TOUS les joueurs les couleurs du
-- crew propriétaire. Les écritures passent uniquement par des RPC
-- SECURITY DEFINER (résolution de Battle en §7) — jamais en direct.

create table if not exists public.territories (
  id             uuid primary key default gen_random_uuid(),
  district_id    uuid not null unique references public.districts(id) on delete cascade,
  owner_crew_id  uuid references public.crews(id) on delete set null,
  influence      int not null default 50 check (influence between 0 and 100),
  prestige       int not null default 1 check (prestige >= 1),
  conquered_at   timestamptz,
  defenses_won   int not null default 0,
  next_battle_at timestamptz,
  updated_at     timestamptz not null default now()
);

create table if not exists public.territory_events (
  id           uuid primary key default gen_random_uuid(),
  territory_id uuid not null references public.territories(id) on delete cascade,
  kind         text not null check (kind in
                 ('claimed', 'lost', 'defended', 'battle_scheduled', 'influence_shift', 'prestige_up')),
  crew_id      uuid references public.crews(id) on delete set null,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists territory_events_territory_idx
  on public.territory_events (territory_id, created_at desc);

alter table public.territories enable row level security;
alter table public.territory_events enable row level security;
revoke all on public.territories from anon, authenticated;
revoke all on public.territory_events from anon, authenticated;
grant select on public.territories to authenticated, anon;
grant select on public.territory_events to authenticated, anon;

do $$ begin
  create policy territories_read on public.territories for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy territory_events_read on public.territory_events for select using (true);
exception when duplicate_object then null; end $$;

-- Un territoire par quartier existant, neutre au départ.
insert into public.territories (district_id)
select d.id from public.districts d
on conflict (district_id) do nothing;

-- ── Résolution d'une Battle : transfère (ou renforce) un territoire ──────
-- Appelée par le moteur de Territory War (§7). Journalise tout mouvement.
create or replace function public.resolve_territory_battle(
  p_district_id  uuid,
  p_winner_crew  uuid,
  p_influence    int,
  p_idempotency  text
) returns public.territories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terr  public.territories;
  v_prev  uuid;
begin
  select * into v_terr from public.territories where district_id = p_district_id for update;
  if not found then
    insert into public.territories (district_id) values (p_district_id) returning * into v_terr;
  end if;

  -- Idempotence : une même battle ne s'applique qu'une fois.
  if exists (
    select 1 from public.territory_events
    where territory_id = v_terr.id and detail->>'idempotency' = p_idempotency
  ) then
    return v_terr;
  end if;

  v_prev := v_terr.owner_crew_id;

  if v_prev is distinct from p_winner_crew then
    update public.territories set
      owner_crew_id = p_winner_crew,
      influence = greatest(50, least(100, p_influence)),
      conquered_at = now(),
      defenses_won = 0,
      prestige = case when v_prev is not null then prestige else prestige end,
      next_battle_at = null,
      updated_at = now()
    where id = v_terr.id returning * into v_terr;

    insert into public.territory_events (territory_id, kind, crew_id, detail)
    values (v_terr.id, 'claimed', p_winner_crew,
            jsonb_build_object('idempotency', p_idempotency, 'from_crew', v_prev, 'influence', v_terr.influence));
    if v_prev is not null then
      insert into public.territory_events (territory_id, kind, crew_id, detail)
      values (v_terr.id, 'lost', v_prev, jsonb_build_object('idempotency', p_idempotency, 'to_crew', p_winner_crew));
    end if;
  else
    update public.territories set
      influence = greatest(0, least(100, p_influence)),
      defenses_won = defenses_won + 1,
      prestige = prestige + (case when (defenses_won + 1) % 3 = 0 then 1 else 0 end),
      next_battle_at = null,
      updated_at = now()
    where id = v_terr.id returning * into v_terr;

    insert into public.territory_events (territory_id, kind, crew_id, detail)
    values (v_terr.id, 'defended', p_winner_crew,
            jsonb_build_object('idempotency', p_idempotency, 'defenses_won', v_terr.defenses_won));
  end if;

  return v_terr;
end;
$$;

create or replace function public.schedule_territory_battle(
  p_district_id uuid,
  p_at          timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
declare v_terr public.territories;
begin
  select * into v_terr from public.territories where district_id = p_district_id;
  if not found then return; end if;
  update public.territories set next_battle_at = p_at, updated_at = now() where id = v_terr.id;
  insert into public.territory_events (territory_id, kind, crew_id, detail)
  values (v_terr.id, 'battle_scheduled', v_terr.owner_crew_id, jsonb_build_object('at', p_at));
end;
$$;

revoke all on function public.resolve_territory_battle(uuid, uuid, int, text) from anon, authenticated;
revoke all on function public.schedule_territory_battle(uuid, timestamptz) from anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.territories;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.territory_events;
exception when duplicate_object then null; end $$;
