import { describe, expect, it } from "vitest";

import {
  deriveDistrictStates,
  districtStateChanges,
  crewDominanceShift,
  consequenceSignals,
  buildCityDigest,
  appendCityHistory,
  applyCityConsequences,
  type DistrictStateMap,
} from "../lib/city-consequences";
import type { LivingCityCrew, LivingCityEvent, LivingCityState } from "../lib/living-city";

const NOW = new Date("2026-09-01T15:00:00Z");
const NIGHT = new Date("2026-09-01T23:30:00Z");

function ev(kind: LivingCityEvent["kind"], district: string, i = 0): LivingCityEvent {
  return {
    id: `${kind}-${district}-${i}`, kind, title: kind, body: "x", district,
    at: NOW.toISOString(), priority: 50, notify: false, actorNpcIds: [], crewIds: [],
  };
}

function crew(id: string, district: string, reputation: number, activity: number): LivingCityCrew {
  return { id, name: id, tag: id.toUpperCase().slice(0, 3), emoji: "🔥", color: "#f00", district, reputation, activity, rivalTags: [], is_npc: true, is_demo: true };
}

describe("deriveDistrictStates", () => {
  it("is deterministic for the same input", () => {
    const events = [ev("SOCIAL", "Carmes"), ev("OUTING", "Carmes", 1), ev("BATTLE", "Compans")];
    const a = deriveDistrictStates(events, {}, NOW);
    const b = deriveDistrictStates(events, {}, NOW);
    expect(a).toEqual(b);
  });

  it("reads social vs competitive activity into distinct moods", () => {
    const events = [
      ev("SOCIAL", "Carmes"), ev("OUTING", "Carmes", 1), ev("FEELING", "Carmes", 2),
      ev("BATTLE", "Compans"), ev("TERRITORY", "Compans", 1), ev("CREW", "Compans", 2),
    ];
    const states = deriveDistrictStates(events, {}, NOW);
    expect(states["Carmes"].mood).toBe("social");
    expect(states["Compans"].mood).toBe("competitif");
  });

  it("leans nocturne for social night activity", () => {
    const events = [ev("SOCIAL", "Saint-Aubin"), ev("OUTING", "Saint-Aubin", 1)];
    expect(deriveDistrictStates(events, {}, NIGHT)["Saint-Aubin"].mood).toBe("nocturne");
  });

  it("only scans a bounded slice of events (no O(N))", () => {
    const many: LivingCityEvent[] = Array.from({ length: 500 }, (_, i) => ev("EVENT", `D${i}`, i));
    const states = deriveDistrictStates(many, {}, NOW);
    expect(Object.keys(states).length).toBeLessThanOrEqual(24);
  });

  it("decays previous score over quiet ticks until a district calms down", () => {
    let prev: DistrictStateMap = { Minimes: { mood: "actif", score: 5, at: NOW.toISOString() } };
    for (let i = 0; i < 5; i++) prev = deriveDistrictStates([], prev, NOW);
    expect(prev["Minimes"]?.mood).toBe("calme");
    expect(prev["Minimes"]?.score).toBeLessThan(1);
  });
});

describe("districtStateChanges", () => {
  it("emits only real mood changes", () => {
    const prev: DistrictStateMap = {
      Carmes: { mood: "calme", score: 1, at: "" },
      Minimes: { mood: "actif", score: 3, at: "" },
    };
    const next: DistrictStateMap = {
      Carmes: { mood: "social", score: 4, at: "" },
      Minimes: { mood: "actif", score: 3, at: "" },
    };
    expect(districtStateChanges(prev, next)).toEqual([{ district: "Carmes", from: "calme", to: "social" }]);
  });
});

describe("crewDominanceShift", () => {
  it("detects a top-crew flip per district, O(crews)", () => {
    const prev = [crew("wlv", "Capitole", 60, 50), crew("kings", "Capitole", 40, 40)];
    const next = [crew("wlv", "Capitole", 45, 30), crew("kings", "Capitole", 80, 70)];
    expect(crewDominanceShift(prev, next)).toEqual([{ district: "Capitole", crewTag: "KIN", crewName: "kings" }]);
  });

  it("stays silent when the leader is unchanged", () => {
    const prev = [crew("wlv", "Capitole", 60, 50), crew("kings", "Capitole", 40, 40)];
    const next = [crew("wlv", "Capitole", 62, 52), crew("kings", "Capitole", 41, 41)];
    expect(crewDominanceShift(prev, next)).toEqual([]);
  });
});

describe("consequenceSignals", () => {
  it("turns real changes into player-facing City Pulse signals, deduped per district", () => {
    const sigs = consequenceSignals(
      [{ district: "Jean-Jaures", from: "calme", to: "actif" }],
      [{ district: "Capitole", crewTag: "WLV", crewName: "Wolves" }],
      NOW,
    );
    expect(sigs).toHaveLength(2);
    expect(sigs.find((s) => s.district === "Jean-Jaures")?.title).toContain("s'anime");
    expect(sigs.find((s) => s.district === "Capitole")?.kind).toBe("CREW");
    expect(sigs.every((s) => !/npc|#\d/i.test(s.body))).toBe(true);
  });

  it("produces nothing when nothing changed", () => {
    expect(consequenceSignals([], [], NOW)).toEqual([]);
  });
});

describe("buildCityDigest", () => {
  it("returns at most 3 items and prioritises the player's district", () => {
    const digest = buildCityDigest(
      [
        { district: "Compans", from: "calme", to: "competitif" },
        { district: "Minimes", from: "calme", to: "actif" },
        { district: "Carmes", from: "calme", to: "social" },
      ],
      [{ district: "Capitole", crewTag: "WLV", crewName: "Wolves" }],
      "Minimes",
    );
    expect(digest.length).toBeLessThanOrEqual(3);
    expect(digest[0]).toContain("Capitole");
    expect(digest.join(" ")).toContain("Minimes");
  });

  it("is empty when nothing meaningful changed", () => {
    expect(buildCityDigest([], [], "Capitole")).toEqual([]);
  });
});

function lc(over: Partial<LivingCityState> = {}): LivingCityState {
  return {
    enabled: true, preset: "NORMAL", speed: 1, crews: [], events: [],
    lastSimulatedAt: null, tick: 0, notificationsLastMinute: 0, avgTickMs: 0,
    lastAbsenceSummary: [], npcInteractionsLastTick: 0, outingsLastTick: 0,
    territorySignalsLastTick: 0, districtStates: {}, cityHistory: [], cityDigest: [], cityDigestAt: null,
    ...over,
  } as LivingCityState;
}

describe("applyCityConsequences (single bounded entry point)", () => {
  const socialEvents = [ev("SOCIAL", "Carmes"), ev("OUTING", "Carmes", 1), ev("FEELING", "Carmes", 2)];

  it("is deterministic: same prev + same tick state + same clock → same output", () => {
    const prev = lc();
    const tick = lc({ events: socialEvents });
    const now = new Date("2026-09-01T15:00:00Z");
    const a = applyCityConsequences(prev, tick, { playerDistrict: null, elapsedMs: 0, forced: false, now });
    const b = applyCityConsequences(prev, tick, { playerDistrict: null, elapsedMs: 0, forced: false, now });
    expect(a).toEqual(b);
  });

  it("caps the digest at 3 and only fills it on a real long gap", () => {
    const prev = lc({ districtStates: { Carmes: { mood: "calme", score: 0.5, at: "" } } });
    const tick = lc({ events: socialEvents });
    const short = applyCityConsequences(prev, tick, { playerDistrict: null, elapsedMs: 60_000, forced: false });
    expect(short.cityDigest).toEqual([]);
    const long = applyCityConsequences(prev, tick, { playerDistrict: null, elapsedMs: 60 * 60_000, forced: false });
    expect(long.cityDigest!.length).toBeGreaterThan(0);
    expect(long.cityDigest!.length).toBeLessThanOrEqual(3);
  });

  it("no digest and no synthetic events when nothing meaningful changed", () => {
    const prev = lc({ districtStates: { Carmes: { mood: "social", score: 6, at: "" } } });
    const tick = lc({ events: socialEvents });
    const out = applyCityConsequences(prev, tick, { playerDistrict: null, elapsedMs: 60 * 60_000, forced: false });
    expect(out.cityDigest).toEqual([]);
    expect(out.events.every((e) => !e.id.startsWith("cc:"))).toBe(true);
  });

  it("keeps events bounded to 60 even with many prior events", () => {
    const prior = Array.from({ length: 60 }, (_, i) => ev("EVENT", `D${i}`, i));
    const out = applyCityConsequences(lc(), lc({ events: prior, crews: [] }), { playerDistrict: null, elapsedMs: 0, forced: false });
    expect(out.events.length).toBeLessThanOrEqual(60);
  });

  it("does not feed its own synthetic events back into district-mood derivation (no loop)", () => {
    const now = new Date("2026-09-01T15:00:00Z");
    // tick already carries a previous synthetic CREW event for Compans
    const synthCrew = { ...ev("CREW", "Compans"), id: "cc:crew:Compans:WLV" };
    const tick = lc({ events: [synthCrew, synthCrew, synthCrew] });
    const out = applyCityConsequences(lc(), tick, { playerDistrict: null, elapsedMs: 0, forced: false, now });
    // Compans must NOT be pushed to "competitif" purely by our own cc: events
    expect(out.districtStates.Compans?.mood ?? "calme").not.toBe("competitif");
    // no NEW cc: event was generated from the pre-existing ones
    const inputCc = tick.events.filter((e) => e.id.startsWith("cc:")).length;
    expect(out.events.filter((e) => e.id.startsWith("cc:")).length).toBe(inputCc);
  });

  it("emits a crew shift once, not again on the next stable tick (idempotent)", () => {
    const now = new Date("2026-09-01T15:00:00Z");
    const before = [crew("wlv", "Capitole", 70, 60), crew("kin", "Capitole", 40, 30)];
    const after = [crew("wlv", "Capitole", 30, 20), crew("kin", "Capitole", 85, 75)];
    const first = applyCityConsequences(lc({ crews: before }), lc({ crews: after }), { playerDistrict: null, elapsedMs: 0, forced: false, now });
    expect(first.events.some((e) => e.id.startsWith("cc:crew:"))).toBe(true);
    // next tick: prev == after == tick.crews → no shift
    const second = applyCityConsequences(lc({ crews: after }), lc({ crews: after }), { playerDistrict: null, elapsedMs: 0, forced: false, now });
    expect(second.events.some((e) => e.id.startsWith("cc:crew:"))).toBe(false);
  });

  it("forced tick never fills the digest even after a long elapsed gap", () => {
    const now = new Date("2026-09-01T15:00:00Z");
    const prev = lc({ districtStates: { Carmes: { mood: "calme", score: 0.5, at: "" } } });
    const out = applyCityConsequences(prev, lc({ events: socialEvents }), { playerDistrict: null, elapsedMs: 5 * 60 * 60_000, forced: true, now });
    expect(out.cityDigest).toEqual([]);
  });

  it("surfaces a crew flip as a City Pulse candidate event", () => {
    const prev = lc({ crews: [crew("wlv", "Capitole", 70, 60), crew("kin", "Capitole", 40, 30)] });
    const tick = lc({ events: [], crews: [crew("wlv", "Capitole", 30, 20), crew("kin", "Capitole", 85, 75)] });
    const out = applyCityConsequences(prev, tick, { playerDistrict: null, elapsedMs: 0, forced: false });
    const synth = out.events.find((e) => e.id.startsWith("cc:crew:"));
    expect(synth).toBeTruthy();
    expect(synth!.notify).toBe(false);
    expect(synth!.kind).toBe("CREW");
  });
});

describe("appendCityHistory", () => {
  it("stays bounded and prepends fresh entries", () => {
    let hist = Array.from({ length: 19 }, (_, i) => ({ id: `old-${i}`, text: `old ${i}`, at: "" }));
    hist = appendCityHistory(hist, [{ district: "Carmes", from: "calme", to: "actif" }], [], NOW, 20);
    expect(hist.length).toBe(20);
    expect(hist[0].text).toContain("Carmes");
  });

  it("returns the same array when nothing changed", () => {
    const hist = [{ id: "a", text: "a", at: "" }];
    expect(appendCityHistory(hist, [], [], NOW)).toBe(hist);
  });
});
