import { supabase } from "./supabase";

/**
 * Dating V2 (§13-14). Le statut relationnel est VOLONTAIRE et séparé de
 * « qui peut m'envoyer un Feeling ». La rencontre passe par le monde
 * (Croisés, events, crew). Aucune position exacte d'un inconnu (§6).
 */

export type RelationshipStatus = "open" | "maybe" | "not_looking" | "couple" | "private";
export type FeelingPermission = "everyone" | "crossed" | "crew" | "nobody";

export const STATUS_META: Record<RelationshipStatus, { emoji: string; label: string }> = {
  open: { emoji: "💚", label: "Célibataire — ouvert aux rencontres" },
  maybe: { emoji: "💛", label: "Célibataire — on verra" },
  not_looking: { emoji: "🩶", label: "Pas en recherche" },
  couple: { emoji: "❤️", label: "En couple" },
  private: { emoji: "🔒", label: "Privé" },
};

export const PERMISSION_META: Record<FeelingPermission, string> = {
  everyone: "Tout le monde",
  crossed: "Seulement si on s'est croisés",
  crew: "Seulement mon crew",
  nobody: "Personne pour l'instant",
};

export type DatingPrefs = {
  relationship_status: RelationshipStatus;
  feeling_permission: FeelingPermission;
  open_to_meet_until: string | null;
};

export async function fetchMyDatingPrefs(): Promise<DatingPrefs | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data } = await supabase
    .from("dating_prefs")
    .select("relationship_status, feeling_permission, open_to_meet_until")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return (data as DatingPrefs) ?? {
    relationship_status: "private",
    feeling_permission: "crossed",
    open_to_meet_until: null,
  };
}

export async function setDatingPrefs(input: {
  status?: RelationshipStatus;
  permission?: FeelingPermission;
  openMinutes?: number;
}): Promise<DatingPrefs | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("set_dating_prefs", {
    p_status: input.status ?? null,
    p_permission: input.permission ?? null,
    p_open_minutes: input.openMinutes ?? null,
  });
  if (error || !data) return null;
  return data as DatingPrefs;
}

export async function recordCrossing(other: string, context = "activity", districtId?: string): Promise<void> {
  if (!supabase || !other) return;
  await supabase.rpc("record_crossing", { p_other: other, p_context: context, p_district: districtId ?? null });
}

export type Crossing = {
  other_id: string;
  context: string;
  crossings_count: number;
  last_at: string;
};

export async function fetchMyCrossings(): Promise<Crossing[]> {
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) return [];
  const { data, error } = await supabase
    .from("crossings")
    .select("user_low, user_high, context, crossings_count, last_at")
    .order("last_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map((r: any) => ({
    other_id: r.user_low === me ? r.user_high : r.user_low,
    context: r.context,
    crossings_count: r.crossings_count,
    last_at: r.last_at,
  }));
}

export async function proposeCouple(other: string): Promise<{ ok: boolean; error?: string; since?: string | null }> {
  if (!supabase) return { ok: false, error: "hors ligne" };
  const { data, error } = await supabase.rpc("propose_couple", { p_other: other });
  if (error) return { ok: false, error: error.message };
  return { ok: true, since: (data as any)?.since ?? null };
}

export async function breakCouple(other: string): Promise<void> {
  if (!supabase) return;
  await supabase.rpc("break_couple", { p_other: other });
}

export type SocialZone = { district_id: string; district_name: string; level: "quiet" | "active" | "hot" };

/** Zones sociales du moment — AGRÉGAT (min 3 personnes), jamais d'individu. */
export async function fetchSocialZones(): Promise<SocialZone[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("social_zones");
  if (error || !Array.isArray(data)) return [];
  return data as SocialZone[];
}
