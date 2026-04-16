# MyLife — Architecture Technique v2

## Stack

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend mobile | React Native + Expo (Router) | UI, navigation, game loop local |
| State | Zustand + AsyncStorage | Local-first, persistance offline |
| Backend core | Supabase (PostgreSQL + Auth + Realtime) | Auth, data prod, sync, présence |
| Serveur léger | Cloudflare Workers | Webhooks, cron, push dispatch |
| Notifications push | Expo Push API | Envoi via Worker |
| Analytics | `analytics_events` (Supabase) | Événements in-app |

---

## Architecture globale

```
┌─────────────────────────────────────────┐
│           Expo App (React Native)        │
│  ┌──────────────┐  ┌───────────────────┐│
│  │  game-store  │  │  Supabase Client  ││
│  │  (Zustand)   │◄─►│  Auth + Realtime  ││
│  └──────┬───────┘  └────────┬──────────┘│
└─────────┼───────────────────┼───────────┘
          │ AsyncStorage       │ HTTPS / WebSocket
          ▼                    ▼
    [Local persist]    ┌──────────────────┐
                       │    Supabase      │
                       │  PostgreSQL      │
                       │  Auth            │
                       │  Realtime        │
                       │  Storage         │
                       └────────┬─────────┘
                                │ Database Webhooks
                                ▼
                       ┌──────────────────┐
                       │ Cloudflare Worker │
                       │  /webhook/*       │
                       │  Cron (decay,     │
                       │  room-cleanup)    │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Expo Push API   │
                       │  (exp.host)      │
                       └──────────────────┘
```

---

## Base de données — 32 tables

### Référence (seed statique)
- `neighborhoods` — quartiers (3)
- `locations` — lieux (8)
- `jobs` — emplois (5)
- `activities` — activités (9)

### Utilisateurs
- `profiles` — profil public (username, bio)
- `avatars` — personnage (27 attributs)
- `avatar_preferences` — intérêts, styles
- `avatar_stats` — 16 stats numériques

### Économie
- `transactions` — historique entrées/sorties monétaires
- `currencies` — ledger dédié (coins/gems/tokens avec delta + balance_after)
- `social_transfers` — transferts entre avatars
- `active_boosts` — multiplicateurs temporaires premium
- `equipped_cosmetics` — cosmétiques équipés
- `inventory` — items généraux (cosmétique | boost | consommable)

### Progression
- `studies` — formations en cours (XP, level, progress_pct)
- `events` — journal des événements quotidiens résolus
- `action_logs` — historique complet des actions

### Social
- `relationships` — paires d'avatars (status, score, isFollowing)
- `invitations` — invitations activité entre avatars
- `date_plans` — plans de sortie (proposed/accepted/completed)

### Messagerie
- `conversations` — threads (local | direct)
- `conversation_members` — participants
- `messages` — messages DM

### Rooms
- `rooms` — salons public/privé/event/secret (expires_at pour secret rooms)
- `room_members` — membres
- `room_messages` — messages rooms

### Présence
- `presence` — statut online/offline par avatar
- `world_presence` — position live sur la carte monde

### Notifications
- `notifications` — notifications in-app
- `advice_logs` — historique conseils coach ARIA
- `push_tokens` — tokens Expo Push (utilisés par le Worker)

### Premium
- `user_premium` — tier + expires_at + stripe_subscription_id

### Modération
- `reports` — signalements (reason, status: pending/reviewed/resolved)
- `blocks` — blocages utilisateur

### Analytics
- `analytics_events` — événements produit (event_name, properties JSONB)

---

## Auth Flow

```
signUp(email, password)
  → supabase.auth.signUp()
  → trigger on_auth_user_created → crée profiles row auto
  → session stockée (provider: "supabase")

signIn(email, password)
  → supabase.auth.signInWithPassword()
  → pullAvatarFromSupabase(userId) → hydrate store
  → session + avatar restaurés

App cold start
  → useAuthListener (monté dans app/_layout.tsx)
  → supabase.auth.getSession() → si session valide → hydrate
  → onAuthStateChange → SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED

signOut()
  → supabase.auth.signOut()
  → AsyncStorage.removeItem()
  → store reset à initialState()
```

---

## Sync Strategy (local-first)

```
Toute action game → met à jour le store Zustand (immédiat)
                  → AsyncStorage persist (offline safe)
                  → syncToSupabase() [si provider = "supabase"]
                     → syncAvatarToSupabase() (avatar + prefs)
                     → syncStatsToSupabase() (stats)

Triggers auto-sync :
  - completeAvatar() → sync immédiat après création
  - editAvatar()     → sync immédiat après modification

Sync manuel disponible via store.syncToSupabase()
```

---

## Cloudflare Workers

**Fichiers :** `workers/`

**Deploy :**
```bash
cd workers
npm install
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put WORKER_SECRET
wrangler deploy
```

**Routes webhook** (à configurer dans Supabase > Database > Webhooks) :

| Table | Événement | URL Worker |
|---|---|---|
| `invitations` | INSERT | `https://mylife-worker.xxx.workers.dev/webhook/invitation` |
| `messages` | INSERT | `https://mylife-worker.xxx.workers.dev/webhook/message` |
| `notifications` | INSERT | `https://mylife-worker.xxx.workers.dev/webhook/notification` |

Ajouter le header `X-Worker-Secret: <WORKER_SECRET>` dans chaque webhook Supabase.

**Cron triggers :**
- `0 0 * * *` → `daily-decay` : log analytics quotidien
- `0 * * * *` → `room-cleanup` : suppression des secret rooms expirées

---

## Migrations Supabase

```
supabase/
  schema.sql                              ← Schema complet v2 (partir de zéro)
  migrations/
    20240101000000_initial_schema.sql     ← Baseline v1
    20240201000000_missing_tables.sql     ← Tables manquantes + index
    20240202000000_auth_trigger.sql       ← Trigger profil auto + updated_at
    20240203000000_push_tokens.sql        ← Table push_tokens
```

**Déploiement initial (projet Supabase neuf) :**
```
Supabase Dashboard → SQL Editor → coller supabase/schema.sql → Run
```

**Déploiement incrémental (DB existante) :**
```
Appliquer les migrations dans l'ordre via SQL Editor ou Supabase CLI :
supabase db push
```

---

## Variables d'environnement

**App mobile (`.env`) :**
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Worker (wrangler secrets) :**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  ← SERVICE ROLE (jamais exposée côté client)
WORKER_SECRET=<chaine aléatoire 32+ chars>
```

---

## Checklist déploiement prod

- [ ] Créer projet Supabase (free tier)
- [ ] Copier `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `.env`
- [ ] Appliquer `schema.sql` dans SQL Editor
- [ ] Activer Email Auth dans Supabase > Auth > Providers
- [ ] Déployer le Worker (`cd workers && wrangler deploy`)
- [ ] Configurer les 3 webhooks dans Supabase > Database > Webhooks
- [ ] Enregistrer `push_tokens` côté app au démarrage (hook `useRegisterPushToken`)
- [ ] Tester le flow complet : signUp → avatar → action → sync → notif push
