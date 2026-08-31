import { buildToulouseGeopolitics, crewPowerScore } from "@/lib/crew-geopolitics";
import type { Territory } from "@/lib/territories";

function territory(overrides: Partial<Territory> & Pick<Territory, "id" | "district_id" | "district_name">): Territory {
  return {
    district_emoji: "📍",
    center_lat: 43.6,
    center_lng: 1.44,
    owner_crew_id: null,
    owner_tag: null,
    owner_name: null,
    owner_emoji: null,
    owner_color: null,
    influence: 50,
    prestige: 1,
    conquered_at: null,
    defenses_won: 0,
    next_battle_at: null,
    ...overrides,
  };
}

describe("Toulouse crew geopolitics", () => {
  it("makes territory ownership the main source of city power", () => {
    expect(crewPowerScore({ territories: 2, influence: 80, prestige: 2, defenses: 0 }))
      .toBeGreaterThan(crewPowerScore({ territories: 1, influence: 100, prestige: 4, defenses: 2 }));
  });

  it("ranks crews and identifies hot and neutral districts", () => {
    const result = buildToulouseGeopolitics([
      territory({ id: "a", district_id: "cap", district_name: "Capitole", owner_crew_id: "red", owner_name: "Rouges", owner_tag: "RED", owner_emoji: "🔴", influence: 78, prestige: 2 }),
      territory({ id: "b", district_id: "car", district_name: "Carmes", owner_crew_id: "red", owner_name: "Rouges", owner_tag: "RED", owner_emoji: "🔴", influence: 55, prestige: 1 }),
      territory({ id: "c", district_id: "stc", district_name: "Saint-Cyprien", owner_crew_id: "blue", owner_name: "Bleus", owner_tag: "BLU", owner_emoji: "🔵", influence: 82, prestige: 3, next_battle_at: "2026-09-01T20:00:00Z" }),
      territory({ id: "d", district_id: "min", district_name: "Minimes" }),
    ]);

    expect(result.leader?.crewId).toBe("red");
    expect(result.leader?.territories).toBe(2);
    expect(result.challenger?.crewId).toBe("blue");
    expect(result.contestedTerritories.map((item) => item.id)).toEqual(["b", "c"]);
    expect(result.neutralTerritories.map((item) => item.id)).toEqual(["d"]);
  });
});
