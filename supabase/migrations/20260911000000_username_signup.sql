-- Onboarding : le pseudo est choisi dès l'inscription (plus d'email-prefix par défaut).
--   1. username_available(text) : vérification publique (format + disponibilité)
--      appelée en direct pendant la saisie, AVANT signup.
--   2. set_username(text)        : l'utilisateur authentifié fixe / met à jour son
--      pseudo — garde-fou si la metadata du signup n'a pas été prise par le trigger.
--   3. index unique insensible à la casse sur profiles.username.
-- Migration purement additive et idempotente.

-- Unicité insensible à la casse (en plus du `unique` simple déjà présent).
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create or replace function public.username_is_valid(p_username text)
returns boolean
language sql
immutable
as $$
  -- 3 à 20 caractères, lettres / chiffres / underscore, et pas uniquement des chiffres.
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and p_username ~ '[A-Za-z]';
$$;

create or replace function public.username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text := lower(trim(coalesce(p_username, '')));
begin
  if not public.username_is_valid(v_norm) then
    return false;
  end if;
  return not exists (
    select 1 from public.profiles where lower(username) = v_norm
  );
end;
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.set_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw  text := trim(coalesce(p_username, ''));
  v_norm text := lower(v_raw);
  v_uid  uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.username_is_valid(v_raw) then
    raise exception 'invalid username';
  end if;
  if exists (
    select 1 from public.profiles
    where lower(username) = v_norm and id <> v_uid
  ) then
    raise exception 'username taken';
  end if;

  insert into public.profiles (id, username)
  values (v_uid, v_raw)
  on conflict (id) do update set username = excluded.username;

  return v_raw;
end;
$$;

revoke all on function public.set_username(text) from public;
grant execute on function public.set_username(text) to authenticated;
