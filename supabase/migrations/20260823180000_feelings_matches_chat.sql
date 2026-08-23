-- Feeling privé -> match mutuel -> conversation débloquée -> messages.
-- Écriture uniquement via RPC SECURITY DEFINER (même pattern que
-- friend_relationships) : aucun grant insert/update direct sur les tables
-- sensibles, toute la logique métier (unicité, idempotence, blocage
-- prioritaire, révélation seulement à la réciprocité) vit en un seul endroit.

create table if not exists public.feelings (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references auth.users(id) on delete cascade,
  target_id   uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint feelings_no_self check (sender_id <> target_id),
  unique (sender_id, target_id)
);

create index if not exists feelings_target_idx on public.feelings (target_id);

alter table public.feelings enable row level security;
revoke all on public.feelings from anon, authenticated;
-- Aucun SELECT direct non plus : un Feeling reste privé même pour son propre
-- expéditeur côté API — le seul signal qu'un client reçoit est "matched" ou
-- non, renvoyé par le RPC lui-même, jamais l'état brut de la table.

create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  user_low    uuid not null references auth.users(id) on delete cascade,
  user_high   uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint matches_ordered check (user_low < user_high),
  unique (user_low, user_high)
);

alter table public.matches enable row level security;
revoke all on public.matches from anon, authenticated;
grant select on public.matches to authenticated;
create policy "matches_select_participant"
  on public.matches for select
  to authenticated
  using (auth.uid() = user_low or auth.uid() = user_high);

create table if not exists public.chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null unique references public.matches(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.chat_conversations enable row level security;
revoke all on public.chat_conversations from anon, authenticated;
grant select on public.chat_conversations to authenticated;
create policy "chat_conversations_select_participant"
  on public.chat_conversations for select
  to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = chat_conversations.match_id
      and (m.user_low = auth.uid() or m.user_high = auth.uid())
  ));

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 1000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at);

alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;
create policy "chat_messages_select_participant"
  on public.chat_messages for select
  to authenticated
  using (exists (
    select 1 from public.chat_conversations c
    join public.matches m on m.id = c.match_id
    where c.id = chat_messages.conversation_id
      and (m.user_low = auth.uid() or m.user_high = auth.uid())
  ));

-- ── send_feeling : privé, révèle seulement à la réciprocité ────────────────
create or replace function public.send_feeling(target uuid)
returns table (matched boolean, conversation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_low uuid; v_high uuid;
  v_reverse_exists boolean;
  v_match_id uuid;
  v_conv_id uuid;
  v_actor_name text;
begin
  if target = auth.uid() or auth.uid() is null then
    raise exception 'Action impossible';
  end if;

  v_low := least(auth.uid(), target);
  v_high := greatest(auth.uid(), target);

  -- Le blocage (dans un sens ou l'autre) prend toujours priorité.
  if exists (
    select 1 from public.friend_relationships
    where user_low = v_low and user_high = v_high and status = 'blocked'
  ) then
    raise exception 'Action impossible';
  end if;

  -- Idempotent : renvoyer with_check via insert ... on conflict do nothing
  insert into public.feelings (sender_id, target_id)
  values (auth.uid(), target)
  on conflict (sender_id, target_id) do nothing;

  select exists (
    select 1 from public.feelings where sender_id = target and target_id = auth.uid()
  ) into v_reverse_exists;

  if not v_reverse_exists then
    return query select false, null::uuid;
    return;
  end if;

  -- Réciproque : créer le match une seule fois (idempotent même en cas de
  -- double appel concurrent grâce à la contrainte unique + on conflict).
  insert into public.matches (user_low, user_high)
  values (v_low, v_high)
  on conflict (user_low, user_high) do nothing;

  select id into v_match_id from public.matches where user_low = v_low and user_high = v_high;

  insert into public.chat_conversations (match_id)
  values (v_match_id)
  on conflict (match_id) do nothing;

  select id into v_conv_id from public.chat_conversations where match_id = v_match_id;

  -- Notifie les DEUX utilisateurs, une seule fois (vérifié par le fait que
  -- ce bloc n'est atteint qu'une fois par paire : le match est déjà créé
  -- au deuxième appel, donc v_reverse_exists était déjà vrai avant et ce
  -- code n'insère pas de doublon de notification).
  if not exists (select 1 from public.social_notifications where type = 'match' and target_user_id = auth.uid() and actor_user_id = target) then
    select coalesce(username, 'Un joueur') into v_actor_name from public.profiles where id = target;
    insert into public.social_notifications (target_user_id, actor_user_id, type, title, body)
    values (auth.uid(), target, 'match', '💫 Match !', 'Feeling mutuel avec ' || v_actor_name);

    select coalesce(username, 'Un joueur') into v_actor_name from public.profiles where id = auth.uid();
    insert into public.social_notifications (target_user_id, actor_user_id, type, title, body)
    values (target, auth.uid(), 'match', '💫 Match !', 'Feeling mutuel avec ' || v_actor_name);
  end if;

  return query select true, v_conv_id;
end;
$$;

grant execute on function public.send_feeling(uuid) to authenticated;

-- ── send_message : uniquement dans une conversation dont on est participant,
-- et seulement si aucun blocage n'existe entre les deux ─────────────────────
create or replace function public.send_message(conv_id uuid, msg_body text)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_other uuid;
  v_row public.chat_messages;
begin
  select m.* into v_match
  from public.chat_conversations c
  join public.matches m on m.id = c.match_id
  where c.id = conv_id;

  if v_match.id is null then
    raise exception 'Conversation introuvable';
  end if;
  if auth.uid() <> v_match.user_low and auth.uid() <> v_match.user_high then
    raise exception 'Action impossible';
  end if;

  v_other := case when auth.uid() = v_match.user_low then v_match.user_high else v_match.user_low end;

  if exists (
    select 1 from public.friend_relationships
    where user_low = least(auth.uid(), v_other) and user_high = greatest(auth.uid(), v_other)
      and status = 'blocked'
  ) then
    raise exception 'Action impossible';
  end if;

  if char_length(trim(msg_body)) = 0 or char_length(msg_body) > 1000 then
    raise exception 'Message invalide';
  end if;

  insert into public.chat_messages (conversation_id, sender_id, body)
  values (conv_id, auth.uid(), msg_body)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.send_message(uuid, text) to authenticated;

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.matches;
