-- Table signalements
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_name    text,
  target_user_id   uuid references auth.users(id) on delete set null,
  target_name      text,
  reason           text not null,
  details          text,
  status           text not null default 'pending'
                     check (status in ('pending','reviewed','resolved','dismissed')),
  admin_note       text,
  created_at       timestamptz default now(),
  reviewed_at      timestamptz
);

-- Un user ne peut pas voir les signalements des autres (admin only)
alter table public.reports enable row level security;

create policy "Insert own report"
  on public.reports for insert
  with check (auth.uid() = reporter_user_id);

-- Seul un admin (service_role) peut lire/modifier les signalements
-- (aucune policy select = seul service_role peut lire)

-- Anti-spam : max 10 signalements par user sur 24h (contrôlé côté app aussi)
create index if not exists reports_reporter_idx on public.reports (reporter_user_id, created_at);

-- Table suppressions de compte (audit trail RGPD)
create table if not exists public.account_deletions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  reason     text,
  deleted_at timestamptz default now()
);

alter table public.account_deletions enable row level security;
-- Seul service_role peut lire/écrire

-- Vue admin signalements (utilisable depuis Supabase dashboard)
create or replace view public.reports_admin as
  select
    r.id,
    r.reason,
    r.status,
    r.reporter_name,
    r.target_name,
    r.details,
    r.created_at,
    r.reviewed_at,
    r.admin_note
  from public.reports r
  order by r.created_at desc;
