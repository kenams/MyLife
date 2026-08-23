-- Cycle de vie complet des crews : création, invitation, acceptation, rôles,
-- départ — tout via RPC SECURITY DEFINER, même raison que pour
-- friend_relationships : éviter de devoir répliquer "qui a le droit de faire
-- quoi" dans plusieurs policies RLS séparées.
--
-- Faille trouvée à l'ouverture de ce chantier : crew_members avait
-- "crew_members_insert" avec with_check = true — n'importe quel compte
-- authentifié pouvait s'insérer dans n'importe quel crew avec le rôle
-- 'founder'. Verrouillé ci-dessous (insert direct révoqué, RPC only).

revoke insert on public.crew_members from authenticated;
revoke insert on public.crews from authenticated;

alter table public.social_notifications drop constraint social_notifications_type_check;
alter table public.social_notifications add constraint social_notifications_type_check
  check (type in ('friend_request','friend_accepted','match','crew_invite'));

create table if not exists public.crew_invitations (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  inviter_id  uuid not null references auth.users(id) on delete cascade,
  invitee_id  uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint crew_invitations_no_self check (inviter_id <> invitee_id),
  unique (crew_id, invitee_id)
);

create index if not exists crew_invitations_invitee_idx on public.crew_invitations (invitee_id);

drop trigger if exists crew_invitations_updated_at on public.crew_invitations;
create trigger crew_invitations_updated_at
  before update on public.crew_invitations
  for each row execute function public.set_updated_at_generic();

alter table public.crew_invitations enable row level security;
revoke all on public.crew_invitations from anon, authenticated;
grant select on public.crew_invitations to authenticated;

create policy "crew_invitations_select_participant"
  on public.crew_invitations for select
  to authenticated
  using (inviter_id = auth.uid() or invitee_id = auth.uid());

-- ── create_crew : le créateur devient founder atomiquement ─────────────────
create or replace function public.create_crew(
  p_name text, p_tag text, p_emoji text, p_color text, p_description text default null
)
returns public.crews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crew public.crews;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if length(trim(p_name)) = 0 or length(trim(p_tag)) = 0 then
    raise exception 'Nom et tag requis';
  end if;

  select coalesce(username, 'Fondateur') into v_name from public.profiles where id = auth.uid();

  insert into public.crews (name, tag, emoji, color, description, founder, member_count, reputation)
  values (trim(p_name), upper(trim(p_tag)), p_emoji, p_color, p_description, v_name, 1, 0)
  returning * into v_crew;

  insert into public.crew_members (crew_id, user_id, player_name, player_emoji, role)
  values (v_crew.id, auth.uid(), v_name, p_emoji, 'founder');

  return v_crew;
end;
$$;

grant execute on function public.create_crew(text, text, text, text, text) to authenticated;

-- ── invite_to_crew : seul un officer/founder du crew peut inviter ──────────
create or replace function public.invite_to_crew(p_crew_id uuid, p_invitee uuid)
returns public.crew_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.crew_invitations;
begin
  if not public.is_crew_officer(p_crew_id) then
    raise exception 'Action impossible';
  end if;
  if p_invitee = auth.uid() then
    raise exception 'Action impossible';
  end if;
  if exists (select 1 from public.crew_members where crew_id = p_crew_id and user_id = p_invitee) then
    raise exception 'Déjà membre';
  end if;

  insert into public.crew_invitations (crew_id, inviter_id, invitee_id, status)
  values (p_crew_id, auth.uid(), p_invitee, 'pending')
  on conflict (crew_id, invitee_id) do update
    set status = 'pending', inviter_id = auth.uid()
    where crew_invitations.status in ('declined', 'cancelled')
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.crew_invitations where crew_id = p_crew_id and invitee_id = p_invitee;
    if v_row.status <> 'pending' then
      raise exception 'Invitation déjà active ou traitée';
    end if;
  end if;

  insert into public.social_notifications (target_user_id, actor_user_id, type, title, body)
  values (p_invitee, auth.uid(), 'crew_invite', 'Invitation de crew',
    (select name from public.crews where id = p_crew_id) || ' t''invite à rejoindre le crew');

  return v_row;
end;
$$;

grant execute on function public.invite_to_crew(uuid, uuid) to authenticated;

-- ── respond_crew_invite : seul l'invité répond, jamais un tiers ────────────
create or replace function public.respond_crew_invite(p_invitation_id uuid, p_accept boolean)
returns public.crew_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.crew_invitations;
  v_name text;
begin
  select * into v_inv from public.crew_invitations where id = p_invitation_id for update;

  if v_inv.id is null or v_inv.invitee_id <> auth.uid() or v_inv.status <> 'pending' then
    raise exception 'Invitation introuvable ou déjà traitée';
  end if;

  update public.crew_invitations
    set status = case when p_accept then 'accepted' else 'declined' end
    where id = p_invitation_id
    returning * into v_inv;

  if p_accept then
    select coalesce(username, 'Membre') into v_name from public.profiles where id = auth.uid();
    -- Toujours 'recruit' à l'entrée : personne ne peut se donner un rôle
    -- supérieur, y compris en acceptant sa propre invitation.
    insert into public.crew_members (crew_id, user_id, player_name, role)
    values (v_inv.crew_id, auth.uid(), v_name, 'recruit')
    on conflict do nothing;

    update public.crews set member_count = member_count + 1 where id = v_inv.crew_id;
  end if;

  return v_inv;
end;
$$;

grant execute on function public.respond_crew_invite(uuid, boolean) to authenticated;

-- ── set_crew_member_role : promotion/rétrogradation, jamais vers founder ───
create or replace function public.set_crew_member_role(p_crew_id uuid, p_target uuid, p_role text)
returns public.crew_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.crew_members;
begin
  if p_role not in ('officer','moderator','member','recruit') then
    raise exception 'Rôle invalide';
  end if;
  if not public.is_crew_officer(p_crew_id) then
    raise exception 'Action impossible';
  end if;
  if exists (select 1 from public.crew_members where crew_id = p_crew_id and user_id = p_target and role = 'founder') then
    raise exception 'Le fondateur ne peut pas être rétrogradé';
  end if;

  update public.crew_members
    set role = p_role
    where crew_id = p_crew_id and user_id = p_target
    returning * into v_row;

  if v_row.id is null then
    raise exception 'Membre introuvable';
  end if;
  return v_row;
end;
$$;

grant execute on function public.set_crew_member_role(uuid, uuid, text) to authenticated;

-- ── leave_crew : uniquement soi-même, le founder ne peut pas partir seul ───
create or replace function public.leave_crew(p_crew_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.crew_members where crew_id = p_crew_id and user_id = auth.uid() and role = 'founder') then
    raise exception 'Le fondateur doit transférer son rôle avant de partir';
  end if;

  delete from public.crew_members where crew_id = p_crew_id and user_id = auth.uid();
  update public.crews set member_count = greatest(0, member_count - 1) where id = p_crew_id;
end;
$$;

grant execute on function public.leave_crew(uuid) to authenticated;
