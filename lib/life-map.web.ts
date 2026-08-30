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

// Toulouse bounding box
export const TOULOUSE_REGION = {
  latitude:       43.6047,
  longitude:      1.4442,
  latitudeDelta:  0.12,
  longitudeDelta: 0.12,
};

// Quartiers Toulouse pour la vérification contextuelle
const TOULOUSE_QUARTIERS: { name: string; lat: number; lng: number; radius: number }[] = [
  { name: "Capitole",       lat: 43.6047, lng: 1.4442, radius: 0.008 },
  { name: "Saint-Cyprien",  lat: 43.5998, lng: 1.4325, radius: 0.008 },
  { name: "Carmes",         lat: 43.5983, lng: 1.4457, radius: 0.006 },
  { name: "Compans",        lat: 43.6119, lng: 1.4348, radius: 0.007 },
  { name: "Les Minimes",    lat: 43.6200, lng: 1.4360, radius: 0.010 },
  { name: "Bonnefoy",       lat: 43.6167, lng: 1.4590, radius: 0.008 },
  { name: "Rangueil",       lat: 43.5749, lng: 1.4620, radius: 0.011 },
  { name: "Saint-Agne",     lat: 43.5815, lng: 1.4490, radius: 0.008 },
  { name: "Empalot",        lat: 43.5800, lng: 1.4415, radius: 0.008 },
  { name: "Mirail",         lat: 43.5750, lng: 1.4110, radius: 0.012 },
  { name: "Bagatelle",      lat: 43.5860, lng: 1.4120, radius: 0.010 },
  { name: "La Vache",       lat: 43.6370, lng: 1.4350, radius: 0.008 },
  { name: "Croix-Daurade",  lat: 43.6385, lng: 1.4620, radius: 0.010 },
  { name: "Esquirol",       lat: 43.6009, lng: 1.4448, radius: 0.006 },
  { name: "Wilson",         lat: 43.6066, lng: 1.4486, radius: 0.006 },
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
  const sharedLocation = approximateLocation(params.lat, params.lng);
  await supabase.from("life_map_players").upsert(
    {
      user_id:           params.userId,
      display_name:      params.displayName,
      avatar_emoji:      params.avatarEmoji,
      status:            params.status,
      level:             params.level,
      last_action:       params.lastAction,
      lat:               sharedLocation.lat,
      lng:               sharedLocation.lng,
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

// ── Présence réelle : heartbeat + expiration (voir lib/life-map.ts pour le
// détail des raisons — dupliqué ici car web utilise ce fichier via la
// résolution de plateforme Expo `.web.ts`) ────────────────────────────────────
export const PRESENCE_TTL_MS = 5 * 60 * 1000;
export const PRESENCE_HEARTBEAT_MS = 60 * 1000;

export async function heartbeatPresence(userId: string, status: MapStatus) {
  if (!supabase || status === "ghost") return;
  await supabase.from("life_map_players").update({ status }).eq("user_id", userId);
}

export function isPresenceFresh(updatedAt: string, now = Date.now()): boolean {
  return now - new Date(updatedAt).getTime() < PRESENCE_TTL_MS;
}

// ── Fetch tous les joueurs visibles (non-ghost, présence fraîche) ────────────
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

// ── Subscribe Realtime + résidents simulés (bridge City Engine) ──────────────
// Note web : life-map.web.ts est résolu par Expo à la place de life-map.ts.
// Il DOIT donc, comme la version native, brancher le bridge Living City —
// sinon la Map n'affiche que les MOCK_PLAYERS statiques.
export function subscribeToMap(onUpdate: (player: MapPlayer) => void) {
  const unsubscribeLocal = subscribeLocalCityPlayers(onUpdate);
  const realtime = supabase
    ? supabase
        .channel("life_map_live")
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "life_map_players",
        }, (payload) => {
          if (!payload.new) return;
          const player = payload.new as MapPlayer;
          if (player.is_npc) return;
          onUpdate(player);
        })
        .subscribe()
    : null;
  return {
    unsubscribe() {
      unsubscribeLocal();
      realtime?.unsubscribe();
    },
  };
}

// ── Mock players — coordonnées Toulouse pour test GPS local ──────────────────
export const MOCK_PLAYERS: MapPlayer[] = [
  { id:"m1",  user_id:"u1",  display_name:"MyLife Toulouse", avatar_emoji:"📍", status:"vibe",  lat:43.6076, lng:1.4451, location_name:"Capitole",       location_verified:true,  last_action:"Compte officiel",     is_star:true,  is_npc:true, level:99, crew_color:"#FFD600", crew_tag:"OFF", updated_at:new Date().toISOString() },
  { id:"m2",  user_id:"u2",  display_name:"Karim_93",     avatar_emoji:"🧢", status:"free",  lat:43.5998, lng:1.4420, location_name:"Saint-Cyprien",   location_verified:true,  last_action:"Au taff",           is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m3",  user_id:"u3",  display_name:"Lina.TLS",     avatar_emoji:"👑", status:"vibe",  lat:43.6120, lng:1.4580, location_name:"Compans",         location_verified:false, last_action:"Terrasse",          is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m4",  user_id:"u4",  display_name:"Seb.Minimes",  avatar_emoji:"🎨", status:"free",  lat:43.6180, lng:1.4320, location_name:"Les Minimes",     location_verified:true,  last_action:"Manger propre",     is_star:false, is_npc:true, level:8,  crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
  { id:"m5",  user_id:"u5",  display_name:"Amina.M",      avatar_emoji:"💄", status:"vibe",  lat:43.5920, lng:1.4500, location_name:"Rangueil",        location_verified:true,  last_action:"Roupiller",         is_star:false, is_npc:true, level:3,  crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
  { id:"m6",  user_id:"u6",  display_name:"Toxic_Nat",    avatar_emoji:"🔥", status:"charo", lat:43.6050, lng:1.4650, location_name:"Bonnefoy",        location_verified:false, last_action:"Faire un tour",     is_star:false, is_npc:true, level:11, crew_color:"#FF3B3B", crew_tag:"NAT", updated_at:new Date().toISOString() },
  { id:"m7",  user_id:"u7",  display_name:"Djo.Croix",    avatar_emoji:"⚽", status:"free",  lat:43.6240, lng:1.4410, location_name:"Croix-Daurade",   location_verified:true,  last_action:"Terrain de foot",   is_star:false, is_npc:true, level:5,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m8",  user_id:"u8",  display_name:"Nora.Carmes",  avatar_emoji:"🎭", status:"vibe",  lat:43.6032, lng:1.4395, location_name:"Carmes",          location_verified:true,  last_action:"Avant-première",    is_star:false, is_npc:true, level:12, crew_color:"#BF5FFF", crew_tag:"ART", updated_at:new Date().toISOString() },
  { id:"m9",  user_id:"u9",  display_name:"Yanis.Wilson", avatar_emoji:"😤", status:"free",  lat:43.6155, lng:1.4502, location_name:"Wilson",          location_verified:true,  last_action:"Serrage de mains",  is_star:false, is_npc:true, level:22, crew_color:"#FF3B3B", crew_tag:"WLS", updated_at:new Date().toISOString() },
  { id:"m10", user_id:"u10", display_name:"Lil Yaz",       avatar_emoji:"💜", status:"vibe",  lat:43.5860, lng:1.4490, location_name:"Empalot",         location_verified:true,  last_action:"Enregistrement",    is_star:false, is_npc:true, level:15, crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
  { id:"m11", user_id:"u11", display_name:"Benz",          avatar_emoji:"🔑", status:"taken", lat:43.6090, lng:1.4362, location_name:"Esquirol",        location_verified:false, last_action:"Café business",     is_star:false, is_npc:true, level:18, crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
  { id:"m12", user_id:"u12", display_name:"Sékouba",       avatar_emoji:"🧢", status:"free",  lat:43.6200, lng:1.4480, location_name:"Compans",         location_verified:true,  last_action:"Gym session",       is_star:false, is_npc:true, level:9,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m13", user_id:"u13", display_name:"Nadia.TLS",     avatar_emoji:"🌹", status:"free",  lat:43.5970, lng:1.4550, location_name:"Saint-Agne",      location_verified:true,  last_action:"Marché bio",        is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m14", user_id:"u14", display_name:"Rafa.Mirail",   avatar_emoji:"🐺", status:"charo", lat:43.5780, lng:1.4070, location_name:"Mirail",          location_verified:true,  last_action:"Mission freestyle", is_star:false, is_npc:true, level:13, crew_color:"#FF3B3B", crew_tag:"MRL", updated_at:new Date().toISOString() },
  { id:"m15", user_id:"u15", display_name:"Yusuf.B",       avatar_emoji:"🤲", status:"free",  lat:43.6310, lng:1.4390, location_name:"La Vache",        location_verified:false, last_action:"Prière du vendredi",is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m16", user_id:"u16", display_name:"Chloe.rive",    avatar_emoji:"🎸", status:"vibe",  lat:43.6010, lng:1.4340, location_name:"Saint-Cyprien",   location_verified:true,  last_action:"Concert impro",     is_star:false, is_npc:true, level:6,  crew_color:"#00FFD1", crew_tag:"RVG", updated_at:new Date().toISOString() },
  { id:"m17", user_id:"u17", display_name:"Oumar.66",      avatar_emoji:"🦁", status:"free",  lat:43.6260, lng:1.4220, location_name:"Croix-Daurade",   location_verified:true,  last_action:"Five le soir",      is_star:false, is_npc:true, level:10, crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m18", user_id:"u18", display_name:"Priya.Cps",     avatar_emoji:"💎", status:"taken", lat:43.5840, lng:1.4690, location_name:"Rangueil",        location_verified:true,  last_action:"Cours à l'INSA",    is_star:false, is_npc:true, level:3,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m19", user_id:"u19", display_name:"Driss.Cap",     avatar_emoji:"🎯", status:"free",  lat:43.6080, lng:1.4420, location_name:"Capitole",        location_verified:true,  last_action:"Balade midi",       is_star:false, is_npc:true, level:7,  crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
  { id:"m20", user_id:"u20", display_name:"Astou.Bag",     avatar_emoji:"🌟", status:"vibe",  lat:43.5940, lng:1.4210, location_name:"Bagatelle",       location_verified:false, last_action:"Répet danse",       is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
];
