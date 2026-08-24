-- Trouvé pendant la revalidation Phase 0 de la Life Map (demande Kenams) :
-- `life_map_players` avait deux policies bien plus larges que nécessaire :
--   - "npc_update_map" (UPDATE, rôle anon, qual=true, with_check=true) :
--     n'importe quel visiteur NON CONNECTÉ pouvait modifier la ligne de
--     N'IMPORTE QUEL joueur réel (position, statut, nom affiché...) via
--     l'API REST publique. Le moteur NPC (lib/npc-map-engine.ts) ne cible
--     que des lignes is_npc=true côté client, mais la policy elle-même ne
--     l'imposait pas — pure convention côté client, contournable.
--   - "Service insert" (INSERT, tous rôles, with_check=true) : n'importe
--     qui pouvait insérer une ligne pour n'importe quel user_id. Aucun code
--     client légitime n'en a besoin (le seul insert réel passe par
--     publishPosition -> upsert, déjà couvert par "Insert own").
-- Corrigé : restreint aux lignes is_npc=true uniquement, dans les deux cas.
drop policy if exists "npc_update_map" on public.life_map_players;
create policy "npc_update_map" on public.life_map_players
  for update to anon
  using (is_npc = true)
  with check (is_npc = true);

drop policy if exists "Service insert" on public.life_map_players;
create policy "npc_insert_map" on public.life_map_players
  for insert to anon
  with check (is_npc = true);
