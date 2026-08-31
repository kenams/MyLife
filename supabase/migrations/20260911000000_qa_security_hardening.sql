-- Harden technical QA accounts: no plaintext password storage in public schema.
-- QA credentials must only exist in protected environment variables / Auth.

alter table if exists public.qa_test_accounts enable row level security;
revoke all on table public.qa_test_accounts from anon, authenticated;

-- Remove the legacy plaintext credential column entirely. Existing values are
-- discarded; automated QA provisioning uses Supabase Auth admin APIs and a
-- protected E2E_QA_PASSWORD environment variable instead.
alter table if exists public.qa_test_accounts
  drop column if exists password_plain;
