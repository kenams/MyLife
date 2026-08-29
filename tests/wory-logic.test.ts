import { describe, expect, it } from "vitest";

import { woryIdempotencyKey } from "@/lib/wory-logic";

describe("woryIdempotencyKey", () => {
  it("est stable pour les mêmes entrées", () => {
    const a = woryIdempotencyKey({ scope: "user", targetId: "u1", reason: "mission", sourceId: "m9" });
    const b = woryIdempotencyKey({ scope: "user", targetId: "u1", reason: "mission", sourceId: "m9" });
    expect(a).toBe(b);
  });

  it("diffère quand la cible, la raison ou la source changent", () => {
    const base = { scope: "user" as const, targetId: "u1", reason: "mission" as const, sourceId: "m9" };
    expect(woryIdempotencyKey(base)).not.toBe(woryIdempotencyKey({ ...base, targetId: "u2" }));
    expect(woryIdempotencyKey(base)).not.toBe(woryIdempotencyKey({ ...base, reason: "daily" }));
    expect(woryIdempotencyKey(base)).not.toBe(woryIdempotencyKey({ ...base, sourceId: "m10" }));
    expect(woryIdempotencyKey(base)).not.toBe(woryIdempotencyKey({ ...base, scope: "crew" }));
  });

  it("permet un nonce pour distinguer des mouvements légitimement répétés", () => {
    const d1 = woryIdempotencyKey({ scope: "user", targetId: "u1", reason: "daily", nonce: "2026-08-31" });
    const d2 = woryIdempotencyKey({ scope: "user", targetId: "u1", reason: "daily", nonce: "2026-09-01" });
    expect(d1).not.toBe(d2);
  });
});
