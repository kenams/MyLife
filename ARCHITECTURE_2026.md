# MyLife - Architecture 2026

Objectif: garder le jeu local-first, rapide sur mobile, mais separer clairement les responsabilites pour pouvoir ajouter de la ville live, du chat, des rooms, de l'IA NPC et du realtime sans transformer les ecrans en fichiers geants.

## Couches

- `app/`: routes Expo Router. Les fichiers ici doivent surtout brancher la navigation et afficher des composants.
- `components/`: UI reutilisable et visuelle, sans logique metier profonde.
- `hooks/`: orchestration React, effets, subscriptions et adaptation mobile/web.
- `lib/`: logique pure du jeu, view-models, moteurs, selectors, sync et helpers testables.
- `stores/`: etat local-first Zustand, actions de mutation et persistance.
- `workers/`: logique serveur peripherique, webhooks, cron et notifications.
- `tests/`: tests des modules purs et des contrats critiques.

## Regles d'evolution

1. Un ecran ne trie pas, ne filtre pas et ne calcule pas les donnees complexes lui-meme.
   Il consomme un view-model venant de `lib/`.

2. Le store reste l'unique source de verite locale.
   Les modules `lib/*` ne mutent rien directement; ils preparent ou calculent.

3. Chaque gros domaine doit avoir son module:
   - social/chat: `lib/social-hub.ts`
   - world/map: `lib/world-*`
   - economy: `lib/economy-*`
   - needs/routine: `lib/selectors.ts` puis extraction progressive
   - NPC intelligence: `lib/npc-*`

4. Les features live doivent etre local-first.
   Si Supabase Realtime tombe, l'app doit encore fonctionner en simulation locale.

5. Toute extraction de logique ajoute au moins un test de contrat.
   Exemple deja en place: `tests/social-hub.test.ts`.

## Premiere brique implementee

`lib/social-hub.ts` transforme les donnees brutes du store en view-model stable pour l'ecran chat:

- contacts en ligne
- proches en ligne
- conversations triees
- rooms rejointes
- rooms disponibles
- invitations en attente
- total non lus
- dernier message du lounge

L'ecran `app/(app)/(tabs)/chat.tsx` se concentre donc davantage sur l'interface MSN 2026, pendant que le tri et la selection sociale vivent dans un module pur et teste.

## Prochaines extractions recommandees

- Extraire `world.tsx` en `lib/world-map-view-model.ts` + composants de carte.
- Decouper `stores/game-store.ts` par slices: auth, avatar, routine, social, rooms, economy, studies.
- Ajouter un adaptateur `lib/realtime-adapter.ts` qui masque Supabase/local simulation derriere une API unique.
- Ajouter des tests sur les rooms: creation, invitation, messages, expiration.
