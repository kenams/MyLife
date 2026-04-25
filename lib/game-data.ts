import type {
  ActivitySeed,
  JobSeed,
  LocationSeed,
  NeighborhoodSeed,
  ResidentSeed
} from "@/lib/types";

export const cityName = "Neo Paris";

export const neighborhoods: NeighborhoodSeed[] = [
  {
    slug: "old-quarter",
    name: "Quartier Populaire",
    vibe: "dense, brut et accessible",
    lifestyle: "debrouille, petits jobs, entraide et loyers bas",
    costLevel: "accessible"
  },
  {
    slug: "central-district",
    name: "Central District",
    vibe: "dense et social",
    lifestyle: "sorties, carriere, rencontres rapides",
    costLevel: "balanced"
  },
  {
    slug: "midtown-residence",
    name: "Midtown Residences",
    vibe: "residentiel et stable",
    lifestyle: "confort, routines propres, vie sociale equilibree",
    costLevel: "balanced"
  },
  {
    slug: "riverside",
    name: "Riverside",
    vibe: "calme et sain",
    lifestyle: "bien-etre, marche, respiration",
    costLevel: "accessible"
  },
  {
    slug: "studio-heights",
    name: "Studio Heights",
    vibe: "creatif et premium",
    lifestyle: "style, image, ambition et reseau",
    costLevel: "premium"
  },
  {
    slug: "north-estates",
    name: "North Estates",
    vibe: "calme, prive et tres riche",
    lifestyle: "villas, prestige, reseau elite et securite",
    costLevel: "premium"
  }
];

export const locations: LocationSeed[] = [
  {
    slug: "home",
    neighborhoodSlug: "midtown-residence",
    name: "Home Suite",
    kind: "home",
    summary: "Le point de reset. Tu y recuperes ton energie, ton hygiene et ton calme.",
    costHint: "gratuit",
    socialEnergy: 0
  },
  {
    slug: "residence-populaire",
    neighborhoodSlug: "old-quarter",
    name: "Bloc Populaire",
    kind: "home",
    summary: "Residences modestes, loyers faibles, ambiance dense et entraide de quartier.",
    costHint: "pauvre",
    socialEnergy: 32
  },
  {
    slug: "residence-confort",
    neighborhoodSlug: "midtown-residence",
    name: "Residence Confort",
    kind: "home",
    summary: "Immeubles propres pour joueurs stables : studio, appartement et loft.",
    costHint: "moyen",
    socialEnergy: 24
  },
  {
    slug: "residence-luxe",
    neighborhoodSlug: "north-estates",
    name: "North Estates",
    kind: "home",
    summary: "Residences riches : penthouse, villa et manoir avec fort impact social.",
    costHint: "riche",
    socialEnergy: 18
  },
  {
    slug: "market",
    neighborhoodSlug: "old-quarter",
    name: "Fresh Market",
    kind: "food",
    summary: "Le meilleur endroit pour gerer le budget alimentation sans degrader la sante.",
    costHint: "economique",
    socialEnergy: 10
  },
  {
    slug: "cafe",
    neighborhoodSlug: "central-district",
    name: "Social Cafe",
    kind: "social",
    summary: "Le hub de conversation. Idéal pour casser l'isolement et ouvrir une nouvelle relation.",
    costHint: "accessible",
    socialEnergy: 70
  },
  {
    slug: "office",
    neighborhoodSlug: "central-district",
    name: "Focus Office",
    kind: "work",
    summary: "Le lieu ou les routines de travail font monter argent, discipline et credibilite.",
    costHint: "productif",
    socialEnergy: 20
  },
  {
    slug: "park",
    neighborhoodSlug: "riverside",
    name: "Riverside Park",
    kind: "public",
    summary: "Un espace utile pour marcher, souffler et reduire le stress sans depenser.",
    costHint: "gratuit",
    socialEnergy: 30
  },
  {
    slug: "gym",
    neighborhoodSlug: "riverside",
    name: "Pulse Gym",
    kind: "wellness",
    summary: "Le lieu fitness pour la discipline, la forme et la perception sociale.",
    costHint: "moyen",
    socialEnergy: 24
  },
  {
    slug: "restaurant",
    neighborhoodSlug: "studio-heights",
    name: "Maison Ember",
    kind: "food",
    summary: "Sorties plus premium, utiles pour l'humeur, la relation et l'image sociale.",
    costHint: "premium",
    socialEnergy: 55
  },
  {
    slug: "cinema",
    neighborhoodSlug: "studio-heights",
    name: "Luma Cinema",
    kind: "social",
    summary: "Le meilleur decor pour une sortie calme ou un date sobre.",
    costHint: "moyen",
    socialEnergy: 44
  },
  {
    slug: "nightclub",
    neighborhoodSlug: "central-district",
    name: "Neo Club",
    kind: "social",
    summary: "La salle de nuit incontournable. Musique, danse, rencontres intenses et ambiance electrique.",
    costHint: "premium",
    socialEnergy: 90
  },
  {
    slug: "library",
    neighborhoodSlug: "midtown-residence",
    name: "City Library",
    kind: "wellness",
    summary: "Espace calme pour etudier, lire et developper ses competences. Ideal pour progresser.",
    costHint: "gratuit",
    socialEnergy: 8
  },
  {
    slug: "spa",
    neighborhoodSlug: "riverside",
    name: "Zenith Spa",
    kind: "wellness",
    summary: "Centre de bien-etre premium : sauna, massage, meditation. Recuperation maximale.",
    costHint: "premium",
    socialEnergy: 15
  },
  {
    slug: "startup",
    neighborhoodSlug: "studio-heights",
    name: "Startup Lab",
    kind: "work",
    summary: "Espace de co-working tech. Reseau, projets ambitieux et opportunites a saisir.",
    costHint: "moyen",
    socialEnergy: 38
  },
  {
    slug: "rooftop-bar",
    neighborhoodSlug: "north-estates",
    name: "Sky Lounge",
    kind: "social",
    summary: "Bar rooftop VIP avec vue panoramique. Cocktails, networking et soirees haut de gamme.",
    costHint: "elite",
    socialEnergy: 72
  }
];

export const jobs: JobSeed[] = [
  {
    slug: "office-assistant",
    name: "Assistant de bureau",
    rewardCoins: 48,
    energyCost: 18,
    hungerCost: 12,
    stressCost: 8,
    disciplineReward: 8,
    reputationReward: 3
  },
  {
    slug: "support-tech",
    name: "Support tech",
    rewardCoins: 56,
    energyCost: 20,
    hungerCost: 12,
    stressCost: 10,
    disciplineReward: 9,
    reputationReward: 4
  },
  {
    slug: "creator-studio",
    name: "Creator studio",
    rewardCoins: 52,
    energyCost: 16,
    hungerCost: 10,
    stressCost: 7,
    disciplineReward: 7,
    reputationReward: 5
  },
  {
    slug: "cafe-host",
    name: "Cafe host",
    rewardCoins: 44,
    energyCost: 15,
    hungerCost: 11,
    stressCost: 5,
    disciplineReward: 6,
    reputationReward: 4
  },
  {
    slug: "wellness-guide",
    name: "Wellness guide",
    rewardCoins: 46,
    energyCost: 14,
    hungerCost: 9,
    stressCost: 4,
    disciplineReward: 8,
    reputationReward: 4
  }
];

export const activities: ActivitySeed[] = [
  {
    slug: "walk",
    name: "Marche active",
    kind: "wellness",
    locationSlug: "park",
    summary: "Une sortie simple qui baisse le stress et relance legerement la forme.",
    cost: 0,
    energyDelta: -6,
    moodDelta: 8,
    sociabilityDelta: 4,
    fitnessDelta: 6,
    stressDelta: -10,
    weightDelta: -0.1,
    disciplineDelta: 4
  },
  {
    slug: "gym-session",
    name: "Session salle",
    kind: "wellness",
    locationSlug: "gym",
    summary: "Une seance disciplinee qui fait monter la forme et l'image personnelle.",
    cost: 14,
    energyDelta: -14,
    moodDelta: 9,
    sociabilityDelta: 2,
    fitnessDelta: 10,
    stressDelta: -12,
    weightDelta: -0.25,
    disciplineDelta: 8
  },
  {
    slug: "coffee-meetup",
    name: "Cafe a deux",
    kind: "social",
    locationSlug: "cafe",
    summary: "La meilleure activite legere pour ouvrir ou renforcer un lien.",
    cost: 10,
    energyDelta: -4,
    moodDelta: 12,
    sociabilityDelta: 16,
    fitnessDelta: 0,
    stressDelta: -6,
    weightDelta: 0,
    disciplineDelta: 2
  },
  {
    slug: "restaurant-date",
    name: "Diner au restaurant",
    kind: "romantic",
    locationSlug: "restaurant",
    summary: "Sortie plus premium qui fait progresser humeur, reputation et relation.",
    cost: 26,
    energyDelta: -6,
    moodDelta: 16,
    sociabilityDelta: 14,
    fitnessDelta: 0,
    stressDelta: -8,
    weightDelta: 0.15,
    disciplineDelta: 1
  },
  {
    slug: "cinema-night",
    name: "Cinema du soir",
    kind: "social",
    locationSlug: "cinema",
    summary: "Activite calme, accessible, utile pour les liens et la detente.",
    cost: 18,
    energyDelta: -5,
    moodDelta: 14,
    sociabilityDelta: 12,
    fitnessDelta: 0,
    stressDelta: -5,
    weightDelta: 0,
    disciplineDelta: 1
  },
  {
    slug: "evening-walk",
    name: "Balade du soir",
    kind: "solo",
    locationSlug: "park",
    summary: "Sortie legere pour souffler et reconnecte avec soi-meme sans depenser.",
    cost: 0,
    energyDelta: -3,
    moodDelta: 10,
    sociabilityDelta: 2,
    fitnessDelta: 4,
    stressDelta: -14,
    weightDelta: -0.05,
    disciplineDelta: 3
  },
  {
    slug: "group-outing",
    name: "Sortie en groupe",
    kind: "social",
    locationSlug: "cafe",
    summary: "Sortie en groupe qui monte vite la sociabilite mais fatigue plus.",
    cost: 16,
    energyDelta: -10,
    moodDelta: 16,
    sociabilityDelta: 22,
    fitnessDelta: 0,
    stressDelta: 4,
    weightDelta: 0,
    disciplineDelta: -1
  },
  {
    slug: "party-night",
    name: "Soiree festive",
    kind: "social",
    locationSlug: "cinema",
    summary: "Sortie intense. Humeur et sociabilite explosent, mais fatigue et budget aussi.",
    cost: 38,
    energyDelta: -22,
    moodDelta: 20,
    sociabilityDelta: 28,
    fitnessDelta: -2,
    stressDelta: 8,
    weightDelta: 0.1,
    disciplineDelta: -6
  },
  {
    slug: "solo-cafe",
    name: "Cafe solo",
    kind: "solo",
    locationSlug: "cafe",
    summary: "S'isoler dans un cafe pour lire, reflechir ou travailler. Discret mais efficace.",
    cost: 8,
    energyDelta: 4,
    moodDelta: 8,
    sociabilityDelta: 3,
    fitnessDelta: 0,
    stressDelta: -8,
    weightDelta: 0,
    disciplineDelta: 5
  }
];

export const starterResidents: ResidentSeed[] = [
  {
    id: "ava",
    name: "Ava",
    ageRange: "25-29",
    role: "Community host",
    locationSlug: "cafe",
    vibe: "ouvre les conversations et aide les nouveaux a s'integrer",
    bio: "Aime les routines nettes, les gens constants et les sorties simples.",
    interests: ["wellness", "networking", "coffee"],
    lookingFor: ["amis", "communaute", "motivation"],
    status: "online",
    reputation: 72,
    socialRank: "confortable"
  },
  {
    id: "malik",
    name: "Malik",
    ageRange: "30-34",
    role: "Night operator",
    locationSlug: "office",
    vibe: "oriente business, rythme tardif, regarde surtout la discipline",
    bio: "Apprécie les profils ambitieux qui tiennent une routine de travail.",
    interests: ["business", "productivity", "tech"],
    lookingFor: ["discussion", "sorties", "progression personnelle"],
    status: "working",
    reputation: 78,
    socialRank: "influent"
  },
  {
    id: "noa",
    name: "Noa",
    ageRange: "22-26",
    role: "Creator",
    locationSlug: "cinema",
    vibe: "fluide, sociable, aime les gens visibles et coherents",
    bio: "Parle style de vie, image, ambition creative et projets legers.",
    interests: ["design", "cinema", "social"],
    lookingFor: ["amis", "discussion", "relation amoureuse"],
    status: "online",
    reputation: 67,
    socialRank: "stable"
  },
  {
    id: "leila",
    name: "Leila",
    ageRange: "27-31",
    role: "Neighborhood guide",
    locationSlug: "park",
    vibe: "calme, saine, bonne pour casser l'isolement et le stress",
    bio: "Valorise le rythme de vie stable, la marche et les discussions douces.",
    interests: ["fitness", "nature", "mindset"],
    lookingFor: ["amis", "sport", "motivation"],
    status: "out",
    reputation: 70,
    socialRank: "confortable"
  },
  {
    id: "yan",
    name: "Yan",
    ageRange: "28-33",
    role: "Ops lead",
    locationSlug: "office",
    vibe: "routines, execution, rigueur et progression sociale continue",
    bio: "Observe les resultats plus que les promesses. Apprecie la constance.",
    interests: ["work", "systems", "discipline"],
    lookingFor: ["communaute", "discussion", "business"],
    status: "busy",
    reputation: 82,
    socialRank: "influent"
  },
  {
    id: "sana",
    name: "Sana",
    ageRange: "24-28",
    role: "Fitness curator",
    locationSlug: "gym",
    vibe: "energie propre, routines sportives, humeur stable",
    bio: "Cherche des profils reguliers, respectueux et tournés progression.",
    interests: ["fitness", "food", "wellbeing"],
    lookingFor: ["sport", "amis", "sorties"],
    status: "online",
    reputation: 74,
    socialRank: "confortable"
  }
];

export const ageRanges = ["18-21", "22-25", "26-30", "31-36", "37-45"];
export const genderOptions = ["Femme", "Homme", "Non-binaire"];
export const photoStyles = ["Studio soft", "Street premium", "Minimal clean", "Editorial chic"];
export const bodyFrames = ["fin", "equilibre", "athletique", "puissant"];
export const skinTones = ["clair", "ambre", "olive", "brun", "ebene"];
export const hairTypes = ["lisse", "ondulé", "bouclé", "crepu"];
export const hairColors = ["noir", "chatain", "blond", "roux", "gris"];
export const hairLengths = ["court", "mi-long", "long"];
export const eyeColors = ["marron", "noisette", "vert", "bleu", "gris"];
export const outfitStyles = ["urbain", "minimal", "sport", "creative", "business"];
export const facialHairOptions = ["aucune", "barbe courte", "barbe pleine", "moustache", "bouc"];
export const silhouettes = ["fine", "tonique", "equilibree", "large"];
export const originStyles = ["Europe", "Afrique", "Asie", "Ameriques", "Mediterranee", "Mixte"];
export const personalityTraits = ["Leader", "Ambitieux", "Strategique", "Calme", "Charismatique", "Discipline"];
export const sociabilityLevels = ["reserve", "ouvert", "tres social"];
export const ambitionLevels = ["equilibre", "croissance", "elite"];
export const lifeRhythms = ["matinal", "equilibre", "tardif"];
export const relationshipStyles = ["stable", "curieux", "selectif", "protecteur"];
export const personalGoals = [
  "stabiliser ma vie",
  "monter socialement",
  "retrouver une routine saine",
  "developper mon cercle",
  "creer une relation de qualite"
];
export const lifeHabits = ["structure", "spontaneite", "sport", "travail", "social"];
export const interestOptions = [
  "fitness",
  "business",
  "cinema",
  "coffee",
  "food",
  "design",
  "tech",
  "mindset",
  "networking",
  "wellness"
];
export const lookingForOptions = [
  "amis",
  "discussion",
  "communaute",
  "motivation",
  "relation amoureuse",
  "sorties",
  "sport",
  "progression personnelle"
];
export const preferredVibes = ["calme", "elegant", "social", "sportif", "creatif", "ambitieux"];
export const traitPreferences = ["fiable", "drôle", "discipline", "ambition", "douceur", "charisme"];

export const dailyGoalLabels = [
  "Manger proprement une fois",
  "Travailler ou produire de la valeur",
  "Faire une action hygiene ou recuperation",
  "Parler a quelqu'un",
  "Bouger au moins 10 minutes"
];
