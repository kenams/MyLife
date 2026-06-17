import { supabase } from "./supabase";

export interface Crew {
  id:           string;
  name:         string;
  tag:          string;
  emoji:        string;
  color:        string;
  description?: string;
  founder:      string;
  member_count: number;
  reputation:   number;
  created_at:   string;
}

export interface CrewMember {
  id:           string;
  crew_id:      string;
  player_name:  string;
  player_emoji: string;
  role:         "founder" | "officer" | "member";
  joined_at:    string;
}

export interface CrewZone {
  id:               string;
  crew_id:          string;
  name:             string;
  lat:              number;
  lng:              number;
  radius:           number;
  claimed_at:       string;
  expires_at:       string;
  last_activity_at?: string;
}

export type CrewZoneRich = CrewZone & {
  crew: Pick<Crew, "color" | "tag" | "emoji" | "name" | "member_count" | "reputation">;
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
export async function checkAndTriggerWars(zones: CrewZoneRich[]): Promise<void> {
  if (!supabase) return;
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i];
      const b = zones[j];
      if (a.crew_id === b.crew_id) continue;
      if (!zonesOverlap(a, b)) continue;

      // Vérifie si une guerre active existe déjà entre ces deux zones
      const { data: existing } = await supabase
        .from("crew_wars")
        .select("id")
        .eq("zone_a_id", a.id)
        .eq("zone_b_id", b.id)
        .eq("status", "active")
        .maybeSingle();
      if (existing) continue;

      // Crée la guerre
      await supabase.from("crew_wars").insert({
        crew_a_id: a.crew_id, crew_b_id: b.crew_id,
        zone_a_id: a.id, zone_b_id: b.id,
      });

      // Flash event automatique
      await supabase.from("flash_events").insert({
        title: `⚔️ ${a.crew.tag} vs ${b.crew.tag} — Guerre de territoire`,
        description: `Les zones de ${a.crew.name ?? a.crew.tag} et ${b.crew.name ?? b.crew.tag} se chevauchent. Rejoins le combat !`,
        emoji: "⚔️",
        location: a.name,
        location_lat: a.lat,
        location_lng: a.lng,
        reward_xp: 150,
        reward_money: 300,
        kind: "battle",
        ends_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      });
    }
  }
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
    .select("*, crew:crews(color,tag,emoji,name,member_count,reputation)")
    .gte("expires_at", new Date().toISOString());
  return (data ?? []) as CrewZoneRich[];
}

export async function createCrew(
  name: string, tag: string, emoji: string, color: string,
  description: string, founderName: string, founderEmoji: string
): Promise<Crew | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("crews")
    .insert({ name, tag, emoji, color, description, founder: founderName })
    .select()
    .single();
  if (error || !data) return null;
  await supabase.from("crew_members").insert({
    crew_id: data.id, player_name: founderName,
    player_emoji: founderEmoji, role: "founder",
  });
  return data as Crew;
}

export async function joinCrew(
  crewId: string, playerName: string, playerEmoji: string
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("crew_members").insert({
    crew_id: crewId, player_name: playerName, player_emoji: playerEmoji, role: "member",
  });
  if (!error) {
    const { data: crew } = await supabase
      .from("crews").select("member_count,reputation").eq("id", crewId).single();
    if (crew) {
      const newCount = (crew.member_count ?? 0) + 1;
      const newRadius = computeZoneRadius(newCount, crew.reputation ?? 0);
      await supabase.from("crews").update({ member_count: newCount }).eq("id", crewId);
      // Mettre à jour le rayon de toutes les zones du crew
      await supabase.from("crew_zones").update({ radius: newRadius }).eq("crew_id", crewId);
    }
  }
  return !error;
}

export async function getMyCrewId(playerName: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("crew_members")
    .select("crew_id")
    .eq("player_name", playerName)
    .single();
  return data?.crew_id ?? null;
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

export const CREW_COLORS = [
  "#FF3B3B", "#FFD600", "#39FF14", "#BF5FFF", "#00B4FF",
  "#FF2D78", "#00FFD1", "#FF6B00", "#FFFFFF",
];
