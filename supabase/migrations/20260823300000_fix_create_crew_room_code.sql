-- Bug bloquant trouvé pendant la revalidation post-lockdown : create_crew
-- insère dans rooms sans jamais fournir `code` (colonne NOT NULL + UNIQUE),
-- donc TOUTE création de crew échouait avec "null value in column code
-- violates not-null constraint" depuis la migration crew_room. Le tag du
-- crew est déjà unique (contrainte crews.tag), on le réutilise comme code
-- de salon. Reste du corps identique à l'original — seule la ligne
-- insert into rooms change.
create or replace function public.create_crew(
  p_name text, p_tag text, p_emoji text, p_color text, p_description text default null
)
returns public.crews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crew public.crews;
  v_name text;
  v_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if length(trim(p_name)) = 0 or length(trim(p_tag)) = 0 then
    raise exception 'Nom et tag requis';
  end if;

  select coalesce(username, 'Fondateur') into v_name from public.profiles where id = auth.uid();

  insert into public.crews (name, tag, emoji, color, description, founder, member_count, reputation)
  values (trim(p_name), upper(trim(p_tag)), p_emoji, p_color, p_description, v_name, 1, 0)
  returning * into v_crew;

  insert into public.crew_members (crew_id, user_id, player_name, player_emoji, role)
  values (v_crew.id, auth.uid(), v_name, p_emoji, 'founder');

  insert into public.rooms (name, kind, code, owner_id, owner_name, crew_id, member_count, is_active)
  values ('Salon ' || v_crew.name, 'crew', 'crew-' || lower(upper(trim(p_tag))), auth.uid(), v_name, v_crew.id, 1, true)
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id, avatar_name)
  values (v_room_id, auth.uid(), v_name);

  return v_crew;
end;
$$;
