# Test credentials policy

- Never commit test or production passwords, recovery codes, access tokens or service-role keys.
- Store QA credentials outside the repository and rotate any credential that has ever appeared in Git history, logs or chat transcripts.
- Documentation may name a test account purpose, but not its password.
- Password recovery links/codes are one-time secrets and must never be logged.
