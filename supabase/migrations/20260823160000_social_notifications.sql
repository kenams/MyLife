-- Centre de notifications sociales réel — alimenté par les RPC de
-- friend_relationships (SECURITY DEFINER, donc l'insert ici bypass RLS
-- volontairement : c'est le seul chemin d'écriture, aucun grant insert
-- client n'existe sur cette table).
create table if not exists public.social_notifications (
  id              uuid primary key default gen_random_uuid(),
  target_user_id  uuid not null references auth.users(id) on delete cascade,
  actor_user_id   uuid references auth.users(id) on delete set null,
  type            text not null check (type in ('friend_request','friend_accepted','match')),
  title           text not null,
  body            text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists social_notifications_target_idx
  on public.social_notifications (target_user_id, created_at desc);

alter table public.social_notifications enable row level security;
revoke all on public.social_notifications from anon, authenticated;
grant select, update on public.social_notifications to authenticated;

create policy "social_notifications_owner_select"
  on public.social_notifications for select
  to authenticated
  using (target_user_id = auth.uid());

-- Update restreint à la lecture (read_at) de sa propre notification —
-- le reste (titre, acteur, type) doit rester tel qu'émis par le serveur.
create policy "social_notifications_owner_mark_read"
  on public.social_notifications for update
  to authenticated
  using (target_user_id = auth.uid())
  with check (target_user_id = auth.uid());

create or replace function public.mark_notification_read(notif_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.social_notifications
  set read_at = now()
  where id = notif_id and target_user_id = auth.uid() and read_at is null;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.social_notifications
  set read_at = now()
  where target_user_id = auth.uid() and read_at is null;
$$;

grant execute on function public.mark_notification_read(uuid), public.mark_all_notifications_read() to authenticated;

-- ── request_friend : notifie la cible d'une nouvelle demande ───────────────
create or replace function public.request_friend(target uuid)
returns public.friend_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_low uuid; v_high uuid;
  v_row public.friend_relationships;
  v_actor_name text;
begin
  if target = auth.uid() then
    raise exception 'Impossible de s''ajouter soi-même';
  end if;
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  v_low  := least(auth.uid(), target);
  v_high := greatest(auth.uid(), target);

  select * into v_row from public.friend_relationships where user_low = v_low and user_high = v_high for update;

  if v_row.id is not null then
    if v_row.status = 'blocked' then
      raise exception 'Action impossible';
    elsif v_row.status = 'accepted' then
      return v_row;
    elsif v_row.status = 'pending' then
      return v_row;
    else
      update public.friend_relationships
        set status = 'pending', requester_id = auth.uid(), blocked_by = null
        where id = v_row.id
        returning * into v_row;
      select coalesce(username, 'Un joueur') into v_actor_name from public.profiles where id = auth.uid();
      insert into public.social_notifications (target_user_id, actor_user_id, type, title, body)
      values (target, auth.uid(), 'friend_request', 'Nouvelle demande d''ami', v_actor_name || ' veut t''ajouter en ami');
      return v_row;
    end if;
  end if;

  insert into public.friend_relationships (user_low, user_high, requester_id, status)
  values (v_low, v_high, auth.uid(), 'pending')
  returning * into v_row;

  select coalesce(username, 'Un joueur') into v_actor_name from public.profiles where id = auth.uid();
  insert into public.social_notifications (target_user_id, actor_user_id, type, title, body)
  values (target, auth.uid(), 'friend_request', 'Nouvelle demande d''ami', v_actor_name || ' veut t''ajouter en ami');

  return v_row;
end;
$$;

-- ── respond_friend : notifie le demandeur si acceptée ───────────────────────
create or replace function public.respond_friend(target uuid, accept boolean)
returns public.friend_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_low uuid := least(auth.uid(), target);
  v_high uuid := greatest(auth.uid(), target);
  v_row public.friend_relationships;
  v_actor_name text;
begin
  select * into v_row from public.friend_relationships where user_low = v_low and user_high = v_high for update;

  if v_row.id is null or v_row.status <> 'pending' then
    raise exception 'Aucune demande en attente';
  end if;
  if v_row.requester_id = auth.uid() then
    raise exception 'Le demandeur ne peut pas répondre à sa propre demande';
  end if;

  update public.friend_relationships
    set status = case when accept then 'accepted' else 'declined' end
    where id = v_row.id
    returning * into v_row;

  if accept then
    select coalesce(username, 'Un joueur') into v_actor_name from public.profiles where id = auth.uid();
    insert into public.social_notifications (target_user_id, actor_user_id, type, title, body)
    values (v_row.requester_id, auth.uid(), 'friend_accepted', 'Demande acceptée', v_actor_name || ' a accepté ta demande d''ami');
  end if;

  return v_row;
end;
$$;
