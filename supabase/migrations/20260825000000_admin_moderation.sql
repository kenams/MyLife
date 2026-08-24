-- Phase 9 : Administration / modération / sécurité — rôles séparés
-- admin/moderator/support, appliqués côté serveur (jamais un flag client),
-- toutes les actions passent par des RPC qui vérifient le rôle et écrivent
-- un log d'audit append-only.

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator', 'support')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id)
);

alter table public.admin_roles enable row level security;
drop policy if exists "admin_roles_select_own" on public.admin_roles;
create policy "admin_roles_select_own" on public.admin_roles
  for select using (user_id = auth.uid());
-- Aucune policy insert/update/delete pour anon/authenticated : l'octroi
-- d'un rôle se fait uniquement via SQL direct (dashboard/MCP), jamais via
-- l'app cliente — élimine toute possibilité d'auto-élévation de privilège.
revoke insert, update, delete on public.admin_roles from anon, authenticated;

create or replace function public.is_staff(p_min_role text default 'support')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = auth.uid()
      and (
        p_min_role = 'support'
        or (p_min_role = 'moderator' and r.role in ('moderator', 'admin'))
        or (p_min_role = 'admin' and r.role = 'admin')
      )
  );
$$;

create table if not exists public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_user_id uuid,
  target_type text,
  target_id uuid,
  details text,
  created_at timestamptz not null default now()
);

alter table public.moderation_log enable row level security;
drop policy if exists "modlog_select_staff" on public.moderation_log;
create policy "modlog_select_staff" on public.moderation_log
  for select using (public.is_staff('support'));
revoke insert, update, delete on public.moderation_log from anon, authenticated;

create table if not exists public.account_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('warning', 'suspension', 'ban')),
  reason text not null,
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id)
);

alter table public.account_sanctions enable row level security;
drop policy if exists "sanctions_select_own_or_staff" on public.account_sanctions;
create policy "sanctions_select_own_or_staff" on public.account_sanctions
  for select using (user_id = auth.uid() or public.is_staff('support'));
revoke insert, update, delete on public.account_sanctions from anon, authenticated;

-- Vue utilisée par le middleware d'accès (Phase 9 non terminée : le blocage
-- effectif des comptes bannis au login reste à brancher côté client, cf.
-- section NON TESTÉ du rapport).
create or replace function public.my_active_sanction()
returns table (kind text, reason text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select kind, reason, expires_at from public.account_sanctions
  where user_id = auth.uid() and active
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;
$$;

revoke all on function public.my_active_sanction() from public;
grant execute on function public.my_active_sanction() to authenticated;

-- ── Recherche joueur (support+) — jamais l'email, uniquement les données
-- déjà publiques (profil, display_name) + id interne pour les actions.
create or replace function public.admin_search_user(p_query text)
returns table (user_id uuid, display_name text, player_id text, level int, crew_id uuid, last_seen timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select pp.user_id, pp.display_name, pp.player_id, pp.level, pp.crew_id, pp.last_seen
  from public.player_profiles pp
  where public.is_staff('support')
    and pp.user_id is not null
    and (pp.display_name ilike '%' || p_query || '%' or pp.player_id ilike '%' || p_query || '%')
  limit 20;
$$;

revoke all on function public.admin_search_user(text) from public;
grant execute on function public.admin_search_user(text) to authenticated;

create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_staff('support') then raise exception 'Accès refusé'; end if;
  select jsonb_build_object(
    'sanctions', (select coalesce(jsonb_agg(s.*), '[]'::jsonb) from public.account_sanctions s where s.user_id = p_user_id),
    'reports_against', (select coalesce(jsonb_agg(r.*), '[]'::jsonb) from public.reports r where r.target_user_id = p_user_id),
    'reports_filed', (select count(*) from public.reports r where r.reporter_user_id = p_user_id)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_user_detail(uuid) from public;
grant execute on function public.admin_user_detail(uuid) to authenticated;

-- ── Sanctions (moderator+) ──
create or replace function public.admin_sanction_user(p_user_id uuid, p_kind text, p_reason text, p_hours int default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_staff('moderator') then raise exception 'Accès refusé'; end if;
  if p_kind not in ('warning', 'suspension', 'ban') then raise exception 'Type de sanction invalide'; end if;

  insert into public.account_sanctions (user_id, kind, reason, expires_at, created_by)
  values (p_user_id, p_kind, p_reason, case when p_hours is not null then now() + (p_hours || ' hours')::interval else null end, auth.uid())
  returning id into v_id;

  insert into public.moderation_log (actor_id, action, target_user_id, target_type, target_id, details)
  values (auth.uid(), 'sanction_' || p_kind, p_user_id, 'user', p_user_id, p_reason);

  return v_id;
end;
$$;

revoke all on function public.admin_sanction_user(uuid, text, text, int) from public;
grant execute on function public.admin_sanction_user(uuid, text, text, int) to authenticated;

create or replace function public.admin_reactivate_user(p_user_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff('moderator') then raise exception 'Accès refusé'; end if;

  update public.account_sanctions set active = false, lifted_at = now(), lifted_by = auth.uid()
  where user_id = p_user_id and active;

  insert into public.moderation_log (actor_id, action, target_user_id, target_type, target_id, details)
  values (auth.uid(), 'reactivate', p_user_id, 'user', p_user_id, p_note);
end;
$$;

revoke all on function public.admin_reactivate_user(uuid, text) from public;
grant execute on function public.admin_reactivate_user(uuid, text) to authenticated;

-- ── Masquer un message (moderator+) — table whitelistée en dur, jamais de
-- SQL dynamique sur un nom de table fourni par le client.
create or replace function public.admin_hide_message(p_table text, p_message_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff('moderator') then raise exception 'Accès refusé'; end if;
  if p_table not in ('dm_messages', 'quartier_messages') then raise exception 'Table non autorisée'; end if;

  if p_table = 'dm_messages' then
    update public.dm_messages set body = '[message masqué par modération]' where id = p_message_id;
  else
    update public.quartier_messages set body = '[message masqué par modération]' where id = p_message_id;
  end if;

  insert into public.moderation_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'hide_message', p_table, p_message_id, p_reason);
end;
$$;

revoke all on function public.admin_hide_message(text, uuid, text) from public;
grant execute on function public.admin_hide_message(text, uuid, text) to authenticated;

-- ── Fermer un événement (moderator+) ──
create or replace function public.admin_close_event(p_event_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff('moderator') then raise exception 'Accès refusé'; end if;

  update public.flash_events set is_active = false where id = p_event_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'close_event', 'flash_event', p_event_id, p_reason);
end;
$$;

revoke all on function public.admin_close_event(uuid, text) from public;
grant execute on function public.admin_close_event(uuid, text) to authenticated;

-- ── Dissoudre un crew (admin only — action lourde, irréversible pour les
-- membres) ──
create or replace function public.admin_disband_crew(p_crew_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff('admin') then raise exception 'Accès refusé'; end if;

  delete from public.crew_members where crew_id = p_crew_id;
  delete from public.crews where id = p_crew_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'disband_crew', 'crew', p_crew_id, p_reason);
end;
$$;

revoke all on function public.admin_disband_crew(uuid, text) from public;
grant execute on function public.admin_disband_crew(uuid, text) to authenticated;

-- ── Traiter un signalement (moderator+) ──
create or replace function public.admin_review_report(p_report_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff('moderator') then raise exception 'Accès refusé'; end if;
  if p_status not in ('reviewed', 'dismissed', 'actioned') then raise exception 'Statut invalide'; end if;

  update public.reports set status = p_status, admin_note = p_note, reviewed_at = now()
  where id = p_report_id;

  insert into public.moderation_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'review_report', 'report', p_report_id, p_status || ': ' || coalesce(p_note, ''));
end;
$$;

revoke all on function public.admin_review_report(uuid, text, text) from public;
grant execute on function public.admin_review_report(uuid, text, text) to authenticated;
