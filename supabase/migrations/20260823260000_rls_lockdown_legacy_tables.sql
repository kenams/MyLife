-- Trouvé par audit sécurité automatique (Supabase advisors) : 5 tables avec
-- RLS totalement désactivée ET anon (donc n'importe qui sur internet, sans
-- même être connecté) avait INSERT/UPDATE/DELETE/TRUNCATE dessus.
--   - neighborhoods, locations, activities, jobs : données de référence du
--     jeu (zones, métiers). Doivent rester lisibles par tous, mais plus du
--     tout modifiables via l'API publique.
--   - conversations : table vide, remplacée par chat_conversations
--     (renommage fait plus tôt dans le projet pour éviter une collision de
--     nom). Verrouillée complètement, comme dm_messages avant elle.

revoke insert, update, delete, truncate on public.neighborhoods from anon, authenticated;
revoke insert, update, delete, truncate on public.locations from anon, authenticated;
revoke insert, update, delete, truncate on public.activities from anon, authenticated;
revoke insert, update, delete, truncate on public.jobs from anon, authenticated;
revoke select, insert, update, delete, truncate on public.conversations from anon, authenticated;

alter table public.neighborhoods enable row level security;
alter table public.locations enable row level security;
alter table public.activities enable row level security;
alter table public.jobs enable row level security;
alter table public.conversations enable row level security;

create policy "Public read neighborhoods" on public.neighborhoods for select using (true);
create policy "Public read locations" on public.locations for select using (true);
create policy "Public read activities" on public.activities for select using (true);
create policy "Public read jobs" on public.jobs for select using (true);
-- conversations : aucune policy, RLS activée + grants retirés = inaccessible.
