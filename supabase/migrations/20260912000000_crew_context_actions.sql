-- One safe digital Crew contribution per player and UTC day.
-- No location, rival identity, movement, or physical-presence data is stored.

create table if not exists public.crew_context_actions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  crew_id         uuid not null references public.crews(id) on delete cascade,
  territory_id    uuid not null references public.territories(id) on delete cascade,
  action_kind     text not null check (action_kind in ('defend', 'pressure')),
  influence_delta int not null check (influence_delta between -2 and 3 and influence_delta <> 0),
  action_day      date not null default current_date,
  created_at      timestamptz not null default now(),
  unique (user_id, action_day)
);

create index if not exists crew_context_actions_crew_day_idx
  on public.crew_context_actions (crew_id, action_day desc);

alter table public.crew_context_actions enable row level security;
revoke all on public.crew_context_actions from anon, authenticated;
grant select on public.crew_context_actions to authenticated;

drop policy if exists crew_context_actions_read_own on public.crew_context_actions;
create policy crew_context_actions_read_own
  on public.crew_context_actions for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.perform_crew_context_action(p_territory_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_crew      uuid;
  v_territory public.territories%rowtype;
  v_action    public.crew_context_actions%rowtype;
  v_kind      text;
  v_delta     int;
  v_before    int;
  v_after     int;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select crew_id into v_crew
  from public.crew_members
  where user_id = v_uid
  order by joined_at desc
  limit 1;

  if v_crew is null then
    raise exception 'Crew membership required';
  end if;

  select * into v_territory
  from public.territories
  where id = p_territory_id
  for update;

  if not found then
    raise exception 'Unknown territory';
  end if;
  if v_territory.owner_crew_id is null then
    raise exception 'Neutral territories require a Battle';
  end if;

  select * into v_action
  from public.crew_context_actions
  where user_id = v_uid and action_day = current_date;

  if found then
    select influence into v_after
    from public.territories
    where id = v_action.territory_id;

    return jsonb_build_object(
      'applied', false,
      'already_done', true,
      'action_kind', v_action.action_kind,
      'territory_id', v_action.territory_id,
      'influence_delta', v_action.influence_delta,
      'influence_after', v_after
    );
  end if;

  v_before := v_territory.influence;
  if v_territory.owner_crew_id = v_crew then
    v_kind := 'defend';
    v_delta := least(3, 100 - v_before);
  else
    v_kind := 'pressure';
    v_delta := -least(2, v_before - 1);
  end if;

  if v_delta = 0 then
    raise exception 'No influence change available';
  end if;

  insert into public.crew_context_actions (
    user_id, crew_id, territory_id, action_kind, influence_delta
  ) values (
    v_uid, v_crew, v_territory.id, v_kind, v_delta
  )
  on conflict (user_id, action_day) do nothing
  returning * into v_action;

  if not found then
    select * into v_action
    from public.crew_context_actions
    where user_id = v_uid and action_day = current_date;

    select influence into v_after
    from public.territories
    where id = v_action.territory_id;

    return jsonb_build_object(
      'applied', false,
      'already_done', true,
      'action_kind', v_action.action_kind,
      'territory_id', v_action.territory_id,
      'influence_delta', v_action.influence_delta,
      'influence_after', v_after
    );
  end if;

  v_after := greatest(1, least(100, v_before + v_delta));
  update public.territories
  set influence = v_after,
      updated_at = now()
  where id = v_territory.id;

  insert into public.territory_events (territory_id, kind, crew_id, detail)
  values (
    v_territory.id,
    'influence_shift',
    v_crew,
    jsonb_build_object(
      'source', 'crew_context_action',
      'action', v_kind,
      'delta', v_delta,
      'influence_before', v_before,
      'influence_after', v_after
    )
  );

  return jsonb_build_object(
    'applied', true,
    'already_done', false,
    'action_kind', v_kind,
    'territory_id', v_territory.id,
    'influence_delta', v_delta,
    'influence_before', v_before,
    'influence_after', v_after
  );
end;
$$;

revoke all on function public.perform_crew_context_action(uuid) from public, anon;
grant execute on function public.perform_crew_context_action(uuid) to authenticated;
