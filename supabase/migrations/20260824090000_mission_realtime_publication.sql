-- Trouvé en comparant la publication supabase_realtime entre le replay
-- local et la production : cette migration avait été appliquée directement
-- en production (session précédente, couche missions sur la Map) mais
-- jamais sauvegardée comme fichier local — un exemple de plus de la classe
-- de bug "table absente de la publication Realtime" déjà rencontrée
-- plusieurs fois ce projet (notifications, flash events).
alter publication supabase_realtime add table public.mission_definitions;
alter publication supabase_realtime add table public.mission_participations;
