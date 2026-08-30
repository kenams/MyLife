import type { HappeningItem } from "@/lib/happening-now";
import type { CityPulseKind, CityPulseSignal } from "@/lib/city-pulse";

function kindFor(item: HappeningItem): CityPulseKind {
  if (item.key === "battle") return "CHALLENGE";
  if (item.key === "outing") return "CREW";
  if (item.key === "social") return "SOCIAL";
  if (item.key.includes("event")) return "EVENT";
  return "CITY";
}

export function happeningItemsToCityPulse(items: HappeningItem[]): CityPulseSignal[] {
  return items.map((item) => ({
    id: `happening:${item.key}`,
    kind: kindFor(item),
    title: item.urgent ? "Maintenant" : "Toulouse Live",
    body: item.text,
    priority: item.urgent ? 92 : item.key === "outing" ? 74 : item.key === "social" ? 68 : 60,
    source: "GAME",
    actionable: Boolean(item.href),
  }));
}
