/**
 * NPC Brain — IA autonome des personnages non-joueurs
 *
 * Chaque NPC a des besoins qui évoluent dans le temps.
 * Toutes les 30 secondes, le moteur "tick" décide d'une action
 * basée sur les besoins les plus critiques.
 *
 * Le comportement ressemble à celui des Sims :
 * - Faim haute → cherche de la nourriture
 * - Énergie basse → dort ou se repose
 * - Sociabilité basse → va dans un lieu social
 * - Bien dans sa peau → activité de loisir
 */

import type { AvatarAction } from "@/lib/avatar-visual";
import { starterResidents } from "@/lib/game-data";
import type { NpcState } from "@/lib/types";

// ─── Lieux et leurs coordonnées sur la carte 2D (0-100) ───────────────────────
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

// ─── Décision d'action selon les besoins ─────────────────────────────────────
function decideAction(npc: NpcState): { action: AvatarAction; locationSlug: string } {
  const { mood, energy } = npc;

  if (energy < 25) return { action: "sleeping", locationSlug: "home" };
  if (mood < 25)   return { action: "eating",   locationSlug: "market" };
  if (mood > 70 && energy > 60) {
    const social = ["cafe", "restaurant", "cinema"];
    return { action: "chatting", locationSlug: social[Math.floor(Math.random() * social.length)] };
  }
  if (energy > 50 && mood > 50) {
    const active = ["gym", "park"];
    return { action: "exercising", locationSlug: active[Math.floor(Math.random() * active.length)] };
  }
  if (Math.random() < 0.2) return { action: "walking", locationSlug: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)] };

  return { action: "idle", locationSlug: npc.locationSlug };
}

// ─── Tick NPC (30s) ───────────────────────────────────────────────────────────
export function tickNpc(npc: NpcState): NpcState {
  const now = new Date().toISOString();
  const msSinceTick = new Date(now).getTime() - new Date(npc.lastTickAt).getTime();
  const secondsSince = msSinceTick / 1000;

  // Decay naturel (comme le joueur)
  const decayRate = secondsSince / 120; // base : -1 toutes les 2 min
  let energy = Math.max(0, npc.energy - decayRate * 4);
  let mood   = Math.max(0, npc.mood   - decayRate * 2);

  // Regain selon l'action courante
  if (npc.action === "sleeping")   { energy = Math.min(100, energy + decayRate * 12); mood = Math.min(100, mood + decayRate * 4); }
  if (npc.action === "eating")     { mood = Math.min(100, mood + decayRate * 8); energy = Math.min(100, energy + decayRate * 3); }
  if (npc.action === "chatting")   { mood = Math.min(100, mood + decayRate * 6); }
  if (npc.action === "exercising") { energy = Math.max(0, energy - decayRate * 2); mood = Math.min(100, mood + decayRate * 5); }

  const { action, locationSlug } = decideAction({ ...npc, energy, mood });
  const coords = LOCATION_COORDS[locationSlug] ?? LOCATION_COORDS["cafe"];

  // Légère variation de position dans le lieu
  const jitter = 4;
  const posX = Math.max(0, Math.min(100, coords.posX + (Math.random() * jitter * 2 - jitter)));
  const posY = Math.max(0, Math.min(100, coords.posY + (Math.random() * jitter * 2 - jitter)));

  return {
    ...npc,
    energy,
    mood,
    action,
    locationSlug,
    posX,
    posY,
    lastTickAt: now
  };
}

// ─── Seed initial des NPC depuis les résidents ────────────────────────────────
export function seedNpcs(): NpcState[] {
  const now = new Date().toISOString();
  return starterResidents.map((r, i) => {
    const locationKeys = Object.keys(LOCATION_COORDS);
    const locSlug = locationKeys[i % locationKeys.length];
    const coords = LOCATION_COORDS[locSlug];
    return {
      id:           r.id,
      name:         r.name,
      locationSlug: locSlug,
      action:       "idle" as AvatarAction,
      mood:         50 + Math.random() * 40,
      energy:       40 + Math.random() * 50,
      lastTickAt:   now,
      posX:         coords.posX + Math.random() * 4 - 2,
      posY:         coords.posY + Math.random() * 4 - 2
    };
  });
}

// ─── Tick de tous les NPC ─────────────────────────────────────────────────────
export function tickAllNpcs(npcs: NpcState[]): NpcState[] {
  return npcs.map(tickNpc);
}
