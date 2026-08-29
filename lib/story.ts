import { supabase } from "./supabase";
import { getMyCrewId } from "./crews";

/**
 * MyLife Story (§15) — MA SEMAINE / MON MOIS / MY YEAR. Récap dérivé des
 * données existantes (ledger Wory, battles, trophées, croisés), pas d'un
 * nouveau journal. Objectif : donner au joueur quelque chose à raconter.
 */

export type StoryPeriod = "week" | "month" | "year";

export const PERIOD_LABEL: Record<StoryPeriod, string> = {
  week: "MA SEMAINE",
  month: "MON MOIS",
  year: "MON ANNÉE",
};

export type StoryRecap = {
  period: StoryPeriod;
  since: string;
  woryGained: number;
  battlesPlayed: number;
  battlesWon: number;
  trophies: string[];
  peopleMet: number;
  becameCouple: boolean;
};

function sinceFor(period: StoryPeriod): Date {
  const d = new Date();
  if (period === "week") d.setDate(d.getDate() - 7);
  else if (period === "month") d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  return d;
}

export async function fetchStoryRecap(period: StoryPeriod, playerName: string): Promise<StoryRecap> {
  const since = sinceFor(period);
  const sinceIso = since.toISOString();
  const empty: StoryRecap = {
    period,
    since: sinceIso,
    woryGained: 0,
    battlesPlayed: 0,
    battlesWon: 0,
    trophies: [],
    peopleMet: 0,
    becameCouple: false,
  };
  if (!supabase) return empty;

  const crewId = await getMyCrewId(playerName).catch(() => null);
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id ?? null;

  const [wory, parts, trophies, crossings, couples] = await Promise.all([
    supabase
      .from("wory_ledger")
      .select("delta, created_at")
      .gte("created_at", sinceIso)
      .gt("delta", 0)
      .then((r) => r.data ?? [], () => []),
    me
      ? supabase
          .from("battle_participants")
          .select("battle_id, crew_id, territory_battles!inner(status, winner_crew, resolved_at)")
          .eq("user_id", me)
          .then((r) => r.data ?? [], () => [])
      : Promise.resolve([]),
    crewId
      ? supabase
          .from("crew_trophies")
          .select("label, created_at")
          .eq("crew_id", crewId)
          .gte("created_at", sinceIso)
          .then((r) => r.data ?? [], () => [])
      : Promise.resolve([]),
    supabase
      .from("crossings")
      .select("last_at")
      .gte("last_at", sinceIso)
      .then((r) => r.data ?? [], () => []),
    supabase
      .from("couples")
      .select("since")
      .not("since", "is", null)
      .gte("since", sinceIso)
      .then((r) => r.data ?? [], () => []),
  ]);

  const woryGained = (wory as { delta: number }[]).reduce((s, r) => s + (r.delta ?? 0), 0);

  const relevant = (parts as any[]).filter((p) => {
    const b = p.territory_battles;
    return b && b.status === "resolved" && b.resolved_at && b.resolved_at >= sinceIso;
  });
  const battlesWon = relevant.filter((p) => p.territory_battles.winner_crew === p.crew_id).length;

  return {
    period,
    since: sinceIso,
    woryGained,
    battlesPlayed: relevant.length,
    battlesWon,
    trophies: (trophies as { label: string }[]).map((t) => t.label),
    peopleMet: (crossings as unknown[]).length,
    becameCouple: (couples as unknown[]).length > 0,
  };
}

export function recapShareText(r: StoryRecap, appName: string): string {
  const lines = [
    `${appName} — ${PERIOD_LABEL[r.period]}`,
    `🪙 +${r.woryGained} Wory`,
  ];
  if (r.battlesPlayed) lines.push(`⚔️ ${r.battlesPlayed} battle${r.battlesPlayed > 1 ? "s" : ""} · ${r.battlesWon} gagnée${r.battlesWon > 1 ? "s" : ""}`);
  if (r.trophies.length) lines.push(`🏆 ${r.trophies.join(" · ")}`);
  if (r.peopleMet) lines.push(`👀 ${r.peopleMet} personne${r.peopleMet > 1 ? "s" : ""} croisée${r.peopleMet > 1 ? "s" : ""}`);
  if (r.becameCouple) lines.push(`❤️ En couple`);
  lines.push(`Rejoins-moi.`);
  return lines.join("\n");
}
