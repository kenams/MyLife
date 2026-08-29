-- Crew Life §1 — agenda de sortie : proposer une sortie IRL, voter, confirmer.
-- RLS : réservé aux membres du crew (public.is_crew_member).

create table if not exists public.crew_outings (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id) on delete cascade,
  created_by  uuid not null default auth.uid(),
  title       text not null check (char_length(title) between 1 and 120),
  place       text not null default '' check (char_length(place) <= 120),
  planned_at  timestamptz not null,
  note        text not null default '' check (char_length(note) <= 500),
  status      text not null default 'proposed'
              check (status in ('proposed', 'confirmed', 'cancelled', 'done')),
  created_at  timestamptz not null default now()
);

create index if not exists crew_outings_crew_idx on public.crew_outings (crew_id, planned_at);

create table if not exists public.crew_outing_rsvps (
  outing_id   uuid not null references public.crew_outings(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  response    text not null check (response in ('yes', 'maybe', 'no')),
  updated_at  timestamptz not null default now(),
  primary key (outing_id, user_id)
);

alter table public.crew_outings enable row level security;
alter table public.crew_outing_rsvps enable row level security;

do $$ begin
  create policy crew_outings_read on public.crew_outings for select to authenticated
    using (public.is_crew_member(crew_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy crew_outings_insert on public.crew_outings for insert to authenticated
    with check (created_by = auth.uid() and public.is_crew_member(crew_id));
exception when duplicate_object then null; end $$;

-- MAJ/annulation : le créateur ou un officier du crew.
do $$ begin
  create policy crew_outings_update on public.crew_outings for update to authenticated
    using (created_by = auth.uid() or public.is_crew_officer(crew_id))
    with check (created_by = auth.uid() or public.is_crew_officer(crew_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy crew_outing_rsvps_read on public.crew_outing_rsvps for select to authenticated
    using (exists (
      select 1 from public.crew_outings o
      where o.id = crew_outing_rsvps.outing_id and public.is_crew_member(o.crew_id)
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy crew_outing_rsvps_write on public.crew_outing_rsvps for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid() and exists (
      select 1 from public.crew_outings o
      where o.id = crew_outing_rsvps.outing_id and public.is_crew_member(o.crew_id)
    ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.crew_outings;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.crew_outing_rsvps;
exception when duplicate_object then null; end $$;
