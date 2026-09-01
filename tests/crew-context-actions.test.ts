import { describe, expect, it } from "vitest";

import {
  crewContextActionToCityPulse,
  selectCrewContextAction,
} from "@/lib/crew-context-actions";
import { buildToulouseGeopolitics } from "@/lib/crew-geopolitics";
import type { Territory } from "@/lib/territories";
import type { TerritoryBattle } from "@/lib/territory-wars";

function territory(overrides: Partial<Territory> & Pick<Territory, "id" | "district_id" | "district_name">): Territory {
  return {
    district_emoji: "pin",
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

function select(
  territories: Territory[],
  myCrewId: string | null,
  battles: TerritoryBattle[] = [],
  completedToday = false,
  playerLevel = 8,
  canLaunchBattle = false
) {
  return selectCrewContextAction({
    territories,
    geopolitics: buildToulouseGeopolitics(territories),
    battles,
    myCrewId,
    playerLevel,
    canLaunchBattle,
    completedToday,
  });
}

describe("crew context actions", () => {
  it("routes a player without a crew toward the existing Crew screen", () => {
    expect(select([], null)?.kind).toBe("JOIN_CREW");
  });

  it("never suggests the locked Crew feature to a level-one player", () => {
    expect(select([], null, [], false, 1)).toBeNull();
  });

  it("prioritizes a real battle involving the player's crew", () => {
    const capitole = territory({
      id: "territory-a",
      district_id: "district-a",
      district_name: "Capitole",
      owner_crew_id: "crew-b",
      owner_tag: "BET",
    });
    const battle = {
      id: "battle-a",
      district_id: "district-a",
      attacker_crew: "crew-a",
      defender_crew: "crew-b",
      status: "scheduled",
    } as TerritoryBattle;

    const action = select([capitole], "crew-a", [battle]);
    expect(action?.kind).toBe("BATTLE");
    expect(action?.battleId).toBe("battle-a");
  });

  it("chooses defense when the player's leading Crew has fragile influence", () => {
    const mine = territory({
      id: "territory-a",
      district_id: "district-a",
      district_name: "Capitole",
      owner_crew_id: "crew-a",
      owner_name: "Alpha",
      owner_tag: "ALP",
      influence: 55,
      prestige: 3,
    });
    const rival = territory({
      id: "territory-b",
      district_id: "district-b",
      district_name: "Carmes",
      owner_crew_id: "crew-b",
      owner_name: "Beta",
      owner_tag: "BET",
      influence: 80,
    });

    const action = select([mine, rival], "crew-a");
    expect(action?.kind).toBe("DEFEND");
    expect(action?.territoryId).toBe("territory-a");
  });

  it("pressures the dominant rival when the player's Crew is behind", () => {
    const leader = territory({
      id: "territory-a",
      district_id: "district-a",
      district_name: "Capitole",
      owner_crew_id: "crew-a",
      owner_name: "Alpha",
      owner_tag: "ALP",
      influence: 75,
      prestige: 4,
    });
    const mine = territory({
      id: "territory-b",
      district_id: "district-b",
      district_name: "Carmes",
      owner_crew_id: "crew-b",
      owner_name: "Beta",
      owner_tag: "BET",
      influence: 90,
    });

    const action = select([leader, mine], "crew-b");
    expect(action?.kind).toBe("PRESSURE");
    expect(action?.territoryId).toBe("territory-a");
    expect(crewContextActionToCityPulse(action!).territoryId).toBe("territory-a");
  });

  it("does not suggest another contribution after today's action", () => {
    expect(select([], "crew-a", [], true)).toBeNull();
  });

  it("reserves neutral-territory Battle suggestions for officers", () => {
    const neutral = territory({ id: "territory-a", district_id: "district-a", district_name: "Capitole" });
    expect(select([neutral], "crew-a")?.kind).not.toBe("EXPAND");
    expect(select([neutral], "crew-a", [], false, 8, true)?.kind).toBe("EXPAND");
  });
});
