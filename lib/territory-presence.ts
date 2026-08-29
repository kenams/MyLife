import { supabase } from "./supabase";

export { currentEnemyTerritory } from "./territory-presence-logic";

/**
 * Territory Presence (§5) — sécurisé (§6). La détection « je suis dans tel
 * quartier » est 100 % locale ; seul un agrégat crew+jour part au serveur.
 * Jamais de position, jamais d'identité rivale exposée.
 */

export type InfluenceMission = {
  id: string;
  territory_id: string;
  target: number;
  progress: number;
  status: "active" | "done" | "claimed" | "expired";
};

export async function reportTerritoryActivity(districtId: string): Promise<InfluenceMission | null> {
  if (!supabase || !districtId) return null;
  const { data, error } = await supabase.rpc("report_territory_activity", { p_district_id: districtId });
  if (error || !data) return null;
  return data as InfluenceMission;
}

export async function fetchMyInfluenceMission(territoryId: string): Promise<InfluenceMission | null> {
  if (!supabase || !territoryId) return null;
  const { data } = await supabase
    .from("territory_influence_missions")
    .select("id, territory_id, target, progress, status")
    .eq("territory_id", territoryId)
    .in("status", ["active", "done"])
    .maybeSingle();
  return (data as InfluenceMission) ?? null;
}

export async function claimInfluenceMission(id: string): Promise<{ wory: number } | null> {
  if (!supabase || !id) return null;
  const { data, error } = await supabase.rpc("claim_influence_mission", { p_mission_id: id });
  if (error || !data) return null;
  return data as { wory: number };
}

export type ContestRow = {
  district_id: string;
  district_name: string;
  rival_crews: number;
  total_activity: number;
  last_day: string;
};

/** Résumé « activité rivale » pour le crew propriétaire — agrégé et retardé (J+1). */
export async function fetchContestSummary(): Promise<ContestRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("territory_contest_summary");
  if (error || !Array.isArray(data)) return [];
  return data as ContestRow[];
}
