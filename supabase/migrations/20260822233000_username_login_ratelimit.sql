-- Durcissement suite à revue sécurité : email_for_username exposait un mapping
-- pseudo -> email direct, exploitable pour de l'énumération en masse.
-- Mitigation : rate-limit par IP (indépendant du fait qu'on soit anon, la
-- connexion se fait justement avant authentification donc anon reste requis)
-- + réponse indiscernable "not found" vs "rate limited", pour ne pas donner
-- d'oracle supplémentaire.

create table if not exists public.username_lookup_attempts (
  ip         text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_username_lookup_attempts_ip_time
  on public.username_lookup_attempts (ip, attempted_at desc);

-- Nettoyage best-effort des vieilles lignes à chaque appel (pas de cron nécessaire)
create or replace function public.email_for_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_ip    text;
  v_count int;
begin
  v_ip := coalesce(
    nullif(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    'unknown'
  );
  v_ip := split_part(v_ip, ',', 1);

  delete from public.username_lookup_attempts
  where attempted_at < now() - interval '1 hour';

  select count(*) into v_count
  from public.username_lookup_attempts
  where ip = v_ip and attempted_at > now() - interval '10 minutes';

  -- 20 tentatives / 10 min / IP : large pour un usage normal (fautes de frappe),
  -- assez bas pour ralentir fortement un scraping automatisé de la table profiles.
  if v_count >= 20 then
    return null;
  end if;

  insert into public.username_lookup_attempts (ip) values (v_ip);

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

alter table public.username_lookup_attempts enable row level security;
-- Aucune policy = personne ne peut lire/écrire directement cette table via l'API,
-- seule la fonction SECURITY DEFINER y touche.
