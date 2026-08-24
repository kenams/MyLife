import { supabase } from "./supabase";

export interface Crew {
  id:               string;
  name:             string;
  tag:              string;
  emoji:            string;
  color:            string;
  description?:     string;
  founder:          string;
  member_count:     number;
  reputation:       number;
  created_at:       string;
  bastion_zone_id?: string | null;
  treasury:         number;
  visitor_reward:   number;
}

export interface CrewMember {
  id:           string;
  crew_id:      string;
  user_id?:     string;
  player_name:  string;
  player_emoji: string;
  role:         "founder" | "officer" | "member";
  joined_at:    string;
  last_seen_at?: string;
}

export interface CrewZone {
  id:                  string;
  crew_id:             string;
  name:                string;
  lat:                 number;
  lng:                 number;
  radius:              number;
  claimed_at:          string;
  expires_at:          string;
  last_activity_at?:   string;
  is_bastion:          boolean;
  bastion_passive_xp:  number;
  bastion_passive_rep: number;
  last_passive_at?:    string;
}

export const BASTION_MIN_DISTANCE_M = 500; // distance min entre deux bastions
export const BASTION_RADIUS = 500;         // rayon fixe d'un bastion (en mètres)

export type CrewZoneRich = CrewZone & {
  crew: Pick<Crew, "color" | "tag" | "emoji" | "name" | "member_count" | "reputation">;
  is_bastion?: boolean;
};

// ── Zone radius dynamique ──────────────────────────────────────────────────────
export function computeZoneRadius(memberCount: number, reputation: number): number {
  const base =
    memberCount >= 50 ? 1200 :
    memberCount >= 20 ? 800  :
    memberCount >= 10 ? 500  :
    memberCount >= 5  ? 350  : 250;
  // Bonus réputation : +1m par point de réputation au-dessus de 50
  const repBonus = Math.max(0, reputation - 50) * 1.5;
  return Math.round(base + repBonus);
}

// Intensité du glow : 0..1 selon member_count
export function computeGlowIntensity(memberCount: number): number {
  if (memberCount >= 50) return 1.0;
  if (memberCount >= 20) return 0.75;
  if (memberCount >= 10) return 0.5;
  if (memberCount >= 5)  return 0.3;
  return 0.15;
}

// ── Joueur dans la zone de son crew ? ─────────────────────────────────────────
export function isPlayerInZone(
  playerLat: number, playerLng: number,
  zone: CrewZone
): boolean {
  const R = 6371000; // Rayon Terre en mètres
  const dLat = (zone.lat - playerLat) * Math.PI / 180;
  const dLng = (zone.lng - playerLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(playerLat * Math.PI / 180) * Math.cos(zone.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return dist <= zone.radius;
}

// ── Deux zones se chevauchent ? ───────────────────────────────────────────────
function zonesOverlap(a: CrewZone, b: CrewZone): boolean {
  const R = 6371000;
  const dLat = (a.lat - b.lat) * Math.PI / 180;
  const dLng = (a.lng - b.lng) * Math.PI / 180;
  const aa = Math.sin(dLat / 2) ** 2 +
    Math.cos(b.lat * Math.PI / 180) * Math.cos(a.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return dist < (a.radius + b.radius) * 0.6;
}

// ── Vérifier conflits et créer guerre si besoin ───────────────────────────────
// DÉSACTIVÉ : faisait des .insert() bruts sur crew_wars/flash_events, tables
// désormais verrouillées (grand ouvertes à l'écriture pour authenticated).
// À reconstruire en RPC SECURITY DEFINER avant réactivation.
export async function checkAndTriggerWars(_zones: CrewZoneRich[]): Promise<void> {
  return;
}

// ── Ping activité dans la zone (reset decay) ─────────────────────────────────
export async function pingZoneActivity(zoneId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("crew_zones")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", zoneId);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function fetchCrews(): Promise<Crew[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("crews")
    .select("*")
    .order("reputation", { ascending: false });
  return (data ?? []) as Crew[];
}

export async function fetchCrewZones(): Promise<CrewZoneRich[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("crew_zones")
    .select("*, is_bastion, crew:crews(color,tag,emoji,name,member_count,reputation)")
    .gte("expires_at", new Date().toISOString());
  return (data ?? []) as CrewZoneRich[];
}

export async function isTagAvailable(tag: string): Promise<boolean> {
  if (!supabase) return true;
  const { data } = await supabase
    .from("crews")
    .select("id")
    .eq("tag", tag.toUpperCase().trim())
    .maybeSingle();
  return !data;
}

export async function createCrew(
  name: string, tag: string, emoji: string, color: string,
  description: string, founderName: string, founderEmoji: string
): Promise<Crew | { error: "TAG_TAKEN" } | null> {
  if (!supabase) return null;
  const normalizedTag = tag.toUpperCase().trim().replace(/[^A-Z0-9]/g, "").slice(0, 5);

  const available = await isTagAvailable(normalizedTag);
  if (!available) return { error: "TAG_TAKEN" };

  // Passe par la RPC create_crew (SECURITY DEFINER) : l'insert direct sur
  // crews/crew_members est verrouillé côté base depuis la faille
  // d'auto-promotion trouvée et corrigée (n'importe qui pouvait s'insérer
  // comme founder de n'importe quel crew).
  const { data, error } = await supabase.rpc("create_crew", {
    p_name: name, p_tag: normalizedTag, p_emoji: emoji, p_color: color, p_description: description,
  });
  if (error || !data) return null;
  return data as Crew;
}

export async function joinCrew(
  crewId: string, _playerName: string, _playerEmoji: string
): Promise<boolean> {
  if (!supabase) return false;
  // RPC : assigne toujours le rôle 'recruit', jamais un rôle passé par le
  // client (même logique que createCrew — insert direct verrouillé).
  const { error } = await supabase.rpc("join_crew_open", { p_crew_id: crewId });
  return !error;
}

export async function transferLeader(
  crewId: string,
  newLeaderUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Pas de connexion" };
  // RPC : seul le founder actuel peut transférer, verrouillé côté base
  // depuis la faille d'auto-promotion trouvée et corrigée (n'importe quel
  // membre pouvait s'auto-nommer founder via un update direct).
  const { error } = await supabase.rpc("transfer_crew_leadership", {
    p_crew_id: crewId, p_new_founder_user_id: newLeaderUserId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface CrewWarRecord {
  id: string;
  crew_a_id: string;
  crew_b_id: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
  crew_a?: Pick<Crew, "name" | "tag" | "color" | "emoji">;
  crew_b?: Pick<Crew, "name" | "tag" | "color" | "emoji">;
}

export async function fetchCrewWars(crewId?: string): Promise<CrewWarRecord[]> {
  if (!supabase) return [];
  let query = supabase
    .from("crew_wars")
    .select("*, crew_a:crew_a_id(name,tag,color,emoji), crew_b:crew_b_id(name,tag,color,emoji)")
    .order("started_at", { ascending: false })
    .limit(20);

  if (crewId) {
    query = query.or(`crew_a_id.eq.${crewId},crew_b_id.eq.${crewId}`);
  }

  const { data } = await query;
  return (data ?? []) as CrewWarRecord[];
}

export async function fetchCrewMembers(crewId: string): Promise<CrewMember[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("crew_members")
    .select("*")
    .eq("crew_id", crewId)
    .order("joined_at", { ascending: true });
  return (data ?? []) as CrewMember[];
}

export async function getMyCrewId(playerName: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("crew_members")
    .select("crew_id")
    .eq("player_name", playerName)
    .maybeSingle();
  return data?.crew_id ?? null;
}

// Version réelle (auth.uid(), pas player_name) : renvoie le crew dont on est
// officer/founder — seul cas où on a le droit d'inviter quelqu'un.
export async function getMyOfficerCrewId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: authData } = await supabase.auth.getSession();
  const uid = authData?.session?.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("crew_members")
    .select("crew_id")
    .eq("user_id", uid)
    .in("role", ["founder", "officer"])
    .limit(1)
    .maybeSingle();
  return data?.crew_id ?? null;
}

export async function inviteToCrew(crewId: string, targetUserId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { error } = await supabase.rpc("invite_to_crew", { p_crew_id: crewId, p_invitee: targetUserId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getMyCrewZone(crewId: string): Promise<CrewZone | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("crew_zones")
    .select("*")
    .eq("crew_id", crewId)
    .gte("expires_at", new Date().toISOString())
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as CrewZone | null;
}

export async function claimZone(
  crewId: string, name: string, lat: number, lng: number,
  memberCount = 1, reputation = 0
): Promise<boolean> {
  if (!supabase) return false;
  const radius = computeZoneRadius(memberCount, reputation);
  const { error } = await supabase.from("crew_zones").insert({
    crew_id: crewId, name, lat, lng, radius,
  });
  return !error;
}

// ── Pénalités de quitter un crew ──────────────────────────────────────────────
export interface LeaveCrewResult {
  ok: boolean;
  blocked?: boolean;    // leader ne peut pas quitter sans transférer
  penalties: {
    xpLost: number;       // -250 XP
    reputationLost: number; // -15% réputation
    cooldownDays: number;   // 7 jours sans rejoindre un autre crew
    moneyLost: number;      // -500 coins de trésorerie crew
  };
  error?: string;
}

export async function leaveCrew(
  crewId: string,
  playerName: string,
  playerXp: number,
  playerReputation: number,
  playerMoney: number,
): Promise<LeaveCrewResult> {
  const penalties = {
    xpLost: 250,
    reputationLost: Math.round(playerReputation * 0.15),
    cooldownDays: 7,
    moneyLost: 500,
  };

  if (!supabase) return { ok: false, penalties, error: "Pas de connexion" };

  // Vérifier si le joueur est leader
  const { data: member } = await supabase
    .from("crew_members")
    .select("role")
    .eq("crew_id", crewId)
    .eq("player_name", playerName)
    .maybeSingle();

  if (member?.role === "founder") {
    // Vérifier si d'autres membres existent
    const { data: others } = await supabase
      .from("crew_members")
      .select("id")
      .eq("crew_id", crewId)
      .neq("player_name", playerName);

    if (others && others.length > 0) {
      return {
        ok: false,
        blocked: true,
        penalties,
        error: "Tu es fondateur — transfère le rôle avant de quitter.",
      };
    }
    // Seul membre = dissolution du crew
    await supabase.from("crews").delete().eq("id", crewId);
    await supabase.from("life_map_players")
      .update({ crew_color: null, crew_tag: null })
      .eq("display_name", playerName);
    return { ok: true, penalties: { xpLost: 0, reputationLost: 0, cooldownDays: 0, moneyLost: 0 } };
  }

  // Retirer le membre
  const { error: leaveError } = await supabase
    .from("crew_members")
    .delete()
    .eq("crew_id", crewId)
    .eq("player_name", playerName);

  if (leaveError) return { ok: false, penalties, error: "Impossible de quitter le crew." };

  // Décrémenter member_count
  const { data: crew } = await supabase
    .from("crews")
    .select("member_count, reputation")
    .eq("id", crewId)
    .single();

  if (crew) {
    const newCount  = Math.max(0, (crew.member_count ?? 1) - 1);
    const newRadius = computeZoneRadius(newCount, crew.reputation ?? 0);
    await supabase.from("crews").update({ member_count: newCount }).eq("id", crewId);
    await supabase.from("crew_zones").update({ radius: newRadius }).eq("crew_id", crewId);
  }

  await supabase
    .from("life_map_players")
    .update({
      crew_color: null,
      crew_tag: null,
      crew_cooldown_until: new Date(Date.now() + penalties.cooldownDays * 86400000).toISOString(),
    })
    .eq("display_name", playerName);

  return { ok: true, penalties };
}

export async function getCrewCooldown(playerName: string): Promise<Date | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("life_map_players")
    .select("crew_cooldown_until")
    .eq("display_name", playerName)
    .single();
  if (!data?.crew_cooldown_until) return null;
  const until = new Date(data.crew_cooldown_until);
  return until > new Date() ? until : null;
}

// ── Bastions ──────────────────────────────────────────────────────────────────

export async function fetchBastions(): Promise<(CrewZone & { crew: Pick<Crew, "color" | "tag" | "emoji" | "name"> })[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("crew_zones")
    .select("*, crew:crews(color,tag,emoji,name)")
    .eq("is_bastion", true);
  return (data ?? []) as (CrewZone & { crew: Pick<Crew, "color" | "tag" | "emoji" | "name"> })[];
}

export async function claimBastion(
  crewId: string,
  name: string,
  lat: number,
  lng: number,
  memberCount = 1,
  reputation = 0,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Pas de connexion" };

  // Vérifie si le crew a déjà un bastion
  const { data: existing } = await supabase
    .from("crew_zones")
    .select("id")
    .eq("crew_id", crewId)
    .eq("is_bastion", true)
    .maybeSingle();
  if (existing) return { ok: false, error: "Ton crew a déjà un bastion." };

  // Vérifie la distance avec les autres bastions
  const others = await fetchBastions();
  for (const b of others) {
    const dist = haversineMeters(lat, lng, b.lat, b.lng);
    if (dist < BASTION_MIN_DISTANCE_M) {
      return {
        ok: false,
        error: `Trop proche du bastion [${b.crew?.tag ?? "?"}] — ${Math.round(dist)}m (min ${BASTION_MIN_DISTANCE_M}m).`,
      };
    }
  }

  const { data: zone, error } = await supabase
    .from("crew_zones")
    .insert({
      crew_id: crewId, name, lat, lng,
      radius: BASTION_RADIUS,
      is_bastion: true,
      expires_at: new Date(Date.now() + 365 * 86400000).toISOString(), // 1 an
      bastion_passive_xp: 5 + Math.floor(reputation / 50),
      bastion_passive_rep: 2 + Math.floor(memberCount / 5),
    })
    .select()
    .single();

  if (error || !zone) return { ok: false, error: "Impossible de créer le bastion." };

  await supabase.from("crews").update({ bastion_zone_id: zone.id }).eq("id", crewId);
  return { ok: true };
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function collectBastionPassive(
  zoneId: string,
): Promise<{ xp: number; rep: number } | null> {
  if (!supabase) return null;
  const { data: zone } = await supabase
    .from("crew_zones")
    .select("is_bastion, bastion_passive_xp, bastion_passive_rep, last_passive_at")
    .eq("id", zoneId)
    .single();
  if (!zone?.is_bastion) return null;

  const lastCollect = zone.last_passive_at ? new Date(zone.last_passive_at) : new Date(0);
  const hoursSince = (Date.now() - lastCollect.getTime()) / 3_600_000;
  if (hoursSince < 1) return null; // pas encore 1h

  const multiplier = Math.min(Math.floor(hoursSince), 24); // max 24h accumulées
  const xp  = zone.bastion_passive_xp  * multiplier;
  const rep = zone.bastion_passive_rep * multiplier;

  await supabase.from("crew_zones")
    .update({ last_passive_at: new Date().toISOString() })
    .eq("id", zoneId);

  return { xp, rep };
}

export async function declareSiege(
  attackerCrewId: string,
  bastionZoneId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Pas de connexion" };

  const { data: zone } = await supabase
    .from("crew_zones")
    .select("crew_id, is_bastion")
    .eq("id", bastionZoneId)
    .single();

  if (!zone?.is_bastion) return { ok: false, error: "Cette zone n'est pas un bastion." };
  if (zone.crew_id === attackerCrewId) return { ok: false, error: "C'est ton propre bastion." };

  // Pas de siège actif en cours sur ce bastion
  const { data: activeSiege } = await supabase
    .from("crew_wars")
    .select("id")
    .eq("siege_target_id", bastionZoneId)
    .eq("status", "active")
    .maybeSingle();
  if (activeSiege) return { ok: false, error: "Un siège est déjà en cours sur ce bastion." };

  await supabase.from("crew_wars").insert({
    crew_a_id: attackerCrewId,
    crew_b_id: zone.crew_id,
    siege_target_id: bastionZoneId,
    is_siege: true,
  });

  return { ok: true };
}

// ── Trésorerie crew ───────────────────────────────────────────────────────────

export async function depositToTreasury(
  crewId: string,
  amount: number,
): Promise<{ ok: boolean; newBalance: number }> {
  if (!supabase) return { ok: false, newBalance: 0 };
  const { data: crew } = await supabase
    .from("crews").select("treasury").eq("id", crewId).single();
  const current = crew?.treasury ?? 0;
  const newBalance = current + amount;
  const { error } = await supabase
    .from("crews").update({ treasury: newBalance }).eq("id", crewId);
  return { ok: !error, newBalance };
}

export async function setVisitorReward(
  crewId: string,
  amount: number, // 0 = désactivé
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("crews").update({ visitor_reward: Math.max(0, amount) }).eq("id", crewId);
  return !error;
}

// ── Check-in bastion ──────────────────────────────────────────────────────────

export interface CheckinResult {
  ok: boolean;
  blEarned: number;
  cooldownUntil?: Date;
  error?: string;
}

export async function bastionCheckin(
  zoneId: string,
  crewId: string,
  _playerName: string,
): Promise<CheckinResult> {
  if (!supabase) return { ok: false, blEarned: 0, error: "Pas de connexion" };
  // RPC : cooldown 24h + calcul de récompense + débit trésorerie vérifiés
  // côté serveur — un insert direct laissait n'importe qui injecter
  // n'importe quel bl_earned et contourner le cooldown.
  const { data, error } = await supabase.rpc("bastion_checkin", {
    p_zone_id: zoneId, p_crew_id: crewId,
  });
  if (error) {
    if (error.message.includes("Déjà check-in")) {
      return { ok: false, blEarned: 0, error: "Déjà check-in aujourd'hui." };
    }
    return { ok: false, blEarned: 0, error: error.message };
  }
  return { ok: true, blEarned: data?.bl_earned ?? 0 };
}

export async function getBastionCheckinCount(zoneId: string): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("bastion_checkins")
    .select("*", { count: "exact", head: true })
    .eq("zone_id", zoneId);
  return count ?? 0;
}

// ── Leaderboard joueurs ───────────────────────────────────────────────────────
export interface PlayerRank {
  display_name: string;
  avatar_emoji:  string;
  level:         number;
  crew_tag?:     string | null;
  crew_color?:   string | null;
  status:        string;
}

export async function fetchPlayerLeaderboard(limit = 20): Promise<PlayerRank[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("life_map_players")
    .select("display_name, avatar_emoji, level, crew_tag, crew_color, status")
    .neq("status", "ghost")
    .order("level", { ascending: false })
    .limit(limit);
  return (data ?? []) as PlayerRank[];
}

// ── Alliances ─────────────────────────────────────────────────────────────────
export interface CrewAlliance {
  id:          string;
  crew_a_id:   string;
  crew_b_id:   string;
  status:      "pending" | "active" | "broken";
  proposed_by: string;
  created_at:  string;
  accepted_at?: string;
  crew_a?: Pick<Crew, "name" | "tag" | "color" | "emoji">;
  crew_b?: Pick<Crew, "name" | "tag" | "color" | "emoji">;
}

export async function proposeAlliance(
  fromCrewId: string,
  toCrewId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Pas de connexion" };
  const { error } = await supabase.from("crew_alliances").insert({
    crew_a_id: fromCrewId,
    crew_b_id: toCrewId,
    proposed_by: fromCrewId,
  });
  if (error) return { ok: false, error: "Alliance déjà proposée ou existante." };
  return { ok: true };
}

export async function acceptAlliance(allianceId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("crew_alliances")
    .update({ status: "active", accepted_at: new Date().toISOString() })
    .eq("id", allianceId);
  return !error;
}

export async function fetchAlliances(crewId: string): Promise<CrewAlliance[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("crew_alliances")
    .select("*, crew_a:crew_a_id(name,tag,color,emoji), crew_b:crew_b_id(name,tag,color,emoji)")
    .or(`crew_a_id.eq.${crewId},crew_b_id.eq.${crewId}`)
    .order("created_at", { ascending: false });
  return (data ?? []) as CrewAlliance[];
}

// ── Auto-transfer si leader inactif > 30j ────────────────────────────────────
export async function checkLeaderInactivity(crewId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data: leader } = await supabase
    .from("crew_members")
    .select("player_name, joined_at, last_seen_at")
    .eq("crew_id", crewId)
    .eq("role", "founder")
    .single();
  if (!leader) return null;
  const lastActive = leader.last_seen_at ?? leader.joined_at;
  const daysSince = (Date.now() - new Date(lastActive).getTime()) / 86400000;
  if (daysSince < 30) return null;
  return leader.player_name;
}

export const CREW_COLORS = [
  "#FF3B3B", "#FFD600", "#39FF14", "#BF5FFF", "#00B4FF",
  "#FF2D78", "#00FFD1", "#FF6B00", "#FFFFFF",
];

// ── FEATURE VIRALE 1 — Bastion takeover : notification à tous les joueurs proches ──

export interface TakeoverNotif {
  bastionName:   string;
  newCrewTag:    string;
  newCrewColor:  string;
  newCrewEmoji:  string;
  lat:           number;
  lng:           number;
  timestamp:     string;
}

/**
 * Résout un siège : change le propriétaire du bastion + publie une notification
 * takeover dans la table `bastion_takeover_events` (Realtime FULL).
 * Tous les clients abonnés reçoivent l'événement et affichent l'alerte virale.
 */
export async function resolveSiege(
  warId: string,
  winnerId: string, // crew_id du gagnant
): Promise<{ ok: boolean; takeover?: TakeoverNotif }> {
  if (!supabase) return { ok: false };

  const { data: war } = await supabase
    .from("crew_wars")
    .select("siege_target_id, crew_a_id, crew_b_id")
    .eq("id", warId)
    .single();

  if (!war?.siege_target_id) return { ok: false };

  const loserId = war.crew_a_id === winnerId ? war.crew_b_id : war.crew_a_id;

  // Transférer le bastion au gagnant
  await supabase.from("crew_zones")
    .update({ crew_id: winnerId })
    .eq("id", war.siege_target_id);

  // Mettre à jour bastion_zone_id du gagnant
  await supabase.from("crews")
    .update({ bastion_zone_id: war.siege_target_id }).eq("id", winnerId);

  // Retirer le bastion de l'ex-propriétaire
  await supabase.from("crews")
    .update({ bastion_zone_id: null }).eq("id", loserId);

  // Clore la guerre
  await supabase.from("crew_wars")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", warId);

  // Récupérer infos pour la notif
  const { data: zone } = await supabase
    .from("crew_zones").select("name, lat, lng").eq("id", war.siege_target_id).single();
  const { data: crew } = await supabase
    .from("crews").select("tag, color, emoji").eq("id", winnerId).single();

  if (!zone || !crew) return { ok: true };

  const notif: TakeoverNotif = {
    bastionName: zone.name, newCrewTag: crew.tag,
    newCrewColor: crew.color, newCrewEmoji: crew.emoji,
    lat: zone.lat, lng: zone.lng,
    timestamp: new Date().toISOString(),
  };

  // Publier dans la table Realtime pour broadcast
  await supabase.from("bastion_takeover_events").insert({
    bastion_name: notif.bastionName,
    new_crew_tag: notif.newCrewTag,
    new_crew_color: notif.newCrewColor,
    new_crew_emoji: notif.newCrewEmoji,
    lat: notif.lat, lng: notif.lng,
  });

  return { ok: true, takeover: notif };
}

/** Subscribe aux prises de bastions — afficher alerte virale sur tous les clients */
export function subscribeToBastionTakeovers(
  cb: (notif: TakeoverNotif) => void,
) {
  if (!supabase) return null;
  return supabase
    .channel("bastion-takeovers")
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "bastion_takeover_events",
    }, (payload) => {
      const r = payload.new as Record<string, string | number>;
      cb({
        bastionName: r.bastion_name as string,
        newCrewTag: r.new_crew_tag as string,
        newCrewColor: r.new_crew_color as string,
        newCrewEmoji: r.new_crew_emoji as string,
        lat: r.lat as number, lng: r.lng as number,
        timestamp: r.created_at as string ?? new Date().toISOString(),
      });
    })
    .subscribe();
}

// ── FEATURE VIRALE 3 — Roi de Toulouse : leaderboard hebdo (reset lundi 00h) ──

export interface RoiDeToulouse {
  display_name: string;
  avatar_emoji:  string;
  level:         number;
  crew_tag?:     string | null;
  crew_color?:   string | null;
  score:         number; // XP accumulé cette semaine (simulé par level×10 + reputation)
  weekLabel:     string; // "Semaine du 16 juin"
}

export async function fetchRoiDeToulouse(): Promise<RoiDeToulouse | null> {
  if (!supabase) return null;

  // On prend le joueur au plus haut level non-ghost (proxy du XP hebdo)
  const { data } = await supabase
    .from("life_map_players")
    .select("display_name, avatar_emoji, level, crew_tag, crew_color")
    .neq("status", "ghost")
    .neq("is_npc", true)
    .order("level", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekLabel = `Sem. du ${monday.getDate()} ${monday.toLocaleDateString("fr-FR", { month: "long" })}`;

  return {
    display_name: data.display_name,
    avatar_emoji:  data.avatar_emoji,
    level:         data.level,
    crew_tag:      data.crew_tag,
    crew_color:    data.crew_color,
    score:         data.level * 10,
    weekLabel,
  };
}

/** Subscribe aux changements de classement (update sur life_map_players) */
export function subscribeToLeaderboard(cb: () => void) {
  if (!supabase) return null;
  return supabase
    .channel("leaderboard-watch")
    .on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "life_map_players",
    }, cb)
    .subscribe();
}
