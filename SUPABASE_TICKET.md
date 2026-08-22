# À faire toi-même — dans cet ordre

## 1. Dashboard Supabase — chemin exact à suivre MAINTENANT

1. Va sur **https://supabase.com/dashboard/project/vlofsaivgydbzghptlfj**
2. Menu de gauche → **Database** → **Backups**
3. Regarde s'il y a un onglet **"Restore points"** ou **"Point in time recovery"**
4. Cherche spécifiquement un point nommé **`restore_vlofsaivgydbzghptlfj_1448999295`** (créé le 22/08/2026 à 15:13:46 UTC / 17:13:46 heure française) — c'est le point le plus prometteur, créé automatiquement alors que les données existaient encore
5. **NE CLIQUE SUR AUCUN BOUTON "Restore" avant de m'avoir dit ce que tu vois** — envoie-moi une capture d'écran de cette page, je veux vérifier l'horodatage exact avant toute action (une restauration écrase l'état actuel, potentiellement de façon définitive)

Si tu ne vois aucun point de restauration ni backup disponible (plan gratuit = souvent aucun backup automatique retenu au-delà de la pause elle-même), passe à l'étape 2.

## 2. Ticket support Supabase — prêt à copier-coller

**Sujet :** Data loss after project pause/resume cycle — tables missing from public schema, restore point may exist

**Corps :**

```
Project ref: vlofsaivgydbzghptlfj

Summary: After two rapid pause/resume cycles on a free-tier project today,
all application tables in the `public` schema (profiles, avatars, crews,
life_map_players, etc.) are missing. `auth.users` still contains 23 real
user records, untouched.

Timeline (UTC, from postgres_logs):
- 2026-08-22 15:11:58 — First resume. Data confirmed present and queryable
  (public.profiles returned real rows).
- 2026-08-22 15:13:46 — Log shows: `restore point
  "restore_vlofsaivgydbzghptlfj_1448999295" created at 3/14000638`
  — this was created automatically while data still existed.
- (project paused again shortly after, for an unrelated reason)
- 2026-08-22 21:33:24 — Second resume triggered.
- 2026-08-22 21:34:10-13 — Logs show: `database system was interrupted;
  last known up at 2026-08-22 15:13:01 UTC` →
  `starting point-in-time recovery to earliest consistent point` →
  `selected new timeline ID: 4` → `archive recovery complete`
  (redo LSN 3/13000028, end LSN 3/13000120)
- 2026-08-22 21:33:44 — First `relation "public.profiles" does not exist`
  error appears.

Root cause hypothesis: the second resume performed a PITR that stopped at
the *earliest consistent point* on a *new timeline* rather than replaying
to the most recent state before the pause, landing before the tables
existed in this recovered timeline.

No DROP/TRUNCATE/destructive statement was ever run — confirmed via
postgres_logs, only additive `CREATE TABLE IF NOT EXISTS` / `CREATE OR
REPLACE FUNCTION` statements are present in the log around this window.

Request:
1. Please check whether restore point "restore_vlofsaivgydbzghptlfj_1448999295"
   (created 2026-08-22T15:13:46Z) is available for recovery, and whether it
   contains the public schema tables (profiles, avatars, crews,
   life_map_players, quartier_messages, dm_messages, etc.).
2. Please check for any internal snapshot/backup taken between
   2026-08-22T15:11:58Z and 2026-08-22T15:13:46Z, i.e. while the data was
   confirmed present.
3. Do NOT initiate any restore without confirming the exact timestamp and
   impact with me first — I need to know precisely what state a given
   restore point would bring back before applying it.

Thanks for any help recovering this — the application schema itself is
fully reproducible from our own migration history, only the live user
data (~23 accounts' worth of profiles/avatars/crew data) is at risk.
```

## 3. Une fois que tu as l'info (dashboard ou support)

Reviens vers moi avec :
- Ce que tu vois dans Database → Backups (capture d'écran si possible)
- La réponse du support si tu l'as contacté

Je reprends immédiatement à partir de là — soit pour valider une restauration précise, soit pour lancer la reconstruction propre en environnement isolé (Phase 4) si aucune récupération n'est possible.
