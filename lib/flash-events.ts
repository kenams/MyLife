import { supabase } from "./supabase";

export interface FlashEvent {
  id:           string;
  title:        string;
  description:  string;
  emoji:        string;
  location?:    string;
  location_lat?: number;
  location_lng?: number;
  starts_at:    string;
  ends_at:      string;
  reward_xp:    number;
  reward_money: number;
  max_players:  number;
  kind:         string;
  is_active:    boolean;
  _participants?: number;
}

export async function fetchActiveFlashEvents(): Promise<FlashEvent[]> {
  if (!supabase) return [];
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("flash_events")
    .select("*, flash_event_participants(count)")
    .eq("is_active", true)
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("ends_at", { ascending: true });
  return (data ?? []).map((e: FlashEvent & { flash_event_participants?: { count: number }[] }) => ({
    ...e,
    _participants: e.flash_event_participants?.[0]?.count ?? 0,
  }));
}

export function subscribeToFlashEvents(cb: (evt: FlashEvent) => void) {
  if (!supabase) return null;
  return supabase
    .channel("flash-events")
    .on("postgres_changes", {
      event: "*", schema: "public", table: "flash_events",
    }, () => fetchActiveFlashEvents().then((evts) => evts.forEach(cb)))
    .subscribe();
}

export async function joinFlashEvent(eventId: string, playerName: string, playerEmoji: string) {
  if (!supabase) return;
  await supabase.from("flash_event_participants").insert({
    event_id: eventId, player_name: playerName, player_emoji: playerEmoji,
  });
}

export function getTimeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Terminé";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return h > 0 ? `${h}h ${rm}m` : `${m}m`;
}

export function getUrgencyLevel(endsAt: string): "critical" | "warning" | "normal" {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms < 20 * 60000) return "critical";
  if (ms < 45 * 60000) return "warning";
  return "normal";
}

// ── FEATURE VIRALE 2 — Rassemblement physique : 20 joueurs au même endroit ────

export const RASSEMBLEMENT_TARGET = 20;

export interface RassemblementEvent extends FlashEvent {
  kind: "rassemblement";
  _participants: number;
}

/**
 * Crée un flash event "Rassemblement" — 20 joueurs physiques requis.
 * Expire dans 2h. Récompense massive.
 */
export async function createRassemblement(
  location: string,
  lat: number,
  lng: number,
  createdBy: string,
): Promise<FlashEvent | null> {
  if (!supabase) return null;
  const starts = new Date().toISOString();
  const ends = new Date(Date.now() + 2 * 3600_000).toISOString();
  const { data, error } = await supabase
    .from("flash_events")
    .insert({
      title: `🔥 Rassemblement — ${location}`,
      description: `Objectif : réunir ${RASSEMBLEMENT_TARGET} joueurs physiquement à ${location}. Tu as 2h. Sois là.`,
      emoji: "🔥",
      location,
      location_lat: lat,
      location_lng: lng,
      starts_at: starts,
      ends_at: ends,
      reward_xp: 500,
      reward_money: 1000,
      max_players: RASSEMBLEMENT_TARGET,
      kind: "rassemblement",
      is_active: true,
    })
    .select()
    .single();
  if (error || !data) return null;

  // Créateur auto-inscrit
  await supabase.from("flash_event_participants").insert({
    event_id: data.id, player_name: createdBy, player_emoji: "⚡",
  });

  return data as FlashEvent;
}

/** Retourne le nb de participants + si le rassemblement est accompli */
export async function getRassemblementStatus(eventId: string): Promise<{
  count: number;
  done: boolean;
}> {
  if (!supabase) return { count: 0, done: false };
  const { count } = await supabase
    .from("flash_event_participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);
  const c = count ?? 0;
  return { count: c, done: c >= RASSEMBLEMENT_TARGET };
}

/** Subscribe aux changements de participants pour updater le compteur live */
export function subscribeToRassemblement(
  eventId: string,
  cb: (count: number, done: boolean) => void,
) {
  if (!supabase) return null;
  return supabase
    .channel(`rassemblement-${eventId}`)
    .on("postgres_changes", {
      event: "INSERT", schema: "public",
      table: "flash_event_participants",
      filter: `event_id=eq.${eventId}`,
    }, async () => {
      const status = await getRassemblementStatus(eventId);
      cb(status.count, status.done);
    })
    .subscribe();
}
