import { supabase } from "./supabase";
import { fetchUpcomingBattles, type TerritoryBattle } from "./territory-wars";
import { fetchSocialZones, type SocialZone } from "./dating";

/**
 * « Ça se passe maintenant » (§16) — agrège en quelques lignes ce qui bouge
 * dans la ville à l'instant T, pour donner l'impression que Toulouse vit
 * même sans le joueur. Lecture seule, tolérante aux tables manquantes.
 */

export type HappeningItem = {
  key: string;
  emoji: string;
  text: string;
  href?: string;
  urgent?: boolean;
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function nextFlashEvent(): Promise<{ id: string; title: string } | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("flash_events")
    .select("id, title, expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(1);
  const row = (data ?? [])[0] as { id: string; title: string } | undefined;
  return row ?? null;
}

async function nextMyLifeEvent(): Promise<{ id: string; title: string } | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("mylife_events")
    .select("id, title, starts_at")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1);
  const row = (data ?? [])[0] as { id: string; title: string } | undefined;
  return row ?? null;
}

async function nextCrewOuting(crewId: string): Promise<{ id: string; title: string } | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("crew_outings")
    .select("id, title, planned_at, status")
    .eq("crew_id", crewId)
    .in("status", ["proposed", "confirmed"])
    .gte("planned_at", new Date().toISOString())
    .order("planned_at", { ascending: true })
    .limit(1);
  const row = (data ?? [])[0] as { id: string; title: string } | undefined;
  return row ?? null;
}

export async function fetchHappeningNow(myCrewId: string | null): Promise<HappeningItem[]> {
  const out: HappeningItem[] = [];
  if (!supabase) return out;

  const [battles, zones, flash, outing, mlEvent] = await Promise.all([
    safe<TerritoryBattle[]>(fetchUpcomingBattles, []),
    safe<SocialZone[]>(fetchSocialZones, []),
    safe(nextFlashEvent, null),
    myCrewId ? safe(() => nextCrewOuting(myCrewId), null) : Promise.resolve(null),
    safe(nextMyLifeEvent, null),
  ]);

  const nextBattle = battles.find(
    (b) => b.status === "live" || new Date(b.scheduled_at).getTime() - Date.now() < 3 * 3600_000
  );
  if (nextBattle) {
    const live = nextBattle.status === "live";
    const mins = Math.max(0, Math.round((new Date(nextBattle.scheduled_at).getTime() - Date.now()) / 60000));
    out.push({
      key: "battle",
      emoji: "⚔️",
      text: live
        ? `Battle EN COURS pour ${nextBattle.district_name}`
        : `Battle dans ${mins} min · ${nextBattle.district_name}`,
      href: `/(app)/battle/${nextBattle.id}`,
      urgent: live || mins <= 30,
    });
  }

  if (outing) {
    out.push({ key: "outing", emoji: "🫂", text: `Ton crew organise : ${outing.title}`, href: "/(app)/crew-hq" });
  }

  const hot = zones.find((z) => z.level === "hot") ?? zones.find((z) => z.level === "active");
  if (hot) {
    out.push({
      key: "social",
      emoji: "❤️",
      text: `Activité sociale élevée à ${hot.district_name}`,
      href: "/(app)/rencontres",
    });
  }

  if (mlEvent) {
    out.push({ key: "mylife-event", emoji: "🎟️", text: `MyLife Night : ${mlEvent.title}`, href: "/(app)/my-pass" });
  } else if (flash) {
    out.push({ key: "event", emoji: "🎉", text: `Événement en cours : ${flash.title}`, href: "/(app)/(tabs)/map" });
  }

  return out;
}
