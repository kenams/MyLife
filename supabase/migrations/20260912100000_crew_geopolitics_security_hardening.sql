-- Harden the Crew geopolitics prerequisites before exposing them remotely.
-- Internal SECURITY DEFINER helpers stay owner/service-only; player RPCs require auth.

alter view public.wory_balances_user set (security_invoker = true);
alter view public.wory_balances_crew set (security_invoker = true);
revoke all on public.wory_balances_user, public.wory_balances_crew
  from public, anon, authenticated;

alter function public.battle_config() set search_path = public, pg_temp;
alter function public.battle_quiz_pool() set search_path = public, pg_temp;
alter function public.battle_gage_options() set search_path = public, pg_temp;

revoke all on function public.is_crew_member(uuid) from public, anon, authenticated;
grant execute on function public.is_crew_member(uuid) to authenticated;

revoke all on function public.record_wory(uuid, uuid, bigint, text, text, text, uuid, jsonb, boolean)
  from public, anon, authenticated;

revoke all on function public.my_wory_balance() from public, anon, authenticated;
revoke all on function public.crew_wory_balance(uuid) from public, anon, authenticated;
grant execute on function public.my_wory_balance() to authenticated;
grant execute on function public.crew_wory_balance(uuid) to authenticated;

revoke all on function public.resolve_territory_battle(uuid, uuid, int, text)
  from public, anon, authenticated;
revoke all on function public.schedule_territory_battle(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.resolve_territory_battle_war(uuid)
  from public, anon, authenticated;
revoke all on function public.battle_prepare_quiz(uuid)
  from public, anon, authenticated;
revoke all on function public.battle_round_open(uuid, int)
  from public, anon, authenticated;

revoke all on function public.create_territory_battle(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.join_territory_battle(uuid)
  from public, anon, authenticated;
revoke all on function public.tick_territory_battle(uuid)
  from public, anon, authenticated;
revoke all on function public.battle_tap(uuid)
  from public, anon, authenticated;
revoke all on function public.battle_get_quiz(uuid)
  from public, anon, authenticated;
revoke all on function public.battle_submit_quiz(uuid, int[])
  from public, anon, authenticated;
revoke all on function public.battle_sync_hit(uuid)
  from public, anon, authenticated;
grant execute on function public.create_territory_battle(uuid, timestamptz) to authenticated;
grant execute on function public.join_territory_battle(uuid) to authenticated;
grant execute on function public.tick_territory_battle(uuid) to authenticated;
grant execute on function public.battle_tap(uuid) to authenticated;
grant execute on function public.battle_get_quiz(uuid) to authenticated;
grant execute on function public.battle_submit_quiz(uuid, int[]) to authenticated;
grant execute on function public.battle_sync_hit(uuid) to authenticated;

revoke all on function public.report_territory_activity(uuid)
  from public, anon, authenticated;
revoke all on function public.claim_influence_mission(uuid)
  from public, anon, authenticated;
revoke all on function public.territory_contest_summary()
  from public, anon, authenticated;
grant execute on function public.report_territory_activity(uuid) to authenticated;
grant execute on function public.claim_influence_mission(uuid) to authenticated;
grant execute on function public.territory_contest_summary() to authenticated;

revoke all on function public.apply_battle_gage(uuid, text)
  from public, anon, authenticated;
grant execute on function public.apply_battle_gage(uuid, text) to authenticated;

alter function public.crew_titles(uuid) security invoker;
alter function public.battle_reward_summary(uuid) security invoker;
revoke all on function public.crew_titles(uuid) from public, anon, authenticated;
revoke all on function public.battle_reward_summary(uuid) from public, anon, authenticated;
grant execute on function public.crew_titles(uuid) to authenticated, anon;
grant execute on function public.battle_reward_summary(uuid) to authenticated, anon;

revoke all on function public.perform_crew_context_action(uuid)
  from public, anon, authenticated;
grant execute on function public.perform_crew_context_action(uuid) to authenticated;
