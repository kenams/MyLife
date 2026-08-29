import { describe, expect, it } from "vitest";

import {
  clearLocalCityPlayers,
  getLocalCityPlayers,
  publishLocalCityPlayers,
  subscribeLocalCityPlayers,
} from "@/lib/local-city-map-bridge";
import type { MapPlayer } from "@/lib/life-map";

function player(id: string, lat = 43.6047): MapPlayer {
  return {
    id,
    user_id: id,
    display_name: id,
    avatar_emoji: "🧑",
    status: "free",
    lat,
    lng: 1.4442,
    location_name: "Capitole",
    location_verified: false,
    last_action: "Vie quotidienne",
    is_star: false,
    is_npc: true,
    level: 1,
    crew_color: null,
    crew_tag: null,
    updated_at: "2026-08-29T20:00:00.000Z",
  };
}

describe("local city map bridge", () => {
  it("publishes only meaningful changes", () => {
    clearLocalCityPlayers();
    const events: MapPlayer[] = [];
    const unsubscribe = subscribeLocalCityPlayers((value) => events.push(value));

    publishLocalCityPlayers([player("npc-1")]);
    publishLocalCityPlayers([player("npc-1")]);
    publishLocalCityPlayers([player("npc-1", 43.605)]);

    expect(events).toHaveLength(2);
    expect(getLocalCityPlayers()).toHaveLength(1);
    unsubscribe();
    clearLocalCityPlayers();
  });

  it("ghosts residents that leave the materialized set", () => {
    clearLocalCityPlayers();
    const events: MapPlayer[] = [];
    const unsubscribe = subscribeLocalCityPlayers((value) => events.push(value));

    publishLocalCityPlayers([player("npc-2")]);
    publishLocalCityPlayers([]);

    expect(events.at(-1)?.id).toBe("npc-2");
    expect(events.at(-1)?.status).toBe("ghost");
    unsubscribe();
    clearLocalCityPlayers();
  });
});
