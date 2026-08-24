-- Fix : "column reference template_code is ambiguous" — le nom de colonne
-- de sortie (RETURNS TABLE) entrait en collision avec la colonne réelle
-- dans la clause ON CONFLICT. #variable_conflict use_column force PL/pgSQL
-- à préférer la colonne de table dans ce cas (comportement souhaité ici,
-- aucune variable locale ne porte ce nom).
create or replace function public.get_today_challenges()
returns table (
  template_code text, title text, description text, category text,
  target_count int, reward_xp int, reward_money int,
  progress_count int, completed_at timestamptz, claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_date date := public.today_toulouse_date();
  v_codes text[] := public.daily_challenge_codes(v_date);
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;

  insert into public.daily_challenge_progress (user_id, challenge_date, template_code)
  select v_uid, v_date, c from unnest(v_codes) as c
  on conflict (user_id, challenge_date, template_code) do nothing;

  return query
  select t.code, t.title, t.description, t.category, t.target_count, t.reward_xp, t.reward_money,
         p.count, p.completed_at, p.claimed_at
  from public.daily_challenge_templates t
  join public.daily_challenge_progress p
    on p.template_code = t.code and p.user_id = v_uid and p.challenge_date = v_date
  where t.code = any(v_codes)
  order by t.code;
end;
$$;
