-- Crew Life (Phase D) — objectif hebdomadaire commun + souvenirs du crew.
-- RLS : lecture/écriture réservées aux membres du crew ciblé (via crew_members).

create table if not exists public.crew_weekly_goals (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  week_start  date not null,
  label       text not null,
  target      integer not null check (target > 0),
  progress    integer not null default 0,
  reward_xp   integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (crew_id, week_start)
);

create table if not exists public.crew_memories (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  author_id   uuid not null default auth.uid(),
  title       text not null check (char_length(title) between 1 and 120),
  body        text not null default '' check (char_length(body) <= 1000),
  created_at  timestamptz not null default now()
);

create index if not exists crew_memories_crew_idx on public.crew_memories (crew_id, created_at desc);

alter table public.crew_weekly_goals enable row level security;
alter table public.crew_memories enable row level security;

-- Appartenance au crew ciblé par la ligne.
create or replace function public.is_crew_member(target_crew uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crew_members m
    where m.crew_id = target_crew and m.user_id = auth.uid()
  );
$$;

do $$ begin
  create policy crew_weekly_goals_read on public.crew_weekly_goals
    for select to authenticated using (public.is_crew_member(crew_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy crew_weekly_goals_write on public.crew_weekly_goals
    for all to authenticated
    using (public.is_crew_member(crew_id))
    with check (public.is_crew_member(crew_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy crew_memories_read on public.crew_memories
    for select to authenticated using (public.is_crew_member(crew_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy crew_memories_insert on public.crew_memories
    for insert to authenticated
    with check (author_id = auth.uid() and public.is_crew_member(crew_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy crew_memories_delete on public.crew_memories
    for delete to authenticated using (author_id = auth.uid());
exception when duplicate_object then null; end $$;
