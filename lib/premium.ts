import type { BoostItem, CosmeticItem, PremiumFeature, PremiumTier } from "@/lib/types";

export const PREMIUM_PRICES: Record<PremiumTier, { label: string; price: string; priceNumeric: number; stripeLink: string }> = {
  monthly: {
    label: "Mensuel",
    price: "4,99€/mois",
    priceNumeric: 499,
    stripeLink: "https://buy.stripe.com/mylife_monthly" // à remplacer
  },
  yearly: {
    label: "Annuel",
    price: "29,99€/an",
    priceNumeric: 2999,
    stripeLink: "https://buy.stripe.com/mylife_yearly" // à remplacer
  }
};

export const PREMIUM_FEATURES: { id: PremiumFeature; label: string; description: string; icon: string }[] = [
  { id: "boost_x2",          label: "Boost x2",          description: "Toutes tes actions rapportent 2× plus.",              icon: "flash" },
  { id: "cosmetics",         label: "Cosmétiques",        description: "Badges, auras et bordures exclusifs.",                icon: "sparkles" },
  { id: "unlimited_dates",   label: "Dates illimitées",   description: "Propose autant de dates que tu veux sans cooldown.", icon: "heart" },
  { id: "elite_social",      label: "Réseau élite",       description: "Accès aux résidents premium et aux lieux VIP.",      icon: "people" },
  { id: "realtime_sync",     label: "Sync temps réel",    description: "Synchronisation Supabase instantanée.",              icon: "cloud" },
  { id: "stats_insights",    label: "Insights avancés",   description: "Analyses détaillées de ta progression.",             icon: "analytics" }
];

export const COSMETICS: CosmeticItem[] = [
  { id: "badge-gold",    name: "Badge Or",       kind: "badge",  color: "#fbbf24", price: 0,  requiresPremium: true  },
  { id: "badge-diamond", name: "Badge Diamant",  kind: "badge",  color: "#93c5fd", price: 0,  requiresPremium: true  },
  { id: "border-fire",   name: "Bordure Feu",    kind: "border", color: "#f97316", price: 20, requiresPremium: false },
  { id: "border-ice",    name: "Bordure Glace",  kind: "border", color: "#67e8f9", price: 20, requiresPremium: false },
  { id: "aura-violet",   name: "Aura Violet",    kind: "aura",   color: "#8b5cf6", price: 35, requiresPremium: true  },
  { id: "aura-gold",     name: "Aura Dorée",     kind: "aura",   color: "#f59e0b", price: 50, requiresPremium: true  }
];

export const BOOSTS: BoostItem[] = [
  {
    id: "boost-xp-2h",
    name: "Boost XP 2h",
    description: "Toutes les actions rapportent 2× pendant 2h.",
    multiplier: 2,
    durationHours: 2,
    price: 15,
    activeUntil: null
  },
  {
    id: "boost-social-4h",
    name: "Boost Social 4h",
    description: "+50% sociabilité et réputation pendant 4h.",
    multiplier: 1.5,
    durationHours: 4,
    price: 25,
    activeUntil: null
  },
  {
    id: "boost-energy-1h",
    name: "Energie Max 1h",
    description: "Ton énergie ne décroît pas pendant 1h.",
    multiplier: 1,
    durationHours: 1,
    price: 10,
    activeUntil: null
  }
];

export function isPremiumFeatureActive(isPremium: boolean, feature: PremiumFeature): boolean {
  if (!isPremium) return false;
  return PREMIUM_FEATURES.some((f) => f.id === feature);
}

export function getActivePremiumBoost(boosts: BoostItem[]): BoostItem | null {
  const now = Date.now();
  return boosts.find((b) => b.activeUntil && new Date(b.activeUntil).getTime() > now) ?? null;
}

export function getBoostMultiplier(boosts: BoostItem[]): number {
  const active = getActivePremiumBoost(boosts);
  return active?.multiplier ?? 1;
}
