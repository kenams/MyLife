# MyLife MVP

Application mobile Expo + Supabase pour une simulation de vie sociale premium.

## Ce que contient maintenant le MVP

- authentification locale immediate, avec branchement Supabase pret
- onboarding avatar complet
  - identite
  - physique
  - style
  - profil comportemental
  - preferences relationnelles
- moteur de simulation plus dense
  - faim
  - hydratation
  - energie
  - hygiene
  - humeur
  - sociabilite
  - sante
  - forme
  - stress
  - argent
  - reputation
  - discipline
  - motivation
  - poids
  - score social
- actions quotidiennes plus credibles
  - repas sain
  - repas comfort
  - hydratation
  - sommeil
  - douche
  - marche
  - salle
  - travail
  - tache focus
  - cafe
  - restaurant
  - cinema
- monde social enrichi
  - plusieurs quartiers
  - plusieurs lieux utiles
  - residents seedes avec profils
  - relations
  - invitations
  - chat prive et local
- centre d'alertes in-app
- conseils de vie courts et applicables
- architecture realtime Supabase minimale pour le lobby social
- schema SQL plus serieux dans `supabase/schema.sql`

## Lancer le projet

```bash
cd MyLife
npm install
npm run start
```

Controle rapide :

```bash
npm run typecheck
```

## Variables d'environnement

Copier `.env.example` vers `.env.local` si tu veux brancher Supabase :

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Sans ces variables, l'application tourne en mode local persistant pour garder le MVP exploitable.

## Structure utile

- `app/` : routes Expo Router
- `components/avatar-form.tsx` : formulaire avatar complet et reutilisable
- `components/ui.tsx` : primitives UI premium
- `stores/game-store.ts` : orchestration et persistance locale
- `lib/game-engine.ts` : logique de simulation, decay, feed, notifications
- `lib/game-data.ts` : seeds du monde, jobs, activites, options onboarding
- `hooks/use-realtime-lobby.ts` : presence Supabase minimale pour le lobby
- `supabase/schema.sql` : schema backend MVP extensible

## Priorites produit deja couvertes

- boucle quotidienne credible
- progression sociale visible
- conseils concrets lies a l'etat du joueur
- liens sociaux, chat et invitations
- UI plus premium et plus lisible

## Ce qui reste naturel pour une V2

- vraie synchronisation Supabase des avatars, messages et relations
- notifications locales Expo
- persistance serveur des activites et transactions
- pages detail utilisateur partagees
- economie entre joueurs
- moderation et reporting
