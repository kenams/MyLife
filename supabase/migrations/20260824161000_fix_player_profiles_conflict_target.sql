-- Fix : l'index unique partiel (where user_id is not null) n'est pas
-- reconnu comme cible ON CONFLICT par PostgREST (il génère
-- "on_conflict=user_id" sans le prédicat). Un index unique plein sur
-- user_id fonctionne identiquement pour notre cas (les NULL multiples
-- restent autorisés par la sémantique standard d'unicité Postgres, donc
-- les lignes NPC/legacy sans user_id ne posent pas de conflit entre elles).
drop index if exists public.player_profiles_user_id_key;
create unique index if not exists player_profiles_user_id_key on public.player_profiles (user_id);
