/**
 * NPC Brain — IA autonome des personnages
 *
 * Chaque NPC a 7 besoins (mood, energy, hunger, stress, hygiene, money, xp).
 * Tick toutes les 30s : décide action → lieu → met à jour stats → gagne XP/money.
 * Personnalités Sims : faim → market, énergie basse → home, sociable → café/parc.
 */

import type { AvatarAction } from "@/lib/avatar-visual";
import { starterResidents } from "@/lib/game-data";
import type { NpcState } from "@/lib/types";

// ─── Coordonnées des lieux ────────────────────────────────────────────────────
export const LOCATION_COORDS: Record<string, { posX: number; posY: number }> = {
  "home":       { posX: 15, posY: 20 },
  "market":     { posX: 30, posY: 15 },
  "cafe":       { posX: 50, posY: 30 },
  "office":     { posX: 70, posY: 20 },
  "park":       { posX: 25, posY: 60 },
  "gym":        { posX: 45, posY: 65 },
  "restaurant": { posX: 70, posY: 55 },
  "cinema":     { posX: 82, posY: 40 }
};

const LOCATIONS = Object.keys(LOCATION_COORDS);

// XP gagné par action NPC
const NPC_XP_TABLE: Record<string, number> = {
  working:    20,
  exercising: 15,
  chatting:   8,
  eating:     4,
  sleeping:   3,
  walking:    5,
  idle:       1,
  studying:   12,
  cooking:    6,
  reading:    8,
};

// Personnalités → préférences de lieux
const NPC_PREFERENCES: Record<string, string[]> = {
  ava:   ["cafe", "restaurant", "park"],
  malik: ["office", "cafe", "cinema"],
  noa:   ["cafe", "cinema", "park"],
  leila: ["park", "gym", "home"],
  yan:   ["office", "gym", "restaurant"],
  sana:  ["gym", "park", "home"],
};

// ─── Décision d'action selon besoins ─────────────────────────────────────────
function decideAction(npc: NpcState): { action: AvatarAction; locationSlug: string } {
  const { mood, energy, hunger, stress, hygiene } = npc;
  const prefs = NPC_PREFERENCES[npc.id] ?? ["cafe", "park"];

  // Besoins critiques d'abord
  if (energy < 20)  return { action: "sleeping",   locationSlug: "home" };
  if (hunger > 75)  return { action: "eating",     locationSlug: Math.random() > 0.5 ? "market" : "restaurant" };
  if (stress > 80)  return { action: "sleeping",   locationSlug: "home" };
  if (hygiene < 20) return { action: "idle",       locationSlug: "home" };

  // Besoins moyens
  if (hunger > 50)  return { action: "eating",     locationSlug: "market" };
  if (energy < 40)  return { action: "sleeping",   locationSlug: "home" };

  // Comportement social / actif
  if (mood > 65 && energy > 55) {
    const socialLoc = prefs[Math.floor(Math.random() * prefs.length)];
    const socialActions: Record<string, AvatarAction> = {
      cafe: "chatting", restaurant: "eating", cinema: "idle", park: "walking", gym: "exercising"
    };
    return { action: socialActions[socialLoc] ?? "chatting", locationSlug: socialLoc };
  }

  if (energy > 50 && mood > 45) {
    const activeLoc = prefs.includes("gym") ? "gym" : "park";
    return { action: "exercising", locationSlug: activeLoc };
  }

  // Travailler si énergie suffisante
  if (energy > 35 && mood > 30 && Math.random() < 0.35) {
    return { action: "working" as AvatarAction, locationSlug: "office" };
  }

  // Random walk
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

  // ── Decay naturel ─────────────────────────────────────────────────────────
  let energy  = Math.max(0, npc.energy  - rate * 3);
  let mood    = Math.max(0, npc.mood    - rate * 1.5);
  let hunger  = Math.min(100, npc.hunger  + rate * 4);  // faim monte
  let stress  = Math.min(100, npc.stress  + rate * 1);
  let hygiene = Math.max(0, npc.hygiene - rate * 0.8);

  // ── Regain selon action actuelle ──────────────────────────────────────────
  switch (npc.action) {
    case "sleeping":
      energy  = Math.min(100, energy  + rate * 14);
      mood    = Math.min(100, mood    + rate * 5);
      stress  = Math.max(0,   stress  - rate * 6);
      hunger  = Math.min(100, hunger  + rate * 2); // on a faim en dormant
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
    case "idle":
      energy  = Math.min(100, energy  + rate * 2);
      stress  = Math.max(0,   stress  - rate * 1);
      break;
  }

  // ── XP & money ────────────────────────────────────────────────────────────
  const xpGain   = NPC_XP_TABLE[npc.action] ?? 1;
  const newXp    = npc.xp + Math.round(xpGain * rate * 2);
  const XP_PER_LEVEL = 100;
  const newLevel = Math.max(1, Math.floor(newXp / XP_PER_LEVEL) + 1);

  let money = npc.money;
  if (npc.action === "working")  money = Math.min(9999, money + Math.round(rate * 18));
  if (npc.action === "eating")   money = Math.max(0,    money - Math.round(rate * 6));
  if (npc.action === "chatting") money = Math.max(0,    money - Math.round(rate * 2));

  // ── Réputation (progresse avec niveau) ───────────────────────────────────
  const reputation = Math.min(100, npc.reputation + (newLevel > npc.level ? 3 : 0));

  // ── Streak (incrément si actif aujourd'hui) ───────────────────────────────
  const streak = npc.streak + (Math.random() < 0.01 ? 1 : 0); // ~1% par tick

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
    energy:  Math.round(Math.max(0, Math.min(100, energy))),
    mood:    Math.round(Math.max(0, Math.min(100, mood))),
    hunger:  Math.round(Math.max(0, Math.min(100, hunger))),
    stress:  Math.round(Math.max(0, Math.min(100, stress))),
    hygiene: Math.round(Math.max(0, Math.min(100, hygiene))),
    money:   Math.round(money),
    xp:      newXp,
    level:   newLevel,
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
    const baseLevel = Math.floor(i / 2) + 1; // 1, 1, 2, 2, 3, 3
    const baseXp    = (baseLevel - 1) * 100 + Math.floor(Math.random() * 60);
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
      money:         r.reputation * 2 + Math.floor(Math.random() * 80),
      xp:            baseXp,
      level:         baseLevel,
      reputation:    r.reputation,
      streak:        Math.floor(Math.random() * 7),
      lastTickAt:    now,
      lastMessageAt: null,
      lastInviteAt:  null,
      posX:          coords.posX + Math.random() * 4 - 2,
      posY:          coords.posY + Math.random() * 4 - 2,
    };
  });
}

// ─── Tick de tous les NPC ─────────────────────────────────────────────────────
export function tickAllNpcs(npcs: NpcState[]): NpcState[] {
  return npcs.map(tickNpc);
}
