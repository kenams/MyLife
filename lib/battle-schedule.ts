/**
 * Créneaux de Territory War : mercredi et samedi 20h (spec §7).
 * Pur, testable.
 */

const BATTLE_DOWS = [3, 6]; // mercredi, samedi
const BATTLE_HOUR = 20;

/** Prochain créneau de Battle strictement après `from` (au moins +10 min). */
export function nextBattleSlot(from = new Date()): Date {
  const floor = new Date(from.getTime() + 10 * 60_000);
  for (let add = 0; add <= 8; add++) {
    const d = new Date(floor.getFullYear(), floor.getMonth(), floor.getDate() + add, BATTLE_HOUR, 0, 0, 0);
    if (BATTLE_DOWS.includes(d.getDay()) && d.getTime() > floor.getTime()) {
      return d;
    }
  }
  // fallback improbable
  return new Date(floor.getFullYear(), floor.getMonth(), floor.getDate() + 1, BATTLE_HOUR);
}

export function formatSlot(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}
