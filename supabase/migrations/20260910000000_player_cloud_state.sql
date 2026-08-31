-- Cross-device snapshot for local-first player state.
-- World simulation (NPCs, city ticks, map camera) intentionally stays client/runtime-side.

create table if not exists public.player_cloud_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  revision    bigint not null default 0 check (revision >= 0),
  updated_at  timestamptz not null default now(),
  constraint player_cloud_state_object check (jsonb_typeof(state) = 'object')
);

create table if not exists public.player_sync_mutations (
  user_id      uuid not null references auth.users(id) on delete cascade,
  mutation_id  text not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, mutation_id),
  constraint player_sync_mutation_id_length check (length(mutation_id) between 1 and 160)
);

create index if not exists player_sync_mutations_created_idx
  on public.player_sync_mutations (user_id, created_at desc);

alter table public.player_cloud_state enable row level security;
alter table public.player_sync_mutations enable row level security;

revoke all on public.player_cloud_state from anon, authenticated;
revoke all on public.player_sync_mutations from anon, authenticated;
grant select on public.player_cloud_state to authenticated;

drop policy if exists player_cloud_state_read_own on public.player_cloud_state;
create policy player_cloud_state_read_own
  on public.player_cloud_state for select to authenticated
  using (user_id = auth.uid());

-- Writes are serialized here so a stale device cannot overwrite a newer snapshot.
-- Reusing a mutation id returns the canonical state without applying it twice.
create or replace function public.sync_player_cloud_state(
  p_state jsonb,
  p_expected_revision bigint,
  p_mutation_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.player_cloud_state%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'player state must be a JSON object';
  end if;
  if octet_length(p_state::text) > 1048576 then
    raise exception 'player state exceeds 1 MiB';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid expected revision';
  end if;
  if p_mutation_id is null or length(p_mutation_id) not between 1 and 160 then
    raise exception 'invalid mutation id';
  end if;

  insert into public.player_cloud_state (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.player_cloud_state
  where user_id = v_uid
  for update;

  if exists (
    select 1 from public.player_sync_mutations
    where user_id = v_uid and mutation_id = p_mutation_id
  ) then
    return jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'conflict', false,
      'revision', v_row.revision,
      'updated_at', v_row.updated_at,
      'state', v_row.state
    );
  end if;

  if v_row.revision <> p_expected_revision then
    return jsonb_build_object(
      'applied', false,
      'duplicate', false,
      'conflict', true,
      'revision', v_row.revision,
      'updated_at', v_row.updated_at,
      'state', v_row.state
    );
  end if;

  insert into public.player_sync_mutations (user_id, mutation_id)
  values (v_uid, p_mutation_id);

  update public.player_cloud_state
  set state = p_state,
      revision = revision + 1,
      updated_at = now()
  where user_id = v_uid
  returning * into v_row;

  return jsonb_build_object(
    'applied', true,
    'duplicate', false,
    'conflict', false,
    'revision', v_row.revision,
    'updated_at', v_row.updated_at,
    'state', v_row.state
  );
end;
$$;

revoke all on function public.sync_player_cloud_state(jsonb, bigint, text) from public, anon;
grant execute on function public.sync_player_cloud_state(jsonb, bigint, text) to authenticated;
