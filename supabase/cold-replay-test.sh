#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Replay complet des migrations depuis zéro — stack officielle Supabase
# (CLI + Docker, vrai schéma GoTrue/Realtime/Storage). N'affecte jamais la
# production : `supabase start`/`db reset` opèrent exclusivement sur la
# base Docker locale (127.0.0.1:54322) tant qu'aucun `supabase link` n'a
# été fait vers un projet distant.
#
# Usage : depuis la racine du repo,  bash supabase/cold-replay-test.sh
# Prérequis : Docker démarré, `npx supabase` disponible (pas d'install
# globale nécessaire).
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── Démarrage de la stack Supabase locale (Docker) ──"
npx supabase start

echo "── Reset complet + replay de toutes les migrations dans l'ordre ──"
npx supabase db reset

echo "── Vérification : nombre de tables publiques ──"
docker exec supabase_db_MyLife psql -U postgres -d postgres -t -c \
  "select count(*) as tables from information_schema.tables where table_schema='public';"

echo "── Vérification : tables dans la publication supabase_realtime ──"
docker exec supabase_db_MyLife psql -U postgres -d postgres -t -c \
  "select string_agg(tablename, ', ' order by tablename) from pg_publication_tables where pubname='supabase_realtime';"

echo "── Nettoyage : arrêt de la stack, suppression des conteneurs/volumes ──"
npx supabase stop --no-backup

echo "── Terminé. Comparer les chiffres ci-dessus avec la production (Supabase Studio ou execute_sql) ──"
