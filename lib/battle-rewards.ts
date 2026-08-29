import { supabase } from "./supabase";

/**
 * Récompenses de Territory War (§9 gages · §10 trophées/titres). Le serveur
 * fait foi : trophées et réputation sont posés dans `resolve_territory_battle_war`,
 * le gage est choisi par un officier du crew vainqueur via `apply_battle_gage`.
 */

export type GageOption = { code: string; emoji: string; label: string };

export type BattleRewardSummary = {
  battle_id: string;
  winner_crew: string | null;
  resolved_at: string | null;
  trophies: { crew_id: string; kind: string; label: string }[];
  titles: { crew_id: string; title: string; expires_at: string | null }[];
  gages: { target_crew_id: string; label: string; expires_at: string }[];
};

export async function fetchBattleRewardSummary(battleId: string): Promise<BattleRewardSummary | null> {
  if (!supabase || !battleId) return null;
  const { data, error } = await supabase.rpc("battle_reward_summary", { p_battle_id: battleId });
  if (error || !data) return null;
  return data as BattleRewardSummary;
}

export async function fetchGageOptions(): Promise<GageOption[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("battle_gage_options");
  if (error || !Array.isArray(data)) return [];
  return data as GageOption[];
}

export async function applyBattleGage(
  battleId: string,
  gageCode: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "hors ligne" };
  const { error } = await supabase.rpc("apply_battle_gage", { p_battle_id: battleId, p_gage_code: gageCode });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type CrewGage = { label: string; emoji: string; expires_at: string; from_battle_id: string | null };

/** Gages actifs (humiliation temporaire) visés sur un crew. */
export async function fetchActiveGages(crewId: string): Promise<CrewGage[]> {
  if (!supabase || !crewId) return [];
  const { data, error } = await supabase
    .from("crew_gages")
    .select("label, emoji, expires_at, from_battle_id")
    .eq("target_crew_id", crewId)
    .gt("expires_at", new Date().toISOString());
  if (error) return [];
  return (data ?? []) as CrewGage[];
}

export type CrewTitle = { title: string; expires_at: string | null; source: string };

export async function fetchCrewTitles(crewId: string): Promise<CrewTitle[]> {
  if (!supabase || !crewId) return [];
  const { data, error } = await supabase.rpc("crew_titles", { p_crew_id: crewId });
  if (error || !Array.isArray(data)) return [];
  return data as CrewTitle[];
}
