export type HousingTierId =
  | "squat"
  | "studio"
  | "appartement"
  | "loft"
  | "penthouse"
  | "villa"
  | "manoir";

export type HousingTier = {
  id: HousingTierId;
  name: string;
  emoji: string;
  rentPerDay: number;       // coût quotidien en crédits
  moodBonus: number;        // bonus passif d'humeur
  reputationBonus: number;  // bonus passif de réputation
  wealthScore: number;      // points dans le classement richesse
  color: string;
  // Conditions de déblocage
  minMoney: number;
  minLevel: number;
  minReputation: number;
  minStreak: number;
  description: string;
  perks: string[];
};

export const HOUSING_TIERS: HousingTier[] = [
  {
    id:              "squat",
    name:            "Squat",
    emoji:           "🏚️",
    rentPerDay:      0,
    moodBonus:       -10,
    reputationBonus: -5,
    wealthScore:     0,
    color:           "#ff5c5c",
    minMoney:        0,
    minLevel:        1,
    minReputation:   0,
    minStreak:       0,
    description:     "Conditions précaires. Tu dois absolument en sortir.",
    perks:           ["Aucun avantage", "−10 humeur passive", "−5 réputation"],
  },
  {
    id:              "studio",
    name:            "Studio",
    emoji:           "🏠",
    rentPerDay:      15,
    moodBonus:       0,
    reputationBonus: 0,
    wealthScore:     500,
    color:           "#94a3b8",
    minMoney:        100,
    minLevel:        1,
    minReputation:   0,
    minStreak:       0,
    description:     "Un espace correct. Le minimum pour vivre dignement.",
    perks:           ["Hygiene +5/jour", "Pas de malus d'humeur"],
  },
  {
    id:              "appartement",
    name:            "Appartement",
    emoji:           "🏢",
    rentPerDay:      35,
    moodBonus:       5,
    reputationBonus: 5,
    wealthScore:     2000,
    color:           "#60a5fa",
    minMoney:        500,
    minLevel:        5,
    minReputation:   20,
    minStreak:       3,
    description:     "Un vrai chez-soi dans la ville.",
    perks:           ["Humeur +5 passif", "Rep +5 passif", "Hygiene +10/jour"],
  },
  {
    id:              "loft",
    name:            "Loft",
    emoji:           "🏙️",
    rentPerDay:      70,
    moodBonus:       10,
    reputationBonus: 10,
    wealthScore:     5000,
    color:           "#a78bfa",
    minMoney:        1500,
    minLevel:        10,
    minReputation:   40,
    minStreak:       7,
    description:     "Style industriel haut de gamme. Tu te distingues.",
    perks:           ["Humeur +10 passif", "Rep +10 passif", "XP +10% toutes actions"],
  },
  {
    id:              "penthouse",
    name:            "Penthouse",
    emoji:           "🌆",
    rentPerDay:      150,
    moodBonus:       18,
    reputationBonus: 20,
    wealthScore:     15000,
    color:           "#f6b94f",
    minMoney:        4000,
    minLevel:        15,
    minReputation:   65,
    minStreak:       14,
    description:     "Vue panoramique. Tu es dans le top de la ville.",
    perks:           ["Humeur +18 passif", "Rep +20 passif", "XP +20%", "Accès zones premium"],
  },
  {
    id:              "villa",
    name:            "Villa",
    emoji:           "🏛️",
    rentPerDay:      300,
    moodBonus:       25,
    reputationBonus: 35,
    wealthScore:     50000,
    color:           "#38c793",
    minMoney:        10000,
    minLevel:        20,
    minReputation:   80,
    minStreak:       30,
    description:     "Propriété d'exception. Seulement pour les meilleurs.",
    perks:           ["Humeur +25 passif", "Rep +35 passif", "XP +30%", "Badge exclusif", "Top 10% classement"],
  },
  {
    id:              "manoir",
    name:            "Manoir",
    emoji:           "👑",
    rentPerDay:      800,
    moodBonus:       35,
    reputationBonus: 50,
    wealthScore:     200000,
    color:           "#f6b94f",
    minMoney:        30000,
    minLevel:        35,
    minReputation:   90,
    minStreak:       60,
    description:     "Le sommet absolu. Statut légendaire dans la ville.",
    perks:           ["Humeur +35 passif", "Rep +50 passif", "XP +50%", "Aura légendaire", "Top 1 prioritaire"],
  },
];

export function getHousingTier(id: HousingTierId): HousingTier {
  return HOUSING_TIERS.find((t) => t.id === id) ?? HOUSING_TIERS[0];
}

export function getMaxAffordableHousing(money: number, level: number, reputation: number, streak: number): HousingTier {
  const eligible = HOUSING_TIERS.filter((t) =>
    money >= t.minMoney &&
    level >= t.minLevel &&
    reputation >= t.minReputation &&
    streak >= t.minStreak
  );
  return eligible.at(-1) ?? HOUSING_TIERS[0];
}

export function canAffordHousing(tier: HousingTier, money: number, level: number, reputation: number, streak: number): boolean {
  return money >= tier.minMoney && level >= tier.minLevel && reputation >= tier.minReputation && streak >= tier.minStreak;
}

export function computeWealthScore(
  money: number,
  playerXp: number,
  reputation: number,
  streak: number,
  housing: HousingTierId,
  playerLevel: number
): number {
  const h = getHousingTier(housing);
  return Math.round(
    money * 2 +
    playerXp * 1.5 +
    reputation * 80 +
    streak * 150 +
    h.wealthScore +
    playerLevel * 200
  );
}

export const HOUSING_TIER_ORDER: HousingTierId[] = [
  "squat", "studio", "appartement", "loft", "penthouse", "villa", "manoir"
];
