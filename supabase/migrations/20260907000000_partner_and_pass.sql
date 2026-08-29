-- ═══════════════════════════════════════════════════════════════════════
-- PARTNER PLACES (§11) + MY PASS / ÉVÉNEMENTS (§12)
-- ═══════════════════════════════════════════════════════════════════════
-- Architecture PRÉPARÉE, pas activée : partner_venues/offers et
-- sponsored_missions naissent `active = false`. Les Wory restent totalement
-- séparés de l'euro. Les pass sont des jetons aléatoires signés serveur
-- (jamais dérivés du user_id), à usage unique, avec expiration + anti-replay.

-- ── §11 Partenaires ─────────────────────────────────────────────────
create table if not exists public.partner_venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  district_id uuid references public.districts(id) on delete set null,
  kind        text not null default 'bar',
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.partner_offers (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.partner_venues(id) on delete cascade,
  title        text not null,
  perk_text    text not null,
  discount_pct int not null default 0 check (discount_pct between 0 and 100),
  crew_only    boolean not null default true,   -- avantage au crew propriétaire du territoire
  active       boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.sponsored_missions (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.partner_venues(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  reward_wory  int not null default 0 check (reward_wory >= 0),
  active       boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.offer_redemptions (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references public.partner_offers(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  redeemed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ── §12 Événements MyLife + My Pass ─────────────────────────────────
create table if not exists public.mylife_events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  starts_at  timestamptz not null,
  wory_cost  int not null default 0 check (wory_cost >= 0),
  capacity   int,
  created_by uuid not null default auth.uid(),
  active     boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.event_passes (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.mylife_events(id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  -- jeton aléatoire, JAMAIS dérivé du user_id
  token      text not null unique default encode(gen_random_bytes(24), 'hex'),
  status     text not null default 'valid' check (status in ('valid','used','revoked')),
  issued_at  timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz,
  scanned_by uuid,
  unique (event_id, user_id)
);

alter table public.partner_venues       enable row level security;
alter table public.partner_offers       enable row level security;
alter table public.sponsored_missions   enable row level security;
alter table public.offer_redemptions    enable row level security;
alter table public.mylife_events        enable row level security;
alter table public.event_passes         enable row level security;

revoke all on public.partner_venues, public.partner_offers, public.sponsored_missions,
  public.offer_redemptions, public.mylife_events, public.event_passes from anon, authenticated;
grant select on public.partner_venues, public.partner_offers, public.sponsored_missions,
  public.mylife_events to authenticated, anon;
grant select on public.offer_redemptions, public.event_passes to authenticated;

-- Vitrine publique : uniquement ce qui est actif.
do $$ begin
  create policy partner_venues_read on public.partner_venues for select using (active);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy partner_offers_read on public.partner_offers for select using (active);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy sponsored_missions_read on public.sponsored_missions for select using (active);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy mylife_events_read on public.mylife_events for select using (active);
exception when duplicate_object then null; end $$;
-- Pass / redemptions : le sien uniquement (le scan passe par une RPC staff).
do $$ begin
  create policy event_passes_own on public.event_passes for select to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy offer_redemptions_own on public.offer_redemptions for select to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ── Acheter un My Pass (coût en Wory via le ledger unifié) ──────────
create or replace function public.buy_event_pass(p_event_id uuid)
returns public.event_passes
language plpgsql security definer set search_path = public as $$
declare
  v_ev   public.mylife_events;
  v_pass public.event_passes;
  v_count int;
begin
  select * into v_ev from public.mylife_events where id = p_event_id and active;
  if not found then raise exception 'Événement indisponible'; end if;
  if v_ev.starts_at < now() then raise exception 'Événement déjà commencé'; end if;

  select * into v_pass from public.event_passes where event_id = p_event_id and user_id = auth.uid();
  if found then return v_pass; end if;

  if v_ev.capacity is not null then
    select count(*) into v_count from public.event_passes where event_id = p_event_id and status <> 'revoked';
    if v_count >= v_ev.capacity then raise exception 'Complet'; end if;
  end if;

  if v_ev.wory_cost > 0 then
    perform public.record_wory(
      auth.uid(), null, -v_ev.wory_cost, 'event_entry',
      'wory:pass:' || p_event_id::text || ':' || auth.uid()::text,
      'mylife_event', p_event_id, '{}'::jsonb
    );  -- record_wory lève si solde insuffisant
  end if;

  insert into public.event_passes (event_id, expires_at)
  values (p_event_id, v_ev.starts_at + interval '4 hours')
  returning * into v_pass;
  return v_pass;
end;
$$;

-- ── Scanner un pass (organisateur / staff) — atomique, anti-replay ──
create or replace function public.scan_event_pass(p_token text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_pass public.event_passes; v_ev public.mylife_events;
begin
  select * into v_pass from public.event_passes where token = p_token for update;
  if not found then return 'INVALID'; end if;

  select * into v_ev from public.mylife_events where id = v_pass.event_id;
  -- Autorisation : créateur de l'événement ou staff.
  if not (v_ev.created_by = auth.uid() or public.is_staff('support')) then
    raise exception 'Non autorisé à scanner';
  end if;

  if v_pass.status = 'used' then return 'ALREADY_USED'; end if;
  if v_pass.status = 'revoked' then return 'REVOKED'; end if;
  if v_pass.expires_at < now() then return 'EXPIRED'; end if;

  update public.event_passes
  set status = 'used', used_at = now(), scanned_by = auth.uid()
  where id = v_pass.id;
  return 'VALID';
end;
$$;

-- ── §11 : réclamer l'avantage partenaire (crew propriétaire du territoire) ──
create or replace function public.redeem_partner_offer(p_offer_id uuid)
returns public.offer_redemptions
language plpgsql security definer set search_path = public as $$
declare
  v_off   public.partner_offers;
  v_venue public.partner_venues;
  v_my    uuid;
  v_owner uuid;
  v_row   public.offer_redemptions;
begin
  select * into v_off from public.partner_offers where id = p_offer_id and active;
  if not found then raise exception 'Offre indisponible'; end if;
  select * into v_venue from public.partner_venues where id = v_off.venue_id and active;
  if not found then raise exception 'Lieu indisponible'; end if;

  if v_off.crew_only then
    select crew_id into v_my from public.crew_members where user_id = auth.uid() limit 1;
    select owner_crew_id into v_owner from public.territories where district_id = v_venue.district_id;
    if v_my is null or v_my is distinct from v_owner then
      raise exception 'Avantage réservé au crew qui contrôle ce quartier';
    end if;
  end if;

  insert into public.offer_redemptions (offer_id, redeemed_at)
  values (p_offer_id, now())
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.buy_event_pass(uuid) from anon, authenticated;
revoke all on function public.scan_event_pass(text) from anon, authenticated;
revoke all on function public.redeem_partner_offer(uuid) from anon, authenticated;
grant execute on function public.buy_event_pass(uuid) to authenticated;
grant execute on function public.scan_event_pass(text) to authenticated;
grant execute on function public.redeem_partner_offer(uuid) to authenticated;
