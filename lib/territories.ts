import { supabase } from "./supabase";

/**
 * Territories V2 (spec §4). Info publique : chaque quartier a un crew
 * propriétaire, une influence, un prestige, une prochaine Battle.
 * Dégrade proprement si la migration `20260902000000` n'est pas appliquée.
 */

export type Territory = {
  id: string;
  district_id: string;
  district_name: string;
  district_emoji: string;
  center_lat: number;
  center_lng: number;
  owner_crew_id: string | null;
  owner_tag: string | null;
  owner_name: string | null;
  owner_emoji: string | null;
  owner_color: string | null;
  influence: number;
  prestige: number;
  conquered_at: string | null;
  defenses_won: number;
  next_battle_at: string | null;
};

export type TerritoryEvent = {
  id: string;
  kind: "claimed" | "lost" | "defended" | "battle_scheduled" | "influence_shift" | "prestige_up";
  crew_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

export async function fetchTerritories(): Promise<Territory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("territories")
    .select(
      `id, district_id, influence, prestige, conquered_at, defenses_won, next_battle_at,
       owner_crew_id,
       districts:district_id ( name, emoji, center_lat, center_lng ),
       crews:owner_crew_id ( tag, name, emoji, color )`
    );
  if (error || !data) return [];
  return data.map((r: Record<string, any>) => ({
    id: r.id,
    district_id: r.district_id,
    district_name: r.districts?.name ?? "Quartier",
    district_emoji: r.districts?.emoji ?? "📍",
    center_lat: r.districts?.center_lat ?? 0,
    center_lng: r.districts?.center_lng ?? 0,
    owner_crew_id: r.owner_crew_id,
    owner_tag: r.crews?.tag ?? null,
    owner_name: r.crews?.name ?? null,
    owner_emoji: r.crews?.emoji ?? null,
    owner_color: r.crews?.color ?? null,
    influence: r.influence ?? 50,
    prestige: r.prestige ?? 1,
    conquered_at: r.conquered_at ?? null,
    defenses_won: r.defenses_won ?? 0,
    next_battle_at: r.next_battle_at ?? null,
  }));
}

export async function fetchTerritoryEvents(territoryId: string, limit = 20): Promise<TerritoryEvent[]> {
  if (!supabase || !territoryId) return [];
  const { data, error } = await supabase
    .from("territory_events")
    .select("id, kind, crew_id, detail, created_at")
    .eq("territory_id", territoryId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as TerritoryEvent[];
}

/** Realtime : la carte réagit dès qu'un territoire change de main. */
export function subscribeTerritories(onChange: () => void) {
  const sb = supabase;
  if (!sb) return () => {};
  const ch = sb
    .channel("territories-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "territories" }, onChange)
    .subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}

/** Jours depuis la conquête, pour « Contrôlé depuis 12 jours ». */
export function daysHeld(conqueredAt: string | null): number | null {
  if (!conqueredAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(conqueredAt).getTime()) / 86400_000));
}
