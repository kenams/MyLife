-- ═══════════════════════════════════════════════════════════════════════
-- WORY — ledger unifié, auditable, append-only (spec V2 §2)
-- ═══════════════════════════════════════════════════════════════════════
-- Wory est une monnaie virtuelle interne STRICTE : aucune valeur en euros,
-- aucune conversion, aucun retrait, aucune crypto, aucun transfert libre
-- joueur → joueur. Ce ledger est la source de vérité de TOUT mouvement de
-- Wory (portefeuille joueur ET trésorerie de crew).
--
-- On NE remplace PAS les ledgers existants (season_reward_ledger,
-- event_reward_ledger) : ils restent la trace détaillée par domaine. Les
-- nouveaux mouvements passent aussi par ce ledger unifié via record_wory().
-- Un backfill des anciens mouvements pourra être fait plus tard.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.wory_ledger (
  id              uuid primary key default gen_random_uuid(),
  -- exactement une des deux cibles est renseignée
  user_id         uuid references auth.users(id) on delete cascade,
  crew_id         uuid references public.crews(id) on delete cascade,
  delta           bigint not null,          -- + gain, - dépense (jamais 0)
  balance_after   bigint not null,          -- solde résultant (invariant vérifiable)
  reason          text not null,            -- 'mission', 'daily', 'battle_stake', 'event_entry', 'treasury_deposit', ...
  source          text,                     -- table/domaine d'origine
  source_id       uuid,
  idempotency_key text not null unique,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint wory_ledger_one_target check (num_nonnulls(user_id, crew_id) = 1),
  constraint wory_ledger_nonzero check (delta <> 0)
);

create index if not exists wory_ledger_user_idx on public.wory_ledger (user_id, created_at desc);
create index if not exists wory_ledger_crew_idx on public.wory_ledger (crew_id, created_at desc);

alter table public.wory_ledger enable row level security;
revoke all on public.wory_ledger from anon, authenticated;
grant select on public.wory_ledger to authenticated;

-- Lecture : ses propres mouvements, ceux de son crew, ou staff.
do $$ begin
  create policy wory_ledger_read on public.wory_ledger for select to authenticated
    using (
      user_id = auth.uid()
      or (crew_id is not null and public.is_crew_member(crew_id))
      or public.is_staff('support')
    );
exception when duplicate_object then null; end $$;

-- Aucune écriture directe : tout passe par record_wory() (SECURITY DEFINER).
-- Append-only : pas d'UPDATE/DELETE policy → impossible pour authenticated.

-- Soldes courants, dérivés du ledger (jamais stockés indépendamment).
create or replace view public.wory_balances_user as
  select user_id, coalesce(sum(delta), 0)::bigint as balance
  from public.wory_ledger where user_id is not null group by user_id;

create or replace view public.wory_balances_crew as
  select crew_id, coalesce(sum(delta), 0)::bigint as balance
  from public.wory_ledger where crew_id is not null group by crew_id;

-- ── record_wory : unique point d'entrée pour bouger du Wory ──────────────
create or replace function public.record_wory(
  p_user_id         uuid,
  p_crew_id         uuid,
  p_delta           bigint,
  p_reason          text,
  p_idempotency_key text,
  p_source          text default null,
  p_source_id       uuid default null,
  p_metadata        jsonb default '{}'::jsonb,
  p_allow_negative  boolean default false
) returns public.wory_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev    bigint;
  v_after   bigint;
  v_row     public.wory_ledger;
begin
  if num_nonnulls(p_user_id, p_crew_id) <> 1 then
    raise exception 'record_wory: exactement une cible (user OU crew) requise';
  end if;
  if p_delta = 0 then
    raise exception 'record_wory: delta nul interdit';
  end if;

  -- Idempotence : si la clé existe déjà, renvoyer la ligne telle quelle.
  select * into v_row from public.wory_ledger where idempotency_key = p_idempotency_key;
  if found then
    return v_row;
  end if;

  -- Solde courant (verrou implicite via la contrainte unique à l'insert).
  if p_user_id is not null then
    select coalesce(sum(delta), 0) into v_prev from public.wory_ledger where user_id = p_user_id;
  else
    select coalesce(sum(delta), 0) into v_prev from public.wory_ledger where crew_id = p_crew_id;
  end if;

  v_after := v_prev + p_delta;
  if v_after < 0 and not p_allow_negative then
    raise exception 'record_wory: solde insuffisant (% + % < 0)', v_prev, p_delta
      using errcode = 'check_violation';
  end if;

  insert into public.wory_ledger (user_id, crew_id, delta, balance_after, reason, source, source_id, idempotency_key, metadata)
  values (p_user_id, p_crew_id, p_delta, v_after, p_reason, p_source, p_source_id, p_idempotency_key, coalesce(p_metadata, '{}'::jsonb))
  on conflict (idempotency_key) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.wory_ledger where idempotency_key = p_idempotency_key;
  end if;

  return v_row;
end;
$$;

revoke all on function public.record_wory(uuid, uuid, bigint, text, text, text, uuid, jsonb, boolean) from anon, authenticated;

-- Lecture de solde côté client (RPC simple, pas d'accès table).
create or replace function public.my_wory_balance()
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce((select balance from public.wory_balances_user where user_id = auth.uid()), 0);
$$;

create or replace function public.crew_wory_balance(p_crew_id uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select case
    when public.is_crew_member(p_crew_id) or public.is_staff('support')
    then coalesce((select balance from public.wory_balances_crew where crew_id = p_crew_id), 0)
    else null
  end;
$$;

grant execute on function public.my_wory_balance() to authenticated;
grant execute on function public.crew_wory_balance(uuid) to authenticated;
