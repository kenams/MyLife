-- dm_messages avait une RLS grande ouverte : "Read own DM" (qual=true) et
-- "Insert DM" (with_check=true) — n'importe quel compte authentifié pouvait
-- lire ou écrire dans N'IMPORTE QUELLE conversation, y compris usurper
-- sender_name/sender_id d'un autre. Trouvé lors de l'audit de la session
-- friend/match/chat, corrigé ici plutôt que de laisser une table encore
-- utilisée (map.web.tsx "Saluer"/"Proposer une activité" y routent toujours
-- via app/dm.tsx) grande ouverte en prod.
--
-- room_id = deux UUID triés alphabétiquement joints par "_" (lib/live-chat.ts
-- dmRoomId) — on peut donc vérifier l'appartenance sans nouvelle colonne.

drop policy if exists "Read own DM" on public.dm_messages;
drop policy if exists "Insert DM" on public.dm_messages;

create policy "dm_read_participant"
  on public.dm_messages for select
  to authenticated
  using (
    auth.uid()::text = split_part(room_id, '_', 1)
    or auth.uid()::text = split_part(room_id, '_', 2)
  );

create policy "dm_insert_participant"
  on public.dm_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      auth.uid()::text = split_part(room_id, '_', 1)
      or auth.uid()::text = split_part(room_id, '_', 2)
    )
    -- Le blocage coupe aussi les DM historiques, pas seulement le nouveau chat.
    and not exists (
      select 1 from public.friend_relationships fr
      where fr.status = 'blocked'
        and fr.user_low = least(
          auth.uid(),
          (case when split_part(room_id, '_', 1) = auth.uid()::text
                then split_part(room_id, '_', 2) else split_part(room_id, '_', 1) end)::uuid
        )
        and fr.user_high = greatest(
          auth.uid(),
          (case when split_part(room_id, '_', 1) = auth.uid()::text
                then split_part(room_id, '_', 2) else split_part(room_id, '_', 1) end)::uuid
        )
    )
  );
