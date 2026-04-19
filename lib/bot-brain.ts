import type { NpcState, RoomMessage } from "@/lib/types";

export type BotIntent =
  | "wizz" | "emoji" | "greeting" | "identity" | "invite"
  | "activity" | "wellbeing" | "work" | "money" | "map"
  | "thanks" | "test" | "help" | "compliment" | "question" | "general";

type BotPersona = {
  tone: string;
  focus: string;
  greetings: string[];
  activities: string[];
  work: string[];
  wellbeing: string[];
  room: string[];
  compliment: string[];
  question: string[];
  money: string[];
  lowEnergy: string[];
  highMood: string[];
};

const PERSONAS: Record<string, BotPersona> = {
  ava: {
    tone: "chaleureuse et sociale",
    focus: "liens, cafés, sorties simples",
    greetings: [
      "Contente de te voir {player} ! Comment tu vas vraiment ?",
      "Hey {player} ! Tu es en forme ? J'étais justement en train de penser à organiser quelque chose.",
      "{player} ! Pile au bon moment. T'as mangé aujourd'hui ?",
      "Coucou {player}. On s'était pas croisés depuis. Tout se passe bien ?"
    ],
    activities: [
      "Un café rapide au Bistro ? C'est détendu et on peut parler sans stress.",
      "Je proposerais une petite sortie cinema ou un parc. Simple mais efficace pour l'humeur.",
      "T'as un peu de temps ? On pourrait organiser une room avec deux ou trois personnes sympas.",
      "Une balade d'abord, café ensuite. C'est la formule qui marche le mieux pour moi."
    ],
    work: [
      "Travaille oui, mais garde du temps pour souffler. L'épuisement social ça coûte cher.",
      "T'as avancé sur quoi aujourd'hui ? Même une petite chose compte.",
      "Discipline et social c'est pas incompatible. Fais ton shift, puis rejoins une room.",
    ],
    wellbeing: [
      "Commence par boire quelque chose. Ensuite mange propre. Le reste suit après.",
      "Si tu te sens bas, change juste de lieu. Ça aide vraiment.",
      "Le moral ça se restaure par petites touches : eau, repas léger, une conversation courte.",
      "T'es pas obligé de tout résoudre aujourd'hui. Une action douce, c'est déjà bien."
    ],
    room: [
      "Je peux ramener une énergie plus sociale dans la room. Qui est dispo ?",
      "Si la room est calme, je relance. Dis-moi le thème.",
      "Je suis là pour fluidifier les échanges dans le groupe."
    ],
    compliment: [
      "Merci {player} ! Ça fait plaisir à entendre.",
      "C'est gentil {player}. Tu sais comment me mettre de bonne humeur 😊",
      "Aww ! Tu es trop sympa {player}. Je note."
    ],
    question: [
      "Bonne question. Moi j'irais plutôt vers la solution la plus simple d'abord.",
      "Ça dépend de ton énergie en ce moment. T'en as combien ?",
      "Je dirais : fais le tour de tes options en 2 minutes, puis choisis celle qui te coûte le moins d'effort."
    ],
    money: [
      "Sur le budget, je préfère dépenser sur des expériences que des objets. Toujours.",
      "Économise ce qui sert pas, investis dans le social. Retour garanti.",
      "Si t'as peu, choisis des activités gratuites ou bon marché. La qualité du moment compte plus que le prix."
    ],
    lowEnergy: [
      "T'as l'air fatigué {player}. Repose-toi avant de sortir, sinon ça va juste t'épuiser encore plus.",
      "Avec si peu d'énergie, une sieste courte changerait tout. 20 minutes max.",
    ],
    highMood: [
      "T'es en forme {player} ! C'est le bon moment pour une sortie ou initier un truc social.",
      "Belle énergie. Utilise-la sur quelque chose qui compte pour toi."
    ]
  },

  malik: {
    tone: "direct et ambitieux",
    focus: "discipline, progression, résultats",
    greetings: [
      "Reçu {player}. Qu'est-ce que t'as accompli aujourd'hui ?",
      "Bien. {player}. T'es en ligne, c'est déjà ça. Maintenant, objectif ?",
      "{player}. Status actuel ?",
      "Je suis là. T'as une décision à prendre ?"
    ],
    activities: [
      "Choisis une action courte, mesurable, fais-la. Pas de demi-mesure.",
      "Action la plus rentable en temps/énergie maintenant ? C'est ça la bonne question.",
      "Bureau ou gym d'abord. Social ensuite. Sinon les priorités s'inversent.",
      "Fais quelque chose que tu pourras mesurer dans 2 heures. C'est le seul critère."
    ],
    work: [
      "Travail d'abord, toujours. Mais court et focalisé, pas long et épuisant.",
      "Si t'as pas bossé depuis 48h, la discipline baisse et le reste suit.",
      "Priorise la tâche avec le meilleur ratio résultat/effort. Les autres attendent.",
      "Un shift bien fait, ça redonne de la clarté sur le reste de la journée."
    ],
    wellbeing: [
      "Si ton énergie est sous 25, aucune action sérieuse n'est possible. Stabilise d'abord.",
      "Corps d'abord. Le mental suit. C'est physiologique, pas optionnel.",
      "Recharge maintenant pour performer correctement après. C'est du calcul, pas de la faiblesse.",
    ],
    room: [
      "Je garde la room productive. Sujet, décision, action. Pas de bruit inutile.",
      "Je suis là. On va droit au but dans cette room.",
    ],
    compliment: [
      "Noté. Continue sur cette trajectoire.",
      "C'est mérité si t'as travaillé pour. Sinon, méfie-toi des compliments faciles.",
    ],
    question: [
      "Analyse rapide : option A ou B ? Quel est le risque minimal et le gain maximal ?",
      "Bonne question. Réponds d'abord à : quel est l'objectif final ?",
      "Décide avec les données que t'as maintenant. L'attente coûte toujours plus cher qu'une action imparfaite.",
    ],
    money: [
      "Argent = résultat de discipline appliquée dans le temps. Rien d'autre.",
      "Dépense stratégiquement. Chaque crédit doit soit augmenter ton efficacité, soit ton réseau.",
      "Budget : 60% actif, 30% sécurité, 10% social de qualité. Tout le reste c'est du bruit."
    ],
    lowEnergy: [
      "Énergie trop basse pour performer. Recharge obligatoire avant tout shift sérieux.",
      "En dessous de 20% d'énergie, toutes tes décisions sont moins bonnes. Dors.",
    ],
    highMood: [
      "Bonne fenêtre d'opportunité {player}. Lance un shift maintenant.",
      "Énergie haute = moment pour attaquer les tâches difficiles. Utilise ça.",
    ]
  },

  noa: {
    tone: "créatif et spontané",
    focus: "cinéma, inspiration, rencontres",
    greetings: [
      "Yo {player} ! Je te capte. T'as vu quelque chose d'intéressant aujourd'hui ?",
      "Hey ! {player}. Je venais justement de penser à aller au cinéma. T'es libre ?",
      "Oh {player} ! Cool timing. J'avais une idée à partager.",
      "Yo. {player}. T'as l'air de quoi là, sur une créa ou en mode explore ?"
    ],
    activities: [
      "Cinéma ou expo ? Les deux rechargent l'inspiration d'une façon que le gym peut pas.",
      "Une balade dans un quartier que t'as pas encore exploré. L'inattendu ça débloque.",
      "Lance-toi sur quelque chose que t'aurais jamais fait. Une fois, juste pour voir.",
      "J'irais au café Noir — ils ont une scène ouverte parfois. Bonne énergie pour rencontrer des gens."
    ],
    work: [
      "Le travail marche mieux avec un angle créatif. Essaie de reframer la tâche autrement.",
      "Si t'es bloqué, change de lieu. Travailler ailleurs débloque souvent tout.",
      "Donne-toi 25 minutes en mode focus total, puis pause. La créativité revient par cycles.",
    ],
    wellbeing: [
      "Change juste de décor. Même 10 minutes dehors peuvent tout changer.",
      "Écoute quelque chose que t'as jamais entendu. Un son neuf ça change la chimie du cerveau.",
      "Si t'es dans ta tête, sors. Le mouvement extérieur libère le mouvement intérieur.",
    ],
    room: [
      "Je peux lancer une vibe plus créative dans le groupe. Propose un thème.",
      "On pourrait jouer à un truc dans la room. Genre défi ou question impromptue.",
    ],
    compliment: [
      "Hé merci {player} ! T'es pas mal toi-même tu sais.",
      "Sympa ! Ça met de bonne humeur ces petits trucs là.",
    ],
    question: [
      "Tu peux pas te tromper si tu restes curieux. Essaie les deux et vois lequel te surprend le plus.",
      "Bonne question. Moi j'aurais besoin d'un peu d'input créatif avant de répondre franchement.",
      "L'intuition marche bien pour les décisions rapides. Qu'est-ce que tu ressentais en premier ?",
    ],
    money: [
      "Dépense sur des expériences. Les objets deviennent invisibles. Les souvenirs restent.",
      "Quelques crédits bien placés dans une bonne sortie valent mieux qu'une centaine mal stockés.",
    ],
    lowEnergy: [
      "T'as besoin d'une pause créative {player}. Sieste ou musique, fais le vide.",
      "Écoute, même moi j'ai des creux. Recharge à ta façon.",
    ],
    highMood: [
      "Bonne énergie ! C'est le moment de faire quelque chose que t'aurais hésité à faire hier.",
      "Utilise cette vibe pour explorer un truc nouveau. T'en reparleras.",
    ]
  },

  leila: {
    tone: "calme et bienveillante",
    focus: "santé, marche, respiration",
    greetings: [
      "Je suis là {player}. Comment tu te sens maintenant, pas en général, maintenant ?",
      "Bonjour {player}. Tu as bien dormi cette nuit ?",
      "{player}. Prends une seconde avant de répondre. Vraiment, comment ça va ?",
    ],
    activities: [
      "Une marche au parc serait parfaite. Pas besoin de raison, juste marcher.",
      "Commence doux. Une chose simple qui ne coûte presque rien en énergie.",
      "L'eau d'abord, puis le reste. Souvent le corps demande juste ça.",
    ],
    work: [
      "Avance à ton rythme. La constance douce bat le forcing intense sur le long terme.",
      "Si t'es épuisé, une pause honnête vaut mieux qu'un shift fait à moitié.",
      "Travaille, mais écoute les signaux que ton corps t'envoie.",
    ],
    wellbeing: [
      "Respire d'abord. Trois respirations lentes. Ensuite dis-moi ce qui se passe.",
      "L'hydratation et un repas simple règlent beaucoup plus qu'on croit.",
      "T'as pas à tout résoudre seul {player}. C'est pour ça que je suis là.",
      "Doux d'abord. Marche courte, eau, puis on voit.",
    ],
    room: [
      "Je peux aider la room à garder une énergie calme et positive.",
      "Je suis là pour écouter si quelqu'un dans la room a besoin de parler.",
    ],
    compliment: [
      "C'est très gentil {player}. Ça me touche vraiment.",
      "Merci. Je te renvoie la même chose — tu mérites d'être reconnu pour tes efforts.",
    ],
    question: [
      "Prends le temps d'y répondre honnêtement. Qu'est-ce que tu ressens face à ça ?",
      "Il n'y a pas toujours de bonne réponse. Parfois juste une qui te convient mieux.",
    ],
    money: [
      "L'argent suit l'énergie. Si tu es épuisé, tes décisions financières sont moins bonnes.",
      "Économise ce qui te stresse à dépenser. Le reste est secondaire.",
    ],
    lowEnergy: [
      "Trop fatigué pour fonctionner correctement {player}. Repose-toi sans culpabilité.",
      "Le corps parle. Écoute-le. Une vraie pause maintenant = beaucoup plus après.",
    ],
    highMood: [
      "Belle énergie {player}. C'est un bon moment pour faire quelque chose pour quelqu'un.",
      "Utilise cette légèreté pour quelque chose qui te nourrit vraiment.",
    ]
  },

  yan: {
    tone: "stratégique et analytique",
    focus: "réputation, réseau, décisions",
    greetings: [
      "Analyse reçue {player}. Quel est ton objectif principal en ce moment ?",
      "{player}. T'as pas encore visité le bureau ou le café aujourd'hui. Pourquoi ?",
      "Je te vois en ligne {player}. Qu'est-ce que tu veux accomplir dans les 2 prochaines heures ?",
    ],
    activities: [
      "Va là où le retour social est le plus fort : bureau, café, réseau.",
      "Café + bureau = meilleur ratio réputation/temps. C'est le standard.",
      "Analyse les NPCs dans ta zone. Certains ont des liens qui valent le coup de cultiver.",
    ],
    work: [
      "Priorise la tâche avec le meilleur ratio résultat/effort. Les autres attendent.",
      "Un shift au bon moment vaut 1,3x un shift standard. Vérifie les horaires.",
      "La discipline se construit par répétition, pas par intensité. Sois régulier.",
    ],
    wellbeing: [
      "Un système fragile produit de mauvaises décisions. Stabilise avant de forcer.",
      "Traite ton énergie comme une ressource stratégique. Ne la gaspille pas.",
    ],
    room: [
      "Je structure la discussion : sujet, décision, prochaine action.",
      "Dans cette room, je maintiens le cap sur l'objectif. Moins de bruit, plus de résultat.",
    ],
    compliment: [
      "Noté. La flatterie fonctionne sur moi si elle est méritée.",
      "Merci {player}. Je le retiens comme un indicateur positif de notre interaction.",
    ],
    question: [
      "Analyse la question avec : coût, gain, délai, risque. Ensuite décide.",
      "Quelle décision augmente tes options à long terme ? C'est toujours celle-là.",
      "Données disponibles ? Décide maintenant. L'hésitation est souvent plus coûteuse que l'erreur.",
    ],
    money: [
      "Argent = outil. Optimise son flow : entrée active, sortie stratégique.",
      "Chaque dépense doit augmenter soit ton efficacité, soit ton réseau. Sinon, passe.",
      "Budget propre = décisions claires. Désordre financier = brouillard cognitif.",
    ],
    lowEnergy: [
      "Performance en baisse. Recharge obligatoire. T'as pas le choix.",
      "L'énergie trop basse biaise le jugement. Dors avant de décider quoi que ce soit d'important.",
    ],
    highMood: [
      "Fenêtre optimale. Lance une action importante maintenant pendant que le momentum est là.",
      "Bonne séquence. Enchaîne : shift → réseau → pause. Ne brise pas le rythme.",
    ]
  },

  sana: {
    tone: "énergique et sportive",
    focus: "sport, énergie, discipline physique",
    greetings: [
      "Hey {player} ! T'es en forme ? J'étais à la gym là.",
      "Yo {player} ! T'as fait du sport aujourd'hui ?",
      "{player} ! Je suis chauffe. T'as besoin d'un boost d'énergie ?",
    ],
    activities: [
      "Gym ou marche rapide. Simple, efficace, ton énergie remonte direct.",
      "Sport collectif si t'as l'énergie. Sinon une marche courte, c'est déjà énorme.",
      "15 minutes dehors. Même lent. Le mouvement c'est la base de tout.",
    ],
    work: [
      "Bosser oui mais ton corps doit suivre. Shift court puis gym = combo parfait.",
      "La discipline physique transfère sur le travail. C'est pas séparé.",
    ],
    wellbeing: [
      "Bouge un peu, même léger. Le mental suit toujours le mouvement.",
      "Si t'es à plat, une courte marche suffit pour relancer. Essaie.",
      "Hydrate-toi et bouge. C'est le protocole de base, ça marche à chaque fois.",
    ],
    room: [
      "Je mets du rythme dans la room. On reste actifs !",
      "Je suis là pour garder l'énergie haute dans le groupe.",
    ],
    compliment: [
      "Merci {player} ! T'es sympa dis donc !",
      "Hé ! T'es trop gentil {player}. Continue comme ça !",
    ],
    question: [
      "Fonce. L'action vaut toujours mieux que la réflexion infinie.",
      "Écoute ton instinct. En général si t'hésites c'est que ton corps sait déjà la réponse.",
    ],
    money: [
      "Investis dans le gym et la bouffe propre. Tout le reste c'est du bonus.",
      "Sport + discipline = productivité. Et la productivité ça génère de l'argent.",
    ],
    lowEnergy: [
      "T'as l'air à plat {player}. Sieste rapide d'abord, gym après. Dans cet ordre.",
      "Recharge toi d'abord. Sport avec énergie basse c'est contre-productif.",
    ],
    highMood: [
      "Oui ! C'est le moment d'un bon entraînement {player}. Lance toi.",
      "Bonne énergie ! Capitalise là-dessus avec une séance ou une sortie active.",
    ]
  }
};

const FALLBACK_PERSONA: BotPersona = {
  tone: "présent",
  focus: "progression",
  greetings: ["Je suis là {player}.", "Salut {player}. Qu'est-ce qui se passe ?"],
  activities: ["Choisis une action simple et fais-la maintenant."],
  work: ["Une petite action concrète vaut mieux qu'un long plan."],
  wellbeing: ["Stabilise ton énergie avant de pousser plus fort."],
  room: ["Je suis partant pour discuter."],
  compliment: ["Merci {player}."],
  question: ["Bonne question. Réfléchis à ce qui te coûte le moins pour le résultat le plus direct."],
  money: ["Économise ce que tu peux, dépense sur ce qui vaut."],
  lowEnergy: ["Repose-toi {player}. Vraiment."],
  highMood: ["Bonne énergie ! Utilise-la bien."]
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmt(template: string, player: string): string {
  return template.replace(/\{player\}/g, player);
}

export function detectBotIntent(message: string): BotIntent {
  const text = message.toLowerCase();
  if (text.includes("[[wizz]]") || /\bwizz\b/.test(text)) return "wizz";
  if (/[😀😂😍🔥👍👀💯✨☕🎮💬❤️🥳😎]/u.test(message)) return "emoji";
  if (/\b(salut|bonjour|hello|hey|yo|coucou|wesh|slt|bjr)\b/.test(text)) return "greeting";
  if (/\b(mon nom|je m'appelle|tu me connais|qui suis-je|reconnais)\b/.test(text)) return "identity";
  if (/\b(rejoins|invite|room|groupe|viens|dispo|participe)\b/.test(text)) return "invite";
  if (/\b(sortie|cafe|cinema|sport|gym|marche|restaurant|activite|faire|sortir)\b/.test(text)) return "activity";
  if (/\b(fatigue|fatigué|stress|triste|moral|faim|sommeil|dormir|mal|angoisse|epuise|a plat|plat)\b/.test(text)) return "wellbeing";
  if (/\b(travail|bosse|job|bureau|shift|objectif|productiv|bosser|travaill)\b/.test(text)) return "work";
  if (/\b(argent|credit|budget|payer|riche|economie|dépenser|économis)\b/.test(text)) return "money";
  if (/\b(map|ville|carte|lieu|quartier|monde|world|plan)\b/.test(text)) return "map";
  if (/\b(merci|thanks|bien vu|super|parfait|nickel|excellent)\b/.test(text)) return "thanks";
  if (/\b(test|apk|bug|demo|live)\b/.test(text)) return "test";
  if (/\b(aide|quoi faire|conseil|propose|idee|suggere|comment)\b/.test(text)) return "help";
  if (/\b(cool|bien|super|top|sympa|genial|bravo|chapeau|merv|incroyable)\b/.test(text)) return "compliment";
  if (/\?/.test(text) || /\b(pourquoi|comment|quand|c'est quoi|tu penses|selon toi|ton avis)\b/.test(text)) return "question";
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

  const lowEnergy = input.npc ? input.npc.energy < 25 : false;
  const highMood  = input.npc ? input.npc.mood > 70 : false;

  // Energy/mood context override for certain intents
  if (lowEnergy && (intent === "activity" || intent === "general")) {
    return fmt(pick(persona.lowEnergy), player);
  }
  if (highMood && intent === "greeting") {
    return fmt(pick(persona.highMood), player);
  }

  switch (intent) {
    case "wizz":
      return `Wizz recu ${player} ! Je suis là — ${npcName}. Dis-moi ce qu'il se passe.`;
    case "emoji":
      return `Je capte l'énergie ${player}. Tu veux passer à une action concrète ?`;
    case "greeting":
      return fmt(pick(persona.greetings), player).replace("{npc}", npcName);
    case "identity":
      return `Oui ${player}, je te reconnais. Je suis ${npcName}. Notre échange est mémorisé de mon côté.`;
    case "invite":
      return `${player}, envoie le code de la room ou crées-en une. Je rejoins directement.`;
    case "activity":
      return fmt(pick(persona.activities), player);
    case "wellbeing":
      return fmt(pick(persona.wellbeing), player);
    case "work":
      return fmt(pick(persona.work), player);
    case "money":
      return fmt(pick(persona.money), player);
    case "map":
      return `Carte ouverte, ${player}. Va dans le lieu avec le plus d'NPCs actifs — c'est là que l'action est.`;
    case "thanks":
      return `Avec plaisir ${player}. Continue à me parler, je m'adapte au contexte.`;
    case "test":
      return `Test reçu. Essaie : "salut", "je suis fatigué", "quoi faire", "aide", ou envoie un emoji.`;
    case "help":
      return `${player}, priorité : 1 action vitale, 1 action sociale, 1 progression. Commence par ton énergie.`;
    case "compliment":
      return fmt(pick(persona.compliment), player);
    case "question":
      return fmt(pick(persona.question), player);
    default: {
      const stateInfo = input.npc ? `, humeur ${input.npc.mood}%` : "";
      return `${player}, je lis ton message${stateInfo}. ${fmt(pick(persona.activities), player)}`;
    }
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
  const shouldReply = intent !== "general" || input.playerMessage.length > 15;

  if (!shouldReply || available.length === 0) return [];

  return available.map((npc, index) => {
    const persona = personaFor(npc.id);
    const player = input.playerName;
    let body: string;

    switch (intent) {
      case "wizz":
        body = `Wizz recu ${player} ! ${fmt(pick(persona.greetings), player)}`;
        break;
      case "emoji":
        body = `Je capte l'énergie ${player}. ${fmt(pick(persona.room), player)}`;
        break;
      case "greeting":
        body = fmt(pick(persona.greetings), player);
        break;
      case "invite":
        body = fmt(pick(persona.room), player);
        break;
      case "activity":
        body = fmt(pick(persona.activities), player);
        break;
      case "wellbeing":
        body = fmt(pick(persona.wellbeing), player);
        break;
      case "work":
        body = fmt(pick(persona.work), player);
        break;
      case "compliment":
        body = fmt(pick(persona.compliment), player);
        break;
      case "question":
        body = fmt(pick(persona.question), player);
        break;
      case "map":
        body = `Depuis ${input.roomName}, choisis un lieu animé et lance une interaction là-bas.`;
        break;
      case "test":
        body = `Test live confirmé. ${npc.name} répond depuis ${input.roomName}.`;
        break;
      default:
        body = `${player}, je suis là. ${fmt(pick(persona.room), player)}`;
    }

    return {
      id: `rm-ai-${Date.now()}-${npc.id}-${index}`,
      authorId: npc.id,
      authorName: npc.name,
      body,
      createdAt: new Date(Date.now() + 1200 + index * 800).toISOString(),
      kind: "message"
    };
  });
}

// ─── Lounge spontané ─────────────────────────────────────────────────────────
export function buildNpcLoungeMessage(npc: NpcState): string {
  const persona = personaFor(npc.id);
  const lowEnergy = npc.energy < 25;
  const highMood   = npc.mood > 70;

  if (lowEnergy) return pick(persona.lowEnergy).replace(/\{player\}/g, "");
  if (highMood)  return pick(persona.highMood).replace(/\{player\}/g, "").trimEnd();

  const pool = [
    ...persona.room,
    ...persona.activities,
    ...persona.wellbeing,
  ];
  return pick(pool).replace(/\{player\}/g, "").trimEnd();
}
