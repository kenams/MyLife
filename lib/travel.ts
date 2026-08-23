import { supabase } from "./supabase";

export async function claimTravelReward(
  targetId: string, distanceM: number, durationS: number, destinationVerified: boolean
): Promise<{ ok: boolean; xp?: number; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { data, error } = await supabase.rpc("claim_travel_reward", {
    p_target_id: targetId,
    p_distance_m: Math.round(distanceM),
    p_duration_s: Math.round(durationS),
    p_destination_verified: destinationVerified,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, xp: data?.xp_awarded };
}
