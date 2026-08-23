-- Salon de crew : réutilise le système rooms/room_members/room_messages déjà
-- en place (RLS déjà correctement scopée aux membres) plutôt que d'en créer
-- un troisième. On lie une room à son crew et on synchronise l'appartenance
-- avec crew_members dans les RPC existantes.

alter table public.rooms add column if not exists crew_id uuid references public.crews(id) on delete cascade;
create unique index if not exists rooms_crew_id_unique on public.rooms (crew_id) where crew_id is not null;

-- Trouvé en marge : room_messages n'avait aucune garantie que author_id
-- corresponde au véritable expéditeur — un membre de la room pouvait insérer
-- un message en usurpant l'author_id d'un autre membre. Corrigé par trigger
-- plutôt que de retoucher la policy ALL existante (moins de risque de
-- régression sur les rooms publiques déjà en prod).
create or replace function public.room_messages_force_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.author_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists room_messages_force_author_trg on public.room_messages;
create trigger room_messages_force_author_trg
  before insert on public.room_messages
  for each row execute function public.room_messages_force_author();

-- ── create_crew : crée aussi le salon privé du crew ─────────────────────────
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
  v_room_id uuid;
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

  insert into public.rooms (name, kind, owner_id, owner_name, crew_id, member_count, is_active)
  values ('Salon ' || v_crew.name, 'crew', auth.uid(), v_name, v_crew.id, 1, true)
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id, avatar_name)
  values (v_room_id, auth.uid(), v_name);

  return v_crew;
end;
$$;

-- ── respond_crew_invite : ajoute aussi au salon à l'acceptation ────────────
create or replace function public.respond_crew_invite(p_invitation_id uuid, p_accept boolean)
returns public.crew_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.crew_invitations;
  v_name text;
  v_room_id uuid;
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
    insert into public.crew_members (crew_id, user_id, player_name, role)
    values (v_inv.crew_id, auth.uid(), v_name, 'recruit')
    on conflict do nothing;

    update public.crews set member_count = member_count + 1 where id = v_inv.crew_id;

    select id into v_room_id from public.rooms where crew_id = v_inv.crew_id;
    if v_room_id is not null then
      insert into public.room_members (room_id, user_id, avatar_name)
      values (v_room_id, auth.uid(), v_name)
      on conflict do nothing;
      update public.rooms set member_count = member_count + 1 where id = v_room_id;
    end if;
  end if;

  return v_inv;
end;
$$;

-- ── leave_crew : retire aussi du salon ──────────────────────────────────────
create or replace function public.leave_crew(p_crew_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  if exists (select 1 from public.crew_members where crew_id = p_crew_id and user_id = auth.uid() and role = 'founder') then
    raise exception 'Le fondateur doit transférer son rôle avant de partir';
  end if;

  delete from public.crew_members where crew_id = p_crew_id and user_id = auth.uid();
  update public.crews set member_count = greatest(0, member_count - 1) where id = p_crew_id;

  select id into v_room_id from public.rooms where crew_id = p_crew_id;
  if v_room_id is not null then
    delete from public.room_members where room_id = v_room_id and user_id = auth.uid();
    update public.rooms set member_count = greatest(0, member_count - 1) where id = v_room_id;
  end if;
end;
$$;
