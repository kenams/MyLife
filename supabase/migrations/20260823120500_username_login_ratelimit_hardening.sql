-- Durcissement rate-limit email_for_username : la limite reposait uniquement
-- sur X-Forwarded-For, un header spoofable côté client (chaque requête avec
-- un XFF différent réinitialise le compteur). Ajout d'une limite par pseudo
-- normalisé (indépendante de l'IP), qui borne le débit d'énumération même
-- si l'IP est falsifiée.

create table if not exists public.username_lookup_by_target (
  username_norm text not null,
  attempted_at   timestamptz not null default now()
);

create index if not exists idx_username_lookup_by_target
  on public.username_lookup_by_target (username_norm, attempted_at desc);

create or replace function public.email_for_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_ip    text;
  v_norm  text;
  v_count_ip     int;
  v_count_target int;
begin
  v_norm := lower(trim(p_username));

  v_ip := coalesce(
    nullif(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    'unknown'
  );
  v_ip := split_part(v_ip, ',', 1);

  delete from public.username_lookup_attempts
  where attempted_at < now() - interval '1 hour';
  delete from public.username_lookup_by_target
  where attempted_at < now() - interval '1 hour';

  select count(*) into v_count_ip
  from public.username_lookup_attempts
  where ip = v_ip and attempted_at > now() - interval '10 minutes';

  -- Limite par cible : même si l'IP est falsifiée à chaque requête, un même
  -- pseudo ne peut être résolu que 5 fois / 10 min tous appelants confondus.
  select count(*) into v_count_target
  from public.username_lookup_by_target
  where username_norm = v_norm and attempted_at > now() - interval '10 minutes';

  if v_count_ip >= 20 or v_count_target >= 5 then
    return null;
  end if;

  insert into public.username_lookup_attempts (ip) values (v_ip);
  insert into public.username_lookup_by_target (username_norm) values (v_norm);

  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = v_norm
  limit 1;

  return v_email;
end;
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

alter table public.username_lookup_by_target enable row level security;
