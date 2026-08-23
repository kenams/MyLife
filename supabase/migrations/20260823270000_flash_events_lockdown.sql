-- Trouvé en branchant l'XP des events dans l'UI profil : flash_events avait
-- encore INSERT/UPDATE/DELETE grand ouverts pour authenticated (la RPC
-- create_flash_event existe depuis la migration précédente mais les grants
-- directs n'avaient jamais été retirés) — n'importe quel joueur pouvait créer,
-- modifier ou supprimer les events de n'importe qui. lib/flash-events.ts
-- (createRassemblement) faisait encore des .insert() bruts sur flash_events
-- ET sur flash_event_participants (déjà verrouillée depuis la migration
-- précédente, donc ce second insert échouait déjà silencieusement).
revoke insert, update, delete on public.flash_events from authenticated;
