// ── Système romantique complet ────────────────────────────────────────────────
// Jalons × Cadeaux × Scénarios narratifs × Chimie NPC

// ── 7 Niveaux de relation ─────────────────────────────────────────────────────
export type RomanceTier =
  | "inconnu" | "connaissance" | "ami" | "crush" | "couple" | "exclusif" | "fiancailles";

export function getTierFromScore(score: number): RomanceTier {
  if (score < 16) return "inconnu";
  if (score < 31) return "connaissance";
  if (score < 51) return "ami";
  if (score < 66) return "crush";
  if (score < 81) return "couple";
  if (score < 96) return "exclusif";
  return "fiancailles";
}

export const TIER_META: Record<RomanceTier, {
  label: string; emoji: string; color: string; minScore: number;
  feedMsg: string; unlocksDesc: string;
}> = {
  inconnu:      { label: "Inconnu",      emoji: "🤍", color: "#9ca3af", minScore: 0,  feedMsg: "Premier contact.",                           unlocksDesc: "—" },
  connaissance: { label: "Connaissance", emoji: "👋", color: "#6b7280", minScore: 16, feedMsg: "Vous commencez à vous connaître.",             unlocksDesc: "Café" },
  ami:          { label: "Amis",         emoji: "🤝", color: "#3b82f6", minScore: 31, feedMsg: "Une vraie amitié se construit.",               unlocksDesc: "Parc · Cinéma" },
  crush:        { label: "Crush",        emoji: "💛", color: "#f59e0b", minScore: 51, feedMsg: "Quelque chose de plus profond commence.",       unlocksDesc: "Restaurant · Nuit" },
  couple:       { label: "En couple",    emoji: "💕", color: "#ec4899", minScore: 66, feedMsg: "Vous êtes officiellement ensemble.",            unlocksDesc: "Love Room · Cadeaux premium" },
  exclusif:     { label: "Exclusif",     emoji: "❤️",  color: "#ef4444", minScore: 81, feedMsg: "Une exclusivité partagée. Fort.",              unlocksDesc: "Bijou · Proposition" },
  fiancailles:  { label: "Fiançailles",  emoji: "💍", color: "#8b5cf6", minScore: 96, feedMsg: "Tu lui as fait une proposition. Elle a dit oui.", unlocksDesc: "Tout débloqué" },
};

// ── Cadeaux ───────────────────────────────────────────────────────────────────
export type GiftId = "roses" | "peluche" | "chocolats" | "livre-rare" | "parfum" | "bijou" | "poeme";

export type GiftDef = {
  id: GiftId;
  emoji: string;
  name: string;
  price: number;
  baseBonus: number;
  bestFor: string[];
  minTier: RomanceTier;
  desc: string;
};

export const GIFTS: GiftDef[] = [
  { id: "peluche",    emoji: "🧸", name: "Peluche",          price: 18,  baseBonus: 8,  bestFor: ["social", "wellness"],              minTier: "connaissance", desc: "Mignon et sans risque." },
  { id: "chocolats",  emoji: "🍫", name: "Chocolats premium", price: 22,  baseBonus: 10, bestFor: ["food", "wellness", "social"],       minTier: "connaissance", desc: "Toujours apprécié." },
  { id: "roses",      emoji: "🌹", name: "Bouquet de roses",  price: 30,  baseBonus: 14, bestFor: ["wellness", "social", "nature"],     minTier: "ami",          desc: "Classique et efficace." },
  { id: "poeme",      emoji: "📝", name: "Poème manuscrit",   price: 5,   baseBonus: 20, bestFor: ["discussion", "cinema", "design"],   minTier: "crush",        desc: "Gratuit en coût, précieux en sens." },
  { id: "livre-rare", emoji: "📚", name: "Livre rare",        price: 40,  baseBonus: 14, bestFor: ["cinema", "design", "productivity"], minTier: "ami",          desc: "Pour les esprits curieux." },
  { id: "parfum",     emoji: "🌸", name: "Parfum luxe",       price: 55,  baseBonus: 18, bestFor: ["design", "social", "business"],     minTier: "crush",        desc: "Marque les esprits." },
  { id: "bijou",      emoji: "💎", name: "Bijou",             price: 90,  baseBonus: 26, bestFor: ["relation amoureuse"],               minTier: "couple",       desc: "Un geste fort. Assure-toi du lien." },
];

export function calcGiftBonus(gift: GiftDef, npcInterests: string[]): number {
  const match = gift.bestFor.some((k) => npcInterests.includes(k));
  return match ? gift.baseBonus : Math.floor(gift.baseBonus * 0.35);
}

export function getGiftReaction(bonus: number, npcName: string): string {
  if (bonus >= 20) return `${npcName} est vraiment touché(e). Ses yeux brillent.`;
  if (bonus >= 12) return `${npcName} sourit chaleureusement. "C'est vraiment gentil."`;
  if (bonus >= 6)  return `${npcName} dit merci poliment. Le geste est noté.`;
  return `${npcName} semble un peu gêné(e). Peut-être trop tôt, ou pas le bon choix.`;
}

// ── Chimie / Compatibilité ────────────────────────────────────────────────────
export function calcChemistry(
  playerStats: { sociability: number; attractiveness: number; mood: number },
  npcReputation: number,
  npcInterests: string[],
  playerInterests?: string[],
): number {
  const base = (playerStats.sociability * 0.4 + playerStats.attractiveness * 0.35 + playerStats.mood * 0.25);
  const repFactor = npcReputation / 100;
  const interestMatch = playerInterests
    ? npcInterests.filter((i) => playerInterests.includes(i)).length / Math.max(1, npcInterests.length)
    : 0.5;
  return Math.min(100, Math.round(base * 0.5 + repFactor * 30 + interestMatch * 20));
}

export function getChemistryLabel(pct: number): { label: string; color: string; emoji: string } {
  if (pct >= 85) return { label: "Alchimie parfaite",   color: "#f59e0b", emoji: "🔥" };
  if (pct >= 65) return { label: "Belle compatibilité", color: "#ec4899", emoji: "💕" };
  if (pct >= 45) return { label: "Potentiel solide",    color: "#6366f1", emoji: "✨" };
  if (pct >= 25) return { label: "À construire",        color: "#6b7280", emoji: "🤝" };
  return              { label: "Peu de points communs", color: "#9ca3af", emoji: "🤍" };
}

// ── Scénarios narratifs de date ───────────────────────────────────────────────
export type DialogueChoice = {
  id: string;
  text: string;
  delta: number;
  reaction: string;
};

export type DialogueCard = {
  id: string;
  npcLine: string;
  choices: DialogueChoice[];
};

export type DateScenario = {
  venueKind: string;
  title: string;
  emoji: string;
  cards: DialogueCard[];
};

export type DateResult = "parfait" | "bon" | "maladroit" | "catastrophe";

export function getDateResult(totalDelta: number): DateResult {
  if (totalDelta >= 36) return "parfait";
  if (totalDelta >= 22) return "bon";
  if (totalDelta >= 8)  return "maladroit";
  return "catastrophe";
}

export const DATE_RESULT_META: Record<DateResult, {
  label: string; emoji: string; color: string; bg: string;
  relationBonus: number; moodBonus: number; desc: string;
}> = {
  parfait:     { label: "Soirée parfaite",  emoji: "🌟", color: "#f59e0b", bg: "#fffbeb", relationBonus: 22, moodBonus: 18, desc: "Une alchimie rare. Ce moment ne s'oublie pas." },
  bon:         { label: "Belle soirée",     emoji: "💕", color: "#ec4899", bg: "#fdf2f8", relationBonus: 14, moodBonus: 10, desc: "Naturel, sincère. Le lien s'approfondit." },
  maladroit:   { label: "Un peu gauche…",   emoji: "😅", color: "#6366f1", bg: "#eef2ff", relationBonus: 5,  moodBonus: 2,  desc: "Quelques maladresses, mais la connexion reste." },
  catastrophe: { label: "Soirée ratée",     emoji: "💔", color: "#ef4444", bg: "#fef2f2", relationBonus: -2, moodBonus: -8, desc: "L'ambiance n'était pas là. Ça arrive à tout le monde." },
};

export const DATE_SCENARIOS: DateScenario[] = [
  {
    venueKind: "coffee",
    title: "Café à deux",
    emoji: "☕",
    cards: [
      {
        id: "c1",
        npcLine: "Tu prends quoi d'habitude dans ces endroits ?",
        choices: [
          { id: "c1a", text: "Un espresso serré, sans fioritures.", delta: 6, reaction: "Direct et assumé. Elle hoche la tête avec un sourire." },
          { id: "c1b", text: "Tout ce qui est chaud et sucré.", delta: 9, reaction: "Elle rit. \"Moi pareil en fait.\"" },
          { id: "c1c", text: "Aide-moi à choisir, tu connais mieux.", delta: 12, reaction: "Elle apprécie d'être le guide. Son regard s'illumine." },
        ]
      },
      {
        id: "c2",
        npcLine: "Tu as l'air d'avoir une journée chargée derrière toi.",
        choices: [
          { id: "c2a", text: "Ouais — mais être là me recharge.", delta: 13, reaction: "Elle pose sa main sur la table. Rapprochement." },
          { id: "c2b", text: "C'est la vie que j'ai choisie.", delta: 7, reaction: "Elle acquiesce. Elle apprécie l'ambition." },
          { id: "c2c", text: "Franchement non, j'avais rien de prévu.", delta: 3, reaction: "Elle sourit poliment. Un peu maladroit." },
        ]
      },
      {
        id: "c3",
        npcLine: "Si tu pouvais être n'importe où ce weekend…",
        choices: [
          { id: "c3a", text: "Là où tu veux aller.", delta: 15, reaction: "Elle rit sincèrement. \"Bonne réponse.\"" },
          { id: "c3b", text: "Un endroit calme, loin du bruit.", delta: 10, reaction: "Elle se projette. \"Ça me parle.\"" },
          { id: "c3c", text: "Rester ici en fait.", delta: 5, reaction: "Honnête mais peu romanesque." },
        ]
      },
    ]
  },
  {
    venueKind: "park",
    title: "Balade au parc",
    emoji: "🌿",
    cards: [
      {
        id: "p1",
        npcLine: "J'aime qu'on puisse marcher sans parler parfois.",
        choices: [
          { id: "p1a", text: "Le silence partagé dit plus que les mots.", delta: 14, reaction: "Elle s'arrête pour te regarder. Un moment suspendu." },
          { id: "p1b", text: "C'est rare de trouver ça avec quelqu'un.", delta: 11, reaction: "Un sourire discret. Complicité." },
          { id: "p1c", text: "Tu trouves pas ça gênant ?", delta: 3, reaction: "Elle hésite. \"Pas vraiment…\"" },
        ]
      },
      {
        id: "p2",
        npcLine: "Tu penses à quoi en ce moment ?",
        choices: [
          { id: "p2a", text: "À toi, en fait.", delta: 17, reaction: "Elle s'arrête net. Une légère rougeur." },
          { id: "p2b", text: "À rien de précis. C'est agréable.", delta: 9, reaction: "Elle acquiesce doucement." },
          { id: "p2c", text: "À mon boulot de demain.", delta: 1, reaction: "Elle rit un peu jaune. Mauvais timing." },
        ]
      },
      {
        id: "p3",
        npcLine: "Est-ce que tu fais souvent ce genre de chose — des moments lents ?",
        choices: [
          { id: "p3a", text: "Non. Mais avec toi j'ai envie d'en faire plus.", delta: 16, reaction: "Elle sourit longuement. Quelque chose change." },
          { id: "p3b", text: "Oui, c'est un rituel pour moi.", delta: 9, reaction: "Elle se sent proche de toi." },
          { id: "p3c", text: "Ça dépend des journées.", delta: 5, reaction: "Réponse honnête mais neutre." },
        ]
      },
    ]
  },
  {
    venueKind: "restaurant",
    title: "Dîner au restaurant",
    emoji: "🍽️",
    cards: [
      {
        id: "r1",
        npcLine: "Comment tu as trouvé cet endroit ?",
        choices: [
          { id: "r1a", text: "Je voulais que ce soit mémorable.", delta: 13, reaction: "Elle apprécie l'intention. Le cadre prend une autre lumière." },
          { id: "r1b", text: "Un ami me l'avait recommandé.", delta: 7, reaction: "Honnête. Elle sourit." },
          { id: "r1c", text: "Premier résultat sur Google.", delta: 2, reaction: "Elle rit. \"Au moins t'as pas menti.\"" },
        ]
      },
      {
        id: "r2",
        npcLine: "Tu commandes au feeling ou tu lis tout le menu ?",
        choices: [
          { id: "r2a", text: "Au feeling. La vie est trop courte.", delta: 11, reaction: "Elle adopte la même logique. Complicité." },
          { id: "r2b", text: "Je lis tout. J'aime pas rater la meilleure option.", delta: 9, reaction: "Elle trouve ça charmant." },
          { id: "r2c", text: "Je prends toujours la même chose.", delta: 4, reaction: "\"Sécurisant\" dit-elle avec humour." },
        ]
      },
      {
        id: "r3",
        npcLine: "Il y a quelque chose chez toi que j'arrive pas à cerner.",
        choices: [
          { id: "r3a", text: "Bien. Je préfère être une question ouverte.", delta: 16, reaction: "Elle est fascinée. Le rythme de la soirée change." },
          { id: "r3b", text: "C'est un bon signe ou mauvais ?", delta: 11, reaction: "Elle rit franchement. \"Bonne question.\"" },
          { id: "r3c", text: "Je suis assez simple en fait.", delta: 5, reaction: "Elle semble légèrement déçue. Mais ça passe." },
        ]
      },
    ]
  },
  {
    venueKind: "cinema",
    title: "Soirée cinéma",
    emoji: "🎬",
    cards: [
      {
        id: "ci1",
        npcLine: "T'as honte de réagir pendant les films ou tu assumes ?",
        choices: [
          { id: "ci1a", text: "J'assume complètement. Le silence c'est pour les films nuls.", delta: 12, reaction: "Elle explose de rire. \"Enfin quelqu'un.\"" },
          { id: "ci1b", text: "Ça dépend du film et de avec qui je suis.", delta: 9, reaction: "Elle sourit. Réponse souple." },
          { id: "ci1c", text: "Je m'efface pour pas gêner.", delta: 3, reaction: "\"Dommage\" dit-elle doucement." },
        ]
      },
      {
        id: "ci2",
        npcLine: "Je suis entre deux scènes… et je pense à toi.",
        choices: [
          { id: "ci2a", text: "Pareil. Le film peut attendre.", delta: 16, reaction: "Elle pose sa tête sur ton épaule." },
          { id: "ci2b", text: "Ça me touche que tu me dises ça.", delta: 13, reaction: "Sincère et fort. Elle serre ton bras." },
          { id: "ci2c", text: "Chut, il se passe un truc important.", delta: -3, reaction: "Mauvais timing total. Elle se redresse." },
        ]
      },
      {
        id: "ci3",
        npcLine: "Quelle fin tu préfères dans un film ?",
        choices: [
          { id: "ci3a", text: "Heureuse. La vraie vie est déjà assez dure.", delta: 10, reaction: "\"Exactement.\" Elle est d'accord." },
          { id: "ci3b", text: "Vraie. Même si ça fait mal.", delta: 13, reaction: "Elle t'apprécie pour ça. Profondeur." },
          { id: "ci3c", text: "Peu importe si le film est bon.", delta: 6, reaction: "Réponse neutre." },
        ]
      },
    ]
  },
];

export function getScenario(venueKind: string): DateScenario {
  return DATE_SCENARIOS.find((s) => s.venueKind === venueKind) ?? DATE_SCENARIOS[0];
}
