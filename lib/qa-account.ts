/**
 * Compte QA Supabase — pilotage par variables d'environnement UNIQUEMENT.
 *
 * Aucun identifiant n'est commité. Les tests E2E de parité (auth, cross-device)
 * lisent :
 *   E2E_QA_EMAIL     — email du compte QA Supabase réel
 *   E2E_QA_PASSWORD  — mot de passe (jamais loggé, jamais dans un rapport)
 *
 * Le compte QA doit être créé côté Supabase avec `is_qa = true` sur son profil
 * pour être exclu des classements / analytics (invariant produit déjà en place).
 * Sans ces variables, les specs concernées se `skip` proprement.
 */

export type QaCredentials = { email: string; password: string };

export function readQaCredentials(): QaCredentials | null {
  const email = process.env.E2E_QA_EMAIL?.trim();
  const password = process.env.E2E_QA_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

/** Masque tout sauf le domaine, pour les logs de test. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}
