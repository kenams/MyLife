-- Harden technical QA accounts: never retain a usable password in public schema.
-- Automated QA login uses Supabase Auth plus a protected E2E_QA_PASSWORD env var.

alter table if exists public.qa_test_accounts enable row level security;
revoke all on table public.qa_test_accounts from anon, authenticated;

-- Scrub any credential left by the legacy bootstrap migration while preserving
-- the legacy column for compatibility with existing provisioning code.
update public.qa_test_accounts
set password_plain = 'managed-by-provision-script'
where password_plain <> 'managed-by-provision-script';

alter table public.qa_test_accounts
  drop constraint if exists qa_test_accounts_password_plain_sentinel;

alter table public.qa_test_accounts
  add constraint qa_test_accounts_password_plain_sentinel
  check (password_plain = 'managed-by-provision-script');
