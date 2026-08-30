import { describe, expect, it } from "vitest";

import type { CityPulseSignal } from "../lib/city-pulse";
import {
  groupMapOpportunities,
  mapOpportunityKindLabel,
  mapOpportunityIcon,
  MAP_OPPORTUNITY_SECTIONS,
} from "../lib/map-opportunity-presentation";

function signal(id: string, kind: CityPulseSignal["kind"]): CityPulseSignal {
  return { id, kind, title: id, body: id, priority: 50, source: "GAME" };
}

describe("map opportunity presentation", () => {
  it("groups the first three ranked signals into the right sections, order preserved", () => {
    const groups = groupMapOpportunities([
      signal("mission", "MISSION"),
      signal("date", "DATING"),
      signal("crew", "CREW"),
      signal("extra", "EVENT"),
    ]);

    expect(groups.now.map((i) => i.id)).toEqual(["mission"]);
    expect(groups.nearby.map((i) => i.id)).toEqual(["date"]);
    expect(groups.crew.map((i) => i.id)).toEqual(["crew"]);
    expect(groups.city).toHaveLength(0);
  });

  it("routes territory challenges to the crew/territoires section", () => {
    const groups = groupMapOpportunities([signal("battle", "CHALLENGE")]);
    expect(groups.crew.map((i) => i.id)).toEqual(["battle"]);
  });

  it("never presents more than three opportunities total", () => {
    const groups = groupMapOpportunities([
      signal("a", "MISSION"),
      signal("b", "DATING"),
      signal("c", "SOCIAL"),
      signal("d", "CREW"),
      signal("e", "CITY"),
    ]);
    const total = MAP_OPPORTUNITY_SECTIONS.reduce((n, s) => n + groups[s].length, 0);
    expect(total).toBe(3);
  });

  it("deduplicates signals and exposes player-facing labels/icons", () => {
    const duplicate = signal("same", "SOCIAL");
    const groups = groupMapOpportunities([duplicate, duplicate]);

    expect(groups.nearby).toHaveLength(1);
    expect(mapOpportunityKindLabel("DATING")).toBe("Rencontre");
    expect(mapOpportunityKindLabel("EXPLORATION")).toBe("Mission");
    expect(mapOpportunityKindLabel("CHALLENGE")).toBe("Territoire");
    expect(mapOpportunityIcon("MISSION")).toBe("🎯");
    expect(mapOpportunityIcon("CREW")).toBe("👥");
  });
});
