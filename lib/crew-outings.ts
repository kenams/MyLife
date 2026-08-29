import { supabase } from "./supabase";
import { sendLocalNotification } from "./notifications";

/**
 * Crew Life §1 — agenda de sortie. Dégrade proprement si la migration
 * `20260901000000_crew_outings.sql` n'est pas encore appliquée.
 */

export type OutingStatus = "proposed" | "confirmed" | "cancelled" | "done";
export type RsvpResponse = "yes" | "maybe" | "no";

export type CrewOuting = {
  id: string;
  crew_id: string;
  created_by: string;
  title: string;
  place: string;
  planned_at: string;
  note: string;
  status: OutingStatus;
  created_at: string;
  rsvps: { yes: number; maybe: number; no: number };
  my_response: RsvpResponse | null;
};

type RsvpRow = { outing_id: string; user_id: string; response: RsvpResponse };

export async function fetchCrewOutings(crewId: string): Promise<CrewOuting[]> {
  if (!supabase || !crewId) return [];
  const { data: outings, error } = await supabase
    .from("crew_outings")
    .select("*")
    .eq("crew_id", crewId)
    .in("status", ["proposed", "confirmed"])
    .gte("planned_at", new Date(Date.now() - 6 * 3600_000).toISOString())
    .order("planned_at", { ascending: true });
  if (error || !outings) return [];

  const ids = outings.map((o) => o.id);
  const { data: rsvps } = ids.length
    ? await supabase.from("crew_outing_rsvps").select("outing_id,user_id,response").in("outing_id", ids)
    : { data: [] as RsvpRow[] };
  const { data: auth } = await supabase.auth.getUser();
  const myId = auth?.user?.id;

  return outings.map((o) => {
    const rs = ((rsvps ?? []) as RsvpRow[]).filter((r) => r.outing_id === o.id);
    return {
      ...o,
      rsvps: {
        yes: rs.filter((r) => r.response === "yes").length,
        maybe: rs.filter((r) => r.response === "maybe").length,
        no: rs.filter((r) => r.response === "no").length,
      },
      my_response: rs.find((r) => r.user_id === myId)?.response ?? null,
    } as CrewOuting;
  });
}

export async function proposeOuting(
  crewId: string,
  input: { title: string; place: string; plannedAt: Date; note?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "hors ligne" };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Un titre est requis." };
  if (input.plannedAt.getTime() < Date.now()) return { ok: false, error: "La date doit être dans le futur." };
  const { data, error } = await supabase
    .from("crew_outings")
    .insert({
      crew_id: crewId,
      title: title.slice(0, 120),
      place: (input.place ?? "").trim().slice(0, 120),
      planned_at: input.plannedAt.toISOString(),
      note: (input.note ?? "").trim().slice(0, 500),
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  // Le proposeur est présent par défaut.
  if (data?.id) await setRsvp(data.id, "yes", input.plannedAt);
  return { ok: true };
}

export async function setRsvp(
  outingId: string,
  response: RsvpResponse,
  plannedAt?: Date
): Promise<boolean> {
  if (!supabase || !outingId) return false;
  const { error } = await supabase
    .from("crew_outing_rsvps")
    .upsert({ outing_id: outingId, response, updated_at: new Date().toISOString() }, { onConflict: "outing_id,user_id" });
  if (error) return false;
  if (response === "yes" && plannedAt) await scheduleOutingReminder(plannedAt);
  return true;
}

export async function setOutingStatus(outingId: string, status: OutingStatus): Promise<boolean> {
  if (!supabase || !outingId) return false;
  const { error } = await supabase.from("crew_outings").update({ status }).eq("id", outingId);
  return !error;
}

/** Rappel local ~2h avant la sortie (min 1 min). */
export async function scheduleOutingReminder(plannedAt: Date): Promise<void> {
  const delay = Math.round((plannedAt.getTime() - Date.now()) / 1000) - 2 * 3600;
  if (delay < 60) return;
  await sendLocalNotification("Sortie du crew bientôt", "Rendez-vous dans 2 h. Ton crew compte sur toi. 🫂", delay);
}
