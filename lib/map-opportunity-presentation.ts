import type { CityPulseKind, CityPulseSignal } from "@/lib/city-pulse";

export type MapOpportunitySection = "now" | "nearby" | "crew" | "city";

export const MAP_OPPORTUNITY_SECTIONS: MapOpportunitySection[] = ["now", "nearby", "crew", "city"];

export const MAP_OPPORTUNITY_SECTION_LABELS: Record<MapOpportunitySection, string> = {
  now: "À faire maintenant",
  nearby: "Autour de toi",
  crew: "Crew / territoires",
  city: "Ville",
};

const SECTION_BY_KIND: Record<CityPulseKind, MapOpportunitySection> = {
  CHALLENGE: "crew",
  MISSION: "now",
  EXPLORATION: "now",
  DATING: "nearby",
  SOCIAL: "nearby",
  EVENT: "nearby",
  CREW: "crew",
  CITY: "city",
};

export function mapOpportunityKindLabel(kind: CityPulseKind): string {
  if (kind === "CHALLENGE") return "Territoire";
  if (kind === "DATING") return "Rencontre";
  if (kind === "CREW") return "Crew";
  if (kind === "MISSION" || kind === "EXPLORATION") return "Mission";
  if (kind === "SOCIAL" || kind === "EVENT") return "Sortie";
  return "Ville";
}

export function mapOpportunityIcon(kind: CityPulseKind): string {
  if (kind === "CHALLENGE") return "⚔️";
  if (kind === "DATING") return "💕";
  if (kind === "CREW") return "👥";
  if (kind === "MISSION" || kind === "EXPLORATION") return "🎯";
  if (kind === "SOCIAL" || kind === "EVENT") return "🍽️";
  return "🏙️";
}

export function groupMapOpportunities(signals: CityPulseSignal[]): Record<MapOpportunitySection, CityPulseSignal[]> {
  const groups: Record<MapOpportunitySection, CityPulseSignal[]> = { now: [], nearby: [], crew: [], city: [] };
  const seen = new Set<string>();

  for (const signal of signals.slice(0, 3)) {
    if (seen.has(signal.id)) continue;
    seen.add(signal.id);
    groups[SECTION_BY_KIND[signal.kind]].push(signal);
  }

  return groups;
}
