# PR #15 Supabase runbook

PR #15 adds one additive migration:

`20260910000000_player_cloud_state.sql`

It depends only on `auth.users`. It creates an owner-readable JSON snapshot,
an internal idempotency ledger, and one authenticated RPC. Direct client writes
to both tables remain revoked. No existing table is dropped or rewritten.

## Production preflight

Run from a trusted workstation. Keep all values in the shell/secret manager;
never write them to `.env`, logs, GitHub comments, or the PR body.

```powershell
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase migration list
npx supabase db push --dry-run
```

The dry run must show the repository migrations missing on the linked project
in timestamp order, ending with `20260910000000`. Do not infer the remote list
from the files in Git. If the output contains a migration older than the latest
remote migration, schema drift, or a destructive statement, stop and reconcile
the migration history before applying anything.

## Apply and verify

```powershell
npx supabase db push
npx supabase migration list
```

In the SQL editor, verify:

```sql
select relname, relrowsecurity
from pg_class
where relname in ('player_cloud_state', 'player_sync_mutations');

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'sync_player_cloud_state';
```

Both tables must report RLS enabled and the function must report `DEFINER`.
Then provision/reset the isolated QA account:

```powershell
$env:SUPABASE_URL = 'https://<PROJECT_REF>.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = '<FROM_SECRET_MANAGER>'
$env:E2E_QA_EMAIL = 'kah.qa@mylife.test'
$env:E2E_QA_PASSWORD = '<RANDOM_12_PLUS_CHARS>'
npm run qa:provision
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:E2E_QA_PASSWORD
```

The script marks the account in `qa_test_accounts`, sets Auth QA metadata,
creates a complete level-8 profile, and seeds an idempotent Wory balance. It
stores a sentinel in the legacy `password_plain` column, never the real secret.

## Validation gate

Only run production parity after Vercel has the QA flag and E2E credentials in
its protected environment. The required target is the single responsive URL:

```powershell
$env:E2E_TARGET = 'prod'
$env:E2E_QA_EMAIL = 'kah.qa@mylife.test'
$env:E2E_QA_PASSWORD = '<FROM_SECRET_MANAGER>'
npx playwright test --project=desktop e2e/device-parity.spec.ts
```

Do not merge PR #15 if this production test is skipped or fails.
