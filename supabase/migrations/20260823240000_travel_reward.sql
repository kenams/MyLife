-- Récompense de trajet réel : rejoindre un autre joueur à pied doit
-- rapporter des points, mais seulement pour un déplacement plausible (pas
-- un simple appel RPC déclaré depuis le client sans avoir bougé). On ne
-- stocke jamais le tracé GPS complet (juste distance/durée déclarées au
-- moment de l'arrivée) — cohérent avec le reste du projet côté vie privée.

create table if not exists public.travel_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  target_id    uuid references auth.users(id) on delete set null,
  distance_m   integer not null,
  duration_s   integer not null,
  xp_awarded   integer not null default 0,
  safety_bonus boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists travel_log_user_idx on public.travel_log (user_id, created_at desc);

alter table public.travel_log enable row level security;
revoke all on public.travel_log from anon, authenticated;
grant select on public.travel_log to authenticated;
create policy "travel_log_own"
  on public.travel_log for select
  to authenticated
  using (user_id = auth.uid());

-- ── claim_travel_reward ──────────────────────────────────────────────────
-- Vérifie que la vitesse implicite (distance/durée) reste plausible pour un
-- déplacement à pied/course (jusqu'à ~10 km/h, marge généreuse) avant de
-- créditer quoi que ce soit. Pas un anti-triche parfait (on ne voit pas le
-- tracé), mais une validation arbitraire depuis le client est impossible :
-- il faut un couple distance/durée cohérent, sinon 0 XP.
create or replace function public.claim_travel_reward(
  p_target_id uuid, p_distance_m integer, p_duration_s integer, p_destination_verified boolean default false
)
returns public.travel_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_speed_ms double precision;
  v_xp int;
  v_row public.travel_log;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if p_distance_m < 80 then
    raise exception 'Trajet trop court pour être récompensé';
  end if;
  if p_duration_s <= 0 then
    raise exception 'Durée invalide';
  end if;

  v_speed_ms := p_distance_m::double precision / p_duration_s;
  if v_speed_ms > 2.8 then
    -- > ~10 km/h soutenu : pas plausible pour un trajet piéton déclaré comme
    -- tel, on ne crédite rien plutôt que de deviner.
    raise exception 'Trajet non crédité (vitesse implausible)';
  end if;

  -- 1 XP tous les 50m parcourus, plafonné à 100 XP par trajet, +20% si la
  -- destination est une position vérifiée (vrai GPS, pas déclarative).
  v_xp := least(100, p_distance_m / 50);
  if p_destination_verified then
    v_xp := v_xp + (v_xp / 5);
  end if;

  insert into public.travel_log (user_id, target_id, distance_m, duration_s, xp_awarded, safety_bonus)
  values (auth.uid(), p_target_id, p_distance_m, p_duration_s, v_xp, p_destination_verified)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.claim_travel_reward(uuid, integer, integer, boolean) to authenticated;
