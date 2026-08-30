import { describe, expect, it } from "vitest";

import {
  dominantCrewByDistrict,
  rankCrewDominance,
  safePublicCitySignal,
  selectCityPulseOpportunities,
  type CityPulseSignal,
} from "@/lib/city-pulse";

describe("city pulse", () => {
  it("ranks crew dominance and exposes the leader of each district", () => {
    const crews = [
      { id: "a", name: "Alpha", district: "Capitole", reputation: 80, activity: 70, territoryCount: 2, trend24h: 3 },
      { id: "b", name: "Beta", district: "Capitole", reputation: 60, activity: 50, territoryCount: 1, trend24h: -1 },
      { id: "c", name: "Gamma", district: "Compans", reputation: 72, activity: 88, territoryCount: 2, trend24h: 5 },
    ];

    const ranked = rankCrewDominance(crews);
    const byDistrict = dominantCrewByDistrict(crews);

    expect(ranked[0].rank).toBe(1);
    expect(byDistrict.Capitole.id).toBe("a");
    expect(byDistrict.Compans.id).toBe("c");
  });

  it("selects at most three relevant opportunities and favors the player's district", () => {
    const signals: CityPulseSignal[] = [
      { id: "far", kind: "CHALLENGE", title: "A", body: "A", district: "Rangueil", priority: 80, source: "GAME" },
      { id: "near", kind: "SOCIAL", title: "B", body: "B", district: "Capitole", priority: 72, source: "GAME" },
      { id: "crew", kind: "CREW", title: "C", body: "C", district: "Capitole", priority: 65, source: "GAME", crewId: "crew-kah" },
      { id: "date", kind: "DATING", title: "D", body: "D", district: "Capitole", priority: 62, source: "GAME" },
      { id: "city", kind: "CITY", title: "E", body: "E", district: "Carmes", priority: 45, source: "GAME" },
    ];

    const selected = selectCityPulseOpportunities(signals, {
      district: "Capitole",
      crewId: "crew-kah",
      wantsDating: false,
    });

    expect(selected).toHaveLength(3);
    expect(selected[0].id).toBe("crew");
    expect(selected.some((signal) => signal.id === "date")).toBe(false);
  });

  it("rejects precise operational police tracking", () => {
    expect(
      safePublicCitySignal({
        id: "police-1",
        category: "POLICE",
        title: "Controle",
        body: "Controle exact ici",
        district: "Capitole",
        isOfficialOrPublic: true,
        preciseOperationalLocation: true,
      })
    ).toBeNull();
  });

  it("allows public safety information without operational police detail", () => {
    const signal = safePublicCitySignal({
      id: "safety-1",
      category: "SAFETY",
      title: "Accident signale",
      body: "Circulation perturbee dans le secteur.",
      district: "Jean-Jaures",
      isOfficialOrPublic: true,
    });

    expect(signal?.source).toBe("PUBLIC");
    expect(signal?.actionable).toBe(false);
  });
});
