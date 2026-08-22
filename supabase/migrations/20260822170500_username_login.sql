-- Connexion par pseudo (au lieu d'email) : résout username -> email
-- sans exposer auth.users ni la table entière à l'anon.
-- SECURITY DEFINER : s'exécute avec les droits du propriétaire (accès à auth.users),
-- mais la fonction elle-même ne renvoie qu'un seul email pour un seul pseudo exact.

create or replace function public.email_for_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(p_username))
  limit 1;

  return v_email;
end;
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;
