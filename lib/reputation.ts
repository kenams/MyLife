import { supabase } from "./supabase";
import type { HousingTierId } from "./housing";

export function computeReputation(
  level: number,
  playerXp: number,
  money: number,
  streak: number,
  housing: HousingTierId,
  actionCount: number,
): number {
  const housingBonus: Record<HousingTierId, number> = {
    squat: 0, studio: 8, appartement: 15,
    loft: 25, penthouse: 40, villa: 60, manoir: 80,
  };
  const raw =
    level * 2.5 +
    Math.sqrt(playerXp) * 0.4 +
    Math.log10(Math.max(money, 1)) * 8 +
    streak * 1.5 +
    (housingBonus[housing] ?? 0) +
    Math.min(actionCount * 0.3, 20);
  return Math.min(Math.round(raw), 100);
}

export async function upsertPlayerProfile(profile: {
  playerId:    string;
  displayName: string;
  playerEmoji: string;
  level:       number;
  playerXp:    number;
  money:       number;
  reputation:  number;
  streak:      number;
  housing:     HousingTierId;
  crewId?:     string | null;
  isPremium:   boolean;
}) {
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return;
  await supabase.from("player_profiles").upsert({
    user_id:      auth.user.id,
    player_id:    profile.playerId,
    display_name: profile.displayName,
    player_emoji: profile.playerEmoji,
    level:        profile.level,
    player_xp:    profile.playerXp,
    money:        profile.money,
    reputation:   profile.reputation,
    streak:       profile.streak,
    housing:      profile.housing,
    crew_id:      profile.crewId ?? null,
    is_premium:   profile.isPremium,
    last_seen:    new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  }, { onConflict: "user_id" });
}

export type PublicProfile = {
  player_id:    string;
  display_name: string;
  player_emoji: string;
  level:        number;
  player_xp:    number;
  money:        number;
  reputation:   number;
  streak:       number;
  housing:      HousingTierId;
  is_premium:   boolean;
  crew_id?:     string | null;
};

export async function fetchLeaderboard(
  sortBy: "reputation" | "player_xp" | "money" = "reputation",
  limit = 20
): Promise<PublicProfile[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("player_profiles")
    .select("*")
    .order(sortBy, { ascending: false })
    .limit(limit);
  return (data ?? []) as PublicProfile[];
}
