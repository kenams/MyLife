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
  id:        string;
  crew_id:   string;
  name:      string;
  lat:       number;
  lng:       number;
  radius:    number;
  claimed_at: string;
  expires_at: string;
}

export async function fetchCrews(): Promise<Crew[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("crews")
    .select("*")
    .order("reputation", { ascending: false });
  return (data ?? []) as Crew[];
}

export async function fetchCrewZones(): Promise<(CrewZone & { crew: Pick<Crew,"color"|"tag"|"emoji"> })[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("crew_zones")
    .select("*, crew:crews(color,tag,emoji)")
    .gte("expires_at", new Date().toISOString());
  return (data ?? []) as (CrewZone & { crew: Pick<Crew,"color"|"tag"|"emoji"> })[];
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
    // Incrémente member_count côté DB
    const { data: crew } = await supabase.from("crews").select("member_count").eq("id", crewId).single();
    if (crew) {
      await supabase.from("crews").update({ member_count: (crew.member_count ?? 0) + 1 }).eq("id", crewId);
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

export async function claimZone(
  crewId: string, name: string, lat: number, lng: number, radius = 300
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("crew_zones").insert({
    crew_id: crewId, name, lat, lng, radius,
  });
  return !error;
}

// Couleurs de crew disponibles
export const CREW_COLORS = [
  "#FF3B3B", "#FFD600", "#39FF14", "#BF5FFF", "#00B4FF",
  "#FF2D78", "#00FFD1", "#FF6B00", "#FFFFFF",
];
