import * as ExpoLocation from "expo-location";
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

// ── Demande permission + récupère position ────────────────────────────────────
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
  const locationName = getQuartier(lat, lng);

  return { lat, lng, locationName, verified: true };
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
  { id:"m1",  user_id:"u1",  display_name:"Jok'air ✓",   avatar_emoji:"🎤", status:"vibe",  lat:43.6076, lng:1.4451, location_name:"Capitole",       location_verified:true,  last_action:"Studio session",     is_star:true,  is_npc:true, level:99, crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
  { id:"m2",  user_id:"u2",  display_name:"Karim_93",     avatar_emoji:"🧢", status:"free",  lat:43.5998, lng:1.4420, location_name:"Saint-Cyprien",   location_verified:true,  last_action:"Au taff",            is_star:false, is_npc:true, level:6,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m3",  user_id:"u3",  display_name:"Lina.Paris",   avatar_emoji:"👑", status:"vibe",  lat:43.6120, lng:1.4580, location_name:"Compans",         location_verified:false, last_action:"Terrasse",           is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m4",  user_id:"u4",  display_name:"Seb.Bellev",   avatar_emoji:"🎨", status:"free",  lat:43.6180, lng:1.4320, location_name:"Les Minimes",     location_verified:true,  last_action:"Manger propre",      is_star:false, is_npc:true, level:8,  crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
  { id:"m5",  user_id:"u5",  display_name:"Amina.M",      avatar_emoji:"💄", status:"vibe",  lat:43.5920, lng:1.4500, location_name:"Rangueil",        location_verified:true,  last_action:"Roupiller",          is_star:false, is_npc:true, level:3,  crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
  { id:"m6",  user_id:"u6",  display_name:"Toxic_Nat",    avatar_emoji:"🔥", status:"charo", lat:43.6050, lng:1.4650, location_name:"Bonnefoy",        location_verified:false, last_action:"Faire un tour",      is_star:false, is_npc:true, level:11, crew_color:"#FF3B3B", crew_tag:"NAT", updated_at:new Date().toISOString() },
  { id:"m7",  user_id:"u7",  display_name:"Djo.SDenis",   avatar_emoji:"⚽", status:"free",  lat:43.6240, lng:1.4410, location_name:"Croix-Daurade",   location_verified:true,  last_action:"Terrain de foot",    is_star:false, is_npc:true, level:5,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m8",  user_id:"u8",  display_name:"Maska ✓",      avatar_emoji:"🎭", status:"vibe",  lat:43.6032, lng:1.4395, location_name:"Carmes",          location_verified:true,  last_action:"Avant-première",     is_star:true,  is_npc:true, level:87, crew_color:"#BF5FFF", crew_tag:"MSK", updated_at:new Date().toISOString() },
  { id:"m9",  user_id:"u9",  display_name:"Doomams",       avatar_emoji:"😤", status:"free",  lat:43.6155, lng:1.4502, location_name:"Wilson",          location_verified:true,  last_action:"Serrage de mains",   is_star:false, is_npc:true, level:22, crew_color:"#FF3B3B", crew_tag:"DOM", updated_at:new Date().toISOString() },
  { id:"m10", user_id:"u10", display_name:"Lil Yaz",       avatar_emoji:"💜", status:"vibe",  lat:43.5860, lng:1.4490, location_name:"Empalot",         location_verified:true,  last_action:"Enregistrement",     is_star:false, is_npc:true, level:15, crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
  { id:"m11", user_id:"u11", display_name:"Benz",          avatar_emoji:"🔑", status:"taken", lat:43.6090, lng:1.4362, location_name:"Esquirol",        location_verified:false, last_action:"Café business",      is_star:false, is_npc:true, level:18, crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
  { id:"m12", user_id:"u12", display_name:"Sékouba",       avatar_emoji:"🧢", status:"free",  lat:43.6200, lng:1.4480, location_name:"Compans",         location_verified:true,  last_action:"Gym session",        is_star:false, is_npc:true, level:9,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m13", user_id:"u13", display_name:"Nadia.TLS",     avatar_emoji:"🌹", status:"free",  lat:43.5970, lng:1.4550, location_name:"Saint-Agne",      location_verified:true,  last_action:"Marché bio",         is_star:false, is_npc:true, level:7,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m14", user_id:"u14", display_name:"Rafa.Mirail",   avatar_emoji:"🐺", status:"charo", lat:43.5780, lng:1.4070, location_name:"Mirail",          location_verified:true,  last_action:"Dalle et freestyle", is_star:false, is_npc:true, level:13, crew_color:"#FF3B3B", crew_tag:"MRL", updated_at:new Date().toISOString() },
  { id:"m15", user_id:"u15", display_name:"Yusuf.B",       avatar_emoji:"🤲", status:"free",  lat:43.6310, lng:1.4390, location_name:"La Vache",        location_verified:false, last_action:"Prière du vendredi", is_star:false, is_npc:true, level:4,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m16", user_id:"u16", display_name:"Chloe.rive",    avatar_emoji:"🎸", status:"vibe",  lat:43.6010, lng:1.4340, location_name:"Saint-Cyprien",   location_verified:true,  last_action:"Concert impro",      is_star:false, is_npc:true, level:6,  crew_color:"#00FFD1", crew_tag:"RVG", updated_at:new Date().toISOString() },
  { id:"m17", user_id:"u17", display_name:"Oumar.66",      avatar_emoji:"🦁", status:"free",  lat:43.6260, lng:1.4220, location_name:"Croix-Daurade",   location_verified:true,  last_action:"Five le soir",       is_star:false, is_npc:true, level:10, crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m18", user_id:"u18", display_name:"Priya.Cps",     avatar_emoji:"💎", status:"taken", lat:43.5840, lng:1.4690, location_name:"Rangueil",        location_verified:true,  last_action:"Cours à l'INSA",     is_star:false, is_npc:true, level:3,  crew_color:null,      crew_tag:null,  updated_at:new Date().toISOString() },
  { id:"m19", user_id:"u19", display_name:"Driss.Cap",     avatar_emoji:"🎯", status:"free",  lat:43.6080, lng:1.4420, location_name:"Capitole",        location_verified:true,  last_action:"Balade midi",        is_star:false, is_npc:true, level:7,  crew_color:"#FFD600", crew_tag:"BVK", updated_at:new Date().toISOString() },
  { id:"m20", user_id:"u20", display_name:"Astou.Bag",     avatar_emoji:"🌟", status:"vibe",  lat:43.5940, lng:1.4210, location_name:"Bagatelle",       location_verified:false, last_action:"Répet danse",        is_star:false, is_npc:true, level:5,  crew_color:"#BF5FFF", crew_tag:"MTR", updated_at:new Date().toISOString() },
];
