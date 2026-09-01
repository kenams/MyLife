# MyLife — journal de progression

Document court, mis à jour à chaque PR. Évite de refaire un audit complet à chaque tour.

## Priorité actuelle
1. **NPC SOCIAL V1 — bloqueur bêta solo**
2. Fermer le gate réel de PR #33 Crew Geopolitics Actions
3. Test production complet sans intervention développeur
4. Crew Life
5. Major NPC persistence / polish social

## Invariants
- ONE GAME / ONE ACCOUNT / ONE WORLD / ONE URL. Pas de gameplay mobile parallèle.
- `game-store` = vérité locale gameplay. Supabase = persistance / sync.
- Migrations additives, idempotentes, timestampées, RLS correcte.
- No pay-to-win. Wory sans valeur réelle.
- Pas de nouveau moteur NPC : réutiliser Living City / NPC Brain / City Pulse / Offline Return.
- Aucun secret, mot de passe ou recovery code dans Git.

## Livré sur master

### Auth / onboarding
- Pseudo dès l'inscription et login par pseudo.
- Avatar prérempli puis persistance Supabase/player cloud state.
- Password Recovery production via PR #34 et route `/reset-password`.
- Les identifiants QA sont conservés hors dépôt et doivent être renouvelés s'ils ont été exposés dans l'historique.

### Living City / NPC
- Living City + NPC Brain heuristique, sans LLM par tick.
- Déplacements coarse, routines, personnalité, intérêts, Crew, Wory et mémoire relationnelle locale.
- Projection Map fréquente sans timer par PNJ.
- Interactions spontanées déjà générées depuis les événements Living City, mais historiquement non garanties/actionnables pour un nouveau joueur.

### City Pulse / Offline
- City Pulse Director V1 : une opportunité contextuelle sur la Map.
- Offline Return V1 : résumé `PENDANT TON ABSENCE` via `livingCity.lastAbsenceSummary`.

### Crews / Toulouse
- Crews, territoires, battles et géopolitique Toulouse visibles.
- PR #33 ajoute les actions Crew contextuelles ; migration distante et hardening sont présents, mais le gate d'action réelle authentifiée doit rester respecté avant merge.

### Mobile / PWA
- Une URL canonique web/PWA, responsive téléphone.
- CI Node + typecheck + tests + export web + Pixel 5 smoke.

## 2026-09-01 — NPC SOCIAL V1 (PR #35)
- Nouveau directeur de présentation branché sur les PNJ Living City existants.
- Première sollicitation dirigée à 45 s sur Map, donc sous le gate produit de 180 s.
- Retour relation connue à 60 s avec continuité explicite.
- `RÉPONDRE` : relation NPC +15 (`contact`) + DM existant ; `npcRelations` et `conversations` sont déjà synchronisés dans Player Cloud State.
- `PAS MAINTENANT` : aucune pénalité relation, cooldown local 3 h.
- QA exclue, priorité quartier, anti double-tap.
- Aucun nouveau moteur/tick/LLM/Realtime/migration.
- Tests unitaires du sélecteur + contrat timing ajoutés.
- Validation production réelle nouveau compte → interaction → logout/login → callback reste obligatoire avant merge final.

## Risques / dette connue
- OpenFreeMap est gratuit sans SLA et peut rate-limit lors de gros volumes de reload QA ; prévoir un provider/fallback avant montée en charge.
- Le README historique reste plus ancien que l'état réel du produit et devra être réécrit après fermeture du beta gate.
- Les anciens secrets présents dans l'historique Git ne sont pas effacés par la modification de ce fichier : les credentials concernés doivent rester considérés compromis/rotatés.
