-- Fix sécurité (revue automatique, HIGH) : player_profiles restait
-- accessible en écriture (INSERT/UPDATE/DELETE) à tout utilisateur
-- authentifié, avec des policies RLS "using (true)"/"with check (true)".
-- player_id étant une chaîne choisie par le client (pas auth.uid()), et
-- l'upsert ciblant onConflict=player_id, n'importe quel compte connecté
-- pouvait écraser argent/xp/réputation/niveau de N'IMPORTE QUEL joueur en
-- devinant son player_id, ou supprimer sa ligne. C'est un IDOR direct sur
-- une table déjà partiellement durcie contre `anon` (migration
-- player_profiles_lockdown, appliquée directement, jamais commit en
-- fichier avant catchup) mais jamais contre `authenticated`.
--
-- Fix : ajout d'un user_id lié à auth.users, RLS scope l'écriture au
-- propriétaire réel. Les lignes existantes (NPC de démo + un compte de
-- dev sans user_id) restent lisibles mais deviennent non modifiables tant
-- qu'aucun utilisateur authentifié n'en revendique la propriété via un
-- premier upsert avec son propre user_id — comportement voulu, pas de vrai
-- joueur n'existe encore en prod donc aucune donnée n'est perdue.
alter table public.player_profiles add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists player_profiles_user_id_key on public.player_profiles (user_id) where user_id is not null;

drop policy if exists "profiles_upsert" on public.player_profiles;
create policy "profiles_upsert" on public.player_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "profiles_update" on public.player_profiles;
create policy "profiles_update" on public.player_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "profiles_delete_own" on public.player_profiles;
create policy "profiles_delete_own" on public.player_profiles
  for delete to authenticated
  using (user_id = auth.uid());

-- Grants déjà présents (INSERT/UPDATE/DELETE authenticated) : on les
-- garde, la policy RLS ci-dessus est maintenant restrictive par ligne au
-- lieu d'être "true" partout — c'est la faille elle-même qui est corrigée,
-- pas juste son symptôme.
