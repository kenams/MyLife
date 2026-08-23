-- Trouvé par audit sécurité automatique : 7 fonctions legacy sans
-- search_path fixé (mutable), ouvrant la porte à un search_path injection si
-- un rôle malveillant pouvait un jour créer un objet du même nom dans un
-- schéma placé avant public. Toutes les RPC écrites ce projet-ci ont déjà
-- `set search_path = public` ; celles-ci datent d'avant et ne l'avaient pas.
alter function public.set_updated_at_generic() set search_path = public;
alter function public.players_nearby(double precision, double precision, double precision) set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.purge_old_feed() set search_path = public;
alter function public.purge_expired_flash_events() set search_path = public;
alter function public.decay_inactive_crew_zones() set search_path = public;
alter function public.cleanup_old_takeovers() set search_path = public;
