export type CityPulseKind =
  | "CHALLENGE"
  | "SOCIAL"
  | "DATING"
  | "CREW"
  | "MISSION"
  | "EXPLORATION"
  | "EVENT"
  | "CITY";

export type CitySignalSource = "GAME" | "PUBLIC";

export type CityPulseSignal = {
  id: string;
  kind: CityPulseKind;
  title: string;
  body: string;
  district?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  priority: number;
  source: CitySignalSource;
  crewId?: string | null;
  crewName?: string | null;
  territoryId?: string | null;
  actionable?: boolean;
};

export type CrewDominanceInput = {
  id: string;
  name: string;
  district: string;
  reputation: number;
  activity: number;
  territoryCount?: number;
  trend24h?: number;
};

export type CrewDominance = CrewDominanceInput & {
  score: number;
  rank: number;
};

export type DistrictCrewDominance = {
  district: string;
  dominant: CrewDominance;
  challenger: CrewDominance | null;
  state: "dominant" | "contested" | "open";
  trend: "rising" | "stable" | "falling";
};

export type PlayerPulseContext = {
  district?: string | null;
  crewId?: string | null;
  wantsDating?: boolean;
  wantsSocial?: boolean;
  recentSignalIds?: string[];
};

export type PublicCitySignalInput = {
  id: string;
  category: "TRANSPORT" | "EVENT" | "WEATHER" | "TRAFFIC" | "SAFETY" | "POLICE";
  title: string;
  body: string;
  district?: string | null;
  priority?: number;
  isOfficialOrPublic?: boolean;
  preciseOperationalLocation?: boolean;
};

const KIND_WEIGHT: Record<CityPulseKind, number> = {
  CHALLENGE: 28,
  SOCIAL: 22,
  DATING: 20,
  CREW: 18,
  MISSION: 24,
  EXPLORATION: 14,
  EVENT: 16,
  CITY: 10,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function rankCrewDominance(crews: CrewDominanceInput[]): CrewDominance[] {
  return crews
    .map((crew) => ({
      ...crew,
      score: Math.round(
        clamp(crew.reputation) * 0.42 +
          clamp(crew.activity) * 0.38 +
          clamp((crew.territoryCount ?? 0) * 12) * 0.12 +
          clamp(50 + (crew.trend24h ?? 0) * 4) * 0.08
      ),
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || b.reputation - a.reputation || a.name.localeCompare(b.name))
    .map((crew, index) => ({ ...crew, rank: index + 1 }));
}

export function dominantCrewByDistrict(crews: CrewDominanceInput[]): Record<string, CrewDominance> {
  const ranked = rankCrewDominance(crews);
  const result: Record<string, CrewDominance> = {};
  for (const crew of ranked) {
    const current = result[crew.district];
    if (!current || crew.score > current.score) result[crew.district] = crew;
  }
  return result;
}

export function crewDominanceByDistrict(crews: CrewDominanceInput[]): Record<string, DistrictCrewDominance> {
  const ranked = rankCrewDominance(crews);
  const groups = new Map<string, CrewDominance[]>();
  for (const crew of ranked) {
    const list = groups.get(crew.district) ?? [];
    list.push(crew);
    groups.set(crew.district, list);
  }

  const result: Record<string, DistrictCrewDominance> = {};
  for (const [district, list] of groups) {
    const ordered = list.sort((a, b) => b.score - a.score || a.rank - b.rank);
    const dominant = ordered[0];
    if (!dominant) continue;
    const challenger = ordered[1] ?? null;
    const gap = challenger ? dominant.score - challenger.score : 100;
    result[district] = {
      district,
      dominant,
      challenger,
      state: challenger && gap <= 8 ? "contested" : "dominant",
      trend: (dominant.trend24h ?? 0) > 1 ? "rising" : (dominant.trend24h ?? 0) < -1 ? "falling" : "stable",
    };
  }
  return result;
}

export function safePublicCitySignal(input: PublicCitySignalInput): CityPulseSignal | null {
  if (!input.isOfficialOrPublic) return null;

  // MyLife may surface safety-oriented public information, but must never become
  // a precise operational radar for police locations, checks or interventions.
  if (input.category === "POLICE" && input.preciseOperationalLocation) return null;

  const categoryKind: CityPulseKind = input.category === "EVENT" ? "EVENT" : "CITY";
  const safeBody = input.category === "POLICE"
    ? "Perturbation ou intervention publique signalee dans le secteur. Evite la zone si necessaire et suis les consignes officielles."
    : input.body;

  return {
    id: `public:${input.id}`,
    kind: categoryKind,
    title: input.title,
    body: safeBody,
    district: input.district ?? null,
    priority: clamp(input.priority ?? 45),
    source: "PUBLIC",
    actionable: input.category !== "SAFETY" && input.category !== "POLICE",
  };
}

function contextualScore(signal: CityPulseSignal, context: PlayerPulseContext): number {
  if (context.recentSignalIds?.includes(signal.id)) return -1000;

  let score = clamp(signal.priority) + KIND_WEIGHT[signal.kind];

  if (context.district && signal.district === context.district) score += 22;
  if (context.crewId && signal.crewId === context.crewId) score += 18;
  if (signal.kind === "DATING" && context.wantsDating === false) score -= 60;
  if (signal.kind === "SOCIAL" && context.wantsSocial === false) score -= 35;
  if (signal.actionable === false) score -= 4;

  return score;
}

function isCurrent(signal: CityPulseSignal, now: number): boolean {
  const starts = signal.startsAt ? Date.parse(signal.startsAt) : null;
  const ends = signal.endsAt ? Date.parse(signal.endsAt) : null;
  if (starts && Number.isFinite(starts) && starts > now) return false;
  if (ends && Number.isFinite(ends) && ends < now) return false;
  return true;
}

function dedupeSignals(signals: CityPulseSignal[]): CityPulseSignal[] {
  const seen = new Set<string>();
  const out: CityPulseSignal[] = [];
  for (const signal of signals) {
    const key = signal.id || `${signal.kind}:${signal.district ?? ""}:${signal.title}:${signal.body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(signal);
  }
  return out;
}

export function selectCityPulseOpportunities(
  signals: CityPulseSignal[],
  context: PlayerPulseContext = {},
  limit = 3
): CityPulseSignal[] {
  if (limit <= 0) return [];

  const now = Date.now();
  return dedupeSignals(signals)
    .filter((signal) => isCurrent(signal, now))
    .map((signal) => ({ signal, score: contextualScore(signal, context) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.signal.priority - a.signal.priority || a.signal.id.localeCompare(b.signal.id))
    .slice(0, Math.min(3, limit))
    .map(({ signal }) => signal);
}

export type LivingCityEventLike = {
  id: string;
  kind: string;
  title: string;
  body: string;
  district: string;
  at: string;
  priority: number;
  crewIds?: string[];
};

function pulseKindForLivingEvent(kind: string): CityPulseKind {
  if (kind === "BATTLE" || kind === "TERRITORY") return "CHALLENGE";
  if (kind === "CREW") return "CREW";
  if (kind === "MISSION") return "MISSION";
  if (kind === "FEELING" || kind === "MATCH") return "DATING";
  if (kind === "OUTING" || kind === "RELATIONSHIP" || kind === "SOCIAL") return "SOCIAL";
  if (kind === "EVENT") return "EVENT";
  return "CITY";
}

export function livingCityEventsToCityPulse(events: LivingCityEventLike[]): CityPulseSignal[] {
  return events.map((event) => ({
    id: `living:${event.id}`,
    kind: pulseKindForLivingEvent(event.kind),
    title: event.title,
    body: event.body,
    district: event.district,
    startsAt: event.at,
    priority: clamp(event.priority),
    source: "GAME",
    crewId: event.crewIds?.[0] ?? null,
    actionable: event.kind !== "CITY" && event.kind !== "WORY",
  }));
}

export function cityPulseRoute(signal: CityPulseSignal): string {
  if (signal.territoryId && (signal.kind === "CREW" || signal.kind === "CHALLENGE")) {
    return `/(app)/territories?focus=${encodeURIComponent(signal.territoryId)}`;
  }
  if (signal.kind === "MISSION" || signal.kind === "EXPLORATION") return "/(app)/missions";
  if (signal.kind === "CHALLENGE") return "/(app)/territories";
  if (signal.kind === "CREW") return "/(app)/(tabs)/crews";
  if (signal.kind === "DATING") return "/(app)/rencontres";
  if (signal.kind === "SOCIAL" || signal.kind === "EVENT") return "/(app)/outings";
  return "/(app)/(tabs)/map";
}
