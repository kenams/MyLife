import { supabase } from "./supabase";

export { woryIdempotencyKey } from "./wory-logic";
export type { WoryReason } from "./wory-logic";

/** Solde Wory du joueur courant (dérivé du ledger serveur). null si hors ligne. */
export async function fetchMyWoryBalance(): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("my_wory_balance");
  if (error) return null;
  return typeof data === "number" ? data : Number(data ?? 0);
}

/** Solde de la trésorerie d'un crew (membres + staff uniquement). */
export async function fetchCrewWoryBalance(crewId: string): Promise<number | null> {
  if (!supabase || !crewId) return null;
  const { data, error } = await supabase.rpc("crew_wory_balance", { p_crew_id: crewId });
  if (error || data == null) return null;
  return typeof data === "number" ? data : Number(data);
}

export type WoryMovement = {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  source: string | null;
  created_at: string;
};

/** Derniers mouvements Wory du joueur (audit visible côté client). */
export async function fetchMyWoryHistory(limit = 40): Promise<WoryMovement[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("wory_ledger")
    .select("id,delta,balance_after,reason,source,created_at")
    .not("user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as WoryMovement[];
}
