import { supabase } from "./supabase";
import { fetchMyWoryBalance } from "./wory";

/**
 * My Pass / Événements MyLife (§12). Coût en Wory (jamais en €). Le pass est
 * un jeton aléatoire signé serveur, à usage unique, avec expiration.
 */

export type MyLifeEvent = {
  id: string;
  title: string;
  starts_at: string;
  wory_cost: number;
  capacity: number | null;
};

export type EventPass = {
  id: string;
  event_id: string;
  token: string;
  status: "valid" | "used" | "revoked";
  expires_at: string;
  used_at: string | null;
};

export async function fetchActiveEvents(): Promise<MyLifeEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mylife_events")
    .select("id, title, starts_at, wory_cost, capacity")
    .gte("starts_at", new Date(Date.now() - 4 * 3600_000).toISOString())
    .order("starts_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as MyLifeEvent[];
}

export async function fetchMyPasses(): Promise<EventPass[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("event_passes")
    .select("id, event_id, token, status, expires_at, used_at");
  return (data ?? []) as EventPass[];
}

export async function buyEventPass(eventId: string): Promise<{ ok: boolean; pass?: EventPass; error?: string; missing?: number }> {
  if (!supabase) return { ok: false, error: "hors ligne" };
  const { data, error } = await supabase.rpc("buy_event_pass", { p_event_id: eventId });
  if (error) {
    // solde insuffisant → indiquer combien il manque
    if (/solde insuffisant|check_violation/i.test(error.message)) {
      return { ok: false, error: "Il te manque des Wory", missing: -1 };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, pass: data as EventPass };
}

export async function computeMissingWory(cost: number): Promise<number> {
  const bal = (await fetchMyWoryBalance()) ?? 0;
  return Math.max(0, cost - bal);
}

/** Scan organisateur → 'VALID' | 'ALREADY_USED' | 'EXPIRED' | 'REVOKED' | 'INVALID'. */
export async function scanEventPass(token: string): Promise<string> {
  if (!supabase) return "INVALID";
  const { data, error } = await supabase.rpc("scan_event_pass", { p_token: token.trim() });
  if (error) return "INVALID";
  return String(data);
}
