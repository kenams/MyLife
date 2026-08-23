-- Relations (amis) — modèle réel avec transitions appliquées côté base,
-- pas seulement masquées côté UI. Toute mutation passe par une fonction
-- SECURITY DEFINER dédiée : la table elle-même n'accepte aucun insert/
-- update/delete direct du client, seulement le service_role et les
-- fonctions ci-dessous. Ça évite d'avoir à répliquer toute la logique de
-- transition (qui peut accepter/annuler/bloquer/débloquer) dans des
-- policies RLS séparées, terrain classique d'erreur (voir le bug Ghost
-- de tout à l'heure).

create table if not exists public.friend_relationships (
  id           uuid primary key default gen_random_uuid(),
  user_low     uuid not null references auth.users(id) on delete cascade,
  user_high    uuid not null references auth.users(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  status       text not null check (status in ('pending','accepted','declined','cancelled','blocked')),
  blocked_by   uuid references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint friend_relationships_no_self check (user_low <> user_high),
  constraint friend_relationships_ordered check (user_low < user_high),
  unique (user_low, user_high)
);

create index if not exists friend_relationships_user_low_idx on public.friend_relationships (user_low);
create index if not exists friend_relationships_user_high_idx on public.friend_relationships (user_high);

create or replace function public.set_updated_at_generic()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists friend_relationships_updated_at on public.friend_relationships;
create trigger friend_relationships_updated_at
  before update on public.friend_relationships
  for each row execute function public.set_updated_at_generic();

alter table public.friend_relationships enable row level security;
revoke all on public.friend_relationships from anon, authenticated;
-- SELECT filtré par la policy ci-dessous (indispensable : sans ce GRANT,
-- même un participant légitime prend un 403 "permission denied" avant même
-- que RLS ait la main — trouvé en testant avec QA-A/QA-C réels). Aucun
-- grant insert/update/delete : toute mutation passe par les fonctions
-- SECURITY DEFINER ci-dessous.
grant select on public.friend_relationships to authenticated;

-- Seule lecture directe autorisée : les deux participants voient leur
-- propre relation (statut, qui a demandé, qui a bloqué). Personne d'autre.
create policy "friend_relationships_select_participant"
  on public.friend_relationships for select
  to authenticated
  using (auth.uid() = user_low or auth.uid() = user_high);

-- ── request_friend ────────────────────────────────────────────────────────
create or replace function public.request_friend(target uuid)
returns public.friend_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_low uuid; v_high uuid;
  v_row public.friend_relationships;
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
      -- Le blocage prend toujours priorité : aucune demande ne peut le contourner.
      raise exception 'Action impossible';
    elsif v_row.status = 'accepted' then
      return v_row; -- déjà amis, idempotent
    elsif v_row.status = 'pending' then
      return v_row; -- demande déjà active, idempotent, pas de doublon
    else
      -- declined/cancelled : on peut redemander, on réécrit la ligne
      update public.friend_relationships
        set status = 'pending', requester_id = auth.uid(), blocked_by = null
        where id = v_row.id
        returning * into v_row;
      return v_row;
    end if;
  end if;

  insert into public.friend_relationships (user_low, user_high, requester_id, status)
  values (v_low, v_high, auth.uid(), 'pending')
  returning * into v_row;
  return v_row;
end;
$$;

-- ── respond_friend : seul le destinataire (pas le demandeur) peut répondre ──
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
  return v_row;
end;
$$;

-- ── cancel_friend_request : seul le demandeur, tant que c'est pending ──────
create or replace function public.cancel_friend_request(target uuid)
returns public.friend_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_low uuid := least(auth.uid(), target);
  v_high uuid := greatest(auth.uid(), target);
  v_row public.friend_relationships;
begin
  select * into v_row from public.friend_relationships where user_low = v_low and user_high = v_high for update;
  if v_row.id is null or v_row.status <> 'pending' or v_row.requester_id <> auth.uid() then
    raise exception 'Rien à annuler';
  end if;
  update public.friend_relationships set status = 'cancelled' where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;

-- ── remove_friend : retirer un ami accepté, les deux côtés peuvent le faire ─
create or replace function public.remove_friend(target uuid)
returns public.friend_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_low uuid := least(auth.uid(), target);
  v_high uuid := greatest(auth.uid(), target);
  v_row public.friend_relationships;
begin
  select * into v_row from public.friend_relationships where user_low = v_low and user_high = v_high for update;
  if v_row.id is null or v_row.status <> 'accepted' then
    raise exception 'Vous n''êtes pas amis';
  end if;
  update public.friend_relationships set status = 'cancelled' where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;

-- ── block_user : priorité absolue, écrase n'importe quel état précédent ────
create or replace function public.block_user_relationship(target uuid)
returns public.friend_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_low uuid := least(auth.uid(), target);
  v_high uuid := greatest(auth.uid(), target);
  v_row public.friend_relationships;
begin
  if target = auth.uid() then
    raise exception 'Action impossible';
  end if;

  insert into public.friend_relationships (user_low, user_high, requester_id, status, blocked_by)
  values (v_low, v_high, auth.uid(), 'blocked', auth.uid())
  on conflict (user_low, user_high)
  do update set status = 'blocked', blocked_by = auth.uid()
  returning * into v_row;
  return v_row;
end;
$$;

-- ── unblock_user : seul l'auteur du blocage peut le lever ──────────────────
create or replace function public.unblock_user_relationship(target uuid)
returns public.friend_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_low uuid := least(auth.uid(), target);
  v_high uuid := greatest(auth.uid(), target);
  v_row public.friend_relationships;
begin
  select * into v_row from public.friend_relationships where user_low = v_low and user_high = v_high for update;
  if v_row.id is null or v_row.status <> 'blocked' or v_row.blocked_by <> auth.uid() then
    raise exception 'Rien à débloquer';
  end if;
  update public.friend_relationships set status = 'cancelled', blocked_by = null where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;

grant execute on function
  public.request_friend(uuid),
  public.respond_friend(uuid, boolean),
  public.cancel_friend_request(uuid),
  public.remove_friend(uuid),
  public.block_user_relationship(uuid),
  public.unblock_user_relationship(uuid)
to authenticated;
