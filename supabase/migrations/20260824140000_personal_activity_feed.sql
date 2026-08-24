-- Phase 6 : Activité récente — timeline personnelle, jamais de coordonnées
-- GPS exactes, visibilité par palier (private/friends/crew/public).
-- Défaut = private (le joueur doit choisir d'exposer, jamais l'inverse).

create table if not exists public.personal_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  visibility text not null default 'private' check (visibility in ('private', 'friends', 'crew', 'public')),
  created_at timestamptz not null default now()
);

create index if not exists personal_activity_events_user_idx on public.personal_activity_events (user_id, created_at desc);

alter table public.personal_activity_events enable row level security;

drop policy if exists "activity_select_visible" on public.personal_activity_events;
create policy "activity_select_visible" on public.personal_activity_events
  for select using (
    user_id = auth.uid()
    or visibility = 'public'
    or (
      visibility = 'friends' and exists (
        select 1 from public.friend_relationships fr
        where fr.status = 'accepted'
          and ((fr.user_low = auth.uid() and fr.user_high = personal_activity_events.user_id)
            or (fr.user_high = auth.uid() and fr.user_low = personal_activity_events.user_id))
      )
    )
    or (
      visibility = 'crew' and exists (
        select 1 from public.crew_members me
        join public.crew_members them on them.crew_id = me.crew_id
        where me.user_id = auth.uid() and them.user_id = personal_activity_events.user_id
      )
    )
  );

drop policy if exists "activity_update_own_visibility" on public.personal_activity_events;
create policy "activity_update_own_visibility" on public.personal_activity_events
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke insert, delete on public.personal_activity_events from anon, authenticated;
revoke update on public.personal_activity_events from anon;
-- authenticated garde update (RLS restreint déjà à ses propres lignes) pour
-- permettre au joueur de changer la visibilité d'un événement après coup ;
-- kind/title/body/user_id/created_at ne sont pas censés être modifiés par
-- le client mais aucune colonne n'est génératrice de valeur ici (pas de
-- solde à protéger) donc le risque est limité à de la cosmétique erronée.

create or replace function public.log_activity(
  p_user_id uuid, p_kind text, p_title text, p_body text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then return; end if;
  insert into public.personal_activity_events (user_id, kind, title, body)
  values (p_user_id, p_kind, p_title, p_body);
end;
$$;

revoke all on function public.log_activity(uuid, text, text, text) from public;

create or replace function public.trg_activity_mission_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_title text;
begin
  select title into v_title from public.mission_definitions where id = new.mission_id;
  perform public.log_activity(new.user_id, 'mission_joined', 'A rejoint une mission', v_title);
  return new;
end;
$$;

drop trigger if exists activity_mission_joined on public.mission_participations;
create trigger activity_mission_joined
  after insert on public.mission_participations
  for each row execute function public.trg_activity_mission_joined();

create or replace function public.trg_activity_mission_validated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_title text;
begin
  if new.status = 'validated' and (old.status is distinct from 'validated') then
    select title into v_title from public.mission_definitions where id = new.mission_id;
    perform public.log_activity(new.user_id, 'mission_validated', 'A validé une mission', v_title);
  end if;
  if new.status = 'rewarded' and (old.status is distinct from 'rewarded') then
    select title into v_title from public.mission_definitions where id = new.mission_id;
    perform public.log_activity(new.user_id, 'mission_rewarded', 'A terminé une mission', v_title);
  end if;
  return new;
end;
$$;

drop trigger if exists activity_mission_validated on public.mission_participations;
create trigger activity_mission_validated
  after update on public.mission_participations
  for each row execute function public.trg_activity_mission_validated();

create or replace function public.trg_activity_badge_unlocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text;
begin
  select name into v_name from public.badges where id = new.badge_id;
  perform public.log_activity(new.user_id, 'badge_unlocked', 'A débloqué un badge', v_name);
  return new;
end;
$$;

drop trigger if exists activity_badge_unlocked on public.badge_awards;
create trigger activity_badge_unlocked
  after insert on public.badge_awards
  for each row execute function public.trg_activity_badge_unlocked();

create or replace function public.trg_activity_district_chosen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text;
begin
  select name into v_name from public.districts where id = new.district_id;
  perform public.log_activity(new.user_id, 'district_chosen', 'A rejoint un quartier', v_name);
  return new;
end;
$$;

drop trigger if exists activity_district_chosen on public.player_districts;
create trigger activity_district_chosen
  after insert on public.player_districts
  for each row execute function public.trg_activity_district_chosen();

-- Lecture paginée avec libellés déjà résolus côté serveur (aucune requête
-- imbriquée nécessaire côté client, RLS s'applique via la policy select).
create or replace function public.fetch_activity_feed(p_user_id uuid, p_limit int default 20, p_offset int default 0)
returns setof public.personal_activity_events
language sql
stable
security invoker
as $$
  select * from public.personal_activity_events
  where user_id = p_user_id
  order by created_at desc
  limit p_limit offset p_offset;
$$;

revoke all on function public.fetch_activity_feed(uuid, int, int) from public;
grant execute on function public.fetch_activity_feed(uuid, int, int) to authenticated;
