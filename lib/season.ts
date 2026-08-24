import { supabase } from "./supabase";

export type MissionCategory = "explore" | "move" | "social";
export type MissionParticipationStatus =
  | "joined" | "in_progress" | "validatable" | "validated" | "rewarded"
  | "expired" | "abandoned" | "rejected";

export type SeasonMission = {
  id: string;
  season_id: string;
  category: MissionCategory;
  title: string;
  description: string;
  district_id: string | null;
  approx_lat: number | null;
  approx_lng: number | null;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  reward_xp: number;
  reward_money: number;
  reward_reputation: number;
  cooldown_hours: number;
  conditions: Record<string, unknown>;
  repeatable: boolean;
  difficulty: "easy" | "medium" | "hard";
  status: string;
  organizer: string;
  linked_event_id: string | null;
};

export type District = {
  id: string; slug: string; name: string; emoji: string;
  center_lat: number; center_lng: number;
};

export async function fetchActiveSeason(): Promise<{ id: string; name: string; theme_color: string; ends_at: string } | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("seasons").select("id,name,theme_color,ends_at").eq("status", "active").limit(1).maybeSingle();
  return data ?? null;
}

export async function fetchDistricts(): Promise<District[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("districts").select("*").order("name");
  return (data ?? []) as District[];
}

export async function fetchMyDistrict(): Promise<{ district_id: string } | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getSession();
  if (!auth?.session?.user) return null;
  const { data } = await supabase.from("player_districts").select("district_id").eq("user_id", auth.session.user.id).maybeSingle();
  return data ?? null;
}

export async function chooseDistrict(districtId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { error } = await supabase.rpc("choose_district", { p_district_id: districtId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function fetchActiveMissions(seasonId: string): Promise<SeasonMission[]> {
  if (!supabase) return [];
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("mission_definitions")
    .select("*")
    .eq("season_id", seasonId)
    .eq("status", "available")
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("created_at", { ascending: false });
  return (data ?? []) as SeasonMission[];
}

/** Toutes les missions de la saison (y compris expirées) — pour la Map et
 * ses filtres (Toutes/Disponibles/En cours/Terminées), contrairement à
 * fetchActiveMissions qui ne renvoie que celles jouables maintenant. */
export async function fetchAllSeasonMissions(seasonId: string): Promise<SeasonMission[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("mission_definitions")
    .select("*")
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false });
  return (data ?? []) as SeasonMission[];
}

export async function fetchMissionParticipantCounts(seasonId: string): Promise<Record<string, number>> {
  if (!supabase) return {};
  const { data } = await supabase.rpc("mission_map_summary", { p_season_id: seasonId });
  const map: Record<string, number> = {};
  (data ?? []).forEach((row: { mission_id: string; participant_count: number }) => {
    map[row.mission_id] = row.participant_count;
  });
  return map;
}

/** Abonnement Realtime unique pour toute la saison — pas un canal par
 * mission. Rappelle `onChange` sur tout INSERT/UPDATE touchant les missions
 * ou les participations (le composant appelant se contente de refetch). */
export function subscribeToSeasonUpdates(onChange: () => void) {
  if (!supabase) return null;
  return supabase
    .channel("season1-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "mission_definitions" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "mission_participations" }, onChange)
    .subscribe();
}

export async function fetchMyParticipations(): Promise<Record<string, MissionParticipationStatus>> {
  if (!supabase) return {};
  const { data: auth } = await supabase.auth.getSession();
  if (!auth?.session?.user) return {};
  const { data } = await supabase.from("mission_participations").select("mission_id,status").eq("user_id", auth.session.user.id);
  const map: Record<string, MissionParticipationStatus> = {};
  (data ?? []).forEach((row: { mission_id: string; status: MissionParticipationStatus }) => { map[row.mission_id] = row.status; });
  return map;
}

export async function joinMission(missionId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { error } = await supabase.rpc("join_mission", { p_mission_id: missionId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function validateMission(
  missionId: string, lat?: number, lng?: number, progress?: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { error } = await supabase.rpc("validate_mission", {
    p_mission_id: missionId, p_lat: lat ?? null, p_lng: lng ?? null, p_progress: progress ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function claimMissionReward(missionId: string): Promise<{
  ok: boolean; xp?: number; money?: number; reputation?: number; error?: string;
}> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { data, error } = await supabase.rpc("claim_mission_reward", { p_mission_id: missionId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, xp: data?.xp, money: data?.money, reputation: data?.reputation };
}

export async function abandonMission(missionId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("abandon_mission", { p_mission_id: missionId });
  return !error;
}

// ── Mission Bouger — protocole de session (aucun historique GPS conservé,
// seul le dernier point + la distance accumulée vivent côté serveur) ──────
export type MoveSession = {
  id: string;
  mission_id: string;
  status: "active" | "finished" | "abandoned" | "expired";
  distance_m: number;
  checkpoint_count: number;
  speed_flag_count: number;
};

export async function startMoveSession(missionId: string): Promise<{ ok: boolean; session?: MoveSession; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { data, error } = await supabase.rpc("start_move_session", { p_mission_id: missionId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, session: data as MoveSession };
}

export async function reportMoveCheckpoint(sessionId: string, lat: number, lng: number): Promise<{ ok: boolean; session?: MoveSession; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { data, error } = await supabase.rpc("report_move_checkpoint", { p_session_id: sessionId, p_lat: lat, p_lng: lng });
  if (error) return { ok: false, error: error.message };
  return { ok: true, session: data as MoveSession };
}

export async function finishMoveSession(sessionId: string): Promise<{ ok: boolean; session?: MoveSession; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { data, error } = await supabase.rpc("finish_move_session", { p_session_id: sessionId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, session: data as MoveSession };
}

export async function abandonMoveSession(sessionId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("abandon_move_session", { p_session_id: sessionId });
  return !error;
}

export async function fetchMyBadges(): Promise<{ code: string; name: string; icon: string; awarded_at: string }[]> {
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getSession();
  if (!auth?.session?.user) return [];
  const { data } = await supabase
    .from("badge_awards")
    .select("awarded_at, badges(code,name,icon)")
    .eq("user_id", auth.session.user.id);
  return (data ?? []).map((row: { awarded_at: string; badges: { code: string; name: string; icon: string } | { code: string; name: string; icon: string }[] }) => {
    const b = Array.isArray(row.badges) ? row.badges[0] : row.badges;
    return { code: b?.code ?? "", name: b?.name ?? "", icon: b?.icon ?? "🏅", awarded_at: row.awarded_at };
  });
}

export type ActivityEvent = {
  id: string; kind: string; title: string; body: string | null;
  visibility: "private" | "friends" | "crew" | "public"; created_at: string;
};

export async function fetchMyActivity(): Promise<ActivityEvent[]> {
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getSession();
  if (!auth?.session?.user) return [];
  const { data } = await supabase.rpc("fetch_activity_feed", { p_user_id: auth.session.user.id, p_limit: 10, p_offset: 0 });
  return (data ?? []) as ActivityEvent[];
}

export async function setActivityVisibility(eventId: string, visibility: ActivityEvent["visibility"]): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("personal_activity_events").update({ visibility }).eq("id", eventId);
  return !error;
}

export async function fetchDistrictLeaderboard(seasonId: string) {
  if (!supabase) return [];
  const { data } = await supabase.rpc("leaderboard_districts", { p_season_id: seasonId });
  return data ?? [];
}

export async function fetchPlayerLeaderboard(seasonId: string, period: "week" | "season" = "season") {
  if (!supabase) return [];
  const { data } = await supabase.rpc("leaderboard_players", { p_season_id: seasonId, p_period: period, p_limit: 20, p_offset: 0 });
  return data ?? [];
}

export type DailyChallenge = {
  template_code: string; title: string; description: string; category: MissionCategory;
  target_count: number; reward_xp: number; reward_money: number;
  progress_count: number; completed_at: string | null; claimed_at: string | null;
};

export async function fetchTodayChallenges(): Promise<DailyChallenge[]> {
  if (!supabase) return [];
  const { data } = await supabase.rpc("get_today_challenges");
  return (data ?? []) as DailyChallenge[];
}

export async function claimDailyChallenge(templateCode: string): Promise<{ ok: boolean; xp?: number; money?: number; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { data, error } = await supabase.rpc("claim_daily_challenge", { p_template_code: templateCode });
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, xp: row?.xp, money: row?.money };
}

export async function fetchMySeasonTotals(): Promise<{ xp: number; money: number; reputation: number }> {
  if (!supabase) return { xp: 0, money: 0, reputation: 0 };
  const { data } = await supabase.from("season_reward_ledger").select("xp,money,reputation");
  return (data ?? []).reduce(
    (acc: { xp: number; money: number; reputation: number }, r: { xp: number; money: number; reputation: number }) => ({
      xp: acc.xp + (r.xp ?? 0), money: acc.money + (r.money ?? 0), reputation: acc.reputation + (r.reputation ?? 0),
    }),
    { xp: 0, money: 0, reputation: 0 }
  );
}
