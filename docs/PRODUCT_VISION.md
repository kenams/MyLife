# MyLife — Product Vision (beta working copy)

> Source de vérité courte pour éviter de repartir en brainstorming. Les systèmes existants ne doivent pas être recréés.

## Promesse

**MyLife — Play your life.**

MyLife transforme la vraie ville et la vraie vie sociale en monde ouvert persistant. Le téléphone est un prétexte pour sortir, rencontrer, construire des relations, rejoindre un Crew et voir la ville évoluer.

## Invariants

- ONE GAME / ONE ACCOUNT / ONE WORLD / ONE URL.
- La Map est le jeu.
- `game-store` reste la vérité locale gameplay ; Supabase persiste/synchronise.
- Living City est un moteur générique configuré par ville ; Toulouse est la première configuration, pas un hardcode produit.
- PNJ = bootstrap social et filet de sécurité. À mesure que les humains deviennent pertinents : PNJ FIRST → HYBRIDE → HUMAN FIRST.
- Pas de P2W. Wory n'a aucune valeur réelle, aucun cashout, aucune conversion euro/crypto.
- Aucune mécanique Crew/Territoire ne doit permettre de localiser, suivre, approcher ou confronter physiquement un rival.
- Ghost et confidentialité restent prioritaires ; pas d'historique public de déplacement précis.

## Déjà existant — ne pas recréer

- Living City / NPC Brain V2.
- City Pulse Director V1.
- Offline Return V1 (`livingCity.lastAbsenceSummary` + `components/city-absence-summary.tsx`).
- Crews, territoires et géopolitique Toulouse.
- Auth Supabase, pseudo, avatar, player cloud state, PWA/mobile.

## Bloqueur bêta actuel — NPC SOCIAL V1

Le système NPC n'est pas considéré fini tant que ce parcours n'est pas fiable en production :

**Compte neuf → Map → < 3 min sollicitation PNJ réelle → répondre/refuser → conséquence → relation/mémoire persistée → retour → callback du même PNJ.**

Le joueur doit pouvoir trouver MyLife intéressant avec un seul humain connecté.

Règle produit : pendant une session normale de 10–20 minutes, forte probabilité d'au moins un moment social significatif initié par le monde/PNJ, sauf choix explicite de disponibilité/privacité contraire.

## Après le beta gate

1. Crew Life : HQ vivant, objectif collectif hebdo, contribution, activité, agenda, souvenirs et appartenance.
2. Major NPCs : 5–10 personnages persistants autour du parcours joueur, avec routine, personnalité, objectifs et mémoire significative.
3. Player Needs / disponibilité : faim, énergie, forme, social, humeur + Disponible/Occupé/DND/Ghost, sans transformer le jeu en corvée.
4. Life Events : événements rares et mémorables, pas un flux de notifications.
5. Multi-ville via City Simulation Engine + configs, Toulouse d'abord.

## Beta Gate

Avant invitation large : signup → avatar → Map vivante → interaction NPC → choix → conséquence → fermeture → retour → monde changé et relation mémorisée. Ce parcours doit passer de façon répétée sur téléphone sans seed manuel, console ou intervention Supabase.
