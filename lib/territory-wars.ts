import { supabase } from "./supabase";

export { liveScore } from "./battle-score";

/**
 * Territory Wars (spec §7). Client mince : toute la logique de score et
 * l'anti-cheat sont côté serveur (RPC SECURITY DEFINER). Dégrade proprement
 * si la migration `20260903000000` n'est pas appliquée.
 */

export type BattleStatus = "scheduled" | "live" | "resolved" | "cancelled";

export type TerritoryBattle = {
  id: string;
  district_id: string;
  district_name: string;
  attacker_crew: string;
  attacker_tag: string | null;
  attacker_emoji: string | null;
  attacker_color: string | null;
  defender_crew: string | null;
  defender_tag: string | null;
  defender_emoji: string | null;
  defender_color: string | null;
  scheduled_at: string;
  status: BattleStatus;
  current_round: number;
  round_started_at: string | null;
  winner_crew: string | null;
  attacker_pct: number | null;
  defender_pct: number | null;
};

export type BattleParticipant = {
  user_id: string;
  crew_id: string;
  r1_taps: number;
  r2_score: number;
  r3_hits: number;
};

function mapBattle(r: Record<string, any>): TerritoryBattle {
  return {
    id: r.id,
    district_id: r.district_id,
    district_name: r.districts?.name ?? "Quartier",
    attacker_crew: r.attacker_crew,
    attacker_tag: r.attacker?.tag ?? null,
    attacker_emoji: r.attacker?.emoji ?? null,
    attacker_color: r.attacker?.color ?? null,
    defender_crew: r.defender_crew,
    defender_tag: r.defender?.tag ?? null,
    defender_emoji: r.defender?.emoji ?? null,
    defender_color: r.defender?.color ?? null,
    scheduled_at: r.scheduled_at,
    status: r.status,
    current_round: r.current_round ?? 0,
    round_started_at: r.round_started_at ?? null,
    winner_crew: r.winner_crew ?? null,
    attacker_pct: r.attacker_pct != null ? Number(r.attacker_pct) : null,
    defender_pct: r.defender_pct != null ? Number(r.defender_pct) : null,
  };
}

const SELECT =
  `id, district_id, attacker_crew, defender_crew, scheduled_at, status, current_round,
   round_started_at, winner_crew, attacker_pct, defender_pct,
   districts:district_id ( name ),
   attacker:attacker_crew ( tag, emoji, color ),
   defender:defender_crew ( tag, emoji, color )`;

export async function fetchUpcomingBattles(): Promise<TerritoryBattle[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("territory_battles")
    .select(SELECT)
    .in("status", ["scheduled", "live"])
    .order("scheduled_at", { ascending: true });
  if (error || !data) return [];
  return data.map(mapBattle);
}

export async function fetchBattle(id: string): Promise<TerritoryBattle | null> {
  if (!supabase || !id) return null;
  const { data, error } = await supabase.from("territory_battles").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapBattle(data);
}

export async function fetchBattleParticipants(battleId: string): Promise<BattleParticipant[]> {
  if (!supabase || !battleId) return [];
  const { data } = await supabase
    .from("battle_participants")
    .select("user_id, crew_id, r1_taps, r2_score, r3_hits")
    .eq("battle_id", battleId);
  return (data ?? []) as BattleParticipant[];
}

export async function createBattle(districtId: string, scheduledAt: Date): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!supabase) return { ok: false, error: "hors ligne" };
  const { data, error } = await supabase.rpc("create_territory_battle", {
    p_district_id: districtId,
    p_scheduled_at: scheduledAt.toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as any)?.id };
}

export async function joinBattle(battleId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("join_territory_battle", { p_battle_id: battleId });
  return !error;
}

export async function tickBattle(battleId: string): Promise<TerritoryBattle | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("tick_territory_battle", { p_battle_id: battleId });
  if (error || !data) return null;
  return fetchBattle(battleId);
}

export async function battleTap(battleId: string): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("battle_tap", { p_battle_id: battleId });
  return error ? null : (data as number);
}

export async function battleSubmitQuiz(battleId: string, correct: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("battle_submit_quiz", { p_battle_id: battleId, p_correct: correct });
  return !error;
}

export async function battleSyncHit(battleId: string): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("battle_sync_hit", { p_battle_id: battleId });
  return error ? null : (data as number);
}

export function subscribeBattle(battleId: string, onChange: () => void) {
  const sb = supabase;
  if (!sb) return () => {};
  const ch = sb
    .channel(`battle-${battleId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "territory_battles", filter: `id=eq.${battleId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "battle_participants", filter: `battle_id=eq.${battleId}` }, onChange)
    .subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}

