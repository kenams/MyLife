import { supabase } from "./supabase";
import { rateLimit } from "./safety";

export type QuartierMessage = {
  id: string;
  quartier: string;
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  body: string;
  is_star: boolean;
  created_at: string;
};

export type DmMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_emoji: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

// ID de room DM : toujours les 2 UIDs triés alphabétiquement
export function dmRoomId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

// ── Quartier messages ─────────────────────────────────────────────────────────

export async function fetchQuartierMessages(quartier: string, limit = 50): Promise<QuartierMessage[]> {
  if (!supabase) return MOCK_MESSAGES[quartier] ?? [];
  const { data, error } = await supabase
    .from("quartier_messages")
    .select("*")
    .eq("quartier", quartier)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data || data.length === 0) return MOCK_MESSAGES[quartier] ?? [];
  return (data as QuartierMessage[]).reverse();
}

export async function sendQuartierMessage(params: {
  quartier: string;
  userId: string;
  displayName: string;
  avatarEmoji: string;
  body: string;
  isStar?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const trimmed = params.body.trim();
  if (!trimmed) return { ok: false, error: "Message vide." };
  if (trimmed.length > 500) return { ok: false, error: "Message trop long (500 car. max)." };

  // Rate limit : 1 message par seconde
  if (!rateLimit(`chat_${params.userId}`, 60)) {
    return { ok: false, error: "Tu envoies trop vite." };
  }

  if (!supabase) {
    // Mode démo : injection locale
    const mock: QuartierMessage = {
      id:           Math.random().toString(36).slice(2),
      quartier:     params.quartier,
      user_id:      params.userId,
      display_name: params.displayName,
      avatar_emoji: params.avatarEmoji,
      body:         trimmed,
      is_star:      params.isStar ?? false,
      created_at:   new Date().toISOString(),
    };
    if (!MOCK_MESSAGES[params.quartier]) MOCK_MESSAGES[params.quartier] = [];
    MOCK_MESSAGES[params.quartier].push(mock);
    return { ok: true };
  }

  const { error } = await supabase.from("quartier_messages").insert({
    quartier:     params.quartier,
    user_id:      params.userId,
    display_name: params.displayName,
    avatar_emoji: params.avatarEmoji,
    body:         trimmed,
    is_star:      params.isStar ?? false,
  });

  return error ? { ok: false, error: error.message } : { ok: true };
}

export function subscribeQuartier(
  quartier: string,
  onMessage: (msg: QuartierMessage) => void
) {
  if (!supabase) return null;
  return supabase
    .channel(`quartier_${quartier}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "quartier_messages",
      filter: `quartier=eq.${quartier}`,
    }, (payload) => onMessage(payload.new as QuartierMessage))
    .subscribe();
}

// ── DM ────────────────────────────────────────────────────────────────────────

export async function fetchDmMessages(roomId: string, limit = 80): Promise<DmMessage[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("dm_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as DmMessage[];
}

export async function sendDm(params: {
  roomId: string;
  senderId: string;
  senderName: string;
  senderEmoji: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const trimmed = params.body.trim();
  if (!trimmed) return { ok: false, error: "Message vide." };
  if (!rateLimit(`dm_${params.senderId}`, 30)) {
    return { ok: false, error: "Trop vite." };
  }
  if (!supabase) return { ok: true }; // démo

  const { error } = await supabase.from("dm_messages").insert({
    room_id:      params.roomId,
    sender_id:    params.senderId,
    sender_name:  params.senderName,
    sender_emoji: params.senderEmoji,
    body:         trimmed,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export function subscribeDm(roomId: string, onMessage: (msg: DmMessage) => void) {
  if (!supabase) return null;
  return supabase
    .channel(`dm_${roomId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "dm_messages",
      filter: `room_id=eq.${roomId}`,
    }, (payload) => onMessage(payload.new as DmMessage))
    .subscribe();
}

// ── Quartiers disponibles ─────────────────────────────────────────────────────
export const TOULOUSE_QUARTIERS_LIST = [
  { id: "Capitole",       emoji: "📍", desc: "Centre et missions officielles" },
  { id: "Saint-Cyprien",  emoji: "☕", desc: "Cafés, sorties et Garonne" },
  { id: "Carmes",         emoji: "🎨", desc: "Artistes, style et food" },
  { id: "Compans",        emoji: "🌳", desc: "Étudiants, parc et business" },
  { id: "Les Minimes",    emoji: "⚽", desc: "Sport et crews de quartier" },
  { id: "Rangueil",       emoji: "🎓", desc: "Campus, sport et tech" },
  { id: "Mirail",         emoji: "🎤", desc: "Création et missions collectives" },
  { id: "Empalot",        emoji: "🔥", desc: "Zones chaudes et rassemblements" },
  { id: "Bagatelle",      emoji: "💪", desc: "Terrain, sport et entraide" },
  { id: "Bonnefoy",       emoji: "🎵", desc: "Culture et sorties locales" },
  { id: "Global",         emoji: "🌍", desc: "Tout Toulouse" },
];

// ── Mock data pour démo ───────────────────────────────────────────────────────
const now = new Date();
const t = (minAgo: number) => new Date(now.getTime() - minAgo * 60000).toISOString();

export const MOCK_MESSAGES: Record<string, QuartierMessage[]> = {
  "Capitole": [
    { id: "1", quartier: "Capitole", user_id: "u1", display_name: "MyLife Toulouse",
      avatar_emoji: "📍", body: "Mission simple disponible près du Capitole.", is_star: true, created_at: t(8) },
    { id: "2", quartier: "Capitole", user_id: "u2", display_name: "Djo.Croix",
      avatar_emoji: "⚽", body: "Terrain ouvert ce soir, qui veut rejoindre ?", is_star: false, created_at: t(5) },
    { id: "3", quartier: "Capitole", user_id: "u3", display_name: "Karim.TLS",
      avatar_emoji: "🧢", body: "Crew sportif cherche deux motivés.", is_star: false, created_at: t(2) },
  ],
  "Saint-Cyprien": [
    { id: "4", quartier: "Saint-Cyprien", user_id: "u4", display_name: "Lina.TLS",
      avatar_emoji: "👑", body: "Terrasse ouverte côté Garonne.", is_star: false, created_at: t(12) },
    { id: "5", quartier: "Saint-Cyprien", user_id: "u5", display_name: "Seb.Minimes",
      avatar_emoji: "🎨", body: "Qui vient à l'expo photo ce soir ?", is_star: false, created_at: t(3) },
  ],
  "Carmes": [
    { id: "6", quartier: "Carmes", user_id: "u6", display_name: "Nora.Carmes",
      avatar_emoji: "🎨", body: "Expo photo ce soir, entrée libre.", is_star: false, created_at: t(20) },
    { id: "7", quartier: "Carmes", user_id: "u7", display_name: "Maya.Art",
      avatar_emoji: "🖌️", body: "Passée devant, très bonne vibe.", is_star: false, created_at: t(7) },
  ],
};
