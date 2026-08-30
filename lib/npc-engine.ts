// Moteur de dialogue PNJ 100% local et déterministe — aucune clé API requise.
// L'IA générative (Anthropic/OpenAI) reste une amélioration FACULTATIVE
// branchée par-dessus (voir npc-chat.ts), jamais une dépendance du jeu.
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Intentions reconnues ─────────────────────────────────────────────────
export type NpcIntent =
  | "greeting" | "introduction" | "ask_toulouse" | "ask_quartier"
  | "propose_activity" | "flirt" | "refusal" | "provocation"
  | "ask_mission" | "ask_advice" | "discuss_event" | "farewell" | "unknown";

const INTENT_KEYWORDS: Record<Exclude<NpcIntent, "unknown">, string[]> = {
  greeting:         ["salut", "coucou", "yo", "hey", "bonjour", "bjr", "wesh", "cc"],
  introduction:     ["je m'appelle", "moi c'est", "je suis nouveau", "je suis nouvelle", "présente"],
  ask_toulouse:     ["toulouse", "la ville", "capitole", "garonne", "occitanie"],
  ask_quartier:     ["quartier", "coin", "zone", "esquirol", "compans", "carmes", "saint-cyprien", "minimes", "jean-jaures"],
  propose_activity: ["on fait quoi", "ça te dit", "ca te dit", "on se voit", "un verre", "sortir", "balade", "ciné", "cine"],
  flirt:            ["belle", "beau", "charmant", "craquant", "mignon", "mignonne", "tu es sympa", "t'es cool", "crush"],
  refusal:          ["non merci", "pas envie", "laisse-moi", "arrete", "arrête", "stop", "lâche"],
  provocation:      ["nul", "chelou", "relou", "ferme-la", "ta gueule", "connard", "connasse"],
  ask_mission:      ["mission", "défi", "defi", "quête", "quete", "tâche", "tache", "récompense", "recompense"],
  ask_advice:       ["conseil", "avis", "que ferais-tu", "tu ferais quoi", "aide-moi", "aide moi"],
  discuss_event:    ["event", "évènement", "evenement", "rassemblement", "soirée", "soiree"],
  farewell:         ["au revoir", "a plus", "à plus", "bye", "ciao", "bonne soirée", "bonne soiree", "je file"],
};

export function classifyIntent(text: string): NpcIntent {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [Exclude<NpcIntent, "unknown">, string[]][]) {
    for (const kw of keywords) {
      const kwNorm = kw.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (t.includes(kwNorm)) return intent;
    }
  }
  return "unknown";
}

// ── Personnalité déterministe (dérivée de l'id du PNJ, stable dans le temps) ──
export type NpcPersonality = {
  ton: "chaleureux" | "cash" | "taquin" | "posé" | "hype";
  interet: string;
  quartier: string;
  emojiStyle: string;
};

const TONS: NpcPersonality["ton"][] = ["chaleureux", "cash", "taquin", "posé", "hype"];
const INTERETS = ["le foot", "la musique", "le street art", "la cuisine", "les jeux vidéo", "la rando", "la mode", "le rap", "le vélo", "les séries"];
const QUARTIERS = ["Capitole", "Saint-Cyprien", "Les Carmes", "Compans-Caffarelli", "Esquirol", "Minimes", "Jean-Jaurès", "Saint-Aubin"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function getNpcPersonality(npcId: string): NpcPersonality {
  const h = hashStr(npcId);
  return {
    ton: TONS[h % TONS.length],
    interet: INTERETS[(h >> 3) % INTERETS.length],
    quartier: QUARTIERS[(h >> 6) % QUARTIERS.length],
    emojiStyle: ["✨", "🔥", "😎", "🌿", "⚡"][(h >> 9) % 5],
  };
}

// ── Relation joueur ↔ PNJ (mémoire locale sur l'appareil) ────────────────
export type NpcRelationship = {
  trust: number;           // 0-100
  lastIntent: NpcIntent | null;
  lastTopics: string[];    // dernières lignes utilisées, pour éviter la répétition
  turns: number;
  updatedAt: string;
  encounters?: number;             // rencontres marquantes (bornées, pas un log)
  lastOutcome?: string | null;     // dernier résultat d'approche
  lastEncounterAt?: string | null; // pour le cooldown anti-spam
};

function storageKey(playerId: string, npcId: string) {
  return `npc-relationship:${playerId}:${npcId}`;
}

export async function loadNpcRelationship(playerId: string, npcId: string): Promise<NpcRelationship> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(playerId, npcId));
    if (raw) return JSON.parse(raw) as NpcRelationship;
  } catch { /* ignore, on repart d'une relation neuve */ }
  return { trust: 20, lastIntent: null, lastTopics: [], turns: 0, updatedAt: new Date().toISOString() };
}

async function saveNpcRelationship(playerId: string, npcId: string, rel: NpcRelationship) {
  try {
    await AsyncStorage.setItem(storageKey(playerId, npcId), JSON.stringify(rel));
  } catch { /* stockage indisponible, tant pis pour la persistance */ }
}

/** Délai minimum avant qu'un même PNJ puisse re-proposer / re-suggérer (anti-spam). */
export const NPC_ENCOUNTER_COOLDOWN_MS = 45 * 60_000;

export function npcEncounterCoolingDown(rel: NpcRelationship, now = Date.now()): boolean {
  if (!rel.lastEncounterAt) return false;
  const t = Date.parse(rel.lastEncounterAt);
  return Number.isFinite(t) && now - t < NPC_ENCOUNTER_COOLDOWN_MS;
}

/**
 * Enregistre UNE rencontre marquante (pas chaque message). Mémoire bornée :
 * `encounters` est un simple compteur plafonné, aucun historique de texte.
 */
export async function noteNpcEncounter(
  playerId: string, npcId: string, outcome: string,
): Promise<NpcRelationship> {
  const rel = await loadNpcRelationship(playerId, npcId);
  const positive = outcome === "ACCEPT" || outcome === "SHORT" || outcome === "OUTING_OK";
  const negative = outcome === "DECLINE" || outcome === "OUTING_NO";
  const next: NpcRelationship = {
    ...rel,
    encounters: Math.min(99, (rel.encounters ?? 0) + 1),
    lastOutcome: outcome,
    lastEncounterAt: new Date().toISOString(),
    trust: Math.max(0, Math.min(100, rel.trust + (positive ? 2 : negative ? -1 : 0))),
    updatedAt: new Date().toISOString(),
  };
  await saveNpcRelationship(playerId, npcId, next);
  return next;
}

const TRUST_DELTA: Partial<Record<NpcIntent, number>> = {
  greeting: 1, introduction: 3, ask_toulouse: 1, ask_quartier: 1,
  propose_activity: 2, flirt: 1, ask_mission: 1, ask_advice: 2,
  discuss_event: 1, farewell: 0, refusal: -2, provocation: -5,
};

// ── Variantes de phrases par intention/ton (plusieurs par cellule pour éviter les répétitions) ──
type Bank = Record<NpcIntent, Partial<Record<NpcPersonality["ton"], string[]>>>;

const BANK: Bank = {
  greeting: {
    chaleureux: ["Hey toi, ça fait plaisir de te croiser ici !", "Salut ! Belle journée pour traîner à {quartier}, non ?"],
    cash: ["Yo. Ça roule ?", "Salut, t'es dans le coin pour quoi ?"],
    taquin: ["Ohhh regarde qui débarque 👀", "Salut, tu me surveilles ou quoi ? 😏"],
    posé: ["Salut, content de te voir.", "Hey, tranquille ici à {quartier}."],
    hype: ["YOOO t'es LÀ ?! {emoji}", "Salut, l'ambiance est folle aujourd'hui !"],
  },
  introduction: {
    chaleureux: ["Enchanté ! Moi c'est {name}, je traîne souvent vers {quartier}.", "Ravi de faire connaissance, bienvenue à Toulouse !"],
    cash: ["{name}. Et toi ?", "Ok, {name}. On se capte plus tard."],
    taquin: ["{name}, le/la plus stylé(e) de {quartier} 😌", "T'as de la chance de me croiser, {name} pour te servir."],
    posé: ["Moi c'est {name}. Enchanté.", "{name}. Je suis souvent par ici."],
    hype: ["{name} dans la place ! Toulouse c'est ma ville {emoji}", "GO on se capte, moi c'est {name} !"],
  },
  ask_toulouse: {
    chaleureux: ["Toulouse c'est la ville rose, tu vas kiffer, surtout {quartier}.", "J'adore cette ville, il y a toujours un truc à faire."],
    cash: ["Toulouse ? Sympa mais faut connaître les bons coins.", "Ça dépend où tu traînes, mais ouais c'est correct."],
    taquin: ["Toulouse c'est la meilleure ville, tu me diras merci plus tard 😏", "Demande-moi, je connais tous les bons spots ici."],
    posé: ["Toulouse, ville tranquille, surtout du côté de {quartier}.", "C'est une bonne ville pour vivre, oui."],
    hype: ["TOULOUSE C'EST LA CAPITALE {emoji}", "Y'a trop de bons plans ici, faut que je te montre !"],
  },
  ask_quartier: {
    chaleureux: ["Moi je traîne surtout à {quartier}, super ambiance.", "{quartier}, c'est mon coin préféré, tu devrais passer voir."],
    cash: ["{quartier}. C'est là que je suis le plus souvent.", "Ça dépend des jours, mais {quartier} souvent."],
    taquin: ["{quartier}, évidemment, le meilleur quartier 😏", "Je te dirai si tu es sympa avec moi."],
    posé: ["{quartier}, plutôt calme, ça me va bien.", "Je reste souvent vers {quartier}."],
    hype: ["{quartier} EST LE MEILLEUR QUARTIER {emoji}", "Faut venir à {quartier}, y'a toujours du monde !"],
  },
  propose_activity: {
    chaleureux: ["Carrément, ça me ferait plaisir de faire un truc ensemble.", "Avec plaisir ! Qu'est-ce que tu proposes ?"],
    cash: ["Ouais pourquoi pas. Tu penses à quoi ?", "Ça dépend, dis-moi le plan."],
    taquin: ["Oh, tu me dragues ou tu proposes un truc sérieux ? 😏", "Voyons voir si t'es à la hauteur."],
    posé: ["Pourquoi pas, si t'as une idée précise.", "Je suis partant, tranquillement."],
    hype: ["GO GO GO on fait ça {emoji}", "Direct, je suis chaud pour un truc !"],
  },
  flirt: {
    chaleureux: ["T'es gentil(le), merci — on reste sympas tous les deux 🙂", "Ça me touche, mais restons dans la bonne humeur."],
    cash: ["Ok merci, mais je reste concentré(e) sur autre chose.", "Sympa, mais bon."],
    taquin: ["Ohhh, tu craques déjà ? 😏 Doucement.", "Je le savais que t'allais dire ça."],
    posé: ["C'est gentil, merci.", "Sympa de ta part, on continue à discuter."],
    hype: ["HAHA arrête {emoji} mais merci !", "T'es marrant(e) toi !"],
  },
  refusal: {
    chaleureux: ["Pas de souci, je respecte ça complètement.", "Ok, aucun problème, on garde ça cool."],
    cash: ["Ok, compris.", "Pas de soucis."],
    taquin: ["Dommage, mais ok 😉", "Bon d'accord, je n'insiste pas."],
    posé: ["D'accord, je comprends.", "Ok, on en reste là."],
    hype: ["Ok ok, tranquille alors {emoji}", "Pas grave, on se recroise !"],
  },
  provocation: {
    chaleureux: ["Hé, je préfère qu'on reste respectueux tous les deux.", "Pas besoin de ça, on peut discuter calmement."],
    cash: ["Ok, je vois. On arrête là.", "Pas la peine, je passe mon chemin."],
    taquin: ["Doucement hein 😏 on se calme.", "Oh là, on se détend."],
    posé: ["Je préfère qu'on reste courtois.", "Restons respectueux, s'il te plaît."],
    hype: ["Ohlala calme-toi {emoji}", "On se pose, pas la peine de s'énerver."],
  },
  ask_mission: {
    chaleureux: ["Regarde du côté des events actifs sur la carte, y'a sûrement un truc pour toi !", "Il y a plein de missions à découvrir en explorant Toulouse."],
    cash: ["Check les events sur la map, y'a des récompenses.", "Va voir la carte, y'a des trucs à faire."],
    taquin: ["Tu veux que je te donne tous mes secrets direct ? 😏 Explore un peu !", "Cherche toi-même, c'est plus fun."],
    posé: ["Les missions apparaissent sur la Life Map, regarde régulièrement.", "Il y a des events IRL affichés sur la carte."],
    hype: ["Y'A DES MISSIONS PARTOUT sur la carte, fonce {emoji}", "Check la map, c'est le feu en ce moment !"],
  },
  ask_advice: {
    chaleureux: ["Mon conseil : reste toi-même et amuse-toi à explorer la ville.", "Prends ton temps, Toulouse se découvre petit à petit."],
    cash: ["Fais gaffe à ton énergie, gère bien ton temps.", "Reste concentré sur ce que tu veux vraiment."],
    taquin: ["Mon conseil : écoute-moi plus souvent 😏", "Fais comme moi, tu peux pas te tromper."],
    posé: ["Prends les choses calmement, ça se passera bien.", "Avance à ton rythme, pas de pression."],
    hype: ["FONCE, prends des risques {emoji}", "Vis à fond, teste des trucs nouveaux !"],
  },
  discuss_event: {
    chaleureux: ["Y'a un event sympa en ce moment, tu devrais checker la carte.", "J'adore quand il y a des rassemblements dans le coin."],
    cash: ["Ouais y'a un truc qui bouge, check la map.", "Un event traîne quelque part, regarde."],
    taquin: ["Peut-être que j'y serai... peut-être pas 😏", "Viens et tu verras bien."],
    posé: ["Il y a un event actif, ça peut valoir le coup d'œil.", "Regarde la carte, il y a quelque chose en cours."],
    hype: ["UN EVENT EN CE MOMENT, fonce {emoji}", "C'est le moment de bouger, y'a du monde !"],
  },
  farewell: {
    chaleureux: ["À bientôt, prends soin de toi !", "Ravi d'avoir discuté, à la prochaine !"],
    cash: ["Ok, à plus.", "Bien reçu, à plus tard."],
    taquin: ["Déjà ? Tu reviens vite hein 😏", "Ok fuis, mais je t'attends."],
    posé: ["À bientôt.", "Bonne continuation."],
    hype: ["A PLUS {emoji} reviens vite !", "Ciao, la suite sera encore plus folle !"],
  },
  unknown: {
    chaleureux: ["Intéressant, raconte-moi en plus.", "Ah ouais ? Dis-m'en plus."],
    cash: ["Ok. Et sinon ?", "Continue, j'écoute."],
    taquin: ["Mystérieux toi 😏 continue.", "Hmm, tu piques ma curiosité."],
    posé: ["D'accord, je t'écoute.", "Continue, ça m'intéresse."],
    hype: ["OH ouais raconte {emoji}", "Continue continue !"],
  },
};

function fill(template: string, vars: { name: string; quartier: string; emoji: string }): string {
  return template
    .replace(/\{name\}/g, vars.name)
    .replace(/\{quartier\}/g, vars.quartier)
    .replace(/\{emoji\}/g, vars.emoji);
}

export type NpcTurnResult = {
  reply: string;
  intent: NpcIntent;
  relationship: NpcRelationship;
  quickReplies: string[];
};

const QUICK_REPLIES: Record<NpcIntent, string[]> = {
  greeting:         ["Ça va et toi ?", "Tu fais quoi ici ?", "On se capte ?"],
  introduction:     ["Enchanté(e) !", "Tu es d'où ?", "T'es souvent dans le coin ?"],
  ask_toulouse:     ["C'est quoi les bons spots ?", "Tu conseilles quel quartier ?", "Merci !"],
  ask_quartier:     ["Pourquoi ce quartier ?", "C'est bien pour sortir ?", "Ok merci"],
  propose_activity: ["Carrément, quand ?", "Non merci, une autre fois", "T'as une idée précise ?"],
  flirt:            ["Merci, sympa", "Restons juste potes", "Haha ok"],
  refusal:          ["Ok pas de souci", "On reste en contact ?", "À plus alors"],
  provocation:      ["Désolé, je me calme", "On repart sur de bonnes bases ?", "Bye"],
  ask_mission:      ["Merci, je vais checker !", "Y'a une récompense ?", "Ok cool"],
  ask_advice:       ["Merci du conseil", "T'as d'autres tips ?", "Ok je note"],
  discuss_event:    ["Je viens !", "C'est où exactement ?", "Peut-être plus tard"],
  farewell:         ["À bientôt !", "Merci pour la discussion", "Ciao !"],
  unknown:          ["Salut !", "Tu connais la ville ?", "Y'a un event en cours ?"],
};

export async function runNpcTurn(
  playerId: string, npcId: string, npcName: string, userText: string
): Promise<NpcTurnResult> {
  const personality = getNpcPersonality(npcId);
  const intent = classifyIntent(userText);
  const rel = await loadNpcRelationship(playerId, npcId);

  const pool = BANK[intent][personality.ton] ?? BANK.unknown.chaleureux!;
  const unused = pool.filter((line) => !rel.lastTopics.includes(line));
  const chosen = (unused.length > 0 ? unused : pool)[Math.floor(Math.random() * (unused.length > 0 ? unused.length : pool.length))];
  const reply = fill(chosen, { name: npcName, quartier: personality.quartier, emoji: personality.emojiStyle });

  const nextTopics = [chosen, ...rel.lastTopics].slice(0, 6);
  const nextTrust = Math.max(0, Math.min(100, rel.trust + (TRUST_DELTA[intent] ?? 0)));
  const nextRel: NpcRelationship = {
    ...rel,
    trust: nextTrust, lastIntent: intent, lastTopics: nextTopics,
    turns: rel.turns + 1, updatedAt: new Date().toISOString(),
  };
  await saveNpcRelationship(playerId, npcId, nextRel);

  return { reply, intent, relationship: nextRel, quickReplies: QUICK_REPLIES[intent] };
}
