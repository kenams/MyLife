import { describe, expect, it } from "vitest";

import { happeningItemsToCityPulse } from "@/lib/city-pulse-happening-adapter";

it("maps existing happening-now data into City Pulse without a parallel fetch layer", () => {
  const signals = happeningItemsToCityPulse([
    { key: "battle", emoji: "x", text: "Battle en cours", href: "/battle/1", urgent: true },
    { key: "social", emoji: "x", text: "Activite sociale", href: "/rencontres" },
  ]);

  expect(signals[0]).toMatchObject({ kind: "CHALLENGE", priority: 92, source: "GAME" });
  expect(signals[1]).toMatchObject({ kind: "SOCIAL", source: "GAME" });
});
