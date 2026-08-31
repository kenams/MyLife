export type NpcGoalType = "WORK" | "SPORT" | "SOCIAL" | "CREW" | "EXPLORATION" | "CULTURE";

export type NpcMultiDayGoal = {
  type: NpcGoalType;
  label: string;
  motivation: string;
  startedAt: string;
  endsAt: string;
  progress: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const GOAL_WINDOW_DAYS = 3;

function hashStr(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function goalPool(personality: string): NpcGoalType[] {
  const p = personality.toLowerCase();
  if (p.includes("sport")) return ["SPORT", "SOCIAL", "EXPLORATION", "WORK"];
  if (p.includes("leader") || p.includes("compet")) return ["CREW", "WORK", "SOCIAL", "SPORT"];
  if (p.includes("social") || p.includes("organis")) return ["SOCIAL", "CREW", "CULTURE", "EXPLORATION"];
  if (p.includes("travail") || p.includes("ambit")) return ["WORK", "CULTURE", "SPORT", "SOCIAL"];
  if (p.includes("romant")) return ["SOCIAL", "CULTURE", "EXPLORATION", "WORK"];
  return ["EXPLORATION", "SOCIAL", "WORK", "CULTURE", "SPORT", "CREW"];
}

const COPY: Record<NpcGoalType, Array<{ label: string; motivation: string }>> = {
  WORK: [
    { label: "Boucler un projet important cette semaine", motivation: "J'ai envie d'avancer pour de vrai, pas juste de parler de mes plans." },
    { label: "Mettre assez de Wory de côté", motivation: "Je veux me donner un peu plus de liberté pour la suite." },
  ],
  SPORT: [
    { label: "Tenir trois séances sans lâcher", motivation: "Je veux retrouver un bon rythme et voir si je peux rester régulier." },
    { label: "Tester un nouveau parcours en ville", motivation: "Changer d'air me motive plus que refaire toujours la même séance." },
  ],
  SOCIAL: [
    { label: "Organiser une vraie sortie avec du monde", motivation: "La ville est meilleure quand on arrête de rester chacun dans son coin." },
    { label: "Revoir des gens que je croise souvent", motivation: "J'ai envie que certaines connaissances deviennent de vraies habitudes." },
  ],
  CREW: [
    { label: "Faire avancer mon Crew dans le quartier", motivation: "Je veux qu'on soit connus pour ce qu'on construit, pas juste pour notre tag." },
    { label: "Rassembler le Crew autour d'un objectif", motivation: "Un Crew sert à quelque chose quand les gens font vraiment des trucs ensemble." },
  ],
  EXPLORATION: [
    { label: "Découvrir trois nouveaux coins de la ville", motivation: "J'en ai marre de toujours tourner aux mêmes endroits." },
    { label: "Changer de routine pendant quelques jours", motivation: "J'ai besoin de voir autre chose et de provoquer un peu le hasard." },
  ],
  CULTURE: [
    { label: "Trouver une sortie qui me marque vraiment", motivation: "J'ai envie d'un souvenir un peu meilleur qu'une soirée oubliée le lendemain." },
    { label: "Voir un événement différent de mes habitudes", motivation: "Je veux sortir de ma bulle sans forcément faire un truc énorme." },
  ],
};

/**
 * Objectif léger sur plusieurs jours : déterministe, sans timer, sans DB et
 * sans nouveau runtime. Le même PNJ garde le même objectif pendant une fenêtre
 * de trois jours, puis peut naturellement passer à autre chose.
 */
export function getNpcMultiDayGoal(
  npcId: string,
  personality: string | null | undefined,
  now: Date = new Date(),
): NpcMultiDayGoal {
  const timestamp = now.getTime();
  const windowMs = GOAL_WINDOW_DAYS * DAY_MS;
  const bucket = Math.floor(timestamp / windowMs);
  const startedMs = bucket * windowMs;
  const endsMs = startedMs + windowMs;
  const seed = hashStr(`${npcId}:${bucket}`);
  const pool = goalPool(personality ?? "");
  const type = pool[seed % pool.length];
  const variants = COPY[type];
  const copy = variants[(seed >>> 5) % variants.length];

  return {
    type,
    label: copy.label,
    motivation: copy.motivation,
    startedAt: new Date(startedMs).toISOString(),
    endsAt: new Date(endsMs).toISOString(),
    progress: clamp01((timestamp - startedMs) / windowMs),
  };
}

export function describeNpcGoal(goal: NpcMultiDayGoal): string {
  const pct = Math.round(goal.progress * 100);
  return `${goal.label} (${pct}% de la période)`;
}
