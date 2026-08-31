-- Local-only smoke test. All fixtures and mutations are rolled back.
begin;

delete from public.crew_context_actions;
delete from public.crew_members
where user_id in (select user_id from public.qa_test_accounts order by label limit 2);
delete from public.crews where name in ('Context Alpha', 'Context Beta');

insert into public.crews (name, tag, emoji, color, founder)
values
  ('Context Alpha', 'CTXA', 'A', '#FFD600', 'QA-A'),
  ('Context Beta', 'CTXB', 'B', '#FF3B3B', 'QA-B');

insert into public.crew_members (crew_id, user_id, player_name, role)
select
  crew.id,
  qa.user_id,
  qa.label,
  'member'
from (
  select user_id, label, row_number() over (order by label) as row_number
  from public.qa_test_accounts
  order by label
  limit 2
) qa
join public.crews crew
  on crew.name = case qa.row_number when 1 then 'Context Alpha' else 'Context Beta' end;

with ranked as (
  select id, row_number() over (order by id) as row_number
  from public.territories
)
update public.territories territory
set owner_crew_id = crew.id,
    influence = case ranked.row_number when 1 then 55 else 75 end,
    updated_at = now()
from ranked
join public.crews crew
  on crew.name = case ranked.row_number when 1 then 'Context Alpha' else 'Context Beta' end
where territory.id = ranked.id
  and ranked.row_number <= 2;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.qa_test_accounts order by label limit 1),
  true
);
set local role authenticated;
select public.perform_crew_context_action((
  select territory.id
  from public.territories territory
  join public.crews crew on crew.id = territory.owner_crew_id
  where crew.name = 'Context Alpha'
  limit 1
)) as first_defense;
reset role;

do $$
begin
  if (select influence from public.territories territory join public.crews crew on crew.id = territory.owner_crew_id where crew.name = 'Context Alpha') <> 58 then
    raise exception 'Defense did not add 3 influence';
  end if;
  if (select count(*) from public.crew_context_actions) <> 1 then
    raise exception 'First action was not recorded exactly once';
  end if;
end;
$$;

set local role authenticated;
select public.perform_crew_context_action((
  select territory.id
  from public.territories territory
  join public.crews crew on crew.id = territory.owner_crew_id
  where crew.name = 'Context Beta'
  limit 1
)) as duplicate_blocked;
reset role;

do $$
begin
  if (select influence from public.territories territory join public.crews crew on crew.id = territory.owner_crew_id where crew.name = 'Context Beta') <> 75 then
    raise exception 'Second action on the same day changed another territory';
  end if;
  if (select count(*) from public.crew_context_actions) <> 1 then
    raise exception 'Daily idempotency failed';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.qa_test_accounts order by label offset 1 limit 1),
  true
);
set local role authenticated;
select public.perform_crew_context_action((
  select territory.id
  from public.territories territory
  join public.crews crew on crew.id = territory.owner_crew_id
  where crew.name = 'Context Alpha'
  limit 1
)) as rival_pressure;
reset role;

do $$
declare
  v_alpha_id uuid;
begin
  select id into v_alpha_id from public.crews where name = 'Context Alpha';
  if (select influence from public.territories where owner_crew_id = v_alpha_id) <> 56 then
    raise exception 'Pressure did not remove 2 influence after defense';
  end if;
  if (select count(*) from public.territories where owner_crew_id = v_alpha_id) <> 1 then
    raise exception 'Pressure transferred territory ownership';
  end if;
  if (select count(*) from public.crew_context_actions) <> 2 then
    raise exception 'Independent Crew action was not recorded';
  end if;
  if (select count(*) from public.territory_events where detail->>'source' = 'crew_context_action') <> 2 then
    raise exception 'Visible territory history was not recorded';
  end if;
end;
$$;

rollback;
