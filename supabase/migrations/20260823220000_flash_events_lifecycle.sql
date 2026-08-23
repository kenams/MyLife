-- Événements IRL réels : création, participation (avec capacité réellement
-- appliquée côté serveur), check-in géolocalisé prudent, récompense
-- idempotente. flash_events/flash_event_participants existaient déjà mais
-- flash_event_participants n'avait aucune colonne user_id (juste un nom en
-- texte libre) et son policy d'insert était with_check=true : n'importe qui
-- pouvait rejoindre en boucle sous un faux nom, sans limite de capacité,
-- sans lien avec un vrai compte. Repris intégralement en RPC.

alter table public.flash_events add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.flash_event_participants add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.flash_event_participants add column if not exists status text not null default 'joined' check (status in ('joined','checked_in','left'));
alter table public.flash_event_participants add column if not exists checked_in_at timestamptz;
alter table public.flash_event_participants add column if not exists reward_claimed_at timestamptz;
create unique index if not exists flash_event_participants_unique on public.flash_event_participants (event_id, user_id) where user_id is not null;

create table if not exists public.event_reward_ledger (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.flash_events(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  xp_awarded    integer not null default 0,
  money_awarded integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.event_reward_ledger enable row level security;
revoke all on public.event_reward_ledger from anon, authenticated;
grant select on public.event_reward_ledger to authenticated;
create policy "event_reward_ledger_own"
  on public.event_reward_ledger for select
  to authenticated
  using (user_id = auth.uid());

-- Verrouille les policies existantes trouvées grandes ouvertes.
drop policy if exists "flash_participants_insert" on public.flash_event_participants;
revoke insert, update, delete on public.flash_event_participants from authenticated;

-- ── create_flash_event ──────────────────────────────────────────────────────
create or replace function public.create_flash_event(
  p_title text, p_description text, p_emoji text, p_location text,
  p_lat double precision, p_lng double precision,
  p_starts_at timestamptz, p_ends_at timestamptz,
  p_reward_xp int default 0, p_reward_money int default 0,
  p_max_players int default 20, p_kind text default 'social'
)
returns public.flash_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.flash_events;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if length(trim(p_title)) = 0 then
    raise exception 'Titre requis';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'Date de fin invalide';
  end if;
  if p_max_players < 1 then
    raise exception 'Capacité invalide';
  end if;

  insert into public.flash_events (
    title, description, emoji, location, location_lat, location_lng,
    starts_at, ends_at, reward_xp, reward_money, max_players, kind, is_active, created_by
  ) values (
    trim(p_title), p_description, p_emoji, p_location, p_lat, p_lng,
    p_starts_at, p_ends_at, greatest(0, p_reward_xp), greatest(0, p_reward_money),
    p_max_players, p_kind, true, auth.uid()
  )
  returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.create_flash_event(text, text, text, text, double precision, double precision, timestamptz, timestamptz, int, int, int, text) to authenticated;

-- ── join_flash_event : capacité réellement appliquée, idempotent ──────────
create or replace function public.join_flash_event(p_event_id uuid)
returns public.flash_event_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.flash_events;
  v_count int;
  v_row public.flash_event_participants;
  v_name text;
begin
  select * into v_event from public.flash_events where id = p_event_id for update;
  if v_event.id is null or not v_event.is_active then
    raise exception 'Événement introuvable';
  end if;
  if v_event.ends_at < now() then
    raise exception 'Événement terminé';
  end if;

  select * into v_row from public.flash_event_participants where event_id = p_event_id and user_id = auth.uid();
  if v_row.id is not null then
    if v_row.status = 'left' then
      update public.flash_event_participants set status = 'joined' where id = v_row.id returning * into v_row;
      return v_row;
    end if;
    return v_row; -- déjà inscrit, idempotent
  end if;

  select count(*) into v_count from public.flash_event_participants
    where event_id = p_event_id and status in ('joined','checked_in');
  if v_count >= v_event.max_players then
    raise exception 'Événement complet';
  end if;

  select coalesce(username, 'Joueur') into v_name from public.profiles where id = auth.uid();

  insert into public.flash_event_participants (event_id, user_id, player_name, status)
  values (p_event_id, auth.uid(), v_name, 'joined')
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.join_flash_event(uuid) to authenticated;

-- ── leave_flash_event ────────────────────────────────────────────────────
create or replace function public.leave_flash_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.flash_event_participants
    set status = 'left'
    where event_id = p_event_id and user_id = auth.uid() and status <> 'left';
end;
$$;

grant execute on function public.leave_flash_event(uuid) to authenticated;

-- ── checkin_flash_event : fenêtre horaire + zone large, pas de check-in
-- répété, aucune conservation de la position exacte (juste un booléen +
-- horodatage) ───────────────────────────────────────────────────────────────
create or replace function public.checkin_flash_event(p_event_id uuid, p_lat double precision, p_lng double precision)
returns public.flash_event_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.flash_events;
  v_row public.flash_event_participants;
  v_dist_m double precision;
begin
  select * into v_event from public.flash_events where id = p_event_id;
  if v_event.id is null then
    raise exception 'Événement introuvable';
  end if;
  if now() < v_event.starts_at - interval '30 minutes' or now() > v_event.ends_at then
    raise exception 'Hors fenêtre de check-in';
  end if;

  select * into v_row from public.flash_event_participants
    where event_id = p_event_id and user_id = auth.uid() and status in ('joined','checked_in')
    for update;
  if v_row.id is null then
    raise exception 'Tu n''as pas rejoint cet événement';
  end if;
  if v_row.status = 'checked_in' then
    return v_row; -- idempotent, pas de double check-in
  end if;

  if v_event.location_lat is not null and v_event.location_lng is not null then
    -- Haversine approximatif, zone large (500m) : on ne fait pas d'anti-triche
    -- parfait, juste "impossible de valider arbitrairement depuis le client"
    -- comme demandé — la position n'est jamais stockée, seul le résultat l'est.
    v_dist_m := 111320 * sqrt(
      power(p_lat - v_event.location_lat, 2) +
      power((p_lng - v_event.location_lng) * cos(radians(v_event.location_lat)), 2)
    );
    if v_dist_m > 500 then
      raise exception 'Trop loin de l''événement';
    end if;
  end if;

  update public.flash_event_participants
    set status = 'checked_in', checked_in_at = now()
    where id = v_row.id
    returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.checkin_flash_event(uuid, double precision, double precision) to authenticated;

-- ── claim_event_reward : idempotent, une seule fois par (event, user) ──────
create or replace function public.claim_event_reward(p_event_id uuid)
returns public.event_reward_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.flash_events;
  v_part public.flash_event_participants;
  v_ledger public.event_reward_ledger;
begin
  select * into v_event from public.flash_events where id = p_event_id;
  select * into v_part from public.flash_event_participants
    where event_id = p_event_id and user_id = auth.uid() for update;

  if v_part.id is null or v_part.status <> 'checked_in' then
    raise exception 'Check-in requis avant la récompense';
  end if;

  -- Idempotence réelle : la contrainte unique (event_id,user_id) empêche
  -- toute double attribution même en cas de double-clic ou requêtes
  -- concurrentes (on conflict do nothing puis on relit la ligne existante).
  insert into public.event_reward_ledger (event_id, user_id, xp_awarded, money_awarded)
  values (p_event_id, auth.uid(), coalesce(v_event.reward_xp, 0), coalesce(v_event.reward_money, 0))
  on conflict (event_id, user_id) do nothing;

  select * into v_ledger from public.event_reward_ledger where event_id = p_event_id and user_id = auth.uid();

  update public.flash_event_participants
    set reward_claimed_at = coalesce(reward_claimed_at, now())
    where id = v_part.id;

  return v_ledger;
end;
$$;

grant execute on function public.claim_event_reward(uuid) to authenticated;
