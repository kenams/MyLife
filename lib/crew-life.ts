import { supabase } from "./supabase";

export { currentWeekStart, deriveSocialRoles } from "./crew-life-logic";
export type { SocialRole, RoleInput } from "./crew-life-logic";
import { currentWeekStart } from "./crew-life-logic";

/**
 * Crew Life (Phase D) — objectif hebdo commun + souvenirs du crew.
 * Toutes les fonctions dégradent proprement (tableau/valeur vide) si la
 * migration `20260830000000_crew_life.sql` n'est pas encore appliquée.
 */

export type CrewWeeklyGoal = {
  id: string;
  crew_id: string;
  week_start: string;
  label: string;
  target: number;
  progress: number;
  reward_xp: number;
};

export type CrewMemory = {
  id: string;
  crew_id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
};

const WEEKLY_LABELS = [
  { label: "5 missions de saison validées par le crew", target: 5, reward_xp: 150 },
  { label: "3 sorties IRL notées en souvenir", target: 3, reward_xp: 120 },
  { label: "10 check-ins au bastion cette semaine", target: 10, reward_xp: 100 },
];

export async function fetchWeeklyGoal(crewId: string): Promise<CrewWeeklyGoal | null> {
  if (!supabase || !crewId) return null;
  const week = currentWeekStart();
  const { data, error } = await supabase
    .from("crew_weekly_goals")
    .select("*")
    .eq("crew_id", crewId)
    .eq("week_start", week)
    .maybeSingle();
  if (error) return null;
  if (data) return data as CrewWeeklyGoal;

  // Aucun objectif pour cette semaine → en semer un (déterministe sur la semaine).
  const pick = WEEKLY_LABELS[parseInt(week.replace(/-/g, ""), 10) % WEEKLY_LABELS.length];
  const { data: created, error: insErr } = await supabase
    .from("crew_weekly_goals")
    .insert({ crew_id: crewId, week_start: week, ...pick })
    .select("*")
    .maybeSingle();
  if (insErr) return null;
  return (created as CrewWeeklyGoal) ?? null;
}

export async function bumpWeeklyGoal(goalId: string, by = 1): Promise<boolean> {
  if (!supabase || !goalId) return false;
  const { data, error } = await supabase
    .from("crew_weekly_goals")
    .select("progress,target")
    .eq("id", goalId)
    .maybeSingle();
  if (error || !data) return false;
  const next = Math.min(data.target, data.progress + by);
  const { error: updErr } = await supabase
    .from("crew_weekly_goals")
    .update({ progress: next })
    .eq("id", goalId);
  return !updErr;
}

export async function fetchCrewMemories(crewId: string, limit = 30): Promise<CrewMemory[]> {
  if (!supabase || !crewId) return [];
  const { data, error } = await supabase
    .from("crew_memories")
    .select("*")
    .eq("crew_id", crewId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as CrewMemory[];
}

export async function addCrewMemory(
  crewId: string,
  title: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "hors ligne" };
  const t = title.trim();
  if (!t) return { ok: false, error: "Un titre est requis." };
  const { error } = await supabase
    .from("crew_memories")
    .insert({ crew_id: crewId, title: t.slice(0, 120), body: body.trim().slice(0, 1000) });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteCrewMemory(id: string): Promise<boolean> {
  if (!supabase || !id) return false;
  const { error } = await supabase.from("crew_memories").delete().eq("id", id);
  return !error;
}

