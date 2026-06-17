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

// Toulouse bounding box
export const PARIS_REGION = {
  latitude:       43.6047,
  longitude:      1.4442,
  latitudeDelta:  0.10,
  longitudeDelta: 0.10,
};

// Quartiers Toulouse pour la vérification contextuelle
const PARIS_QUARTIERS: { name: string; lat: number; lng: number; radius: number }[] = [
  { name: "Capitole",           lat: 43.6043, lng: 1.4437, radius: 0.007 },
  { name: "Saint-Cyprien",      lat: 43.5997, lng: 1.4285, radius: 0.008 },
  { name: "Carmes",             lat: 43.5967, lng: 1.4446, radius: 0.006 },
  { name: "Wilson",             lat: 43.6071, lng: 1.4500, radius: 0.006 },
  { name: "Jean Jaurès",        lat: 43.6129, lng: 1.4458, radius: 0.007 },
  { name: "Arnaud-Bernard",     lat: 43.6130, lng: 1.4380, radius: 0.007 },
  { name: "Les Minimes",        lat: 43.6310, lng: 1.4380, radius: 0.009 },
  { name: "Compans-Caffarelli", lat: 43.6170, lng: 1.4270, radius: 0.008 },
  { name: "Rangueil",           lat: 43.5650, lng: 1.4680, radius: 0.010 },
  { name: "Mirail",             lat: 43.5760, lng: 1.4030, radius: 0.012 },
  { name: "Purpan",             lat: 43.6200, lng: 1.4030, radius: 0.010 },
  { name: "Jolimont",           lat: 43.6100, lng: 1.4650, radius: 0.009 },
  { name: "Côte Pavée",         lat: 43.5900, lng: 1.4600, radius: 0.009 },
  { name: "Saint-Michel",       lat: 43.5920, lng: 1.4440, radius: 0.007 },
  { name: "Saint-Agne",         lat: 43.5780, lng: 1.4580, radius: 0.009 },
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

// ── Mock players Toulouse pour démo / dev sans Supabase ──────────────────────
export const MOCK_PLAYERS: MapPlayer[] = [
  {
    id: "m1", user_id: "u1", display_name: "Kah.TLS ✓", avatar_emoji: "🎤",
    status: "vibe", lat: 43.6043, lng: 1.4437, location_name: "Capitole",
    location_verified: true, last_action: "Studio session", is_star: true, is_npc: true,
    level: 99, crew_color: "#FFD600", crew_tag: "KAH", updated_at: new Date().toISOString(),
  },
  {
    id: "m2", user_id: "u2", display_name: "Karim_31", avatar_emoji: "🧢",
    status: "free", lat: 43.6129, lng: 1.4458, location_name: "Jean Jaurès",
    location_verified: true, last_action: "Au taff", is_star: false, is_npc: true,
    level: 6, crew_color: null, crew_tag: null, updated_at: new Date().toISOString(),
  },
  {
    id: "m3", user_id: "u3", display_name: "Lina.TLS", avatar_emoji: "👑",
    status: "vibe", lat: 43.5997, lng: 1.4285, location_name: "Saint-Cyprien",
    location_verified: false, last_action: "Terrasse", is_star: false, is_npc: true,
    level: 4, crew_color: null, crew_tag: null, updated_at: new Date().toISOString(),
  },
  {
    id: "m4", user_id: "u4", display_name: "Seb_Carmes", avatar_emoji: "🎨",
    status: "free", lat: 43.5967, lng: 1.4446, location_name: "Carmes",
    location_verified: true, last_action: "Manger propre", is_star: false, is_npc: true,
    level: 8, crew_color: "#FFD600", crew_tag: "KAH", updated_at: new Date().toISOString(),
  },
  {
    id: "m5", user_id: "u5", display_name: "Amina.Mirail", avatar_emoji: "💄",
    status: "vibe", lat: 43.5760, lng: 1.4030, location_name: "Mirail",
    location_verified: true, last_action: "Roupiller", is_star: false, is_npc: true,
    level: 3, crew_color: "#BF5FFF", crew_tag: "MRL", updated_at: new Date().toISOString(),
  },
  {
    id: "m6", user_id: "u6", display_name: "Toxic_Wilson", avatar_emoji: "🔥",
    status: "charo", lat: 43.6071, lng: 1.4500, location_name: "Wilson",
    location_verified: false, last_action: "Faire un tour", is_star: false, is_npc: true,
    level: 11, crew_color: "#FF3B3B", crew_tag: "WLS", updated_at: new Date().toISOString(),
  },
  {
    id: "m7", user_id: "u7", display_name: "Djo.Rangueil", avatar_emoji: "⚽",
    status: "free", lat: 43.5650, lng: 1.4680, location_name: "Rangueil",
    location_verified: true, last_action: "Terrain de foot", is_star: false, is_npc: true,
    level: 5, crew_color: null, crew_tag: null, updated_at: new Date().toISOString(),
  },
];
