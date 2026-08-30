// Décision d'approche d'un habitant simulé — 100 % locale et déterministe.
// Réutilise la personnalité (npc-engine.getNpcPersonality) et l'état de
// simulation déjà porté par le marqueur (activité, statut). Aucune nouvelle
// IA, aucun timer, aucun appel réseau. Évalué UNIQUEMENT au moment où le
// joueur interagit.
import { getNpcPersonality, type NpcPersonality } from "./npc-engine";

export type NpcApproachOutcome =
  | "ACCEPT" | "SHORT" | "SUGGEST" | "LATER" | "BUSY" | "DECLINE";

export type NpcQuickActionId = "talk" | "outing" | "district" | "gameplay" | "leave";

export type NpcQuickAction = { id: NpcQuickActionId; label: string };

export type NpcApproachContext = {
  npcId: string;
  activityLabel: string | null; // player.last_action (déjà "💼 Au travail" etc.)
  status: string;               // free | vibe | charo | taken | ghost
  crewTag: string | null;
  hour: number;                 // 0-23
  trust: number;                // 0-100 (mémoire relationnelle)
  encounters: number;           // rencontres marquantes passées
};

export type NpcApproachResult = {
  outcome: NpcApproachOutcome;
  line: string;
  actions: NpcQuickAction[];
  /** true quand une réponse "toujours oui" serait fausse : l'UI ne doit pas insister. */
  guarded: boolean;
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

type ToneGroup = "warm" | "neutral" | "blunt";
function toneGroup(ton: NpcPersonality["ton"]): ToneGroup {
  if (ton === "chaleureux" || ton === "hype") return "warm";
  if (ton === "cash") return "blunt";
  return "neutral";
}

/** Ce que l'activité simulée fait à la disponibilité (borné). */
function activityScore(label: string | null): { delta: number; busyWord: string | null } {
  const t = normalize(label ?? "");
  if (!t) return { delta: 0, busyWord: null };
  if (/(dort|sommeil)/.test(t)) return { delta: -6, busyWord: "je récupère là" };
  if (/(travail|au taf|boulot)/.test(t)) return { delta: -3, busyWord: "je bosse encore un moment" };
  if (/(etudie|etude|revise|cours)/.test(t)) return { delta: -3, busyWord: "je suis en plein taf" };
  if (/(sport|entrain|salle|gym|court)/.test(t)) return { delta: -3, busyWord: "je suis en plein entraînement" };
  if (/(shopping)/.test(t)) return { delta: -1, busyWord: "je fais deux-trois courses" };
  if (/(deplace|pied|metro|voiture|route|trajet)/.test(t)) return { delta: -1, busyWord: "je suis en chemin" };
  if (/(sortie|cafe|socialise|resto|restaurant|parc|event|evenement)/.test(t)) return { delta: 2, busyWord: null };
  if (/(crew|mission)/.test(t)) return { delta: 1, busyWord: null };
  return { delta: 0, busyWord: null };
}

function statusScore(status: string): number {
  if (status === "charo") return 3;
  if (status === "vibe") return 2;
  if (status === "taken") return -1;
  return 0;
}

function toneScore(ton: NpcPersonality["ton"]): number {
  if (ton === "chaleureux") return 2;
  if (ton === "hype") return 1;
  if (ton === "posé") return -1;
  if (ton === "cash") return -1;
  return 0;
}

const LINES: Record<NpcApproachOutcome, Record<ToneGroup, string[]>> = {
  ACCEPT: {
    warm: ["Hey ! Ça tombe bien, j'ai deux minutes. On parle de quoi ?", "Tiens, tu tombes bien. Vas-y, je t'écoute."],
    neutral: ["Ok, j'ai un moment. Qu'est-ce qu'il y a ?", "Salut. On peut discuter, oui."],
    blunt: ["Ouais. Vas-y, parle.", "Ok, t'as deux minutes de mon temps."],
  },
  SHORT: {
    warm: ["Salut ! J'ai pas trop le temps mais dis vite.", "Hey, je file bientôt — c'est rapide ?"],
    neutral: ["Vas-y mais fais court, je suis un peu pris.", "Ok, deux secondes alors."],
    blunt: ["Fais court.", "T'as trente secondes."],
  },
  SUGGEST: {
    warm: ["Franchement là je peux pas trop, mais y a des trucs qui bougent dans le coin si tu veux voir.", "Passe plutôt voir ce qui se passe autour, moi je suis pris."],
    neutral: ["Pas maintenant, mais regarde ce qui bouge dans le quartier.", "J'ai pas le temps — check l'activité du coin."],
    blunt: ["Pas là. Va voir ce qui se passe autour.", "Occupé. Y a des trucs à faire dans le coin."],
  },
  LATER: {
    warm: ["Là c'est chaud pour moi, on se recroise plus tard ?", "Pas le moment, mais on se capte une prochaine fois."],
    neutral: ["Une autre fois plutôt, là je peux pas.", "Repasse plus tard, je serai plus dispo."],
    blunt: ["Plus tard.", "Pas maintenant. Reviens."],
  },
  BUSY: {
    warm: ["Désolé, {busy} — on parlera une autre fois !", "Là je peux vraiment pas, {busy}."],
    neutral: ["Pas dispo là, {busy}.", "{busy}, on verra plus tard."],
    blunt: ["{busy}. Pas le moment.", "Occupé. {busy}."],
  },
  DECLINE: {
    warm: ["Je préfère rester tranquille là, sans te vexer.", "Pas envie de discuter maintenant, désolé."],
    neutral: ["Je vais rester dans mon coin là.", "Pas maintenant."],
    blunt: ["Non, là je passe.", "Laisse tomber pour l'instant."],
  },
};

function pick(pool: string[], seed: number): string {
  return pool[seed % pool.length];
}

const LEAVE: NpcQuickAction = { id: "leave", label: "Laisser tranquille" };

export function resolveNpcApproach(ctx: NpcApproachContext): NpcApproachResult {
  const personality = getNpcPersonality(ctx.npcId);
  const group = toneGroup(personality.ton);
  const hourBucket = Math.floor(((ctx.hour % 24) + 24) % 24 / 2);
  const seed = hash(`${ctx.npcId}:${hourBucket}:${ctx.encounters}`);

  const act = activityScore(ctx.activityLabel);
  let score =
    statusScore(ctx.status) +
    act.delta +
    toneScore(personality.ton) +
    (ctx.trust >= 60 ? 3 : ctx.trust <= 10 ? -1 : 0) +
    (ctx.encounters >= 3 ? 1 : 0) +
    ((seed % 5) - 2);

  // Le soir, un peu plus ouvert ; en pleine nuit, beaucoup moins.
  const h = ((ctx.hour % 24) + 24) % 24;
  if (h >= 19 && h < 24) score += 1;
  if (h >= 1 && h < 6) score -= 3;

  let outcome: NpcApproachOutcome;
  if (score >= 5) outcome = "ACCEPT";
  else if (score >= 2) outcome = "SHORT";
  else if (score >= 0) outcome = "SUGGEST";
  else if (score >= -2) outcome = "LATER";
  else if (score >= -4) outcome = "BUSY";
  else outcome = "DECLINE";

  // BUSY n'a de sens qu'avec une vraie activité contraignante.
  if (outcome === "BUSY" && !act.busyWord) outcome = "LATER";

  let line = pick(LINES[outcome][group], seed);
  if (outcome === "BUSY" && act.busyWord) line = line.replace("{busy}", act.busyWord);

  let actions: NpcQuickAction[];
  switch (outcome) {
    case "ACCEPT":
      actions = [
        { id: "talk", label: "Discuter" },
        { id: "outing", label: "Proposer une sortie" },
        { id: "district", label: "Parler du quartier" },
        LEAVE,
      ];
      break;
    case "SHORT":
      actions = [
        { id: "talk", label: "Discuter vite fait" },
        { id: "district", label: "Parler du quartier" },
        LEAVE,
      ];
      break;
    case "SUGGEST":
      actions = [
        { id: "gameplay", label: "Voir ce qui se passe" },
        { id: "district", label: "Parler du quartier" },
        LEAVE,
      ];
      break;
    case "LATER":
      actions = [{ id: "district", label: "Parler du quartier" }, LEAVE];
      break;
    default:
      actions = [LEAVE];
  }

  return {
    outcome,
    line,
    actions,
    guarded: outcome === "BUSY" || outcome === "DECLINE" || outcome === "LATER",
  };
}

/** Réaction déterministe à une proposition de sortie. */
export function resolveOutingProposal(ctx: NpcApproachContext): { accepted: boolean; line: string } {
  const personality = getNpcPersonality(ctx.npcId);
  const group = toneGroup(personality.ton);
  const seed = hash(`${ctx.npcId}:outing:${ctx.encounters}`);
  const act = activityScore(ctx.activityLabel);
  const score =
    statusScore(ctx.status) + act.delta + toneScore(personality.ton) +
    (ctx.trust >= 50 ? 2 : 0) + ((seed % 4) - 1);
  const accepted = score >= 2;
  const bank = accepted
    ? {
        warm: ["Carrément, ça me tente ! On se retrouve où ?", "Avec plaisir, propose un plan."],
        neutral: ["Ok, pourquoi pas. T'as une idée ?", "Ça marche, dis-moi quand."],
        blunt: ["Ok. Tu gères le plan.", "Ça peut le faire."],
      }
    : {
        warm: ["Pas ce soir, mais garde l'idée pour une prochaine fois !", "J'aimerais bien mais là je peux pas."],
        neutral: ["Une autre fois plutôt.", "Pas dispo pour une sortie là."],
        blunt: ["Non, pas maintenant.", "Pas chaud là."],
      };
  return { accepted, line: pick(bank[group], seed) };
}

/** Ligne "quartier / crew" contextuelle. */
export function districtLine(ctx: NpcApproachContext): string {
  const personality = getNpcPersonality(ctx.npcId);
  const seed = hash(`${ctx.npcId}:district:${ctx.encounters}`);
  const q = personality.quartier;
  if (ctx.crewTag) {
    return pick([
      `Ici c'est plutôt le territoire de [${ctx.crewTag}] en ce moment. Ça bouge.`,
      `Mon crew [${ctx.crewTag}] est actif dans le coin, tu verras.`,
    ], seed);
  }
  return pick([
    `${q}, c'est vivant en ce moment. Reste dans le coin, tu vas voir.`,
    `Y a toujours quelque chose qui se passe vers ${q}.`,
  ], seed);
}

/** Statut court pour une puce / un en-tête (Part 8). "💼 Au travail" -> "Travail". */
export function npcActivityShort(label: string | null): string | null {
  if (!label) return null;
  const stripped = label.replace(/^[^\p{L}]+/u, "").trim();
  const map: Record<string, string> = {
    "Au travail": "Travail",
    "Étudie": "Études",
    "Mange en ville": "Repas",
    "Au restaurant": "Repas",
    "Au café": "Café",
    "Socialise": "Sortie",
    "En sortie": "Sortie",
    "En rencontre": "Sortie",
    "Avec son crew": "Crew",
    "Sur une mission": "Mission",
    "Événement en ville": "Événement",
    "Fait du sport": "Sport",
    "Salle de sport": "Sport",
    "Au parc": "Parc",
    "Shopping": "Shopping",
    "Se déplace à pied": "En déplacement",
    "En voiture": "En déplacement",
    "Dans le métro": "En déplacement",
    "Dort": "Chez lui",
    "Vie quotidienne": "Chez lui",
  };
  return map[stripped] ?? stripped;
}
