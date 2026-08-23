-- Root cause du "push Realtime jamais reçu, seulement le fetch au montage" :
-- social_notifications n'avait jamais été ajoutée à la publication
-- supabase_realtime. Le code client (filter, cleanup, abonnement) était
-- correct depuis le départ — sans cette ligne, Postgres n'envoie tout
-- simplement aucun événement de réplication logique pour cette table, quel
-- que soit le client qui écoute.
alter publication supabase_realtime add table public.social_notifications;
