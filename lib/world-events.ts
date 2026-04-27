/**
 * World Events — 1 événement mondial par jour sur la carte.
 * Génère de la FOMO, encourage la connexion quotidienne.
 * Les joueurs présents dans la ville reçoivent des bonus.
 */

export type WorldEventKind =
  | "festival"
  | "sale"
  | "tournament"
  | "concert"
  | "market"
  | "hackathon"
  | "parade"
  | "gala";

export type WorldEventCity = {
  slug: string;
  name: string;
  emoji: string;
  posX: number; // 0-100 sur la carte monde
  posY: number;
};

export type WorldEvent = {
  id: string;
  kind: WorldEventKind;
  title: string;
  description: string;
  city: WorldEventCity;
  emoji: string;
  xpReward: number;
  moneyReward: number;
  moodBonus: number;
  sociabilityBonus: number;
  participantCount: number;
  startsAt: string;
  endsAt: string;  // fin de journée
  active: boolean;
};

export const WORLD_CITIES: WorldEventCity[] = [
  { slug: "neo-paris",   name: "Neo Paris",   emoji: "🗼", posX: 49, posY: 34 },
  { slug: "neo-newyork", name: "Neo NewYork",  emoji: "🗽", posX: 22, posY: 32 },
  { slug: "neo-tokyo",   name: "Neo Tokyo",    emoji: "🏯", posX: 76, posY: 33 },
  { slug: "neo-london",  name: "Neo London",   emoji: "🎡", posX: 47, posY: 29 },
  { slug: "neo-bamako",  name: "Neo Bamako",   emoji: "🌍", posX: 48, posY: 52 },
  { slug: "neo-sydney",  name: "Neo Sydney",   emoji: "🦘", posX: 78, posY: 68 },
  { slug: "neo-sao",     name: "Neo São Paulo", emoji: "🌴", posX: 30, posY: 62 },
  { slug: "neo-dubai",   name: "Neo Dubai",    emoji: "🕌", posX: 57, posY: 40 },
];

type EventTemplate = {
  kind: WorldEventKind;
  emoji: string;
  titles: string[];
  descriptions: string[];
  xpReward: number;
  moneyReward: number;
  moodBonus: number;
  sociabilityBonus: number;
};

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    kind: "festival",
    emoji: "🎪",
    titles: ["Festival Néon", "Fête de quartier", "Festival des arts"],
    descriptions: [
      "Les rues sont animées, la musique résonne. Rejoins la fête et rencontre de nouvelles personnes.",
      "Un festival éphémère transforme la ville en scène géante. Parfait pour networker.",
    ],
    xpReward: 60,
    moneyReward: 20,
    moodBonus: 20,
    sociabilityBonus: 15,
  },
  {
    kind: "sale",
    emoji: "🛍️",
    titles: ["Soldes Flash", "Black Friday virtuel", "Vente privée exclusive"],
    descriptions: [
      "Réductions énormes sur tous les items du jeu. 24h seulement — ne rate pas ça.",
      "Vente exclusive : prix divisés par deux pendant une journée.",
    ],
    xpReward: 30,
    moneyReward: 50,
    moodBonus: 10,
    sociabilityBonus: 5,
  },
  {
    kind: "tournament",
    emoji: "🏆",
    titles: ["Tournoi de la ville", "Grand Prix", "Championnat social"],
    descriptions: [
      "Un tournoi réunit les meilleurs joueurs de la ville. Montre ce dont tu es capable.",
      "Compétition ouverte : les meilleurs scores du jour gagnent un bonus XP.",
    ],
    xpReward: 80,
    moneyReward: 30,
    moodBonus: 15,
    sociabilityBonus: 20,
  },
  {
    kind: "concert",
    emoji: "🎵",
    titles: ["Concert live", "Nuit électro", "Session acoustique"],
    descriptions: [
      "Un concert surprise dans le quartier. L'ambiance est au maximum.",
      "Musique live, bonne humeur et rencontres faciles. Ce soir, tout est possible.",
    ],
    xpReward: 45,
    moneyReward: 10,
    moodBonus: 25,
    sociabilityBonus: 18,
  },
  {
    kind: "market",
    emoji: "🥕",
    titles: ["Marché des producteurs", "Bazar international", "Pop-up market"],
    descriptions: [
      "Des centaines de stands éphémères. Mange bien, rencontre des gens, économise.",
      "Marché pop-up : items rares, nourriture locale, prix mini.",
    ],
    xpReward: 35,
    moneyReward: 40,
    moodBonus: 12,
    sociabilityBonus: 10,
  },
  {
    kind: "hackathon",
    emoji: "💻",
    titles: ["Hackathon 24h", "Sprint créatif", "Innovation week-end"],
    descriptions: [
      "Forme une équipe, code ou crée. Les meilleures idées gagnent un bonus de réputation.",
      "72 heures d'innovation collective. Viens avec tes idées.",
    ],
    xpReward: 70,
    moneyReward: 25,
    moodBonus: 8,
    sociabilityBonus: 12,
  },
  {
    kind: "parade",
    emoji: "🎉",
    titles: ["Défilé de la ville", "Parade néon", "Carnaval virtuel"],
    descriptions: [
      "La ville défile dans les rues. Rejoins le cortège et gagne en visibilité.",
      "Carnaval éphémère : costumes, musique et humeur au sommet.",
    ],
    xpReward: 40,
    moneyReward: 15,
    moodBonus: 30,
    sociabilityBonus: 25,
  },
  {
    kind: "gala",
    emoji: "🥂",
    titles: ["Gala de l'élite", "Soirée VIP", "Bal de fin d'année"],
    descriptions: [
      "Invitation ouverte ce soir : gala premium pour les joueurs actifs. Dress code : élégant.",
      "Le gratin de la ville est là. Montre-toi, network et progresse.",
    ],
    xpReward: 90,
    moneyReward: 35,
    moodBonus: 18,
    sociabilityBonus: 30,
  },
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateWorldEvent(dateStr?: string): WorldEvent {
  const date = dateStr ?? new Date().toDateString();
  const seed = date.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const cityIdx = Math.floor(seededRandom(seed) * WORLD_CITIES.length);
  const templateIdx = Math.floor(seededRandom(seed + 13) * EVENT_TEMPLATES.length);
  const city = WORLD_CITIES[cityIdx];
  const template = EVENT_TEMPLATES[templateIdx];
  const titleIdx = Math.floor(seededRandom(seed + 7) * template.titles.length);
  const descIdx = Math.floor(seededRandom(seed + 19) * template.descriptions.length);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const participantCount = Math.floor(seededRandom(seed + 41) * 800) + 50;

  return {
    id: `world-event-${date.replace(/\s/g, "-")}`,
    kind: template.kind,
    title: template.titles[titleIdx],
    description: template.descriptions[descIdx],
    city,
    emoji: template.emoji,
    xpReward: template.xpReward,
    moneyReward: template.moneyReward,
    moodBonus: template.moodBonus,
    sociabilityBonus: template.sociabilityBonus,
    participantCount,
    startsAt: today.toISOString(),
    endsAt: endOfDay.toISOString(),
    active: true,
  };
}

export function isWorldEventActive(event: WorldEvent | null): boolean {
  if (!event) return false;
  const now = Date.now();
  return now >= new Date(event.startsAt).getTime() && now <= new Date(event.endsAt).getTime();
}
