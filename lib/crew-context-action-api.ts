import { supabase } from "@/lib/supabase";

export type CrewContextActionResult = {
  applied: boolean;
  alreadyDone: boolean;
  actionKind: "defend" | "pressure";
  territoryId: string;
  influenceDelta: number;
  influenceBefore: number | null;
  influenceAfter: number;
};

export async function fetchCrewContextActionCompletedToday(): Promise<boolean> {
  if (!supabase) return false;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("crew_context_actions")
    .select("id")
    .eq("action_day", today)
    .limit(1)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function performCrewContextAction(territoryId: string): Promise<{
  ok: boolean;
  result?: CrewContextActionResult;
  error?: string;
}> {
  if (!supabase) return { ok: false, error: "Connexion indisponible" };
  const { data, error } = await supabase.rpc("perform_crew_context_action", {
    p_territory_id: territoryId,
  });
  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Action indisponible" };
  }

  const row = data as Record<string, unknown>;
  return {
    ok: true,
    result: {
      applied: row.applied === true,
      alreadyDone: row.already_done === true,
      actionKind: row.action_kind === "defend" ? "defend" : "pressure",
      territoryId: String(row.territory_id ?? territoryId),
      influenceDelta: Number(row.influence_delta ?? 0),
      influenceBefore: row.influence_before == null ? null : Number(row.influence_before),
      influenceAfter: Number(row.influence_after ?? 0),
    },
  };
}
