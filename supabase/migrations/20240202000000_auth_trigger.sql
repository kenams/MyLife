-- Migration 003 — Trigger auth : création automatique du profil
-- + trigger updated_at sur avatars et studies

-- Auto-création du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automatique
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_avatars_updated_at on avatars;
create trigger set_avatars_updated_at
  before update on avatars
  for each row execute function public.set_updated_at();

drop trigger if exists set_studies_updated_at on studies;
create trigger set_studies_updated_at
  before update on studies
  for each row execute function public.set_updated_at();
