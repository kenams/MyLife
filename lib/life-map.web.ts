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
  free:   { label: "Libre",  color: "#FFD600", emoji: "🟡", desc: "Je cherche" },
  vibe:   { label: "Soirée", color: "#BF5FFF", emoji: "💜", desc: "Je sors ce soir" },
  charo:  { label: "Charo",  color: "#FF3B3B", emoji: "🔴", desc: "Décomplexé, assumé" },
  taken:  { label: "Pris",   color: "#39FF14", emoji: "💍", desc: "Just vibes, amis" },
  ghost:  { label: "Ghost",  color: "#4A4844", emoji: "⚫", desc: "Mode discret" },
};

// Paris bounding box
export const PARIS_REGION = {
  latitude:       48.8566,
  longitude:      2.3522,
  latitudeDelta:  0.12,
  longitudeDelta: 0.12,
};

// Quartiers Paris pour la vérification contextuelle
const PARIS_QUARTIERS: { name: string; lat: number; lng: number; radius: number }[] = [
  { name: "République",   lat: 48.8673, lng: 2.3630,  radius: 0.007 },
  { name: "Belleville",   lat: 48.8720, lng: 2.3785,  radius: 0.008 },
  { name: "Oberkampf",    lat: 48.8640, lng: 2.3720,  radius: 0.006 },
  { name: "Pigalle",      lat: 48.8828, lng: 2.3390,  radius: 0.006 },
  { name: "Châtelet",     lat: 48.8589, lng: 2.3469,  radius: 0.007 },
  { name: "Marais",       lat: 48.8570, lng: 2.3580,  radius: 0.008 },
  { name: "Bastille",     lat: 48.8533, lng: 2.3692,  radius: 0.007 },
  { name: "Nation",       lat: 48.8484, lng: 2.3960,  radius: 0.007 },
  { name: "Montmartre",   lat: 48.8867, lng: 2.3431,  radius: 0.007 },
  { name: "Saint-Denis",  lat: 48.9362, lng: 2.3574,  radius: 0.012 },
  { name: "Aubervilliers",lat: 48.9132, lng: 2.3814,  radius: 0.010 },
  { name: "Montreuil",    lat: 48.8640, lng: 2.4425,  radius: 0.012 },
  { name: "Vincennes",    lat: 48.8480, lng: 2.4390,  radius: 0.009 },
  { name: "La Défense",   lat: 48.8921, lng: 2.2385,  radius: 0.010 },
  { name: "Pantin",       lat: 48.8978, lng: 2.4039,  radius: 0.010 },
  { name: "Bobigny",      lat: 48.9100, lng: 2.4402,  radius: 0.010 },
];

function getQuartier(lat: number, lng: number): string | null {
  for (const q of PARIS_QUARTIERS) {
    const d = Math.sqrt((lat - q.lat) ** 2 + (lng - q.lng) ** 2);
    if (d < q.radius) return q.name;
  }
  return null;
}

// ── Demande permission + récupère position (web via navigator.geolocation) ────
export async function requestAndGetLocation(): Promise<{
  lat: number;
  lng: number;
  locationName: string | null;
  verified: boolean;
} | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        resolve({ lat, lng, locationName: getQuartier(lat, lng), verified: true });
      },
      () => resolve(null),
      { timeout: 8000 }
    );
  });
}

// ── Upsert position dans Supabase ─────────────────────────────────────────────
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
  await supabase.from("life_map_players").upsert(
    {
      user_id:           params.userId,
      display_name:      params.displayName,
      avatar_emoji:      params.avatarEmoji,
      status:            params.status,
      level:             params.level,
      last_action:       params.lastAction,
      lat:               params.lat,
      lng:               params.lng,
      location_name:     params.locationName,
      location_verified: params.locationVerified,
    },
    { onConflict: "user_id" }
  );
}

// ── Passe en ghost (retire de la map) ─────────────────────────────────────────
export async function goGhost(userId: string) {
  if (!supabase) return;
  await supabase
    .from("life_map_players")
    .update({ status: "ghost" })
    .eq("user_id", userId);
}

// ── Fetch tous les joueurs visibles (non-ghost) ───────────────────────────────
export async function fetchAllPlayers(): Promise<MapPlayer[]> {
  if (!supabase) return MOCK_PLAYERS;
  const { data, error } = await supabase
    .from("life_map_players")
    .select("*")
    .neq("status", "ghost")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error || !data || data.length === 0) return MOCK_PLAYERS;
  return data as MapPlayer[];
}

// ── Subscribe Realtime aux updates de la map ──────────────────────────────────
export function subscribeToMap(onUpdate: (player: MapPlayer) => void) {
  if (!supabase) return null;
  return supabase
    .channel("life_map_live")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "life_map_players",
    }, (payload) => {
      if (payload.new) onUpdate(payload.new as MapPlayer);
    })
    .subscribe();
}

// ── Mock players Paris pour démo / dev sans Supabase ─────────────────────────
export const MOCK_PLAYERS: MapPlayer[] = [
  {
    id: "m1", user_id: "u1", display_name: "Jok'air ✓", avatar_emoji: "🎤",
    status: "vibe", lat: 48.8867, lng: 2.3431, location_name: "Montmartre",
    location_verified: true, last_action: "Studio session", is_star: true, is_npc: true,
    level: 99, crew_color: "#FFD600", crew_tag: "BVK", updated_at: new Date().toISOString(),
  },
  {
    id: "m2", user_id: "u2", display_name: "Karim_93", avatar_emoji: "🧢",
    status: "free", lat: 48.9132, lng: 2.3814, location_name: "Aubervilliers",
    location_verified: true, last_action: "Au taff", is_star: false, is_npc: true,
    level: 6, crew_color: null, crew_tag: null, updated_at: new Date().toISOString(),
  },
  {
    id: "m3", user_id: "u3", display_name: "Lina.Paris", avatar_emoji: "👑",
    status: "vibe", lat: 48.8673, lng: 2.3630, location_name: "République",
    location_verified: false, last_action: "Terrasse", is_star: false, is_npc: true,
    level: 4, crew_color: null, crew_tag: null, updated_at: new Date().toISOString(),
  },
  {
    id: "m4", user_id: "u4", display_name: "Seb_Belleville", avatar_emoji: "🎨",
    status: "free", lat: 48.8720, lng: 2.3785, location_name: "Belleville",
    location_verified: true, last_action: "Manger propre", is_star: false, is_npc: true,
    level: 8, crew_color: "#FFD600", crew_tag: "BVK", updated_at: new Date().toISOString(),
  },
  {
    id: "m5", user_id: "u5", display_name: "Amina.Montreuil", avatar_emoji: "💄",
    status: "vibe", lat: 48.8640, lng: 2.4425, location_name: "Montreuil",
    location_verified: true, last_action: "Roupiller", is_star: false, is_npc: true,
    level: 3, crew_color: "#BF5FFF", crew_tag: "MTR", updated_at: new Date().toISOString(),
  },
  {
    id: "m6", user_id: "u6", display_name: "Toxic_Nation", avatar_emoji: "🔥",
    status: "charo", lat: 48.8484, lng: 2.3960, location_name: "Nation",
    location_verified: false, last_action: "Faire un tour", is_star: false, is_npc: true,
    level: 11, crew_color: "#FF3B3B", crew_tag: "NAT", updated_at: new Date().toISOString(),
  },
  {
    id: "m7", user_id: "u7", display_name: "Djo.SDenis", avatar_emoji: "⚽",
    status: "free", lat: 48.9362, lng: 2.3574, location_name: "Saint-Denis",
    location_verified: true, last_action: "Terrain de foot", is_star: false, is_npc: true,
    level: 5, crew_color: null, crew_tag: null, updated_at: new Date().toISOString(),
  },
];
