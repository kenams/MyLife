import type { NpcState, RoomMessage } from "@/lib/types";

export type BotIntent =
  | "greeting"
  | "identity"
  | "invite"
  | "activity"
  | "wellbeing"
  | "work"
  | "money"
  | "map"
  | "thanks"
  | "test"
  | "help"
  | "general";

type BotPersona = {
  tone: string;
  focus: string;
  greeting: string;
  activity: string;
  work: string;
  wellbeing: string;
  room: string;
};

const PERSONAS: Record<string, BotPersona> = {
  ava: {
    tone: "chaleureuse et sociale",
    focus: "liens, cafes, sorties simples",
    greeting: "Contente de te voir",
    activity: "Je partirais sur un cafe simple ou une petite room avec deux personnes.",
    work: "Garde du temps pour respirer aussi, sinon tu vas t'eteindre socialement.",
    wellbeing: "Tu devrais faire simple: boire, manger propre, puis parler a quelqu'un.",
    room: "Je peux ramener une energie plus sociale dans la room."
  },
  malik: {
    tone: "direct et ambitieux",
    focus: "discipline, progression, resultats",
    greeting: "Bien recu",
    activity: "Choisis une action courte, fais-la, puis mesure le resultat.",
    work: "Travail d'abord, mais sans detruire ton energie. Routine propre.",
    wellbeing: "Si ton corps baisse, tes plans ralentissent. Recharge avant de forcer.",
    room: "Je garde la room efficace: objectif clair, pas de bavardage inutile."
  },
  noa: {
    tone: "creatif et spontané",
    focus: "cinema, inspiration, rencontres",
    greeting: "Yo, je te capte",
    activity: "Un cinema ou une balade peut relancer l'inspiration direct.",
    work: "Le travail marche mieux quand tu gardes un angle creatif.",
    wellbeing: "Change de decor. Meme dix minutes dehors peuvent debloquer l'humeur.",
    room: "Je peux lancer une vibe plus creative dans le groupe."
  },
  leila: {
    tone: "calme et bienveillante",
    focus: "sante, marche, respiration",
    greeting: "Je suis la",
    activity: "Une marche au parc serait parfaite pour reprendre proprement.",
    work: "Avance, mais respecte ton energie. La constance vaut mieux que le forcing.",
    wellbeing: "Respire, hydrate-toi, puis fais une action douce.",
    room: "Je peux aider la room a rester calme et positive."
  },
  yan: {
    tone: "strategique et analytique",
    focus: "reputation, reseau, decisions",
    greeting: "Analyse recue",
    activity: "Va la ou le retour social est le plus fort: cafe, bureau, reseau.",
    work: "Priorise une tache rentable. Le reste attend.",
    wellbeing: "Un systeme fragile donne de mauvais resultats. Stabilise d'abord.",
    room: "Je structure la discussion: sujet, decision, prochaine action."
  },
  sana: {
    tone: "energique et sportive",
    focus: "sport, energie, discipline physique",
    greeting: "Hey, je suis chaude",
    activity: "Gym ou marche rapide. Ton energie va remonter.",
    work: "Bosser oui, mais ton corps doit suivre.",
    wellbeing: "Bouge un peu, meme leger. Le mental suit souvent le mouvement.",
    room: "Je mets du rythme dans la room."
  }
};

const FALLBACK_PERSONA: BotPersona = {
  tone: "present",
  focus: "progression",
  greeting: "Je suis la",
  activity: "Choisis une action simple et fais-la maintenant.",
  work: "Une petite action concrete vaut mieux qu'un long plan.",
  wellbeing: "Stabilise ton energie avant de pousser plus fort.",
  room: "Je suis partant pour discuter."
};

export function detectBotIntent(message: string): BotIntent {
  const text = message.toLowerCase();
  if (/\b(salut|bonjour|hello|hey|yo|coucou|wesh)\b/.test(text)) return "greeting";
  if (/\b(mon nom|je m'appelle|tu me connais|qui suis-je|reconnais)\b/.test(text)) return "identity";
  if (/\b(rejoins|invite|room|groupe|viens|dispo)\b/.test(text)) return "invite";
  if (/\b(sortie|cafe|cinema|sport|gym|marche|restaurant|activite)\b/.test(text)) return "activity";
  if (/\b(fatigue|stress|triste|moral|faim|sommeil|dormir|mal|angoisse)\b/.test(text)) return "wellbeing";
  if (/\b(travail|bosse|job|bureau|shift|objectif|productiv)\b/.test(text)) return "work";
  if (/\b(argent|credit|budget|payer|riche|economie)\b/.test(text)) return "money";
  if (/\b(map|ville|carte|lieu|quartier|monde|world)\b/.test(text)) return "map";
  if (/\b(merci|thanks|bien vu)\b/.test(text)) return "thanks";
  if (/\b(test|apk|bug|demo|live)\b/.test(text)) return "test";
  if (/\b(aide|quoi faire|conseil|propose|idee)\b/.test(text)) return "help";
  return "general";
}

function personaFor(npcId: string) {
  return PERSONAS[npcId] ?? FALLBACK_PERSONA;
}

function nameOf(npc: NpcState | null | undefined, fallbackId: string, fallbackName?: string) {
  return npc?.name ?? fallbackName ?? fallbackId;
}

export function buildDirectBotReply(input: {
  npc: NpcState | null | undefined;
  residentId: string;
  residentName?: string;
  playerName: string;
  playerMessage: string;
  relationshipScore: number;
  messageCount: number;
}) {
  const intent = detectBotIntent(input.playerMessage);
  const persona = personaFor(input.residentId);
  const npcName = nameOf(input.npc, input.residentId, input.residentName);
  const player = input.playerName || "toi";
  const affinity = input.relationshipScore >= 60 ? "on se connait assez bien" : input.relationshipScore >= 35 ? "le lien commence a prendre" : "on apprend encore a se connaitre";
  const mood = input.npc ? `humeur ${input.npc.mood}%, energie ${input.npc.energy}%` : "etat inconnu";

  switch (intent) {
    case "greeting":
      return `${persona.greeting} ${player}. C'est ${npcName}. ${affinity}, donc je te reponds franchement.`;
    case "identity":
      return `Oui ${player}, je te reconnais. Pour moi tu es le joueur principal ici, et je garde le contexte de notre lien.`;
    case "invite":
      return `${player}, je peux te rejoindre. Cree une room ou envoie le code, et je m'adapte a l'ambiance.`;
    case "activity":
      return `${persona.activity} Vu mon etat actuel (${mood}), je te conseille une action courte maintenant.`;
    case "wellbeing":
      return `${player}, ${persona.wellbeing} Ensuite seulement tu relances le social ou le travail.`;
    case "work":
      return `${persona.work} Si tu veux progresser, transforme ca en une action de 10 minutes.`;
    case "money":
      return `Cote budget, evite les achats impulsifs. Gagne d'abord, depense apres. Le social doit rester rentable pour toi.`;
    case "map":
      return `Va sur la carte, choisis un lieu vivant, puis ouvre le chat de room. La ville doit guider tes rencontres.`;
    case "thanks":
      return `Avec plaisir ${player}. Continue a me parler normalement, je repondrai selon le contexte.`;
    case "test":
      return `Mode test compris. Essaie: bonjour, invite-moi, je suis fatigue, quoi faire, ou on va au cafe.`;
    case "help":
      return `${player}, fais simple: 1 action vitale, 1 action sociale, 1 progression. La meilleure prochaine action depend de ton energie.`;
    default:
      return `${persona.greeting}. Je lis ton message comme ca: ${persona.focus}. Reponds-moi avec une intention claire et je suivrai.`;
  }
}

export function buildRoomBotReplies(input: {
  roomId: string;
  roomName: string;
  playerName: string;
  playerMessage: string;
  onlineNpcs: NpcState[];
  maxReplies?: number;
}): RoomMessage[] {
  const intent = detectBotIntent(input.playerMessage);
  const available = input.onlineNpcs.slice(0, Math.max(1, input.maxReplies ?? 2));
  const shouldReply = intent !== "general" || input.playerMessage.length > 18;

  if (!shouldReply || available.length === 0) return [];

  return available.map((npc, index) => {
    const persona = personaFor(npc.id);
    const base =
      intent === "greeting" ? `${persona.greeting} ${input.playerName}, je suis dans la room.`
      : intent === "invite" ? `${persona.room} Je peux rester ici si le groupe bouge.`
      : intent === "activity" ? persona.activity
      : intent === "wellbeing" ? persona.wellbeing
      : intent === "work" ? persona.work
      : intent === "map" ? `Depuis ${input.roomName}, le mieux est de choisir un lieu et d'y lancer une interaction.`
      : intent === "test" ? "Test live recu. Les bots repondent selon l'intention du message."
      : `${input.playerName}, je suis la. ${persona.room}`;

    return {
      id: `rm-ai-${Date.now()}-${npc.id}-${index}`,
      authorId: npc.id,
      authorName: npc.name,
      body: base,
      createdAt: new Date(Date.now() + 1200 + index * 700).toISOString(),
      kind: "message"
    };
  });
}
