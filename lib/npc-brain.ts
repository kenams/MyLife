/**
 * NPC Brain — IA autonome des personnages
 *
 * Tick toutes les 30s : décide action → lieu → met à jour stats → gagne/dépense argent.
 * Économie réelle : travail = revenu, nourriture/sorties = dépenses, niveau de vie adaptatif.
 */

import type { AvatarAction } from "@/lib/avatar-visual";
import { starterResidents } from "@/lib/game-data";
import type { NpcState } from "@/lib/types";

// ─── Coordonnées des lieux (grille urbaine) ───────────────────────────────────
export const LOCATION_COORDS: Record<string, { posX: number; posY: number }> = {
  "home":               { posX: 18, posY: 15 },
  "library":            { posX: 47, posY: 13 },
  "cafe":               { posX: 78, posY: 22 },
  "park":               { posX: 18, posY: 44 },
  "office":             { posX: 50, posY: 47 },
  "cinema":             { posX: 87, posY: 50 },
  "market":             { posX: 15, posY: 70 },
  "gym":                { posX: 86, posY: 72 },
  "restaurant":         { posX: 60, posY: 78 },
  "residence-populaire":{ posX: 14, posY: 84 },
  "residence-confort":  { posX: 47, posY: 84 },
  "residence-luxe":     { posX: 83, posY: 84 },
  "nightclub":          { posX: 12, posY: 91 },
  "spa":                { posX: 36, posY: 91 },
  "startup":            { posX: 60, posY: 91 },
  "rooftop-bar":        { posX: 84, posY: 91 },
};

const LOCATIONS = Object.keys(LOCATION_COORDS);

// ─── XP par action ────────────────────────────────────────────────────────────
const NPC_XP_TABLE: Record<string, number> = {
  working: 20, exercising: 15, chatting: 8, eating: 4,
  sleeping: 3, walking: 5, idle: 1, waving: 4,
};

// ─── Préférences de lieux par NPC ────────────────────────────────────────────
const NPC_PREFERENCES: Record<string, string[]> = {
  ava:   ["cafe", "restaurant", "rooftop-bar", "park", "market"],
  malik: ["office", "startup", "cafe", "nightclub", "cinema"],
  noa:   ["cafe", "cinema", "nightclub", "rooftop-bar", "park"],
  leila: ["park", "spa", "gym", "library", "cafe"],
  yan:   ["office", "startup", "gym", "restaurant", "cafe"],
  sana:  ["spa", "gym", "library", "park", "home"],
};

// ─── Économie : revenus et coûts ──────────────────────────────────────────────
// Gains (par tick de ~30s, rate = 1 pour tick normal)
const WORK_EARN: Record<string, number> = {
  office:  22,   // travail régulier
  startup: 28,   // startup = plus risqué mais plus rémunérateur
  library: 10,   // étude = XP mais peu d'argent
  gym:     0,    // aucun revenu
  park:    0,
  market:  0,
  cafe:    0,
};

// Coûts (dépensés quand action = eating ou lieu premium)
const LOCATION_COST: Record<string, number> = {
  restaurant:  12,  // cher
  nightclub:   10,  // cher
  "rooftop-bar": 9, // premium
  spa:          8,  // premium
  cafe:         4,  // modéré
  cinema:       5,  // modéré
  gym:          5,  // modéré
  market:       3,  // économique
  home:         0,
  park:         0,
  library:      0,
  office:       0,
  startup:      0,
};

// ─── Décision d'action selon besoins et argent ────────────────────────────────
function decideAction(npc: NpcState): { action: AvatarAction; locationSlug: string } {
  const { mood, energy, hunger, stress, hygiene, money } = npc;
  const prefs = NPC_PREFERENCES[npc.id] ?? ["cafe", "park"];
  const isRich = money >= 200;
  const isFlat = money <= 20;

  // Besoins critiques
  if (energy < 20)  return { action: "sleeping",   locationSlug: "home" };
  if (hunger > 75) {
    // si fauché → marché (moins cher), sinon selon préférences
    const foodLoc = isFlat ? "market" : (isRich && Math.random() > 0.5 ? "restaurant" : "market");
    return { action: "eating", locationSlug: foodLoc };
  }
  if (stress > 80)  return { action: "sleeping",   locationSlug: "home" };
  if (hygiene < 20) return { action: "idle",       locationSlug: "home" };

  // Besoins moyens
  if (hunger > 50) {
    return { action: "eating", locationSlug: isFlat ? "market" : "market" };
  }
  if (energy < 40)  return { action: "sleeping",   locationSlug: "home" };

  // Si fauché → travailler en priorité
  if (isFlat && energy > 40) {
    return { action: "working", locationSlug: Math.random() > 0.4 ? "office" : "startup" };
  }

  // Comportement social enrichi
  if (mood > 65 && energy > 55) {
    const pool = isRich
      ? prefs.filter((loc) => !["market", "park"].includes(loc)) // les riches évitent les lieux basiques
      : prefs;
    const socialLoc = pool[Math.floor(Math.random() * pool.length)] ?? prefs[0];
    const socialActions: Record<string, AvatarAction> = {
      cafe: "chatting", restaurant: "eating", cinema: "idle",
      park: "walking", gym: "exercising", nightclub: "chatting",
      spa: "idle", library: "idle", startup: "working",
      "rooftop-bar": "chatting", home: "idle",
    };
    return { action: socialActions[socialLoc] ?? "chatting", locationSlug: socialLoc };
  }

  // Activité physique si énergie suffisante
  if (energy > 50 && mood > 45) {
    const fitLoc = prefs.includes("gym") ? "gym" : "park";
    return { action: "exercising", locationSlug: fitLoc };
  }

  // Travailler
  if (energy > 35 && mood > 30 && Math.random() < 0.4) {
    const workLoc = prefs.includes("startup") ? (Math.random() > 0.5 ? "startup" : "office") : "office";
    return { action: "working" as AvatarAction, locationSlug: workLoc };
  }

  // Balade aléatoire
  if (Math.random() < 0.25) {
    return { action: "walking", locationSlug: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)] };
  }

  return { action: "idle", locationSlug: npc.locationSlug };
}

// ─── Tick NPC (30s) ───────────────────────────────────────────────────────────
export function tickNpc(npc: NpcState): NpcState {
  const now     = new Date().toISOString();
  const msSince = new Date(now).getTime() - new Date(npc.lastTickAt).getTime();
  const rate    = Math.min(msSince / 120_000, 3); // base = 1 unité / 2min, cap à 3

  // ── Decay naturel ──────────────────────────────────────────────────────────
  let energy  = Math.max(0, npc.energy  - rate * 3);
  let mood    = Math.max(0, npc.mood    - rate * 1.5);
  let hunger  = Math.min(100, npc.hunger  + rate * 4);
  let stress  = Math.min(100, npc.stress  + rate * 1);
  let hygiene = Math.max(0, npc.hygiene - rate * 0.8);

  // ── Regain selon action ────────────────────────────────────────────────────
  switch (npc.action) {
    case "sleeping":
      energy  = Math.min(100, energy  + rate * 14);
      mood    = Math.min(100, mood    + rate * 5);
      stress  = Math.max(0,   stress  - rate * 6);
      hunger  = Math.min(100, hunger  + rate * 2);
      break;
    case "eating":
      hunger  = Math.max(0,   hunger  - rate * 30);
      mood    = Math.min(100, mood    + rate * 8);
      energy  = Math.min(100, energy  + rate * 3);
      break;
    case "chatting":
      mood    = Math.min(100, mood    + rate * 7);
      stress  = Math.max(0,   stress  - rate * 3);
      energy  = Math.max(0,   energy  - rate * 1);
      break;
    case "exercising":
      energy  = Math.max(0,   energy  - rate * 2);
      mood    = Math.min(100, mood    + rate * 6);
      stress  = Math.max(0,   stress  - rate * 5);
      hunger  = Math.min(100, hunger  + rate * 5);
      break;
    case "walking":
      mood    = Math.min(100, mood    + rate * 3);
      energy  = Math.max(0,   energy  - rate * 1);
      stress  = Math.max(0,   stress  - rate * 2);
      break;
    case "working":
      energy  = Math.max(0,   energy  - rate * 3);
      stress  = Math.min(100, stress  + rate * 3);
      hunger  = Math.min(100, hunger  + rate * 3);
      break;
    case "waving":
      mood    = Math.min(100, mood    + rate * 2);
      break;
    case "idle":
      energy  = Math.min(100, energy  + rate * 2);
      stress  = Math.max(0,   stress  - rate * 1);
      break;
  }

  // ── XP ────────────────────────────────────────────────────────────────────
  const xpGain   = NPC_XP_TABLE[npc.action] ?? 1;
  const newXp    = npc.xp + Math.round(xpGain * rate * 2);
  const XP_PER_LEVEL = 100;
  const newLevel = Math.max(1, Math.floor(newXp / XP_PER_LEVEL) + 1);

  // ── Économie d'argent ─────────────────────────────────────────────────────
  let money = npc.money;

  // Gains au travail (startup > office)
  if (npc.action === "working") {
    const locEarn = WORK_EARN[npc.locationSlug] ?? 18;
    money = Math.min(9999, money + Math.round(locEarn * rate));
  }

  // Dépenses en mangeant (restaurant coûte plus que market)
  if (npc.action === "eating") {
    const locCost = LOCATION_COST[npc.locationSlug] ?? 4;
    money = Math.max(0, money - Math.round(locCost * rate * 1.5));
  }

  // Dépenses dans les lieux premium (chat/sortie)
  if (npc.action === "chatting" || npc.action === "idle") {
    const locCost = LOCATION_COST[npc.locationSlug] ?? 0;
    if (locCost > 0) {
      money = Math.max(0, money - Math.round(locCost * rate * 0.6));
    }
  }

  // Petite économie passive (investment-like) pour les riches
  if (money >= 400 && Math.random() < 0.1) {
    money = Math.min(9999, money + Math.round(money * 0.005));
  }

  // ── Réputation (évolue avec niveau) ───────────────────────────────────────
  const reputation = Math.min(100, npc.reputation + (newLevel > npc.level ? 3 : 0));

  // ── Streak ────────────────────────────────────────────────────────────────
  const streak = npc.streak + (Math.random() < 0.01 ? 1 : 0);

  // ── Décision next action ──────────────────────────────────────────────────
  const { action, locationSlug } = decideAction({
    ...npc, energy, mood, hunger, stress, hygiene, money, xp: newXp, level: newLevel
  });
  const coords = LOCATION_COORDS[locationSlug] ?? LOCATION_COORDS["cafe"];
  const jitter = 4;
  const posX = Math.max(0, Math.min(100, coords.posX + (Math.random() * jitter * 2 - jitter)));
  const posY = Math.max(0, Math.min(100, coords.posY + (Math.random() * jitter * 2 - jitter)));

  return {
    ...npc,
    energy:     Math.round(Math.max(0, Math.min(100, energy))),
    mood:       Math.round(Math.max(0, Math.min(100, mood))),
    hunger:     Math.round(Math.max(0, Math.min(100, hunger))),
    stress:     Math.round(Math.max(0, Math.min(100, stress))),
    hygiene:    Math.round(Math.max(0, Math.min(100, hygiene))),
    money:      Math.round(Math.max(0, money)),
    xp:         newXp,
    level:      newLevel,
    reputation: Math.round(reputation),
    streak,
    action,
    locationSlug,
    posX,
    posY,
    lastTickAt: now,
  };
}

// ─── Seed initial des NPC ─────────────────────────────────────────────────────
export function seedNpcs(): NpcState[] {
  const now = new Date().toISOString();
  return starterResidents.map((r, i) => {
    const locKeys  = Object.keys(LOCATION_COORDS);
    const locSlug  = (NPC_PREFERENCES[r.id] ?? locKeys)[0];
    const coords   = LOCATION_COORDS[locSlug];
    const baseLevel = Math.floor(i / 2) + 1;
    const baseXp    = (baseLevel - 1) * 100 + Math.floor(Math.random() * 60);
    // Argent initial basé sur réputation : les plus connus ont plus d'argent
    const baseMoney = Math.round(r.reputation * 1.8 + Math.random() * 60);
    return {
      id:            r.id,
      name:          r.name,
      locationSlug:  locSlug,
      action:        "idle" as AvatarAction,
      mood:          50 + Math.random() * 35,
      energy:        45 + Math.random() * 40,
      hunger:        15 + Math.random() * 30,
      stress:        10 + Math.random() * 25,
      hygiene:       60 + Math.random() * 30,
      money:         baseMoney,
      xp:            baseXp,
      level:         baseLevel,
      reputation:    r.reputation,
      streak:        Math.floor(Math.random() * 7),
      lastTickAt:      now,
      lastMessageAt:   null,
      lastInviteAt:    null,
      posX:            coords.posX + Math.random() * 4 - 2,
      posY:            coords.posY + Math.random() * 4 - 2,
      presenceOnline:  i % 2 === 0,
      lastOnlineAt:    i % 2 === 0 ? now : null,
    };
  });
}

// ─── Tick de tous les NPC ─────────────────────────────────────────────────────
export function tickAllNpcs(npcs: NpcState[]): NpcState[] {
  return npcs.map(tickNpc);
}
