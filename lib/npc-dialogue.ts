/**
 * NPC Dialogue Engine — Système de dialogue contextuel
 *
 * Chaque NPC a une personnalité, des sujets favoris et des réponses
 * adaptées à son état (action, humeur) et à la relation avec le joueur.
 */

import type { AvatarAction } from "@/lib/avatar-visual";
import type { NpcState } from "@/lib/types";

export type DialogueLine = {
  id:   string;
  text: string;
  kind: "greeting" | "chat" | "activity" | "emote" | "reaction";
};

export type ActivityProposal = {
  slug:        string;
  label:       string;
  locationSlug: string;
  emoji:       string;
};

// ─── Personnalités NPC ────────────────────────────────────────────────────────
const NPC_PERSONALITIES: Record<string, {
  greetings:    string[];
  topics:       string[];
  declineLines: string[];
  acceptLines:  string[];
  busyLines:    string[];
}> = {
  ava: {
    greetings: [
      "Hey ! Ça fait plaisir de te voir ici.",
      "Salut ! Tu passes dans le coin ?",
      "Oh, c'est toi ! T'as l'air en forme.",
      "Coucou ! Je justement pensais à organiser quelque chose."
    ],
    topics: [
      "J'ai découvert un nouveau café hier, c'était parfait.",
      "Les soirées au café Social sont tellement chill en ce moment.",
      "J'essaie de construire ma routine bien-être — tu as des tips ?",
      "Le networking, c'est fatigant mais ça paye vraiment.",
      "J'ai rencontré quelqu'un d'intéressant au marché ce matin."
    ],
    declineLines: [
      "Ouf, pas maintenant — j'ai besoin de me ressourcer.",
      "Je passe, j'suis un peu dans ma bulle là.",
      "Bonne idée mais je suis crevée ce soir.",
      "Une autre fois ? Je gère quelque chose là."
    ],
    acceptLines: [
      "Avec plaisir, j'adore ça !",
      "Top idée, j'y suis !",
      "On y va quand tu veux.",
      "Parfait, j'avais justement envie de sortir."
    ],
    busyLines: [
      "Je suis en train de me reposer, reviens dans un peu.",
      "Là je récupère, mais on peut se voir après.",
      "Je mange vite fait, on se voit après ?"
    ]
  },
  noa: {
    greetings: [
      "Yo ! T'es là toi aussi ?",
      "Ah, tu traînes par ici. Sympa.",
      "Hey ! J'étais justement sur un projet.",
      "Wesh, quoi de neuf ?"
    ],
    topics: [
      "Je travaille sur un truc visuel depuis ce matin, c'est intense.",
      "Le cinéma Luma passe un film de ouf cette semaine.",
      "Je cherche des collab créatifs — tu connais des gens ?",
      "Mon feed est rempli de trucs inspirants là, trop bien.",
      "J'ai shooté des photos au parc ce matin, ambiance incroyable."
    ],
    declineLines: [
      "Nan, j'suis dans mon flow là, je veux pas couper.",
      "Pas trop envie ce soir, je préfère rester sur mon truc.",
      "Peut-être une autre fois, là j'suis focus.",
      "J'ai un rendu à finir, sorry."
    ],
    acceptLines: [
      "Ça marche, let's go.",
      "J'viens, t'as de bonnes idées.",
      "Ouais, ça fait du bien de décrocher.",
      "On y va, j'avais besoin d'air."
    ],
    busyLines: [
      "Je crée là, laisse-moi finir.",
      "Dans mon monde là, reviens dans 5.",
      "Je suis au max de concentration, deux minutes."
    ]
  },
  leila: {
    greetings: [
      "Hey, bienvenue ! Comment tu vas aujourd'hui ?",
      "Oh, tu es là ! Tu veux faire un tour ?",
      "Salut ! J'étais justement au parc ce matin.",
      "Coucou toi. Tu as bonne mine."
    ],
    topics: [
      "J'ai couru 5km ce matin, je me sens super bien.",
      "La nature en ville c'est une thérapie, vraiment.",
      "Je t'apprends un exercice de respiration si tu veux.",
      "Le parc Riverside est magnifique à cette heure-ci.",
      "Je prépare un groupe de marche pour la semaine prochaine."
    ],
    declineLines: [
      "Pas pour l'instant, je dois finir ma séance.",
      "Je récupère là, je préfère rester tranquille.",
      "Trop fatiguée ce soir, une prochaine fois ?",
      "Je passe, j'ai besoin de silence."
    ],
    acceptLines: [
      "Super idée, le mouvement c'est la vie !",
      "Absolument, allons-y !",
      "J'adore, on part quand ?",
      "Parfait, ça va nous faire du bien."
    ],
    busyLines: [
      "Je suis en séance là, encore un peu.",
      "Je me repose, reviens dans quelques minutes.",
      "Je mange sainement là — on se retrouve après ?"
    ]
  }
};

// ─── Activités proposables ────────────────────────────────────────────────────
export const PROPOSABLE_ACTIVITIES: ActivityProposal[] = [
  { slug: "coffee-meetup",  label: "Café à deux",      locationSlug: "cafe",       emoji: "☕" },
  { slug: "walk",           label: "Marche au parc",   locationSlug: "park",       emoji: "🌿" },
  { slug: "gym-session",    label: "Session salle",    locationSlug: "gym",        emoji: "💪" },
  { slug: "cinema-date",    label: "Film au cinéma",   locationSlug: "cinema",     emoji: "🎬" },
  { slug: "market-shop",    label: "Tour au marché",   locationSlug: "market",     emoji: "🛒" },
  { slug: "restaurant-out", label: "Dîner ensemble",   locationSlug: "restaurant", emoji: "🍽️" }
];

// ─── Emotes rapides ───────────────────────────────────────────────────────────
export const QUICK_EMOTES = ["👋", "😄", "🔥", "💪", "✨", "🤝", "😂", "❤️"];

// ─── Génère une ligne de dialogue contextuelle ────────────────────────────────
export function getNpcDialogue(
  npcId:    string,
  action:   AvatarAction,
  mood:     number,
  kind:     "greeting" | "topic" | "busy"
): string {
  const persona = NPC_PERSONALITIES[npcId];
  if (!persona) return "...";

  if (kind === "greeting") {
    const pool = persona.greetings;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (kind === "busy") {
    const pool = persona.busyLines;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // topic
  const pool = persona.topics;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Réponse NPC à une proposition d'activité ────────────────────────────────
export function getNpcActivityResponse(
  npcId:  string,
  npc:    NpcState,
  _activitySlug: string
): { accepted: boolean; line: string } {
  const persona = NPC_PERSONALITIES[npcId];
  if (!persona) return { accepted: false, line: "..." };

  // NPC refuse si trop fatigué, dort ou mange
  const tooBusy = npc.action === "sleeping" || npc.energy < 20 || npc.mood < 20;
  if (tooBusy) {
    const line = persona.declineLines[Math.floor(Math.random() * persona.declineLines.length)];
    return { accepted: false, line };
  }

  // Accepte si humeur haute
  if (npc.mood > 60 && npc.energy > 40) {
    const line = persona.acceptLines[Math.floor(Math.random() * persona.acceptLines.length)];
    return { accepted: true, line };
  }

  // 50/50 sinon
  const accepted = Math.random() > 0.5;
  const pool = accepted ? persona.acceptLines : persona.declineLines;
  const line = pool[Math.floor(Math.random() * pool.length)];
  return { accepted, line };
}

// ─── Réaction NPC à un emote ─────────────────────────────────────────────────
export function getNpcEmoteReaction(npcId: string, emote: string): string {
  const reactions: Record<string, string[]> = {
    "👋": ["Hey toi !", "Salut !", "Wesh !"],
    "😄": ["Haha ! 😄", "T'es trop drôle.", "Ahaha !"],
    "🔥": ["C'est feu !", "Ouais !", "Brûle !"],
    "💪": ["Let's go !", "Force !", "Ça muscle !"],
    "✨": ["Trop bien.", "Vibes.", "Classe."],
    "🤝": ["Deal.", "On est d'accord.", "Partenaires."],
    "😂": ["Hahaha !", "T'es sérieux ?!", "MDR."],
    "❤️": ["Aww merci.", "T'es trop sympa.", "❤️"]
  };
  const pool = reactions[emote] ?? ["😊"];
  const base = pool[Math.floor(Math.random() * pool.length)];
  const persona = NPC_PERSONALITIES[npcId];
  if (!persona) return base;
  // Ajouter couleur de personnalité
  const suffix = persona.topics[Math.floor(Math.random() * persona.topics.length)];
  return Math.random() > 0.5 ? base : `${base} ${suffix}`;
}
