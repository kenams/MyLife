/**
 * Real Supabase QA account, configured only through environment variables.
 *
 * E2E_QA_EMAIL and E2E_QA_PASSWORD are never committed or printed. The user
 * must be registered in `qa_test_accounts` and carry Auth metadata
 * `qa_account=true`; existing leaderboards exclude that table. Run
 * `npm run qa:provision` with a service-role key to enforce the invariant.
 */

export type QaCredentials = { email: string; password: string };

export function readQaCredentials(): QaCredentials | null {
  const email = process.env.E2E_QA_EMAIL?.trim();
  const password = process.env.E2E_QA_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

/** Keeps only a small username prefix and the domain for test logs. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}
