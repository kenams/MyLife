import type { AvatarAction } from "@/lib/avatar-visual";
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
  | "MISSION"
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

function eventTemplates(): Array<Omit<LivingCityEvent, "id" | "at" | "priority"> & { priorityBase: number }> {
  return [
    { kind: "CITY", title: "Toulouse Live", body: "Jean-Jaures devient actif", district: "Jean-Jaures", notify: false, priorityBase: 34 },
    { kind: "CREW", title: "Crew", body: "Wolves recrutent de nouveaux profils", district: "Compans", notify: true, priorityBase: 68 },
    { kind: "MISSION", title: "Missions", body: "missions terminees a Capitole", district: "Capitole", notify: false, priorityBase: 45 },
    { kind: "TERRITORY", title: "Territoires", body: "Kings mettent la pression sur Saint-Cyprien", district: "Saint-Cyprien", notify: true, priorityBase: 72 },
    { kind: "SOCIAL", title: "Social", body: "activite sociale en hausse aux Carmes", district: "Carmes", notify: false, priorityBase: 40 },
    { kind: "FEELING", title: "Feeling", body: "Quelqu'un t'a envoye un Feeling", district: "Esquirol", notify: true, priorityBase: 80 },
    { kind: "RELATIONSHIP", title: "Relation", body: "Lina a relance une ancienne discussion", district: "Capitole", notify: true, priorityBase: 74 },
    { kind: "EVENT", title: "Sortie", body: "Mehdi invite du monde a une sortie", district: "Saint-Aubin", notify: true, priorityBase: 65 },
    { kind: "WORY", title: "Wory", body: "des PNJ depensent du Wory en ville", district: "Carmes", notify: false, priorityBase: 38 },
  ];
}

function makeEvent(seed: string, now: Date, activity: number, forceKind?: LivingCityEventKind): LivingCityEvent {
  const random = rng(hash(seed));
  const templates = eventTemplates();
  const tpl = forceKind
    ? templates.find((item) => item.kind === forceKind) ?? pick(templates, random)
    : pick(templates, random);
  const count = 3 + Math.floor(random() * 18);
  const body = tpl.kind === "MISSION" ? `${count} ${tpl.body}` : tpl.body;
  return {
    id: `lc-${hash(`${seed}:${now.toISOString()}`).toString(36)}`,
    kind: tpl.kind,
    title: tpl.title,
    body,
    district: tpl.district,
    at: now.toISOString(),
    priority: clamp(tpl.priorityBase + activity / 8 + random() * 12, 0, 100),
    notify: tpl.notify,
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
  const action = activityFor(hourPhase(now.getHours()), archetypes, random);
  const detailFactor = level === "NEAR_PLAYER" ? 1 : level === "ACTIVE_DISTRICT" ? 0.55 : 0.18;
  const delta = Math.min(8, Math.max(0.2, minutes / 10)) * detailFactor;
  const locationSlug = locationFor(action, npc.homeDistrictSlug ?? playerDistrict, random);
  return {
    ...npc,
    action,
    currentActivity: action,
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
  for (let i = 0; i < eventBudget; i++) {
    rawEvents.push(makeEvent(
      `${state.tick}:${i}:${population}:${now.toDateString()}:${input.forceKind ?? "auto"}`,
      new Date(now.getTime() - i * 7 * 60000),
      activity,
      i === 0 ? input.forceKind : undefined
    ));
  }
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
      events,
      lastSimulatedAt: now.toISOString(),
      tick: state.tick + 1,
      notificationsLastMinute: notifications.length,
      avgTickMs,
      lastAbsenceSummary: absenceSummary,
    },
    npcs,
    feed,
    notifications,
  };
}
