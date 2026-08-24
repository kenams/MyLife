-- Phase 5 : Défis quotidiens — 3 défis générés côté serveur pour la date
-- Toulouse (Europe/Paris), progression suivie via triggers sur des actions
-- déjà existantes (aucun reroll client, aucune récompense non plafonnée).

create table if not exists public.daily_challenge_templates (
  code text primary key,
  title text not null,
  description text not null,
  category text not null check (category in ('explore', 'move', 'social')),
  target_count int not null default 1,
  reward_xp int not null,
  reward_money int not null,
  active boolean not null default true
);

insert into public.daily_challenge_templates (code, title, description, category, target_count, reward_xp, reward_money) values
  ('join_mission', 'Lance-toi', 'Rejoins une mission de la saison.', 'explore', 1, 20, 30),
  ('validate_mission', 'Mission accomplie', 'Valide une mission de la saison.', 'move', 1, 30, 50),
  ('send_message', 'Reste connecté', 'Envoie un message à quelqu''un.', 'social', 1, 15, 20)
on conflict (code) do nothing;

create table if not exists public.daily_challenge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_date date not null,
  template_code text not null references public.daily_challenge_templates(code),
  count int not null default 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_date, template_code)
);

alter table public.daily_challenge_progress enable row level security;

drop policy if exists "daily_progress_select_own" on public.daily_challenge_progress;
create policy "daily_progress_select_own" on public.daily_challenge_progress
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.daily_challenge_progress from anon, authenticated;
revoke all on public.daily_challenge_templates from anon;
grant select on public.daily_challenge_templates to anon, authenticated;

-- Sélection déterministe de 3 templates pour une date donnée (même date =
-- mêmes défis pour tout le monde, pas de tirage par joueur).
create or replace function public.daily_challenge_codes(p_date date)
returns text[]
language sql
stable
as $$
  select array_agg(code order by code) from (
    select code from public.daily_challenge_templates
    where active
    order by md5(code || p_date::text)
    limit 3
  ) t;
$$;

create or replace function public.today_toulouse_date()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Paris')::date;
$$;

create or replace function public.get_today_challenges()
returns table (
  template_code text, title text, description text, category text,
  target_count int, reward_xp int, reward_money int,
  progress_count int, completed_at timestamptz, claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := public.today_toulouse_date();
  v_codes text[] := public.daily_challenge_codes(v_date);
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;

  insert into public.daily_challenge_progress (user_id, challenge_date, template_code)
  select v_uid, v_date, c from unnest(v_codes) as c
  on conflict (user_id, challenge_date, template_code) do nothing;

  return query
  select t.code, t.title, t.description, t.category, t.target_count, t.reward_xp, t.reward_money,
         p.count, p.completed_at, p.claimed_at
  from public.daily_challenge_templates t
  join public.daily_challenge_progress p
    on p.template_code = t.code and p.user_id = v_uid and p.challenge_date = v_date
  where t.code = any(v_codes)
  order by t.code;
end;
$$;

revoke all on function public.get_today_challenges() from public;
grant execute on function public.get_today_challenges() to authenticated;

create or replace function public.bump_daily_challenge(p_user_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := public.today_toulouse_date();
  v_codes text[] := public.daily_challenge_codes(v_date);
  v_target int;
begin
  if p_user_id is null or not (p_code = any(v_codes)) then return; end if;

  select target_count into v_target from public.daily_challenge_templates where code = p_code;
  if v_target is null then return; end if;

  insert into public.daily_challenge_progress (user_id, challenge_date, template_code, count)
  values (p_user_id, v_date, p_code, 1)
  on conflict (user_id, challenge_date, template_code)
  do update set
    count = least(public.daily_challenge_progress.count + 1, v_target),
    completed_at = case
      when public.daily_challenge_progress.completed_at is not null then public.daily_challenge_progress.completed_at
      when public.daily_challenge_progress.count + 1 >= v_target then now()
      else null
    end
  where public.daily_challenge_progress.completed_at is null;
end;
$$;

revoke all on function public.bump_daily_challenge(uuid, text) from public;

create or replace function public.claim_daily_challenge(p_template_code text)
returns table (xp int, money int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_date date := public.today_toulouse_date();
  v_row public.daily_challenge_progress;
  v_tpl public.daily_challenge_templates;
  v_key text;
begin
  if v_uid is null then raise exception 'Non connecté'; end if;

  select * into v_row from public.daily_challenge_progress
  where user_id = v_uid and challenge_date = v_date and template_code = p_template_code;
  if v_row.id is null or v_row.completed_at is null then
    raise exception 'Défi non terminé';
  end if;
  if v_row.claimed_at is not null then
    raise exception 'Déjà réclamé';
  end if;

  select * into v_tpl from public.daily_challenge_templates where code = p_template_code;
  v_key := 'daily:' || v_uid::text || ':' || v_date::text || ':' || p_template_code;

  insert into public.season_reward_ledger (user_id, source, source_id, xp, money, reputation, idempotency_key)
  values (v_uid, 'daily_challenge', v_row.id, v_tpl.reward_xp, v_tpl.reward_money, 0, v_key)
  on conflict (idempotency_key) do nothing;

  update public.daily_challenge_progress set claimed_at = now() where id = v_row.id;

  insert into public.social_notifications (target_user_id, type, title, body, source, idempotency_key)
  values (v_uid, 'mission_rewarded', 'Défi quotidien réussi', v_tpl.title || ' — +' || v_tpl.reward_xp || ' XP', 'daily_challenge', v_key || ':notif')
  on conflict (idempotency_key) do nothing;

  return query select v_tpl.reward_xp, v_tpl.reward_money;
end;
$$;

revoke all on function public.claim_daily_challenge(text) from public;
grant execute on function public.claim_daily_challenge(text) to authenticated;

-- Triggers de progression — branchés sur des actions déjà existantes,
-- aucune modification des RPC client nécessaire.
create or replace function public.trg_daily_progress_join_mission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_daily_challenge(new.user_id, 'join_mission');
  return new;
end;
$$;

drop trigger if exists daily_progress_join_mission on public.mission_participations;
create trigger daily_progress_join_mission
  after insert on public.mission_participations
  for each row execute function public.trg_daily_progress_join_mission();

create or replace function public.trg_daily_progress_validate_mission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'validated' and (old.status is distinct from 'validated') then
    perform public.bump_daily_challenge(new.user_id, 'validate_mission');
  end if;
  return new;
end;
$$;

drop trigger if exists daily_progress_validate_mission on public.mission_participations;
create trigger daily_progress_validate_mission
  after update on public.mission_participations
  for each row execute function public.trg_daily_progress_validate_mission();

create or replace function public.trg_daily_progress_send_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_daily_challenge(new.sender_id, 'send_message');
  return new;
end;
$$;

drop trigger if exists daily_progress_send_message on public.dm_messages;
create trigger daily_progress_send_message
  after insert on public.dm_messages
  for each row execute function public.trg_daily_progress_send_message();
