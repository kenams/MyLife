import { beforeEach, describe, expect, it, vi } from "vitest";

const backend = vi.hoisted(() => ({
  from: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: backend.from,
    rpc: backend.rpc,
  },
}));

import { createCrew, joinCrew } from "../lib/crews";
import { getCrewAccess, isCityUnlocked } from "../lib/progression";

const crew = {
  id: "crew-qa",
  name: "QA Crew",
  tag: "QA",
  emoji: "Q",
  color: "#ffffff",
  description: "QA",
  founder: "QA",
  member_count: 1,
  reputation: 0,
  created_at: "2026-08-30T00:00:00.000Z",
  treasury: 0,
  visitor_reward: 0,
};

describe("crew level unlock", () => {
  beforeEach(() => {
    backend.from.mockReset();
    backend.maybeSingle.mockReset();
    backend.rpc.mockReset();
    backend.maybeSingle.mockResolvedValue({ data: null });
    backend.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: backend.maybeSingle })),
      })),
    });
    backend.rpc.mockImplementation(async (name: string) =>
      name === "create_crew" ? { data: crew, error: null } : { data: {}, error: null }
    );
  });

  it("keeps the Crews page visible at level one", () => {
    expect(getCrewAccess(1, false)).toEqual({
      canView: true,
      canCreateOrJoin: false,
      canManageExisting: false,
    });
    expect(isCityUnlocked("crew", 1)).toBe(false);
  });

  it("blocks crew creation at level one", async () => {
    await expect(createCrew("QA Crew", "QA", "Q", "#fff", "QA", "QA", "Q", 1))
      .resolves.toEqual({ error: "LEVEL_LOCKED" });
    expect(backend.rpc).not.toHaveBeenCalled();
  });

  it("blocks crew joining at level one", async () => {
    await expect(joinCrew("crew-qa", "QA", "Q", 1)).resolves.toBe(false);
    expect(backend.rpc).not.toHaveBeenCalled();
  });

  it("allows crew creation at level two", async () => {
    await expect(createCrew("QA Crew", "QA", "Q", "#fff", "QA", "QA", "Q", 2))
      .resolves.toMatchObject({ id: "crew-qa" });
    expect(backend.rpc).toHaveBeenCalledWith("create_crew", expect.any(Object));
  });

  it("allows crew joining at level two", async () => {
    await expect(joinCrew("crew-qa", "QA", "Q", 2)).resolves.toBe(true);
    expect(backend.rpc).toHaveBeenCalledWith("join_crew_open", { p_crew_id: "crew-qa" });
  });

  it("preserves consultation and management for a legacy level-one member", () => {
    expect(getCrewAccess(1, true)).toEqual({
      canView: true,
      canCreateOrJoin: false,
      canManageExisting: true,
    });
  });

  it("rejects direct action calls when no valid store level is supplied", async () => {
    const invalidLevel = undefined as unknown as number;
    await expect(createCrew("QA Crew", "QA", "Q", "#fff", "QA", "QA", "Q", invalidLevel))
      .resolves.toEqual({ error: "LEVEL_LOCKED" });
    await expect(joinCrew("crew-qa", "QA", "Q", invalidLevel)).resolves.toBe(false);
    expect(backend.from).not.toHaveBeenCalled();
    expect(backend.rpc).not.toHaveBeenCalled();
  });
});
