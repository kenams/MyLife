# MyLife — journal de progression

Document court, mis à jour à chaque PR. Évite de refaire un audit complet à chaque tour.

## Feuille de route (prompt 2026-08-31)
1. **Onboarding + pseudo dès l'inscription** ← en cours
2. NPC Brain V1 (heuristique, pas de LLM par tick)
3. City Pulse / Game Director (1–3 opportunités par ouverture)
4. Offline World ("Pendant ton absence")
5. Crew Life
6. Géopolitique Toulouse
7. Polish Map / mobile

## Invariants
- ONE GAME / ONE ACCOUNT / ONE WORLD / ONE URL. Pas de gameplay mobile parallèle.
- `game-store` = vérité locale du gameplay. Supabase = persistance / sync.
- Migrations : additives, idempotentes, timestampées, RLS correcte.
- No pay-to-win. Wory sans valeur réelle.

## Fait

### 2026-08-31 — Pseudo à l'inscription (branche `claude/onboarding-pseudo-signup`)
- Migration `20260911000000_username_signup.sql` :
  - `username_available(text)` (anon) — format + disponibilité, appelée pendant la saisie.
  - `set_username(text)` (authenticated) — pose/maj le pseudo sur `profiles`, garde-fou
    si la metadata du signup n'a pas été appliquée par le trigger `handle_new_user`.
  - index unique `lower(username)` sur `profiles`.
- `game-store` :
  - `signUp(email, password, username?)` → passe `options.data.username` à Supabase,
    vérifie la dispo avant, renvoie `needsConfirm`. Si session immédiate (confirmation
    email OFF) → `set_username` direct.
  - `checkUsername(username)` → dispo temps réel.
  - `pendingUsername` en state, réutilisé pour préremplir le `displayName` de l'avatar,
    et rejoué via `set_username` à la fin de `completeAvatar`.
- `sign-in.tsx` : champ **Ton pseudo** sur l'onglet inscription + statut live
  (disponible / pris / invalide). Après signup sans confirmation → `/(auth)/avatar`.
- `avatar.tsx` / `AvatarForm` : `displayName` prérempli avec le pseudo choisi.

Flux cible : Inscription (pseudo + email + mot de passe) → Avatar (pseudo prérempli)
→ Map.

### 2026-08-31 (suite) — PR #27 mergée, flux testé en prod
- Testé sur https://mylife-app-rho.vercel.app (E2E navigateur, master) :
  - signup pseudo+email+mdp → check dispo pseudo live OK
  - login **par pseudo** (RPC `email_for_username`) OK
  - 1er login → `/avatar` avec pseudo prérempli → submit → `/map`, avatar synchronisé
    Supabase (`avatars` row + `supabaseAvatarId`), joueur neuf Niv.1 / 0 XP
  - logout → login → retour direct sur `/map`, avatar + progression persistés
  - profil affiche bien le pseudo
- **Compte de test livré** : `KenamsTest` / `kenams42+mylife@gmail.com` / `MyLife2026!`
  (email confirmé à la main en base).
- ⚠️ **Friction restante (non-bloquante pour le compte livré)** : « Confirm email » est
  ON sur le projet Supabase MyLife → un tout nouveau testeur doit cliquer le lien email
  avant d'atteindre la Map. Pour du test ouvert : Supabase → Authentication → Sign In /
  Providers → Email → décocher « Confirm email ». Le code gère déjà les 2 cas
  (`needsConfirm`).
- Bruit relevé (non bloquant) : bandeau « MyLife sur ton téléphone » masque le haut de
  certains écrans sur desktop ; `ACTIVE_CITY.displayName` = « NEO TOULOUSE ».

## NPC Brain V1 — DÉJÀ EN PLACE (2026-08-31)
Vérifié dans le code, rien à réécrire (over-engineering évité) :
- `lib/living-city.ts` + `lib/npc-brain-policy.ts` + `lib/npc-brain.ts` + `NpcState`.
- Chaque PNJ a : 2 archétypes, personnalité, intérêts, quartier d'origine, rythme de
  vie, sociabilité, profil compétitif, crew, mémoire relationnelle (`relationMemory`),
  Wory, trajets coarse domicile→travail→resto→sortie.
- Politique d'intention `chooseNpcAction(npc, ctx, now)` : REST/WORK/EAT/SOCIAL/CREW/
  DATE/SPORT/ROAM selon heure + personnalité + activité du quartier + opportunités +
  cooldown d'initiation. **Zéro LLM par tick** — RNG déterministe seedé par PNJ/minute.
- LOD : NEAR_PLAYER / ACTIVE_DISTRICT / OFFSCREEN (détail dégressif).
- Tests : `npc-brain`, `bot-brain`, `city-intelligence`, `game-director` — verts.
Reste (améliorations, pas V1) : dialogue génératif pour les vraies conversations,
objectifs PNJ multi-jours explicites, rôles sociaux plus fins.

## 2026-08-31 (fin) — PR #28 : fixes trouvés au test prod
- **login → avatar** : pseudo prérempli depuis `profiles.username` + message d'erreur
  visible si vide (le submit était silencieux).
- **map.web** : `loadTimeout` 12s→25s, handler `load` en try/finally (une couche
  secondaire qui échoue n'empêche plus l'affichage de la carte), `map.on('error')`
  log-only. Corrige l'écran « La carte n'a pas pu se charger » sur connexion lente /
  1re visite.
- **Comptes de test prod** (email confirmé en base) :
  - `KenamsTest` / `kenams42+mylife@gmail.com` / `MyLife2026!`
  - `CollabTest` / `kenams42+collab@gmail.com` / `MyLife2026!`
- ⚠️ openfreemap.org (CDN de tuiles gratuit, sans SLA) rate-limite l'IP après un gros
  volume de rechargements (tests). Un vrai utilisateur qui ouvre 1× ne le voit pas.
  Reco moyen terme : provider de tuiles avec quota (MapTiler free) ou fallback raster.
