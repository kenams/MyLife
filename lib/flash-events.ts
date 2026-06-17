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
