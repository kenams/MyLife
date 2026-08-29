import * as ExpoLocation from "expo-location";

import { getLocalCityPlayers, subscribeLocalCityPlayers } from "./local-city-map-bridge";
import { supabase } from "./supabase";

export type MapStatus = "free" | "vibe" | "charo" | "taken" | "ghost";

export type MapPlayer = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  status: MapStatus;
  lat: number;
  lng: number;
  location_name: string | null;
  location_verified: boolean;
  last_action: string | null;
  is_star: boolean;
  is_npc: boolean;
  level: number;
  crew_color: string | null;
  crew_tag: string | null;
  updated_at: string;
};

export const STATUS_CONFIG: Record<MapStatus, { label: string; color: string; emoji: string; desc: string }> = {
  free:   { label: "Libre",   color: "#FFD600", emoji: "🟡", desc: "Visible pour activités" },
  vibe:   { label: "Sortie",  color: "#BF5FFF", emoji: "💜", desc: "Partant pour bouger" },
  charo:  { label: "Feeling", color: "#FF3B3B", emoji: "💫", desc: "Ouvert aux rencontres consenties" },
  taken:  { label: "Crew",    color: "#39FF14", emoji: "🤝", desc: "Amis et crew seulement" },
  ghost:  { label: "Ghost",   color: "#4A4844", emoji: "⚫", desc: "Invisible sur la Life Map" },
};

export const TOULOUSE_REGION = {
  latitude: 43.6047,
  longitude: 1.4442,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const TOULOUSE_QUARTIERS: { name: string; lat: number; lng: number; radius: number }[] = [
  { name: "Capitole", lat: 43.6047, lng: 1.4442, radius: 0.008 },
  { name: "Saint-Cyprien", lat: 43.5998, lng: 1.4325, radius: 0.008 },
  { name: "Carmes", lat: 43.5983, lng: 1.4457, radius: 0.006 },
  { name: "Compans", lat: 43.6119, lng: 1.4348, radius: 0.007 },
  { name: "Les Minimes", lat: 43.62, lng: 1.436, radius: 0.01 },
  { name: "Bonnefoy", lat: 43.6167, lng: 1.459, radius: 0.008 },
  { name: "Rangueil", lat: 43.5749, lng: 1.462, radius: 0.011 },
  { name: "Saint-Agne", lat: 43.5815, lng: 1.449, radius: 0.008 },
  { name: "Empalot", lat: 43.58, lng: 1.4415, radius: 0.008 },
  { name: "Mirail", lat: 43.575, lng: 1.411, radius: 0.012 },
  { name: "Bagatelle", lat: 43.586, lng: 1.412, radius: 0.01 },
  { name: "La Vache", lat: 43.637, lng: 1.435, radius: 0.008 },
  { name: "Croix-Daurade", lat: 43.6385, lng: 1.462, radius: 0.01 },
  { name: "Esquirol", lat: 43.6009, lng: 1.4448, radius: 0.006 },
  { name: "Wilson", lat: 43.6066, lng: 1.4486, radius: 0.006 },
];

function getQuartier(lat: number, lng: number): string | null {
  for (const q of TOULOUSE_QUARTIERS) {
    const d = Math.sqrt((lat - q.lat) ** 2 + (lng - q.lng) ** 2);
    if (d < q.radius) return q.name;
  }
  return null;
}

export const LOCATION_PRIVACY_RADIUS_METERS = 250;

export function approximateLocation(lat: number, lng: number): { lat: number; lng: number } {
  const latStep = LOCATION_PRIVACY_RADIUS_METERS / 111_320;
  const lngStep = LOCATION_PRIVACY_RADIUS_METERS / (111_320 * Math.cos(lat * Math.PI / 180));
  return {
    lat: Math.round(lat / latStep) * latStep,
    lng: Math.round(lng / lngStep) * lngStep,
  };
}

export async function requestAndGetLocation(): Promise<{
  lat: number;
  lng: number;
  locationName: string | null;
  verified: boolean;
} | null> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
  const { latitude: lat, longitude: lng } = loc.coords;
  return { lat, lng, locationName: getQuartier(lat, lng), verified: true };
}

export async function publishPosition(params: {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  status: MapStatus;
  level: number;
  lastAction: string | null;
  lat: number;
  lng: number;
  locationName: string | null;
  locationVerified: boolean;
}) {
  if (!supabase) return;
  const sharedLocation = approximateLocation(params.lat, params.lng);
  await supabase.from("life_map_players").upsert(
    {
      user_id: params.userId,
      display_name: params.displayName,
      avatar_emoji: params.avatarEmoji,
      status: params.status,
      level: params.level,
      last_action: params.lastAction,
      lat: sharedLocation.lat,
      lng: sharedLocation.lng,
      location_name: params.locationName,
      location_verified: params.locationVerified,
      is_npc: false,
    },
    { onConflict: "user_id" },
  );
}

export async function goGhost(userId: string) {
  if (!supabase) return;
  await supabase.from("life_map_players").update({ status: "ghost" }).eq("user_id", userId);
}

export const PRESENCE_TTL_MS = 5 * 60 * 1000;
export const PRESENCE_HEARTBEAT_MS = 60 * 1000;

export async function heartbeatPresence(userId: string, status: MapStatus) {
  if (!supabase || status === "ghost") return;
  await supabase.from("life_map_players").update({ status }).eq("user_id", userId);
}

export function isPresenceFresh(updatedAt: string, now = Date.now()): boolean {
  return now - new Date(updatedAt).getTime() < PRESENCE_TTL_MS;
}

/**
 * Life Map now combines two sources deliberately:
 * - real player presence from Supabase;
 * - simulated residents from the local City Engine bridge.
 *
 * Simulated residents never need one DB row each and are excluded from real
 * player analytics by construction.
 */
export async function fetchAllPlayers(): Promise<MapPlayer[]> {
  const localCity = getLocalCityPlayers();
  if (!supabase) return localCity.length > 0 ? localCity : MOCK_PLAYERS;

  const { data, error } = await supabase
    .from("life_map_players")
    .select("*")
    .eq("is_npc", false)
    .neq("status", "ghost")
    .gt("updated_at", new Date(Date.now() - PRESENCE_TTL_MS).toISOString())
    .order("updated_at", { ascending: false })
    .limit(200);

  const realPlayers = !error && data ? (data as MapPlayer[]) : [];
  if (realPlayers.length === 0 && localCity.length === 0) return MOCK_PLAYERS;
  return [...realPlayers, ...localCity];
}

/** Composite realtime subscription preserving the old `.unsubscribe()` API. */
export function subscribeToMap(onUpdate: (player: MapPlayer) => void) {
  const unsubscribeLocal = subscribeLocalCityPlayers(onUpdate);
  const realtime = supabase
    ? supabase
        .channel("life_map_live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "life_map_players" },
          (payload) => {
            if (!payload.new) return;
            const player = payload.new as MapPlayer;
            if (player.is_npc) return;
            onUpdate(player);
          },
        )
        .subscribe()
    : null;

  return {
    unsubscribe() {
      unsubscribeLocal();
      realtime?.unsubscribe();
    },
  };
}

// Fallback only when neither Supabase nor the City Engine has data yet.
export const MOCK_PLAYERS: MapPlayer[] = [
  {
    id: "mylife-official",
    user_id: "mylife-official",
    display_name: "MyLife Toulouse",
    avatar_emoji: "📍",
    status: "vibe",
    lat: 43.6047,
    lng: 1.4442,
    location_name: "Capitole",
    location_verified: false,
    last_action: "Ville en initialisation",
    is_star: true,
    is_npc: true,
    level: 99,
    crew_color: "#FFD600",
    crew_tag: "OFF",
    updated_at: new Date().toISOString(),
  },
];
