import { expect, it, vi } from "vitest";

import { selectCityPulseOpportunities } from "@/lib/city-pulse";

it("ignores future and expired signals", () => {
  vi.setSystemTime(new Date("2026-08-29T20:00:00Z"));
  const selected = selectCityPulseOpportunities([
    { id: "future", kind: "EVENT", title: "Future", body: "x", startsAt: "2026-08-29T22:00:00Z", priority: 99, source: "GAME" },
    { id: "expired", kind: "CITY", title: "Expired", body: "x", endsAt: "2026-08-29T18:00:00Z", priority: 99, source: "GAME" },
    { id: "now", kind: "SOCIAL", title: "Now", body: "x", priority: 50, source: "GAME" },
  ]);
  expect(selected.map((s) => s.id)).toEqual(["now"]);
  vi.useRealTimers();
});
