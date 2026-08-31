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

## À vérifier au prochain passage
- Statut de la confirmation email sur le projet Supabase (détermine si on va direct
  sur `/(auth)/avatar` ou si on repasse par l'onglet connexion).
- Créer compte neuf / logout / login / même compte téléphone + desktop : persistance
  pseudo + progression.
