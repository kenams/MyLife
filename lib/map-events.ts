import type { AvatarStats } from "@/lib/types";

export type MapEventSeverity = "low" | "medium" | "high";

export type MapEvent = {
  id: string;
  locationSlug: string;
  emoji: string;
  title: string;
  body: string;
  severity: MapEventSeverity;
  statKey: keyof Pick<
    AvatarStats,
    | "hunger"
    | "health"
    | "hygiene"
    | "mood"
    | "energy"
    | "attractiveness"
    | "money"
    | "sociability"
    | "reputation"
    | "stress"
  >;
};

type Rule = {
  id: string;
  statKey: MapEvent["statKey"];
  locationSlug: string;
  emoji: string;
  title: string;
  body: string;
  highAt?: number;
  mediumAt?: number;
  lowAt?: number;
  inverse?: boolean;
};

const RULES: Rule[] = [
  {
    id: "hunger-food",
    statKey: "hunger",
    locationSlug: "market",
    emoji: "🍎",
    title: "Faim basse",
    body: "Passe au marché ou au restaurant avant que l'énergie chute.",
    highAt: 22,
    mediumAt: 38,
    lowAt: 55,
  },
  {
    id: "health-care",
    statKey: "health",
    locationSlug: "spa",
    emoji: "✚",
    title: "Santé fragile",
    body: "Une pause soin stabilise la santé et réduit le stress.",
    highAt: 35,
    mediumAt: 52,
  },
  {
    id: "hygiene-home",
    statKey: "hygiene",
    locationSlug: "home",
    emoji: "🚿",
    title: "Hygiène à gérer",
    body: "Retourne chez toi pour récupérer de l'image et du confort.",
    highAt: 28,
    mediumAt: 45,
  },
  {
    id: "mood-park",
    statKey: "mood",
    locationSlug: "park",
    emoji: "🌿",
    title: "Moral bas",
    body: "Le parc et les rencontres calmes aident à remonter le moral.",
    highAt: 30,
    mediumAt: 48,
  },
  {
    id: "energy-rest",
    statKey: "energy",
    locationSlug: "home",
    emoji: "⚡",
    title: "Énergie faible",
    body: "Repos conseillé avant les activités sociales ou le travail.",
    highAt: 25,
    mediumAt: 42,
  },
  {
    id: "money-work",
    statKey: "money",
    locationSlug: "office",
    emoji: "💼",
    title: "Budget serré",
    body: "Le centre d'affaires peut relancer l'argent et la carrière.",
    highAt: 45,
    mediumAt: 90,
  },
  {
    id: "stress-spa",
    statKey: "stress",
    locationSlug: "spa",
    emoji: "🫧",
    title: "Tension élevée",
    body: "Une activité bien-être évite la spirale fatigue/stress.",
    highAt: 78,
    mediumAt: 62,
    inverse: true,
  },
  {
    id: "image-gym",
    statKey: "attractiveness",
    locationSlug: "gym",
    emoji: "✨",
    title: "Image à booster",
    body: "Sport, soin et shopping améliorent l'attractivité.",
    mediumAt: 48,
    lowAt: 62,
  },
  {
    id: "social-cafe",
    statKey: "sociability",
    locationSlug: "cafe",
    emoji: "💬",
    title: "Lien social faible",
    body: "Le café est le point d'entrée le plus sûr pour revoir du monde.",
    mediumAt: 45,
    lowAt: 62,
  },
  {
    id: "rep-lounge",
    statKey: "reputation",
    locationSlug: "rooftop-bar",
    emoji: "★",
    title: "Réputation à construire",
    body: "Les lieux premium donnent de la visibilité quand tu es prêt.",
    lowAt: 42,
  },
];

function severityFor(rule: Rule, value: number): MapEventSeverity | null {
  if (rule.inverse) {
    if (rule.highAt !== undefined && value >= rule.highAt) return "high";
    if (rule.mediumAt !== undefined && value >= rule.mediumAt) return "medium";
    if (rule.lowAt !== undefined && value >= rule.lowAt) return "low";
    return null;
  }

  if (rule.highAt !== undefined && value <= rule.highAt) return "high";
  if (rule.mediumAt !== undefined && value <= rule.mediumAt) return "medium";
  if (rule.lowAt !== undefined && value <= rule.lowAt) return "low";
  return null;
}

const SEVERITY_ORDER: Record<MapEventSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function buildMapEvents(stats: AvatarStats, limit = 4): MapEvent[] {
  return RULES.flatMap((rule) => {
    const severity = severityFor(rule, Number(stats[rule.statKey]));
    if (!severity) return [];
    return [{
      id: rule.id,
      locationSlug: rule.locationSlug,
      emoji: rule.emoji,
      title: rule.title,
      body: rule.body,
      severity,
      statKey: rule.statKey,
    }];
  })
    .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
    .slice(0, limit);
}

export function eventByLocation(events: MapEvent[]) {
  return events.reduce<Record<string, MapEvent>>((acc, event) => {
    const current = acc[event.locationSlug];
    if (!current || SEVERITY_ORDER[event.severity] > SEVERITY_ORDER[current.severity]) {
      acc[event.locationSlug] = event;
    }
    return acc;
  }, {});
}
