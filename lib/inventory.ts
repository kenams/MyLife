/**
 * Inventory & Shop — Items consommables + cosmétiques.
 * Achat avec crédits, effets immédiats sur les stats.
 */

import type { AvatarStats } from "@/lib/types";

export type ItemCategory = "food" | "drink" | "care" | "boost" | "cosmetic";

export type ShopItem = {
  id: string;
  name: string;
  emoji: string;
  category: ItemCategory;
  description: string;
  price: number;
  maxStack: number;
  locationSlugs: string[];   // lieux où cet item est disponible (vide = partout)
  effects: Partial<{
    hunger: number;
    hydration: number;
    energy: number;
    hygiene: number;
    mood: number;
    stress: number;
    health: number;
    fitness: number;
    sociability: number;
    money: number;
    reputation: number;
    discipline: number;
  }>;
};

export type InventoryItem = {
  itemId: string;
  quantity: number;
  acquiredAt: string;
};

export const SHOP_ITEMS: ShopItem[] = [
  // ── Nourriture ───────────────────────────────────────────────────────────────
  {
    id: "espresso",
    name: "Espresso",
    emoji: "☕",
    category: "drink",
    description: "Un café serré. Boost rapide d'énergie et de concentration.",
    price: 5,
    maxStack: 10,
    locationSlugs: ["cafe", "restaurant", "rooftop-bar"],
    effects: { energy: 12, mood: 8, stress: -5 },
  },
  {
    id: "energy-drink",
    name: "Boisson énergie",
    emoji: "⚡",
    category: "drink",
    description: "Boost intense mais de courte durée. -santé sur le long terme.",
    price: 8,
    maxStack: 5,
    locationSlugs: ["market", "gym", "nightclub"],
    effects: { energy: 28, mood: 5, stress: 5, health: -3 },
  },
  {
    id: "healthy-smoothie",
    name: "Smoothie santé",
    emoji: "🥤",
    category: "drink",
    description: "Mélange de fruits frais. Bonne humeur et vitalité.",
    price: 10,
    maxStack: 8,
    locationSlugs: ["cafe", "gym", "park"],
    effects: { hunger: 15, hydration: 20, health: 8, mood: 6 },
  },
  {
    id: "sandwich",
    name: "Sandwich",
    emoji: "🥪",
    category: "food",
    description: "Repas simple et rapide. Soulage la faim en déplacement.",
    price: 8,
    maxStack: 10,
    locationSlugs: ["market", "cafe", "park"],
    effects: { hunger: 30, energy: 5 },
  },
  {
    id: "bento",
    name: "Bento premium",
    emoji: "🍱",
    category: "food",
    description: "Repas équilibré et copieux. Rassasie pour longtemps.",
    price: 14,
    maxStack: 8,
    locationSlugs: ["restaurant", "market"],
    effects: { hunger: 45, health: 5, mood: 8, energy: 8 },
  },
  {
    id: "protein-bar",
    name: "Barre protéinée",
    emoji: "💪",
    category: "food",
    description: "Parfait après le sport. Récupération et énergie.",
    price: 7,
    maxStack: 10,
    locationSlugs: ["gym", "market"],
    effects: { hunger: 18, fitness: 5, energy: 10 },
  },
  {
    id: "cocktail",
    name: "Cocktail premium",
    emoji: "🍹",
    category: "drink",
    description: "Une soirée de qualité commence toujours avec un bon verre.",
    price: 18,
    maxStack: 5,
    locationSlugs: ["nightclub", "rooftop-bar", "restaurant"],
    effects: { mood: 20, sociability: 15, stress: -10, health: -2 },
  },
  // ── Soin ─────────────────────────────────────────────────────────────────────
  {
    id: "hygiene-kit",
    name: "Kit hygiène",
    emoji: "🧴",
    category: "care",
    description: "Gel, déodorant, soin. Hygiène remise à niveau rapidement.",
    price: 12,
    maxStack: 5,
    locationSlugs: ["market", "spa"],
    effects: { hygiene: 30, mood: 5, reputation: 3 },
  },
  {
    id: "spa-session",
    name: "Session spa",
    emoji: "🛁",
    category: "care",
    description: "1h de relaxation totale. Stress en chute libre.",
    price: 30,
    maxStack: 3,
    locationSlugs: ["spa"],
    effects: { stress: -25, mood: 18, hygiene: 20, energy: 12 },
  },
  {
    id: "vitamins",
    name: "Vitamines",
    emoji: "💊",
    category: "care",
    description: "Cure de vitamines. Santé et immunité boostées.",
    price: 15,
    maxStack: 5,
    locationSlugs: ["market", "gym"],
    effects: { health: 15, energy: 8, fitness: 5 },
  },
  // ── Boost ─────────────────────────────────────────────────────────────────────
  {
    id: "motivational-book",
    name: "Livre motivation",
    emoji: "📚",
    category: "boost",
    description: "Un bestseller. +discipline et +motivation.",
    price: 20,
    maxStack: 3,
    locationSlugs: ["library", "market"],
    effects: { discipline: 12, mood: 8, stress: -5 },
  },
  {
    id: "networking-event",
    name: "Pass networking",
    emoji: "🤝",
    category: "boost",
    description: "Accès à un event pro. Réputation et contacts boostés.",
    price: 25,
    maxStack: 3,
    locationSlugs: ["startup", "office"],
    effects: { sociability: 20, reputation: 12, discipline: 5 },
  },
  {
    id: "gym-pass",
    name: "Gym pass mensuel",
    emoji: "🏋️",
    category: "boost",
    description: "Accès illimité à la salle. Fitness et discipline en hausse.",
    price: 40,
    maxStack: 2,
    locationSlugs: ["gym"],
    effects: { fitness: 20, discipline: 10, health: 8 },
  },
  // ── Cosmétique ────────────────────────────────────────────────────────────────
  {
    id: "outfit-casual",
    name: "Tenue casual",
    emoji: "👕",
    category: "cosmetic",
    description: "Style décontracté mais propre. +humeur +image.",
    price: 35,
    maxStack: 1,
    locationSlugs: ["market"],
    effects: { mood: 10, reputation: 5 },
  },
  {
    id: "outfit-premium",
    name: "Tenue premium",
    emoji: "👔",
    category: "cosmetic",
    description: "Style sharp. Réputation et attractivité améliorées.",
    price: 80,
    maxStack: 1,
    locationSlugs: ["market", "startup"],
    effects: { reputation: 15, mood: 12, sociability: 8 },
  },
  {
    id: "fragrance",
    name: "Parfum de luxe",
    emoji: "💐",
    category: "cosmetic",
    description: "Séduction et confiance. Bonus dans les lieux sociaux.",
    price: 45,
    maxStack: 2,
    locationSlugs: ["market", "spa"],
    effects: { sociability: 12, mood: 8, reputation: 8 },
  },
];

export function getShopItemsByLocation(locationSlug: string): ShopItem[] {
  return SHOP_ITEMS.filter(
    (item) => item.locationSlugs.length === 0 || item.locationSlugs.includes(locationSlug)
  );
}

export function applyItemEffect(item: ShopItem, stats: AvatarStats): AvatarStats {
  const { effects } = item;
  return {
    ...stats,
    hunger:       Math.max(0, Math.min(100, stats.hunger       + (effects.hunger       ?? 0))),
    hydration:    Math.max(0, Math.min(100, stats.hydration    + (effects.hydration    ?? 0))),
    energy:       Math.max(0, Math.min(100, stats.energy       + (effects.energy       ?? 0))),
    hygiene:      Math.max(0, Math.min(100, stats.hygiene      + (effects.hygiene      ?? 0))),
    mood:         Math.max(0, Math.min(100, stats.mood         + (effects.mood         ?? 0))),
    stress:       Math.max(0, Math.min(100, stats.stress       + (effects.stress       ?? 0))),
    health:       Math.max(0, Math.min(100, stats.health       + (effects.health       ?? 0))),
    fitness:      Math.max(0, Math.min(100, stats.fitness      + (effects.fitness      ?? 0))),
    sociability:  Math.max(0, Math.min(100, stats.sociability  + (effects.sociability  ?? 0))),
    reputation:   Math.max(0, Math.min(100, stats.reputation   + (effects.reputation   ?? 0))),
    discipline:   Math.max(0, Math.min(100, stats.discipline   + (effects.discipline   ?? 0))),
    money:        Math.max(0, stats.money + (effects.money ?? 0)),
  };
}

export function getItemById(itemId: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === itemId);
}
