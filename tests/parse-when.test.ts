import { describe, expect, it } from "vitest";

import { parseWhen } from "@/lib/parse-when";

const now = new Date(2026, 8, 1, 12, 0); // 2026-09-01 12:00 local

describe("parseWhen", () => {
  it("parse le format ISO court", () => {
    const d = parseWhen("2026-09-05 20:00", now)!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(20);
  });

  it("parse le format jour/mois heure:min avec année courante", () => {
    const d = parseWhen("05/09 20:00", now)!;
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(5);
  });

  it("bascule sur l'année suivante si la date jj/mm est déjà passée", () => {
    const d = parseWhen("01/02 19:00", now)!;
    expect(d.getFullYear()).toBe(2027);
  });

  it("rejette les entrées invalides", () => {
    expect(parseWhen("demain soir", now)).toBeNull();
    expect(parseWhen("", now)).toBeNull();
    expect(parseWhen("2026-13-40 99:99", now)).toBeNull();
  });
});
