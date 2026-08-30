// Couche de conséquences autonomes de la ville — PURE et déterministe.
// Ne simule rien de neuf : lit les événements déjà produits par
// simulateLivingCityTick (living-city.ts) + l'état des crews NPC, et en
// dérive un petit nombre de changements PERSISTANTS lisibles par le joueur
// (humeur de quartier, bascule de domination de crew). Aucun timer, aucun
// scan all-pairs : O(events + districts + crews).
import type { LivingCityCrew, LivingCityEvent, LivingCityEventKind, LivingCityState } from "./living-city";
import type { CityPulseSignal } from "./city-pulse";

export type DistrictMood = "calme" | "actif" | "social" | "competitif" | "nocturne";

export type DistrictState = { mood: DistrictMood; score: number; at: string };

export type DistrictStateMap = Record<string, DistrictState>;

export type DistrictChange = { district: string; from: DistrictMood; to: DistrictMood };

export type CrewDominanceShift = { district: string; crewTag: string; crewName: string };

export type CityHistoryEntry = { id: string; text: string; at: string };

const SOCIAL_KINDS = new Set(["SOCIAL", "FEELING", "MATCH", "OUTING", "RELATIONSHIP"]);
const COMPETITIVE_KINDS = new Set(["TERRITORY", "BATTLE", "CREW"]);

const DECAY = 0.6;         // l'ancien score s'estompe à chaque tick
const NEW_WEIGHT = 1;      // poids d'un évènement récent
const MAX_SCORE = 20;

function isNight(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  return h >= 22 || h < 6;
}

function moodFromSignals(social: number, competitive: number, generic: number, night: boolean): { mood: DistrictMood; score: number } {
  const total = social + competitive + generic;
  if (total < 1.5) return { mood: "calme", score: total };
  if (night && total >= 2 && social >= competitive) return { mood: "nocturne", score: total };
  if (competitive >= social && competitive >= 2) return { mood: "competitif", score: total };
  if (social >= 2 && social > competitive) return { mood: "social", score: total };
  return { mood: "actif", score: total };
}

/**
 * Recalcule l'humeur de chaque quartier à partir des évènements récents et
 * de l'état précédent (avec décroissance). Déterministe : mêmes entrées →
 * même sortie.
 */
export function deriveDistrictStates(
  events: LivingCityEvent[],
  prev: DistrictStateMap,
  now: Date,
): DistrictStateMap {
  const nowIso = now.toISOString();
  const night = isNight(now.getHours());

  const social = new Map<string, number>();
  const competitive = new Map<string, number>();
  const generic = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

  for (const e of events.slice(0, 24)) {
    if (!e.district) continue;
    if (SOCIAL_KINDS.has(e.kind)) bump(social, e.district, NEW_WEIGHT);
    else if (COMPETITIVE_KINDS.has(e.kind)) bump(competitive, e.district, NEW_WEIGHT);
    else bump(generic, e.district, NEW_WEIGHT);
  }

  const districts = new Set<string>([
    ...Object.keys(prev),
    ...social.keys(), ...competitive.keys(), ...generic.keys(),
  ]);

  const next: DistrictStateMap = {};
  for (const d of districts) {
    const prevScore = (prev[d]?.score ?? 0) * DECAY;
    const s = (social.get(d) ?? 0) + prevScore * 0.4;
    const c = (competitive.get(d) ?? 0) + prevScore * 0.4;
    const g = (generic.get(d) ?? 0) + prevScore * 0.2;
    const { mood, score } = moodFromSignals(s, c, g, night);
    const clamped = Math.min(MAX_SCORE, Math.round((s + c + g) * 10) / 10);
    if (clamped < 0.3 && !prev[d]) continue; // rien à retenir
    next[d] = { mood, score: clamped, at: nowIso };
  }
  return next;
}

/** Quartiers dont l'humeur a réellement changé. */
export function districtStateChanges(prev: DistrictStateMap, next: DistrictStateMap): DistrictChange[] {
  const out: DistrictChange[] = [];
  for (const [district, state] of Object.entries(next)) {
    const before = prev[district]?.mood;
    if (before && before !== state.mood) out.push({ district, from: before, to: state.mood });
  }
  return out;
}

function crewStrength(crew: LivingCityCrew): number {
  return crew.reputation * 0.6 + crew.activity * 0.4;
}

/** Bascule de la crew la plus forte d'un quartier (O(crews)). */
export function crewDominanceShift(prev: LivingCityCrew[], next: LivingCityCrew[]): CrewDominanceShift[] {
  const topBy = (list: LivingCityCrew[]) => {
    const m = new Map<string, LivingCityCrew>();
    for (const c of list) {
      const cur = m.get(c.district);
      if (!cur || crewStrength(c) > crewStrength(cur)) m.set(c.district, c);
    }
    return m;
  };
  const before = topBy(prev);
  const after = topBy(next);
  const out: CrewDominanceShift[] = [];
  for (const [district, crew] of after) {
    const prevTop = before.get(district);
    if (prevTop && prevTop.id !== crew.id) {
      out.push({ district, crewTag: crew.tag, crewName: crew.name });
    }
  }
  return out;
}

const MOOD_VERB: Record<DistrictMood, string> = {
  calme: "se calme",
  actif: "s'anime",
  social: "devient plus social",
  competitif: "devient plus compétitif",
  nocturne: "s'éveille pour la nuit",
};

/**
 * Transforme les changements réels en signaux pour la City Pulse EXISTANTE
 * (aucune City Pulse v2). Agrégé, dédupliqué par quartier, jamais technique.
 */
export function consequenceSignals(
  districtChanges: DistrictChange[],
  crewShifts: CrewDominanceShift[],
  now: Date,
): CityPulseSignal[] {
  const at = now.toISOString();
  const seen = new Set<string>();
  const out: CityPulseSignal[] = [];

  for (const shift of crewShifts.slice(0, 2)) {
    if (seen.has(shift.district)) continue;
    seen.add(shift.district);
    out.push({
      id: `cc:crew:${shift.district}:${shift.crewTag}`,
      kind: "CREW",
      title: `${shift.district} bascule`,
      body: `[${shift.crewTag}] ${shift.crewName} domine maintenant ${shift.district}.`,
      district: shift.district,
      startsAt: at,
      priority: 62,
      source: "GAME",
      crewName: shift.crewName,
      actionable: true,
    });
  }

  for (const change of districtChanges.slice(0, 3)) {
    if (seen.has(change.district)) continue;
    seen.add(change.district);
    out.push({
      id: `cc:district:${change.district}:${change.to}`,
      kind: "CITY",
      title: `${change.district} ${MOOD_VERB[change.to]}`,
      body: `L'activité de ${change.district} évolue en ce moment.`,
      district: change.district,
      startsAt: at,
      priority: 48,
      source: "GAME",
      actionable: false,
    });
  }

  return out;
}

/** Résumé de retour : 3 items MAX, uniquement de vrais changements. */
export function buildCityDigest(
  districtChanges: DistrictChange[],
  crewShifts: CrewDominanceShift[],
  playerDistrict: string | null,
): string[] {
  const items: { text: string; weight: number }[] = [];
  for (const s of crewShifts) {
    items.push({
      text: `[${s.crewTag}] a pris le contrôle de ${s.district}.`,
      weight: s.district === playerDistrict ? 3 : 2,
    });
  }
  for (const c of districtChanges) {
    items.push({
      text: `${c.district} ${MOOD_VERB[c.to]}.`,
      weight: c.district === playerDistrict ? 2 : 1,
    });
  }
  return items
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((i) => i.text);
}

/**
 * Point d'entrée unique : à partir de l'état précédent et du résultat d'un
 * tick de simulateLivingCityTick, calcule les conséquences persistantes et
 * renvoie les champs à fusionner dans le LivingCityState. Borné, déterministe,
 * O(events + districts + crews). Ne simule RIEN de nouveau.
 */
export function applyCityConsequences(
  prev: LivingCityState,
  tickState: LivingCityState,
  opts: { playerDistrict: string | null; elapsedMs: number; forced: boolean; now?: Date },
): Pick<LivingCityState, "events" | "districtStates" | "cityHistory" | "cityDigest" | "cityDigestAt"> {
  const now = opts.now ?? new Date();
  // Ne jamais réinjecter nos propres évènements synthétiques dans le calcul
  // d'humeur : sinon un "cc:crew:*" (kind CREW) compterait comme activité
  // compétitive et pourrait faire osciller le quartier tick après tick.
  const realEvents = tickState.events.filter((e) => !e.id.startsWith("cc:"));
  const prevDS = (prev.districtStates ?? {}) as DistrictStateMap;
  const districtStates = deriveDistrictStates(realEvents, prevDS, now);
  const dChanges = districtStateChanges(prevDS, districtStates);
  const cShifts = crewDominanceShift(prev.crews ?? [], tickState.crews ?? []);

  const synthetic: LivingCityEvent[] = consequenceSignals(dChanges, cShifts, now).map((sig) => ({
    id: sig.id,
    kind: (sig.kind === "CREW" ? "CREW" : "CITY") as LivingCityEventKind,
    title: sig.title,
    body: sig.body,
    district: sig.district ?? "",
    at: now.toISOString(),
    priority: sig.priority,
    notify: false, // conséquences autonomes : City Pulse, jamais de push
    actorNpcIds: [],
    crewIds: [],
  }));
  const existing = new Set(tickState.events.map((e) => e.id));
  const events = [...synthetic.filter((e) => !existing.has(e.id)), ...tickState.events].slice(0, 60);

  const cityHistory = appendCityHistory(prev.cityHistory ?? [], dChanges, cShifts, now);

  const longGap = !opts.forced && opts.elapsedMs >= 45 * 60_000;
  const cityDigest = longGap ? buildCityDigest(dChanges, cShifts, opts.playerDistrict) : (prev.cityDigest ?? []);
  const cityDigestAt = longGap ? now.toISOString() : (prev.cityDigestAt ?? null);

  return { events, districtStates, cityHistory, cityDigest, cityDigestAt };
}

export function appendCityHistory(
  history: CityHistoryEntry[],
  changes: DistrictChange[],
  shifts: CrewDominanceShift[],
  now: Date,
  max = 20,
): CityHistoryEntry[] {
  const at = now.toISOString();
  const fresh: CityHistoryEntry[] = [];
  for (const s of shifts) {
    fresh.push({ id: `h:crew:${s.district}:${s.crewTag}:${at}`, text: `[${s.crewTag}] domine ${s.district}`, at });
  }
  for (const c of changes) {
    fresh.push({ id: `h:district:${c.district}:${c.to}:${at}`, text: `${c.district} ${MOOD_VERB[c.to]}`, at });
  }
  if (fresh.length === 0) return history;
  return [...fresh, ...history].slice(0, max);
}
