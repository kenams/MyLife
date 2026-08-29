-- ═══════════════════════════════════════════════════════════════════════
-- DATING V2 (spec §13-14) — la rencontre passe par le monde MyLife.
-- ═══════════════════════════════════════════════════════════════════════
-- Sécurité (§6) : aucune position exacte d'un inconnu. « Open to meet » ne
-- produit que des agrégats de zone (min 3 personnes). Les Croisés ne
-- révèlent jamais où ni quand précisément.

-- ── Préférences relationnelles (volontaires, extensibles) ─────────────
create table if not exists public.dating_prefs (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  relationship_status text not null default 'private'
                      check (relationship_status in ('open','maybe','not_looking','couple','private')),
  -- SÉPARÉ du statut : qui peut m'envoyer un Feeling
  feeling_permission  text not null default 'crossed'
                      check (feeling_permission in ('everyone','crossed','crew','nobody')),
  open_to_meet_until  timestamptz,
  updated_at          timestamptz not null default now()
);

alter table public.dating_prefs enable row level security;
revoke all on public.dating_prefs from anon, authenticated;
grant select on public.dating_prefs to authenticated;

-- Le statut relationnel est public (💚/💛/🩶/❤️/🔒) ; le reste, non.
do $$ begin
  create policy dating_prefs_read on public.dating_prefs for select to authenticated using (true);
exception when duplicate_object then null; end $$;
-- Écriture via RPC uniquement.

-- ── Croisés : deux personnes présentes au même moment de vie ──────────
create table if not exists public.crossings (
  user_low   uuid not null references auth.users(id) on delete cascade,
  user_high  uuid not null references auth.users(id) on delete cascade,
  context    text not null default 'activity',   -- 'event' | 'outing' | 'mission' | 'activity'
  district_id uuid references public.districts(id) on delete set null,
  crossings_count int not null default 1,
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint crossings_ordered check (user_low < user_high)
);

alter table public.crossings enable row level security;
revoke all on public.crossings from anon, authenticated;
grant select on public.crossings to authenticated;

do $$ begin
  create policy crossings_read on public.crossings for select to authenticated
    using (auth.uid() in (user_low, user_high));
exception when duplicate_object then null; end $$;

-- ── Couples déclarés (double confirmation) ───────────────────────────
create table if not exists public.couples (
  user_low   uuid not null references auth.users(id) on delete cascade,
  user_high  uuid not null references auth.users(id) on delete cascade,
  confirmed_low  boolean not null default false,
  confirmed_high boolean not null default false,
  since      timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint couples_ordered check (user_low < user_high)
);

alter table public.couples enable row level security;
revoke all on public.couples from anon, authenticated;
grant select on public.couples to authenticated;
do $$ begin
  create policy couples_read on public.couples for select to authenticated
    using (auth.uid() in (user_low, user_high) or since is not null);
exception when duplicate_object then null; end $$;

-- ── RPC : régler ses préférences ─────────────────────────────────────
create or replace function public.set_dating_prefs(
  p_status text default null,
  p_permission text default null,
  p_open_minutes int default null
) returns public.dating_prefs
language plpgsql security definer set search_path = public as $$
declare v_row public.dating_prefs;
begin
  insert into public.dating_prefs (user_id) values (auth.uid())
  on conflict (user_id) do nothing;

  update public.dating_prefs set
    relationship_status = coalesce(p_status, relationship_status),
    feeling_permission  = coalesce(p_permission, feeling_permission),
    open_to_meet_until  = case
      when p_open_minutes is null then open_to_meet_until
      when p_open_minutes <= 0 then null
      else now() + (least(p_open_minutes, 240) || ' minutes')::interval
    end,
    updated_at = now()
  where user_id = auth.uid()
  returning * into v_row;
  return v_row;
end;
$$;

-- ── RPC : enregistrer un « croisement » (appelé après un moment partagé) ──
create or replace function public.record_crossing(
  p_other uuid, p_context text default 'activity', p_district uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_low uuid; v_high uuid;
begin
  if p_other is null or p_other = auth.uid() then return; end if;
  -- pas de croisement si blocage
  v_low := least(auth.uid(), p_other);
  v_high := greatest(auth.uid(), p_other);
  if exists (select 1 from public.friend_relationships
             where user_low = v_low and user_high = v_high and status = 'blocked') then
    return;
  end if;

  insert into public.crossings (user_low, user_high, context, district_id)
  values (v_low, v_high, coalesce(p_context,'activity'), p_district)
  on conflict (user_low, user_high) do update
    set crossings_count = public.crossings.crossings_count + 1,
        last_at = now(),
        district_id = coalesce(excluded.district_id, public.crossings.district_id);
end;
$$;

-- ── Croisements auto : tous les participants d'un même flash event ────
create or replace function public.record_event_crossings(p_event_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record; v_low uuid; v_high uuid;
begin
  if not exists (
    select 1 from public.flash_event_participants
    where event_id = p_event_id and user_id = auth.uid()
  ) then
    return 0;
  end if;
  for r in
    select user_id from public.flash_event_participants
    where event_id = p_event_id and user_id <> auth.uid()
  loop
    v_low := least(auth.uid(), r.user_id);
    v_high := greatest(auth.uid(), r.user_id);
    if exists (select 1 from public.friend_relationships
               where user_low = v_low and user_high = v_high and status = 'blocked') then
      continue;
    end if;
    insert into public.crossings (user_low, user_high, context)
    values (v_low, v_high, 'event')
    on conflict (user_low, user_high) do update
      set crossings_count = public.crossings.crossings_count + 1, last_at = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.record_event_crossings(uuid) from anon, authenticated;
grant execute on function public.record_event_crossings(uuid) to authenticated;

-- ── send_feeling V2 : respecte feeling_permission de la cible ─────────
create or replace function public.send_feeling(target uuid)
returns table (matched boolean, conversation_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_low uuid; v_high uuid;
  v_reverse_exists boolean;
  v_match_id uuid;
  v_conv_id uuid;
  v_actor_name text;
  v_perm text;
begin
  if target = auth.uid() or auth.uid() is null then
    raise exception 'Action impossible';
  end if;

  v_low := least(auth.uid(), target);
  v_high := greatest(auth.uid(), target);

  if exists (
    select 1 from public.friend_relationships
    where user_low = v_low and user_high = v_high and status = 'blocked'
  ) then
    raise exception 'Action impossible';
  end if;

  -- Permission de la cible (défaut : croisés seulement).
  select coalesce(feeling_permission, 'crossed') into v_perm
  from public.dating_prefs where user_id = target;
  v_perm := coalesce(v_perm, 'crossed');

  if v_perm = 'nobody' then
    raise exception 'Cette personne ne reçoit pas de Feeling en ce moment';
  elsif v_perm = 'crossed' then
    if not exists (select 1 from public.crossings where user_low = v_low and user_high = v_high)
       and not exists (select 1 from public.matches where user_low = v_low and user_high = v_high) then
      raise exception 'Vous devez vous être croisés dans MyLife d''abord';
    end if;
  elsif v_perm = 'crew' then
    if not exists (
      select 1 from public.crew_members m1
      join public.crew_members m2 on m1.crew_id = m2.crew_id
      where m1.user_id = auth.uid() and m2.user_id = target
    ) then
      raise exception 'Réservé aux membres de ton crew';
    end if;
  end if;

  insert into public.feelings (sender_id, target_id)
  values (auth.uid(), target)
  on conflict (sender_id, target_id) do nothing;

  select exists (
    select 1 from public.feelings where sender_id = target and target_id = auth.uid()
  ) into v_reverse_exists;

  if not v_reverse_exists then
    return query select false, null::uuid;
    return;
  end if;

  insert into public.matches (user_low, user_high)
  values (v_low, v_high) on conflict (user_low, user_high) do nothing;
  select id into v_match_id from public.matches where user_low = v_low and user_high = v_high;

  insert into public.chat_conversations (match_id)
  values (v_match_id) on conflict (match_id) do nothing;
  select id into v_conv_id from public.chat_conversations where match_id = v_match_id;

  if not exists (select 1 from public.social_notifications where type = 'match' and target_user_id = auth.uid() and actor_user_id = target) then
    select coalesce(username, 'Un joueur') into v_actor_name from public.profiles where id = target;
    insert into public.social_notifications (target_user_id, actor_user_id, type, title, body)
    values (auth.uid(), target, 'match', '💫 Match !', 'Feeling mutuel avec ' || v_actor_name);
    select coalesce(username, 'Un joueur') into v_actor_name from public.profiles where id = auth.uid();
    insert into public.social_notifications (target_user_id, actor_user_id, type, title, body)
    values (target, auth.uid(), 'match', '💫 Match !', 'Feeling mutuel avec ' || v_actor_name);
  end if;

  return query select true, v_conv_id;
end;
$$;

-- ── Couples : proposer / confirmer ──────────────────────────────────
create or replace function public.propose_couple(p_other uuid)
returns public.couples
language plpgsql security definer set search_path = public as $$
declare v_low uuid; v_high uuid; v_row public.couples; v_am_low boolean;
begin
  if p_other is null or p_other = auth.uid() then raise exception 'Action impossible'; end if;
  -- Il faut un match existant.
  v_low := least(auth.uid(), p_other);
  v_high := greatest(auth.uid(), p_other);
  if not exists (select 1 from public.matches where user_low = v_low and user_high = v_high) then
    raise exception 'Il faut un match d''abord';
  end if;
  v_am_low := auth.uid() = v_low;

  insert into public.couples (user_low, user_high, confirmed_low, confirmed_high)
  values (v_low, v_high, v_am_low, not v_am_low)
  on conflict (user_low, user_high) do update set
    confirmed_low  = public.couples.confirmed_low  or v_am_low,
    confirmed_high = public.couples.confirmed_high or (not v_am_low)
  returning * into v_row;

  if v_row.confirmed_low and v_row.confirmed_high and v_row.since is null then
    update public.couples set since = now() where user_low = v_low and user_high = v_high returning * into v_row;
    insert into public.dating_prefs (user_id, relationship_status)
      select u, 'couple' from unnest(array[v_low, v_high]) u
      on conflict (user_id) do update set relationship_status = 'couple', updated_at = now();
  end if;
  return v_row;
end;
$$;

create or replace function public.break_couple(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_low uuid; v_high uuid;
begin
  v_low := least(auth.uid(), p_other);
  v_high := greatest(auth.uid(), p_other);
  delete from public.couples where user_low = v_low and user_high = v_high;
  update public.dating_prefs set relationship_status = 'private', updated_at = now()
    where user_id in (v_low, v_high) and relationship_status = 'couple';
end;
$$;

-- ── Zones sociales (§13) : AGRÉGAT uniquement, min 3 personnes ────────
create or replace function public.social_zones()
returns table (district_id uuid, district_name text, level text)
language sql stable security definer set search_path = public as $$
  with active as (
    select p.user_id, nd.district_id
    from public.dating_prefs p
    join public.life_map_players mp on mp.user_id = p.user_id
    cross join lateral (
      select d.id as district_id
      from public.districts d
      where mp.lat is not null and mp.lng is not null
      order by (d.center_lat - mp.lat)^2 + (d.center_lng - mp.lng)^2
      limit 1
    ) nd
    where p.open_to_meet_until > now()
      and p.relationship_status in ('open','maybe')
      and mp.status <> 'ghost'
      and coalesce(mp.updated_at, now()) > now() - interval '15 minutes'
  ),
  by_d as (select district_id, count(*) n from active group by district_id)
  select b.district_id, d.name,
         case when b.n >= 8 then 'hot' when b.n >= 5 then 'active' else 'quiet' end
  from by_d b join public.districts d on d.id = b.district_id
  where b.n >= 3;   -- k-anonymat : jamais moins de 3
$$;

revoke all on function public.set_dating_prefs(text, text, int) from anon, authenticated;
revoke all on function public.record_crossing(uuid, text, uuid) from anon, authenticated;
revoke all on function public.propose_couple(uuid) from anon, authenticated;
revoke all on function public.break_couple(uuid) from anon, authenticated;
grant execute on function public.set_dating_prefs(text, text, int) to authenticated;
grant execute on function public.record_crossing(uuid, text, uuid) to authenticated;
grant execute on function public.propose_couple(uuid) to authenticated;
grant execute on function public.break_couple(uuid) to authenticated;
grant execute on function public.social_zones() to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.couples;
exception when duplicate_object then null; end $$;
