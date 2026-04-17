/**
 * NPC Dialogue Engine — Réponses contextuelles de personnages
 *
 * Couvre les 6 résidents avec personnalités distinctes.
 * Fournit : greetings, topics, accept/decline/busy lines, réactions emotes.
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
      "Coucou ! Je pensais justement à organiser quelque chose.",
      "Hey ! Je suis de super bonne humeur là. Et toi ?"
    ],
    topics: [
      "J'ai découvert un nouveau café hier, c'était parfait.",
      "Les soirées au café Social sont tellement chill en ce moment.",
      "J'essaie de construire ma routine bien-être — tu as des tips ?",
      "Le networking, c'est fatigant mais ça paye vraiment.",
      "J'ai rencontré quelqu'un d'intéressant au marché ce matin.",
      "T'as déjà organisé un repas entre amis ? Je prépare quelque chose."
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

  malik: {
    greetings: [
      "Bro, t'es là. Bien.",
      "Ça roule ? Je suis en mode focus là.",
      "Hey. T'as l'air actif aujourd'hui.",
      "Quoi de neuf côté stats ?",
      "Tu travailles cette nuit aussi ?"
    ],
    topics: [
      "J'analyse mes habitudes depuis 3 semaines. Les chiffres parlent.",
      "Les nuits en ville changent la perspective. Tu vis la nuit ou le jour ?",
      "La discipline, c'est ce qui sépare les performants des autres.",
      "J'ai optimisé ma routine du matin. Résultat immédiat.",
      "Tu devrais tracker tes stats de productivité. Game-changer.",
      "Le réseau se construit dans les moments calmes, pas en rush."
    ],
    declineLines: [
      "Pas maintenant, je suis dans le flow.",
      "Mon agenda est chargé ce soir, une autre fois.",
      "Je passe — j'ai un truc à terminer.",
      "Trop fatigué là, je performe pas à 100%."
    ],
    acceptLines: [
      "Deal. Je suis là.",
      "Ok, ça rentre dans le planning.",
      "Je viens — mais on maximise le temps.",
      "Allons-y. Ce genre d'interaction est utile."
    ],
    busyLines: [
      "Je suis en session de travail. Reviens dans 30.",
      "Concentration max là. Plus tard.",
      "Je récupère pour la nuit de boulot. On parle après."
    ]
  },

  noa: {
    greetings: [
      "Yo ! T'es là toi aussi ?",
      "Ah, tu traînes par ici. Sympa.",
      "Hey ! J'étais justement sur un projet.",
      "Wesh, quoi de neuf ?",
      "T'es tombé où ? Je te cherchais presque."
    ],
    topics: [
      "Je travaille sur un truc visuel depuis ce matin, c'est intense.",
      "Le cinéma Luma passe un film de ouf cette semaine.",
      "Je cherche des collab créatifs — tu connais des gens ?",
      "Mon feed est rempli de trucs inspirants là, trop bien.",
      "J'ai shooté des photos au parc ce matin, ambiance incroyable.",
      "Le concept de lifestyle content m'obsède. T'as un angle unique ?"
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
      "Coucou toi. Tu as bonne mine.",
      "Bonjour ! La nature te manquait ?"
    ],
    topics: [
      "J'ai couru 5km ce matin, je me sens super bien.",
      "La nature en ville c'est une thérapie, vraiment.",
      "Je t'apprends un exercice de respiration si tu veux.",
      "Le parc Riverside est magnifique à cette heure-ci.",
      "Je prépare un groupe de marche pour la semaine prochaine.",
      "Le mouvement, même léger, change l'humeur complètement."
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
  },

  yan: {
    greetings: [
      "Opérationnel. Qu'est-ce qui se passe ?",
      "Je t'attendais. On a des trucs à faire.",
      "Bienvenue. Tu es ponctuel, c'est un bon signe.",
      "Stats en ordre ? On peut y aller.",
      "Efficacité d'abord. Comment tu vas ?"
    ],
    topics: [
      "J'ai closé 3 deals ce matin. Rituels matinaux : ça change tout.",
      "Ta réputation sociale se construit dans les détails.",
      "Les leaders que j'observe ont tous une routine stricte.",
      "Réseau x Discipline = Résultat. L'équation est simple.",
      "Je compile des données sur les patterns de progression. Fascinant.",
      "Tu connais le concept de flywheel ? C'est comme ça que ça marche."
    ],
    declineLines: [
      "Planning chargé. Replanifie.",
      "Pas le bon moment. Je suis à 80% de capacité.",
      "J'optimise mon temps là. Une autre fois.",
      "Non. Trop peu de valeur ajoutée maintenant."
    ],
    acceptLines: [
      "Ok. Rendement attendu : élevé.",
      "Je valide. On y va.",
      "Planifié. On exécute.",
      "Deal. Je suis là à l'heure."
    ],
    busyLines: [
      "Séquence de travail en cours. Ne pas interrompre.",
      "Je traite des données. Reviens dans 20.",
      "Meeting mental en cours. Attends."
    ]
  },

  sana: {
    greetings: [
      "Hey ! T'es venu t'entraîner aussi ?",
      "Salut ! Tu as une tête de quelqu'un qui a besoin de sport.",
      "Oh, te voilà ! Je pensais à toi pendant ma séance.",
      "Bienvenue ! Le corps se souvient de chaque effort.",
      "Hey ! La forme ça se travaille. Prêt ?"
    ],
    topics: [
      "J'ai testé une nouvelle routine HIIT ce matin. Ça brûle bien.",
      "Le cardio c'est pour l'endurance, la muscu pour la structure.",
      "La récupération c'est aussi important que l'entraînement.",
      "J'aide des gens à trouver leur routine. T'en aurais besoin ?",
      "Nutrition + mouvement + sommeil. La trilogie parfaite.",
      "Mon streak d'entraînement tient. La discipline sur le long terme, c'est ça."
    ],
    declineLines: [
      "Pas possible là, je suis au milieu d'une série.",
      "Je récupère, séance intense. Une autre fois.",
      "Je suis en mode nutrition là. Plus tard.",
      "Programme chargé aujourd'hui. Demain ?"
    ],
    acceptLines: [
      "Absolument, allons brûler des calories !",
      "C'est exactement ce qu'il faut. On y va !",
      "Top timing, j'allais justement y aller.",
      "Let's go ! Corps et esprit vont adorer."
    ],
    busyLines: [
      "Séance en cours. Encore 15 minutes.",
      "Je mange mes macros là. Reviens après.",
      "Récupération active. Pas encore dispo."
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
  npcId: string,
  action: AvatarAction,
  mood:   number,
  kind:   "greeting" | "topic" | "busy"
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
  const pool = persona.topics;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Réponse NPC à une proposition d'activité ────────────────────────────────
export function getNpcActivityResponse(
  npcId: string,
  npc:   NpcState,
  _activitySlug: string
): { accepted: boolean; line: string } {
  const persona = NPC_PERSONALITIES[npcId];
  if (!persona) return { accepted: false, line: "..." };

  const tooBusy = npc.action === "sleeping" || npc.energy < 20 || npc.mood < 20;
  if (tooBusy) {
    const line = persona.declineLines[Math.floor(Math.random() * persona.declineLines.length)];
    return { accepted: false, line };
  }

  if (npc.mood > 60 && npc.energy > 40) {
    const line = persona.acceptLines[Math.floor(Math.random() * persona.acceptLines.length)];
    return { accepted: true, line };
  }

  const accepted = Math.random() > 0.5;
  const pool     = accepted ? persona.acceptLines : persona.declineLines;
  const line     = pool[Math.floor(Math.random() * pool.length)];
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
  return pool[Math.floor(Math.random() * pool.length)];
}
