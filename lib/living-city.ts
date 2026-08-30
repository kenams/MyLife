import type { AvatarAction } from "@/lib/avatar-visual";
import { chooseNpcAction, type NpcContext, type NpcIntent } from "@/lib/npc-brain-policy";
import type { LifeFeedItem, NotificationItem, NpcState } from "@/lib/types";

export type LivingCityPreset = "LOW" | "NORMAL" | "BUSY" | "CHAOS";
export type LivingCitySpeed = 1 | 5 | 20;
export type LivingCityLevel = "OFFSCREEN" | "ACTIVE_DISTRICT" | "NEAR_PLAYER";

export type LivingCityCrew = {
  id: string;
  name: string;
  tag: string;
  emoji: string;
  color: string;
  district: string;
  reputation: number;
  activity: number;
  rivalTags: string[];
  is_npc: true;
  is_demo: true;
};

export type LivingCityEventKind =
  | "SOCIAL"
  | "FEELING"
  | "MATCH"
  | "CREW"
  | "EVENT"
  | "TERRITORY"
  | "BATTLE"
  | "MISSION"
  | "OUTING"
  | "WORY"
  | "CITY"
  | "RELATIONSHIP";

export type LivingCityEvent = {
  id: string;
  kind: LivingCityEventKind;
  title: string;
  body: string;
  district: string;
  at: string;
  priority: number;
  notify: boolean;
  actorNpcIds: string[];
  crewIds: string[];
};

export type LivingCityState = {
  enabled: boolean;
  preset: LivingCityPreset;
  speed: LivingCitySpeed;
  crews: LivingCityCrew[];
  events: LivingCityEvent[];
  lastSimulatedAt: string | null;
  tick: number;
  notificationsLastMinute: number;
  avgTickMs: number;
  lastAbsenceSummary: string[];
  npcInteractionsLastTick: number;
  outingsLastTick: number;
  territorySignalsLastTick: number;
  // Conséquences autonomes persistantes (voir lib/city-consequences.ts)
  districtStates?: Record<string, { mood: string; score: number; at: string }>;
  cityHistory?: { id: string; text: string; at: string }[];
  cityDigest?: string[];
  cityDigestAt?: string | null;
};

export type LivingCityTickInput = {
  state: LivingCityState;
  npcs: NpcState[];
  now?: Date;
  playerDistrict?: string;
  forceMinutes?: number;
  forceKind?: LivingCityEventKind;
};

export type LivingCityTickResult = {
  state: LivingCityState;
  npcs: NpcState[];
  feed: LifeFeedItem[];
  notifications: NotificationItem[];
};

const PRESET_COUNTS: Record<LivingCityPreset, number> = {
  LOW: 30,
  NORMAL: 100,
  BUSY: 250,
  CHAOS: 500,
};

const ARCHETYPES = [
  "social",
  "explorateur",
  "sportif",
  "noctambule",
  "leader",
  "organisateur",
  "romantique",
  "competitif",
  "discret",
  "travailleur",
];

const DISTRICTS = [
  "Capitole",
  "Jean-Jaures",
  "Compans",
  "Saint-Cyprien",
  "Carmes",
  "Rangueil",
  "Minimes",
  "Saint-Aubin",
  "Esquirol",
  "Bonnefoy",
];

const INTERESTS = [
  "sport",
  "musique",
  "food",
  "street-art",
  "business",
  "nightlife",
  "jeux",
  "cinema",
  "mode",
  "tech",
];

export const DEFAULT_LIVING_CITY_CREWS: LivingCityCrew[] = [
  { id: "npc-crew-wolves", name: "Wolves", tag: "WLV", emoji: "W", color: "#00B4FF", district: "Compans", reputation: 72, activity: 78, rivalTags: ["KNG"], is_npc: true, is_demo: true },
  { id: "npc-crew-kings", name: "Kings", tag: "KNG", emoji: "K", color: "#FFD600", district: "Capitole", reputation: 86, activity: 70, rivalTags: ["WLV", "OWL"], is_npc: true, is_demo: true },
  { id: "npc-crew-night-owls", name: "Night Owls", tag: "OWL", emoji: "O", color: "#BF5FFF", district: "Jean-Jaures", reputation: 64, activity: 88, rivalTags: ["KNG"], is_npc: true, is_demo: true },
  { id: "npc-crew-garonne", name: "Garonne Club", tag: "GAR", emoji: "G", color: "#00FFD1", district: "Saint-Cyprien", reputation: 58, activity: 54, rivalTags: ["WLV"], is_npc: true, is_demo: true },
];

const NAMES = [
  "Lina",
  "Mehdi",
  "Ava",
  "Noa",
  "Malik",
  "Leila",
  "Sana",
  "Yan",
  "Ines",
  "Rayan",
  "Camille",
  "Yanis",
  "Nora",
  "Amir",
  "Sarah",
  "Nassim",
  "Maya",
  "Ilyes",
];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function hourPhase(hour: number): "morning" | "midday" | "afternoon" | "evening" | "night" {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

function activityFor(phase: ReturnType<typeof hourPhase>, archetypes: string[], random: () => number): AvatarAction {
  if (phase === "night") return archetypes.includes("noctambule") && random() > 0.35 ? "chatting" : "sleeping";
  if (phase === "morning") return archetypes.includes("sportif") && random() > 0.45 ? "exercising" : "working";
  if (phase === "midday") return random() > 0.45 ? "eating" : "chatting";
  if (phase === "afternoon") return archetypes.includes("explorateur") ? "walking" : "working";
  if (archetypes.includes("social") || archetypes.includes("organisateur")) return "chatting";
  return random() > 0.45 ? "walking" : "idle";
}

function locationFor(action: AvatarAction, district: string, random: () => number): string {
  if (action === "sleeping") return "home";
  if (action === "working") return random() > 0.55 ? "office" : "startup";
  if (action === "eating") return random() > 0.5 ? "restaurant" : "market";
  if (action === "exercising") return random() > 0.45 ? "gym" : "park";
  if (action === "chatting") return random() > 0.55 ? "cafe" : "rooftop-bar";
  if (action === "walking") return "park";
  return district.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "cafe";
}

function avatarActionForIntent(intent: NpcIntent, fallback: AvatarAction): AvatarAction {
  if (intent === "REST") return "sleeping";
  if (intent === "WORK") return "working";
  if (intent === "EAT") return "eating";
  if (intent === "SPORT") return "exercising";
  if (intent === "SOCIAL" || intent === "CREW" || intent === "DATE") return "chatting";
  if (intent === "ROAM") return "walking";
  if (intent === "DO_NOTHING" || intent === "IDLE") return "idle";
  return fallback;
}

function currentActivityForIntent(intent: NpcIntent, action: AvatarAction): string {
  if (intent === "CREW") return "crew";
  if (intent === "DATE") return "date";
  if (intent === "DO_NOTHING") return "idle";
  return action;
}

export function populationForPreset(preset: LivingCityPreset): number {
  return PRESET_COUNTS[preset];
}

export function createLivingCityState(preset: LivingCityPreset = "NORMAL"): LivingCityState {
  return {
    enabled: true,
    preset,
    speed: 1,
    crews: DEFAULT_LIVING_CITY_CREWS,
    events: [],
    lastSimulatedAt: null,
    tick: 0,
    notificationsLastMinute: 0,
    avgTickMs: 0,
    lastAbsenceSummary: [],
    npcInteractionsLastTick: 0,
    outingsLastTick: 0,
    territorySignalsLastTick: 0,
    districtStates: {},
    cityHistory: [],
    cityDigest: [],
    cityDigestAt: null,
  };
}

export function seedLivingCityNpcs(preset: LivingCityPreset, now = new Date()): NpcState[] {
  const count = populationForPreset(preset);
  const out: NpcState[] = [];
  for (let i = 0; i < count; i++) {
    const random = rng(hash(`${preset}:${i}`));
    const first = pick(NAMES, random);
    const district = pick(DISTRICTS, random);
    const archetypeA = pick(ARCHETYPES, random);
    const archetypeB = pick(ARCHETYPES.filter((a) => a !== archetypeA), random);
    const crew = random() > 0.28 ? pick(DEFAULT_LIVING_CITY_CREWS, random) : null;
    const level = 1 + Math.floor(random() * 18);
    const action = activityFor(hourPhase(now.getHours()), [archetypeA, archetypeB], random);
    out.push({
      id: `npc-living-${i + 1}`,
      name: `${first}.${district.slice(0, 3).toUpperCase()}`,
      locationSlug: locationFor(action, district, random),
      action,
      mood: Math.round(42 + random() * 45),
      energy: Math.round(35 + random() * 55),
      hunger: Math.round(10 + random() * 45),
      stress: Math.round(8 + random() * 55),
      hygiene: Math.round(45 + random() * 50),
      money: Math.round(35 + random() * 500),
      xp: (level - 1) * 100 + Math.round(random() * 90),
      level,
      reputation: Math.round(10 + random() * 90),
      streak: Math.floor(random() * 12),
      lastTickAt: now.toISOString(),
      lastMessageAt: null,
      lastInviteAt: null,
      posX: Math.round(8 + random() * 84),
      posY: Math.round(8 + random() * 84),
      presenceOnline: random() > 0.45,
      lastOnlineAt: now.toISOString(),
      is_npc: true,
      is_demo: true,
      is_qa: false,
      personality: `${archetypeA}/${archetypeB}`,
      interests: [pick(INTERESTS, random), pick(INTERESTS, random)],
      homeDistrictSlug: district,
      currentActivity: action,
      lifeRhythm: archetypeA === "noctambule" ? "night" : archetypeA === "travailleur" ? "work" : "balanced",
      sociability: Math.round(20 + random() * 80),
      competitiveProfile: archetypeA === "competitif" || archetypeB === "competitif" ? "competitive" : archetypeA === "explorateur" ? "exploration" : "social",
      crewId: crew?.id ?? null,
      crewName: crew?.name ?? null,
      crewTag: crew?.tag ?? null,
      relationMemory: [],
      npcWory: Math.round(20 + random() * 300),
    });
  }
  return out;
}

function eventTemplates(): Array<Omit<LivingCityEvent, "id" | "at" | "priority" | "actorNpcIds" | "crewIds"> & { priorityBase: number }> {
  return [
    { kind: "CITY", title: "Toulouse Live", body: "Jean-Jaures devient actif", district: "Jean-Jaures", notify: false, priorityBase: 34 },
    { kind: "CREW", title: "Crew", body: "Wolves recrutent de nouveaux profils", district: "Compans", notify: true, priorityBase: 68 },
    { kind: "MISSION", title: "Missions", body: "missions terminees a Capitole", district: "Capitole", notify: false, priorityBase: 45 },
    { kind: "TERRITORY", title: "Territoires", body: "Kings mettent la pression sur Saint-Cyprien", district: "Saint-Cyprien", notify: true, priorityBase: 72 },
    { kind: "BATTLE", title: "Battle", body: "battle de territoire programmee", district: "Compans", notify: true, priorityBase: 82 },
    { kind: "SOCIAL", title: "Social", body: "activite sociale en hausse aux Carmes", district: "Carmes", notify: false, priorityBase: 40 },
    { kind: "FEELING", title: "Feeling", body: "Quelqu'un t'a envoye un Feeling", district: "Esquirol", notify: true, priorityBase: 80 },
    { kind: "MATCH", title: "Match", body: "deux PNJ matchent apres une sortie", district: "Carmes", notify: true, priorityBase: 78 },
    { kind: "RELATIONSHIP", title: "Relation", body: "Lina a relance une ancienne discussion", district: "Capitole", notify: true, priorityBase: 74 },
    { kind: "EVENT", title: "Sortie", body: "Mehdi invite du monde a une sortie", district: "Saint-Aubin", notify: true, priorityBase: 65 },
    { kind: "OUTING", title: "Sortie", body: "sortie PNJ spontanee", district: "Saint-Aubin", notify: true, priorityBase: 70 },
    { kind: "WORY", title: "Wory", body: "des PNJ depensent du Wory en ville", district: "Carmes", notify: false, priorityBase: 38 },
  ];
}

function pickDifferentNpc(npcs: NpcState[], actor: NpcState, random: () => number): NpcState {
  const fallback = npcs.find((npc) => npc.id !== actor.id);
  for (let i = 0; i < 5; i++) {
    const candidate = pick(npcs, random);
    if (candidate.id !== actor.id) return candidate;
  }
  return fallback ?? actor;
}

function eventCopy(
  tpl: ReturnType<typeof eventTemplates>[number],
  actor: NpcState,
  target: NpcState,
  crew: LivingCityCrew,
  rival: LivingCityCrew,
  count: number
): Pick<LivingCityEvent, "body" | "district" | "actorNpcIds" | "crewIds"> {
  const district = actor.homeDistrictSlug ?? tpl.district;
  if (tpl.kind === "FEELING") {
    return { body: `${actor.name} a envoye un Feeling a ${target.name}.`, district, actorNpcIds: [actor.id, target.id], crewIds: [] };
  }
  if (tpl.kind === "MATCH") {
    return { body: `${actor.name} et ${target.name} matchent apres une sortie.`, district, actorNpcIds: [actor.id, target.id], crewIds: [] };
  }
  if (tpl.kind === "RELATIONSHIP") {
    return { body: `${actor.name} relance ${target.name} et garde le lien chaud.`, district, actorNpcIds: [actor.id, target.id], crewIds: [] };
  }
  if (tpl.kind === "OUTING" || tpl.kind === "EVENT") {
    return { body: `${actor.name} sort avec ${target.name} vers ${district}.`, district, actorNpcIds: [actor.id, target.id], crewIds: [] };
  }
  if (tpl.kind === "CREW") {
    return { body: `${crew.name} recrute ${actor.name} autour de ${crew.district}.`, district: crew.district, actorNpcIds: [actor.id], crewIds: [crew.id] };
  }
  if (tpl.kind === "TERRITORY") {
    return { body: `${crew.name} teste ${rival.name} sur ${crew.district}.`, district: crew.district, actorNpcIds: [actor.id], crewIds: [crew.id, rival.id] };
  }
  if (tpl.kind === "BATTLE") {
    return { body: `${crew.name} programme une battle contre ${rival.name} a ${crew.district}.`, district: crew.district, actorNpcIds: [actor.id], crewIds: [crew.id, rival.id] };
  }
  if (tpl.kind === "MISSION") {
    return { body: `${actor.name} termine ${count} missions a ${district}.`, district, actorNpcIds: [actor.id], crewIds: actor.crewId ? [actor.crewId] : [] };
  }
  if (tpl.kind === "WORY") {
    return { body: `${actor.name} depense du Wory chez les commercants de ${district}.`, district, actorNpcIds: [actor.id], crewIds: actor.crewId ? [actor.crewId] : [] };
  }
  return { body: `${district} devient actif grace aux PNJ locaux.`, district, actorNpcIds: [actor.id], crewIds: [] };
}

function makeEvent(
  seed: string,
  now: Date,
  activity: number,
  npcs: NpcState[],
  crews: LivingCityCrew[],
  forceKind?: LivingCityEventKind
): LivingCityEvent {
  const random = rng(hash(seed));
  const templates = eventTemplates();
  const tpl = forceKind
    ? templates.find((item) => item.kind === forceKind) ?? pick(templates, random)
    : pick(templates, random);
  const count = 3 + Math.floor(random() * 18);
  const actor = pick(npcs, random);
  const target = pickDifferentNpc(npcs, actor, random);
  const crew = actor.crewId
    ? crews.find((item) => item.id === actor.crewId) ?? pick(crews, random)
    : pick(crews, random);
  const rivals = crews.filter((item) => item.id !== crew.id);
  const rival = rivals.length > 0 ? pick(rivals, random) : crew;
  const copy = eventCopy(tpl, actor, target, crew, rival, count);
  return {
    id: `lc-${hash(`${seed}:${now.toISOString()}`).toString(36)}`,
    kind: tpl.kind,
    title: tpl.title,
    body: copy.body,
    district: copy.district,
    at: now.toISOString(),
    priority: clamp(tpl.priorityBase + activity / 8 + random() * 12, 0, 100),
    notify: tpl.notify,
    actorNpcIds: copy.actorNpcIds,
    crewIds: copy.crewIds,
  };
}

function notificationKind(kind: LivingCityEventKind): NotificationItem["kind"] {
  if (kind === "SOCIAL") return "social";
  return kind.toLowerCase() as NotificationItem["kind"];
}

function dedupeEvents(events: LivingCityEvent[]): LivingCityEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.kind}:${event.body}:${event.district}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateNpc(npc: NpcState, minutes: number, now: Date, playerDistrict: string): NpcState {
  const random = rng(hash(`${npc.id}:${Math.floor(now.getTime() / 60000)}`));
  const archetypes = (npc.personality ?? "social/balanced").split("/");
  const level: LivingCityLevel =
    npc.homeDistrictSlug === playerDistrict ? "NEAR_PLAYER" :
    random() > 0.6 ? "ACTIVE_DISTRICT" : "OFFSCREEN";
  const routineAction = activityFor(hourPhase(now.getHours()), archetypes, random);
  const npcContext: NpcContext = {
    hour: now.getHours(),
    districtActivity: level === "NEAR_PLAYER" ? 82 : level === "ACTIVE_DISTRICT" ? 58 : 24,
    nearbyPeople: level === "NEAR_PLAYER" ? 3 : level === "ACTIVE_DISTRICT" ? 1 : 0,
    hasCrewOpportunity: Boolean(npc.crewId) && level !== "OFFSCREEN",
    hasDatingOpportunity: level === "NEAR_PLAYER" && random() > 0.45,
    hasSocialOpportunity: level !== "OFFSCREEN",
  };
  const intent = chooseNpcAction(npc, npcContext, now);
  const action = avatarActionForIntent(intent.intent, routineAction);
  const currentActivity = currentActivityForIntent(intent.intent, action);
  const detailFactor = level === "NEAR_PLAYER" ? 1 : level === "ACTIVE_DISTRICT" ? 0.55 : 0.18;
  const delta = Math.min(8, Math.max(0.2, minutes / 10)) * detailFactor;
  const locationSlug = locationFor(action, npc.homeDistrictSlug ?? playerDistrict, random);
  return {
    ...npc,
    action,
    currentActivity,
    locationSlug,
    mood: Math.round(clamp(npc.mood + (action === "chatting" ? 3 : action === "sleeping" ? 1 : 0) * delta - 0.4)),
    energy: Math.round(clamp(npc.energy + (action === "sleeping" ? 8 : -1.3) * delta)),
    hunger: Math.round(clamp(npc.hunger + (action === "eating" ? -9 : 1.4) * delta)),
    stress: Math.round(clamp(npc.stress + (action === "working" ? 2 : -1) * delta)),
    money: Math.max(0, Math.round(npc.money + (action === "working" ? 8 : action === "eating" || action === "chatting" ? -2 : 0) * delta)),
    npcWory: Math.max(0, Math.round((npc.npcWory ?? npc.money) + (action === "working" ? 4 : action === "chatting" ? -1 : 0) * delta)),
    xp: npc.xp + Math.round((action === "working" ? 5 : action === "exercising" ? 4 : 2) * delta),
    level: Math.max(1, Math.floor((npc.xp + Math.round(delta * 4)) / 100) + 1),
    posX: Math.round(clamp(npc.posX + (random() * 10 - 5) * detailFactor, 4, 96)),
    posY: Math.round(clamp(npc.posY + (random() * 10 - 5) * detailFactor, 4, 96)),
    presenceOnline: action !== "sleeping" && random() > (level === "OFFSCREEN" ? 0.62 : 0.28),
    lastOnlineAt: action !== "sleeping" ? now.toISOString() : npc.lastOnlineAt,
    lastTickAt: now.toISOString(),
  };
}

function pushMemory(npc: NpcState, line: string): string[] {
  return [line, ...(npc.relationMemory ?? [])].slice(0, 8);
}

function applyEventEffectsToNpcs(npcs: NpcState[], events: LivingCityEvent[], crews: LivingCityCrew[], now: Date): NpcState[] {
  const crewById = new Map(crews.map((crew) => [crew.id, crew]));
  const mutable = new Map(npcs.map((npc) => [npc.id, npc]));

  for (const event of events) {
    const [actorId, targetId] = event.actorNpcIds;
    const actor = actorId ? mutable.get(actorId) : undefined;
    const target = targetId ? mutable.get(targetId) : undefined;
    if (!actor) continue;

    if (event.kind === "FEELING" || event.kind === "MATCH" || event.kind === "RELATIONSHIP" || event.kind === "OUTING" || event.kind === "EVENT") {
      mutable.set(actor.id, {
        ...actor,
        mood: Math.round(clamp(actor.mood + 3)),
        sociability: Math.round(clamp((actor.sociability ?? 50) + 2)),
        relationMemory: pushMemory(actor, `${event.kind}:${target?.name ?? "ville"}:${now.toISOString()}`),
        lastMessageAt: now.toISOString(),
      });
      if (target) {
        mutable.set(target.id, {
          ...target,
          mood: Math.round(clamp(target.mood + 2)),
          sociability: Math.round(clamp((target.sociability ?? 50) + 2)),
          relationMemory: pushMemory(target, `${event.kind}:${actor.name}:${now.toISOString()}`),
          lastMessageAt: now.toISOString(),
        });
      }
    }

    if (event.kind === "CREW") {
      const crew = event.crewIds[0] ? crewById.get(event.crewIds[0]) : undefined;
      if (crew) {
        mutable.set(actor.id, {
          ...actor,
          crewId: crew.id,
          crewName: crew.name,
          crewTag: crew.tag,
          reputation: Math.round(clamp(actor.reputation + 2)),
          relationMemory: pushMemory(actor, `CREW:${crew.name}:${now.toISOString()}`),
        });
      }
    }

    if (event.kind === "MISSION" || event.kind === "WORY") {
      mutable.set(actor.id, {
        ...actor,
        xp: actor.xp + (event.kind === "MISSION" ? 12 : 3),
        npcWory: Math.max(0, (actor.npcWory ?? actor.money) + (event.kind === "MISSION" ? 8 : -4)),
      });
    }
  }

  return npcs.map((npc) => mutable.get(npc.id) ?? npc);
}

function advanceCrews(crews: LivingCityCrew[], events: LivingCityEvent[]): LivingCityCrew[] {
  const pressure = new Map<string, number>();
  for (const event of events) {
    if (event.kind !== "CREW" && event.kind !== "TERRITORY" && event.kind !== "BATTLE") continue;
    for (const crewId of event.crewIds) {
      pressure.set(crewId, (pressure.get(crewId) ?? 0) + (event.kind === "BATTLE" ? 3 : 1));
    }
  }
  if (pressure.size === 0) return crews;
  return crews.map((crew) => {
    const value = pressure.get(crew.id) ?? 0;
    return value === 0
      ? crew
      : {
          ...crew,
          activity: Math.round(clamp(crew.activity + value, 0, 100)),
          reputation: Math.round(clamp(crew.reputation + value / 2, 0, 100)),
        };
  });
}

export function simulateLivingCityTick(input: LivingCityTickInput): LivingCityTickResult {
  const started = Date.now();
  const now = input.now ?? new Date();
  const state = input.state.enabled ? input.state : { ...input.state, lastSimulatedAt: now.toISOString() };
  const previous = state.lastSimulatedAt ? new Date(state.lastSimulatedAt) : new Date(now.getTime() - 10 * 60_000);
  const elapsedMinutes = input.forceMinutes ?? Math.max(1, Math.round((now.getTime() - previous.getTime()) / 60000));
  const simulatedMinutes = Math.min(24 * 60, elapsedMinutes * state.speed);
  const population = Math.max(input.npcs.length, populationForPreset(state.preset));
  const activity = Math.round(population * (hourPhase(now.getHours()) === "evening" ? 0.68 : hourPhase(now.getHours()) === "night" ? 0.24 : 0.48));
  const playerDistrict = input.playerDistrict ?? "Capitole";

  const baseNpcs = input.npcs.length >= population ? input.npcs : [
    ...input.npcs,
    ...seedLivingCityNpcs(state.preset, now).slice(input.npcs.length, population),
  ];
  const stride = state.preset === "CHAOS" ? 4 : state.preset === "BUSY" ? 2 : 1;
  const npcs = baseNpcs.map((npc, index) =>
    index % stride === state.tick % stride ? updateNpc(npc, simulatedMinutes, now, playerDistrict) : npc
  );

  const eventBudget = Math.max(1, Math.min(8, Math.round(simulatedMinutes / 18) + (population >= 250 ? 2 : 0)));
  const rawEvents: LivingCityEvent[] = [];
  const activeCrews = (state.crews?.length ?? 0) > 0 ? state.crews : DEFAULT_LIVING_CITY_CREWS;
  for (let i = 0; i < eventBudget; i++) {
    rawEvents.push(makeEvent(
      `${state.tick}:${i}:${population}:${now.toDateString()}:${input.forceKind ?? "auto"}`,
      new Date(now.getTime() - i * 7 * 60000),
      activity,
      npcs,
      activeCrews,
      i === 0 ? input.forceKind : undefined
    ));
  }
  const effectedNpcs = applyEventEffectsToNpcs(npcs, rawEvents, activeCrews, now);
  const crews = advanceCrews(activeCrews, rawEvents);
  const events = dedupeEvents([...rawEvents, ...state.events]).slice(0, 60);
  const notifyEvents = rawEvents
    .filter((event) => event.notify && event.priority >= 65)
    .slice(0, state.preset === "LOW" ? 1 : 2);

  const feed: LifeFeedItem[] = rawEvents.slice(0, 6).map((event) => ({
    id: event.id,
    title: event.title,
    body: `${event.district} - ${event.body}`,
    createdAt: event.at,
  }));

  const notifications: NotificationItem[] = notifyEvents.map((event) => ({
    id: `notif-${event.id}`,
    kind: notificationKind(event.kind),
    title: event.title,
    body: event.body,
    createdAt: event.at,
    read: false,
  }));

  const absenceSummary = elapsedMinutes >= 45
    ? rawEvents.slice(0, 5).map((event) => `${event.district}: ${event.body}`)
    : state.lastAbsenceSummary;
  const duration = Math.max(1, Date.now() - started);
  const avgTickMs = state.avgTickMs === 0 ? duration : Math.round(state.avgTickMs * 0.75 + duration * 0.25);

  return {
    state: {
      ...state,
      crews,
      events,
      lastSimulatedAt: now.toISOString(),
      tick: state.tick + 1,
      notificationsLastMinute: notifications.length,
      avgTickMs,
      lastAbsenceSummary: absenceSummary,
      npcInteractionsLastTick: rawEvents.filter((event) => event.actorNpcIds.length > 1).length,
      outingsLastTick: rawEvents.filter((event) => event.kind === "OUTING" || event.kind === "EVENT").length,
      territorySignalsLastTick: rawEvents.filter((event) => event.kind === "TERRITORY" || event.kind === "BATTLE").length,
    },
    npcs: effectedNpcs,
    feed,
    notifications,
  };
}
