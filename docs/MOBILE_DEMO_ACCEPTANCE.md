# MyLife mobile production acceptance

The mobile web build is the reference experience for phone testing.

## One game invariants

- One URL and one account across desktop and mobile.
- Same Supabase-backed player state on every responsive viewport.
- The City Engine remains the single world simulation layer.
- Responsive layout may differ; gameplay rules and progression may not.

## Release gate

Before calling a mobile release demo-ready:

1. Production deployment is READY and `/map` returns HTTP 200.
2. GitHub CI passes typecheck and unit tests.
3. No new Vercel runtime error cluster appears after deployment.
4. Supabase player cloud sync preserves progression and rejects stale writes.
5. Mobile viewport has no horizontal overflow and bottom navigation does not cover gameplay controls.
6. Map remains interactive while the Living City updates.
7. Auth survives refresh and invalid sessions return cleanly to sign-in.
8. A real authenticated desktop -> phone -> desktop parity pass is run when a browser runner with the protected QA secret is available.

## Phone smoke path

Open `/map`, sign in, wait for Living City activity, open City Pulse, navigate Home/Profile/Objectifs, perform one safe gameplay action, return to Map, refresh, and confirm the player state is preserved.
