import { supabase } from "./supabase";

export type FeedKind =
  | "action" | "level_up" | "broke" | "rich"
  | "encounter" | "event_join" | "crew_war" | "location_change" | "npc_drama";

export interface FeedEvent {
  id:           string;
  kind:         FeedKind;
  emoji:        string;
  body:         string;
  player_name?: string;
  player_emoji?: string;
  location?:    string;
  is_npc:       boolean;
  is_star:      boolean;
  created_at:   string;
}

// ── Publish ────────────────────────────────────────────────────────────────────
export async function publishFeedEvent(event: Omit<FeedEvent, "id" | "created_at">) {
  if (!supabase) return;
  await supabase.from("life_feed_events").insert(event);
}

// ── Subscribe realtime ─────────────────────────────────────────────────────────
export function subscribeToFeed(cb: (event: FeedEvent) => void) {
  if (!supabase) return null;
  return supabase
    .channel("life-feed")
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "life_feed_events",
    }, (payload) => cb(payload.new as FeedEvent))
    .subscribe();
}

// ── Fetch recent ───────────────────────────────────────────────────────────────
export async function fetchRecentFeed(limit = 20): Promise<FeedEvent[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("life_feed_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as FeedEvent[];
}

// ── Action → Feed event mapper ─────────────────────────────────────────────────
const ACTION_FEED: Record<string, { emoji: string; templates: string[] }> = {
  "work-shift":   { emoji: "💼", templates: ["{name} vient de finir son shift 💪", "{name} au taff depuis 8h — grind mode activé", "{name} rentre avec du blé 💰"] },
  "gym":          { emoji: "🏋️", templates: ["{name} s'arrache à la salle 💪", "{name} au gym — pas de day off", "{name} push day, no excuses"] },
  "cafe-chat":    { emoji: "☕", templates: ["{name} pose au bando ☕", "{name} au café, réseau en cours...", "{name} charbonne les connexions"] },
  "shopping":     { emoji: "🛍️", templates: ["{name} fait le SNKRS et Marais 🛍️", "{name} claque du blé en shopping", "{name} check les nouvelles sneaks"] },
  "team-sport":   { emoji: "🏀", templates: ["{name} sur le terrain 🏀", "{name} jeu propre au five", "{name} MVP du quartier ce soir"] },
  "healthy-meal": { emoji: "🍱", templates: ["{name} mange propre 🍱", "{name} cuisine healthy — discipline totale", "{name} riz poulet brocoli, classique"] },
  "sleep":        { emoji: "🛌", templates: ["{name} est couché — recovery mode", "{name} dodo, recharge pour demain", "{name} coupe pour la nuit"] },
  "walk":         { emoji: "🚶", templates: ["{name} marche dans Toulouse 🗺️", "{name} explore le quartier", "{name} en vadrouille dans la ville"] },
  "meditate":     { emoji: "🧘", templates: ["{name} se pose et respire 🧘", "{name} zen mode activé", "{name} déstresse, level mental up"] },
};

export function buildActionFeedEvent(
  actionId: string,
  playerName: string,
  playerEmoji: string,
  location: string,
  isNpc = false,
): Omit<FeedEvent, "id" | "created_at"> | null {
  const cfg = ACTION_FEED[actionId];
  if (!cfg) return null;
  const tpl = cfg.templates[Math.floor(Math.random() * cfg.templates.length)];
  const body = tpl.replace("{name}", playerName);
  return {
    kind: "action", emoji: cfg.emoji,
    body, player_name: playerName, player_emoji: playerEmoji,
    location, is_npc: isNpc, is_star: false,
  };
}

// ── NPC drama generator (appelé par le moteur NPC) ────────────────────────────
const NPC_DRAMA = [
  { emoji: "💰", body: "{name} vient de toucher 800 BL — richesse silencieuse", kind: "rich" as FeedKind },
  { emoji: "😤", body: "{name} lance un défi positif pour son crew", kind: "npc_drama" as FeedKind },
  { emoji: "👀", body: "{name} change de quartier pour une mission locale", kind: "location_change" as FeedKind },
  { emoji: "🤝", body: "{name} vient de nouer une alliance dans le {loc}", kind: "encounter" as FeedKind },
  { emoji: "📈", body: "{name} monte en niveau — la grinta paie", kind: "level_up" as FeedKind },
  { emoji: "🎤", body: "{name} fait le buzz dans le {loc} ce soir", kind: "npc_drama" as FeedKind },
  { emoji: "🤝", body: "{name} organise une mission collective dans le {loc}", kind: "encounter" as FeedKind },
  { emoji: "🔥", body: "{name} est intouchable ce soir", kind: "npc_drama" as FeedKind },
];

const LOCATIONS = ["Capitole", "Saint-Cyprien", "Compans", "Carmes", "Minimes", "Rangueil", "Bonnefoy", "Mirail", "Croix-Daurade", "Bagatelle"];

export async function publishNpcDrama(npcName: string, npcEmoji: string, isStar = false) {
  const drama = NPC_DRAMA[Math.floor(Math.random() * NPC_DRAMA.length)];
  const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const body = drama.body.replace("{name}", npcName).replace("{loc}", loc);
  await publishFeedEvent({
    kind: drama.kind, emoji: drama.emoji,
    body, player_name: npcName, player_emoji: npcEmoji,
    location: loc, is_npc: true, is_star: isStar,
  });
}

// ── NPC cast complet Toulouse ─────────────────────────────────────────────────
const NPC_CAST = [
  { name: "MyLife Toulouse", emoji: "📍", is_star: true  },
  { name: "Ava.PNJ",         emoji: "☕", is_star: false },
  { name: "Noa.PNJ",         emoji: "🎭", is_star: false },
  { name: "Malik.PNJ",       emoji: "💼", is_star: false },
  { name: "Leila.PNJ",       emoji: "🏃", is_star: false },
  { name: "Sana.PNJ",        emoji: "💪", is_star: false },
  { name: "Karim_93",    emoji: "⚽", is_star: false },
  { name: "Lina.TLS",    emoji: "👑", is_star: false },
  { name: "Toxic_Nat",   emoji: "🔥", is_star: false },
  { name: "Amina.M",     emoji: "💄", is_star: false },
];

// ── Mock feed pour dev offline (retourné si Supabase vide) ───────────────────
function buildMockFeed(): FeedEvent[] {
  const now = Date.now();
  const entries: Array<{ npc: typeof NPC_CAST[0]; drama: typeof NPC_DRAMA[0]; loc: string; offset: number }> = [];
  for (let i = 0; i < 18; i++) {
    entries.push({
      npc:   NPC_CAST[i % NPC_CAST.length],
      drama: NPC_DRAMA[Math.floor(Math.random() * NPC_DRAMA.length)],
      loc:   LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      offset: i * 45_000 + Math.random() * 20_000,
    });
  }
  return entries.map((e, idx) => ({
    id:          `mock_${idx}`,
    kind:        e.drama.kind,
    emoji:       e.drama.emoji,
    body:        e.drama.body.replace("{name}", e.npc.name).replace("{loc}", e.loc),
    player_name: e.npc.name,
    player_emoji: e.npc.emoji,
    location:    e.loc,
    is_npc:      true,
    is_star:     e.npc.is_star,
    created_at:  new Date(now - e.offset).toISOString(),
  }));
}

export async function fetchRecentFeedWithFallback(limit = 20): Promise<FeedEvent[]> {
  const remote = await fetchRecentFeed(limit);
  if (remote.length > 0) return remote;
  return buildMockFeed().slice(0, limit);
}

// ── Génère un événement NPC local aléatoire (sans Supabase) ──────────────────
export function buildRandomNpcEvent(): FeedEvent {
  const npc   = NPC_CAST[Math.floor(Math.random() * NPC_CAST.length)];
  const drama = NPC_DRAMA[Math.floor(Math.random() * NPC_DRAMA.length)];
  const loc   = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  return {
    id:          `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    kind:        drama.kind,
    emoji:       drama.emoji,
    body:        drama.body.replace("{name}", npc.name).replace("{loc}", loc),
    player_name: npc.name,
    player_emoji: npc.emoji,
    location:    loc,
    is_npc:      true,
    is_star:     npc.is_star,
    created_at:  new Date().toISOString(),
  };
}
