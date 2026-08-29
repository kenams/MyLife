/**
 * Crew Life — logique pure (aucune dépendance réseau/RN), testable isolément.
 */

/** Lundi de la semaine courante, en YYYY-MM-DD. */
export function currentWeekStart(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // 0 = lundi
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

export type SocialRole = { label: string; emoji: string; hint: string };

export type RoleInput = {
  userId?: string;
  playerName: string;
  joinedAt: string;
  role: string;
  memoriesAuthored: number;
};

/** Attribue des titres positifs aux membres à partir de l'ancienneté, du rôle
 *  et de la contribution au mur de souvenirs. Un membre peut cumuler. */
export function deriveSocialRoles(members: RoleInput[]): Record<string, SocialRole[]> {
  const out: Record<string, SocialRole[]> = {};
  if (members.length === 0) return out;
  const key = (m: RoleInput) => m.userId ?? m.playerName;
  const add = (m: RoleInput, r: SocialRole) => {
    (out[key(m)] ??= []).push(r);
  };

  const byAge = [...members].sort((a, b) => +new Date(a.joinedAt) - +new Date(b.joinedAt));
  add(byAge[0], { label: "Pilier", emoji: "🪨", hint: "Le membre le plus ancien du crew" });

  const weekAgo = Date.now() - 7 * 86400_000;
  for (const m of members) {
    if (+new Date(m.joinedAt) > weekAgo && m !== byAge[0]) {
      add(m, { label: "Recrue", emoji: "🌱", hint: "A rejoint le crew cette semaine" });
    }
    if (m.role === "founder") add(m, { label: "Fondateur", emoji: "👑", hint: "A créé le crew" });
    if (m.role === "officer") add(m, { label: "Officier", emoji: "🎖️", hint: "Bras droit du fondateur" });
  }

  const topAuthor = [...members]
    .filter((m) => m.memoriesAuthored > 0)
    .sort((a, b) => b.memoriesAuthored - a.memoriesAuthored)[0];
  if (topAuthor) {
    add(topAuthor, { label: "Ambianceur", emoji: "🎙️", hint: "Écrit le plus de souvenirs du crew" });
  }

  return out;
}
