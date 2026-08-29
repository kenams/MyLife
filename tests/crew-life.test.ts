import { describe, expect, it } from "vitest";

import { currentWeekStart, deriveSocialRoles } from "@/lib/crew-life-logic";

describe("currentWeekStart", () => {
  it("renvoie le lundi de la semaine au format YYYY-MM-DD", () => {
    // 2026-08-27 = jeudi → lundi 2026-08-24
    expect(currentWeekStart(new Date("2026-08-27T10:00:00Z"))).toBe("2026-08-24");
    // 2026-08-24 = lundi → lui-même
    expect(currentWeekStart(new Date("2026-08-24T23:00:00Z"))).toBe("2026-08-24");
    // 2026-08-30 = dimanche → lundi 2026-08-24
    expect(currentWeekStart(new Date("2026-08-30T08:00:00Z"))).toBe("2026-08-24");
  });
});

describe("deriveSocialRoles", () => {
  const old = "2026-01-01T00:00:00Z";
  const recent = new Date(Date.now() - 2 * 86400_000).toISOString();

  it("attribue Pilier au membre le plus ancien et Recrue aux nouveaux", () => {
    const roles = deriveSocialRoles([
      { userId: "a", playerName: "A", joinedAt: old, role: "founder", memoriesAuthored: 0 },
      { userId: "b", playerName: "B", joinedAt: recent, role: "member", memoriesAuthored: 0 },
    ]);
    expect(roles.a.map((r) => r.label)).toContain("Pilier");
    expect(roles.a.map((r) => r.label)).toContain("Fondateur");
    expect(roles.b.map((r) => r.label)).toContain("Recrue");
  });

  it("attribue Ambianceur au plus gros contributeur de souvenirs", () => {
    const roles = deriveSocialRoles([
      { userId: "a", playerName: "A", joinedAt: old, role: "founder", memoriesAuthored: 1 },
      { userId: "b", playerName: "B", joinedAt: old, role: "member", memoriesAuthored: 5 },
    ]);
    expect(roles.b.map((r) => r.label)).toContain("Ambianceur");
    expect(roles.a?.map((r) => r.label) ?? []).not.toContain("Ambianceur");
  });

  it("ne plante pas sur un crew vide", () => {
    expect(deriveSocialRoles([])).toEqual({});
  });
});
