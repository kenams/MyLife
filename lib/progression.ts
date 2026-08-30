export interface Talent {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: TalentCategory;
  tier: 1 | 2 | 3;
  requires?: string[];
  unlockLevel: number;
  bonus: TalentBonus;
}

export type TalentCategory = "corps" | "esprit" | "social" | "travail";

export interface TalentBonus {
  energyRegen?: number;
  hungerDecay?: number;
  moodBoost?: number;
  xpMultiplier?: number;
  moneyMultiplier?: number;
  socialBoost?: number;
  stressReduction?: number;
  healthBoost?: number;
}

export const TALENTS: Talent[] = [
  // ── Corps ──
  {
    id: "iron-body",
    name: "Corps d'acier",
    description: "-10% perte d'énergie au sport",
    emoji: "💪",
    category: "corps",
    tier: 1,
    unlockLevel: 2,
    bonus: { energyRegen: 0.1 },
  },
  {
    id: "natural-athlete",
    name: "Athlète naturel",
    description: "+20% XP pour les activités physiques",
    emoji: "🏆",
    category: "corps",
    tier: 2,
    requires: ["iron-body"],
    unlockLevel: 5,
    bonus: { xpMultiplier: 0.2 },
  },
  {
    id: "endurance",
    name: "Endurance",
    description: "Énergie -30% moins vite",
    emoji: "🏃",
    category: "corps",
    tier: 3,
    requires: ["natural-athlete"],
    unlockLevel: 10,
    bonus: { energyRegen: 0.3 },
  },
  // ── Esprit ──
  {
    id: "zen-mind",
    name: "Esprit zen",
    description: "-15% stress accumulé",
    emoji: "🧘",
    category: "esprit",
    tier: 1,
    unlockLevel: 3,
    bonus: { stressReduction: 0.15 },
  },
  {
    id: "fast-reader",
    name: "Lecteur rapide",
    description: "+25% XP lecture et études",
    emoji: "📚",
    category: "esprit",
    tier: 2,
    requires: ["zen-mind"],
    unlockLevel: 6,
    bonus: { xpMultiplier: 0.25 },
  },
  {
    id: "philosopher",
    name: "Philosophe",
    description: "+15% humeur passif",
    emoji: "🦉",
    category: "esprit",
    tier: 3,
    requires: ["fast-reader"],
    unlockLevel: 12,
    bonus: { moodBoost: 15 },
  },
  // ── Social ──
  {
    id: "charming",
    name: "Charmeur",
    description: "+10 sociabilité sur chaque interaction",
    emoji: "😎",
    category: "social",
    tier: 1,
    unlockLevel: 2,
    bonus: { socialBoost: 10 },
  },
  {
    id: "networker",
    name: "Networker",
    description: "+20% XP sur les actions sociales",
    emoji: "🤝",
    category: "social",
    tier: 2,
    requires: ["charming"],
    unlockLevel: 7,
    bonus: { xpMultiplier: 0.2 },
  },
  {
    id: "influencer",
    name: "Influenceur",
    description: "+30 réputation passif",
    emoji: "⭐",
    category: "social",
    tier: 3,
    requires: ["networker"],
    unlockLevel: 14,
    bonus: { socialBoost: 30 },
  },
  // ── Travail ──
  {
    id: "hard-worker",
    name: "Bourreau de travail",
    description: "+15% gains d'argent au travail",
    emoji: "💼",
    category: "travail",
    tier: 1,
    unlockLevel: 3,
    bonus: { moneyMultiplier: 0.15 },
  },
  {
    id: "entrepreneur",
    name: "Entrepreneur",
    description: "+25% XP travail",
    emoji: "🚀",
    category: "travail",
    tier: 2,
    requires: ["hard-worker"],
    unlockLevel: 8,
    bonus: { xpMultiplier: 0.25 },
  },
  {
    id: "boss",
    name: "Le Boss",
    description: "+40% salaire et XP travail",
    emoji: "👑",
    category: "travail",
    tier: 3,
    requires: ["entrepreneur"],
    unlockLevel: 15,
    bonus: { moneyMultiplier: 0.4, xpMultiplier: 0.4 },
  },
];

export const LEVEL_MILESTONES: Record<number, string> = {
  1:  "Nouveau joueur",
  5:  "Apprenti",
  10: "Confirmé",
  15: "Expérimenté",
  20: "Vétéran",
  25: "Expert",
  30: "Maître",
  40: "Légende",
  50: "Demi-dieu",
};

export function getLevelTitle(level: number): string {
  const keys = Object.keys(LEVEL_MILESTONES).map(Number).sort((a, b) => b - a);
  for (const k of keys) {
    if (level >= k) return LEVEL_MILESTONES[k];
  }
  return "Nouveau joueur";
}

export function getTalentsForCategory(category: TalentCategory): Talent[] {
  return TALENTS.filter((t) => t.category === category);
}

export function isTalentUnlocked(
  talentId: string,
  unlockedIds: string[],
  playerLevel: number
): boolean {
  const talent = TALENTS.find((t) => t.id === talentId);
  if (!talent) return false;
  if (playerLevel < talent.unlockLevel) return false;
  if (talent.requires && !talent.requires.every((r) => unlockedIds.includes(r))) return false;
  return !unlockedIds.includes(talentId);
}

export function getTalentPoints(playerLevel: number): number {
  return Math.floor(playerLevel / 3);
}

export const PLAYER_XP_PER_LEVEL = 200;

export function getPlayerXpThreshold(playerLevel: number): number {
  return Math.max(0, Math.floor(playerLevel - 1) * PLAYER_XP_PER_LEVEL);
}

export function getPlayerLevelFromXp(playerXp: number): number {
  return Math.max(1, Math.floor(Math.max(0, playerXp) / PLAYER_XP_PER_LEVEL) + 1);
}

// ── Paliers de ville : ce que la progression ouvre dans Toulouse ──
export interface CityUnlock {
  id: string;
  name: string;
  hint: string;
  emoji: string;
  unlockLevel: number;
}

export const CITY_UNLOCKS: CityUnlock[] = [
  { id: "quartiers", name: "Carte des quartiers", hint: "Vois qui bouge autour de toi en temps réel", emoji: "🗺️", unlockLevel: 1 },
  { id: "crew", name: "Crews", hint: "Rejoins ou crée une équipe", emoji: "🤝", unlockLevel: 2 },
  { id: "missions-irl", name: "Missions IRL de saison", hint: "Des objectifs à faire sur le terrain", emoji: "📍", unlockLevel: 3 },
  { id: "rencontres", name: "Rencontres", hint: "Mode Disponible, Feeling, Croisés", emoji: "✨", unlockLevel: 4 },
  { id: "metier", name: "Un vrai métier", hint: "Un job récurrent avec un salaire", emoji: "💼", unlockLevel: 5 },
  { id: "bastion", name: "Bastion de crew", hint: "Ton crew pose son QG sur la carte", emoji: "🏰", unlockLevel: 7 },
  { id: "patrimoine", name: "Patrimoine", hint: "Investir, accumuler, transmettre", emoji: "📈", unlockLevel: 10 },
  { id: "secteurs", name: "Secteurs de la ville", hint: "Des zones à influence longue durée", emoji: "🌆", unlockLevel: 12 },
  { id: "roi", name: "Course au Roi de Toulouse", hint: "Le sommet du classement de la ville", emoji: "👑", unlockLevel: 15 },
];

export function getCityUnlock(id: string): CityUnlock | null {
  return CITY_UNLOCKS.find((unlock) => unlock.id === id) ?? null;
}

export function isCityUnlocked(id: string, playerLevel: number): boolean {
  const unlock = getCityUnlock(id);
  return Boolean(unlock && Number.isFinite(playerLevel) && playerLevel >= unlock.unlockLevel);
}

export function getCrewAccess(playerLevel: number, hasExistingCrew: boolean) {
  return {
    canView: true,
    canCreateOrJoin: isCityUnlocked("crew", playerLevel),
    canManageExisting: hasExistingCrew,
  };
}

/** Le prochain palier de ville strictement au-dessus du niveau courant. */
export function nextCityUnlock(playerLevel: number): CityUnlock | null {
  return CITY_UNLOCKS.find((u) => u.unlockLevel > playerLevel) ?? null;
}
