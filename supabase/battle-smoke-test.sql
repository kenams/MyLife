-- Smoke test des RPC Territory War (§7) sur la base Docker locale.
-- Exécuté en superuser : on teste la LOGIQUE des RPC (SECURITY DEFINER +
-- auth.uid() via request.jwt.claims), pas les policies RLS.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'att@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'def@test.dev');

insert into public.districts (id, slug, name, emoji, center_lat, center_lng) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'test-cap', 'TestCapitole', '🏛️', 43.6045, 1.4442);

insert into public.crews (id, name, tag, emoji, color, founder) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Attaquants', 'ATT', '🐺', '#00B4FF', 'att'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Defenseurs', 'DEF', '🦁', '#FF3B3B', 'def');

insert into public.crew_members (crew_id, user_id, player_name, player_emoji, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'att', '🐺', 'founder'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'def', '🦁', 'founder');

insert into public.territories (district_id, owner_crew_id, influence, conquered_at)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 70, now() - interval '5 days')
on conflict (district_id) do update set owner_crew_id = excluded.owner_crew_id, influence = 70, conquered_at = now() - interval '5 days';

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select id as battle_id from public.create_territory_battle(
  'dddddddd-dddd-dddd-dddd-dddddddddddd', now() + interval '1 hour') \gset
\echo -- battle: :battle_id

select 'quiz prepared' as check, jsonb_array_length(quiz) as questions, array_length(quiz_answers,1) as answers
from public.territory_battles where id = :'battle_id';

update public.territory_battles set scheduled_at = now() - interval '10 seconds' where id = :'battle_id';

select 'join att' as step, r1_taps from public.join_territory_battle(:'battle_id');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select 'join def' as step, r1_taps from public.join_territory_battle(:'battle_id');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select 'tick -> live' as step, status, current_round from public.tick_territory_battle(:'battle_id');

-- anti-autoclick
select 'tap 1' as step, public.battle_tap(:'battle_id') as taps;
select 'tap 2 (autoclick, ignoré)' as step, public.battle_tap(:'battle_id') as taps;
select pg_sleep(0.06);
select 'tap 3 (ok)' as step, public.battle_tap(:'battle_id') as taps;

-- action hors manche -> refus attendu ("Mauvaise manche")
update public.territory_battles set current_round = 2, round_started_at = now() where id = :'battle_id';
\set ON_ERROR_STOP off
\echo -- attendu ci-dessous : ERROR "Mauvaise manche"
savepoint sp_badround;
select public.battle_tap(:'battle_id');
rollback to savepoint sp_badround;
\set ON_ERROR_STOP on

-- quiz corrigé serveur : on soumet de mauvaises réponses -> score attendu 0..3
select 'quiz score (3 mauvaises réponses)' as step, public.battle_submit_quiz(:'battle_id', array[3,3,3]::int[]) as correct;

-- manche 3
update public.territory_battles set current_round = 3, round_started_at = now() - interval '3 seconds' where id = :'battle_id';
select 'sync hit (fenêtre GO)' as step, public.battle_sync_hit(:'battle_id') as hits;
select 'sync hit 2 (trop rapproché, ignoré)' as step, public.battle_sync_hit(:'battle_id') as hits;

-- résolution
update public.territory_battles set round_started_at = now() - interval '61 seconds' where id = :'battle_id';
select 'resolve' as step, status, winner_crew, attacker_pct, defender_pct from public.tick_territory_battle(:'battle_id');
-- idempotence
select public.resolve_territory_battle_war(:'battle_id');
select public.resolve_territory_battle_war(:'battle_id');

select 'territory final' as step, owner_crew_id, influence, defenses_won
from public.territories where district_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select 'wory movements' as step, count(*) as n, coalesce(sum(delta),0) as total
from public.wory_ledger where source = 'territory_battle';
select 'territory events' as step, kind, count(*) from public.territory_events group by kind order by kind;
select 'battle rewards' as step,
  (select count(*) from public.crew_trophies where battle_id = :'battle_id') as trophies,
  (select count(*) from public.crew_title_grants where battle_id = :'battle_id') as titles,
  (select count(*) from public.crew_badges where source_id = :'battle_id') as badges;
select 'winner titles' as step, title, expires_at is not null as temporary
from public.crew_titles('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select 'gage options' as step, jsonb_array_length(public.battle_gage_options()) as options;
select 'apply gage' as step, gage_code, label, expires_at > now() as active
from public.apply_battle_gage(:'battle_id', 'poulets');
select 'apply gage idempotent' as step, count(*) as n
from public.crew_gages where from_battle_id = :'battle_id';

rollback;
