/**
 * NPC AI — Moteur proactif des personnages IA
 *
 * Génère des événements autonomes : messages au joueur, invitations,
 * activités complétées, level-ups. Compare l'état NPC avant/après tick
 * pour déterminer ce qui s'est passé et ce qui doit être communiqué.
 */

import type { NpcState, RelationshipRecord } from "@/lib/types";
import { PROPOSABLE_ACTIVITIES } from "@/lib/npc-dialogue";

// ─── Types d'événements ───────────────────────────────────────────────────────
export type NpcEventKind = "message" | "invitation" | "activity_done" | "level_up";

export type NpcProactiveEvent = {
  kind: NpcEventKind;
  npcId: string;
  npcName: string;
  message?: string;
  activitySlug?: string;
  activityLabel?: string;
  xpGained?: number;
  moneyGained?: number;
  newLevel?: number;
};

// ─── Cooldowns ────────────────────────────────────────────────────────────────
const MSG_COOLDOWN_MS    = 5  * 60 * 1000;  // 5 min
const INVITE_COOLDOWN_MS = 12 * 60 * 1000;  // 12 min
const ACTIVITY_MIN_XP    = 3;               // XP min pour log activité

// ─── Messages proactifs par NPC ───────────────────────────────────────────────
type MsgFn = (npc: NpcState, playerName: string) => string;

const NPC_MESSAGES: Record<string, MsgFn[]> = {
  ava: [
    (n, p) => `Hey ${p} ! J'organisais justement quelque chose pour ce soir, t'es dispo ? 😊`,
    (n, p) => `Je viens de rentrer du café, j'ai rencontré des gens top. Comment tu vas ${p} ?`,
    (n, p) => `T'as l'air occupé ces derniers temps. Comment tu vas vraiment ?`,
    (n, p) => `Niveau ${n.level} pour moi ! Je progresse doucement mais sûrement ✨`,
    (n, p) => `J'ai faim là, je file au marché. On se retrouve après ?`,
    (n, p) => `${p}, j'ai une idée de sortie sympa ce weekend. Tu serais chaud ?`,
    (n, p) => `Mon humeur est au max (${n.mood}% !). Parfait pour se voir !`,
    (n, p) => `Je pense à organiser un petit groupe. T'en serais ?`,
  ],
  malik: [
    (n, p) => `Bro, niveau ${n.level}, j'avance. Tu kiffes le grind aussi ${p} ?`,
    (n, p) => `J'ai bossé 2h d'affilée. Stats au max. Tu fais quoi toi ?`,
    (n, p) => `Les nuits en ville c'est un autre monde. T'as bossé aujourd'hui ${p} ?`,
    (n, p) => `J'ai ${n.money} crédits en banque. Le game ça paie si t'es consistant.`,
    (n, p) => `Discipline = résultats. T'en es où toi ${p} ?`,
    (n, p) => `On devrait se motiver ensemble. Mon niveau monte, le tien aussi ?`,
    (n, p) => `J'observe les patterns. Ceux qui avancent ont une routine. T'as la tienne ?`,
    (n, p) => `Streak de ${n.streak} jours. La régularité c'est tout.`,
  ],
  noa: [
    (n, p) => `Je viens de terminer un projet. Besoin d'air. Café ${p} ?`,
    (n, p) => `Mes vibes créatives sont au max. On sort ce soir ?`,
    (n, p) => `J'ai shooté des photos trop bien aujourd'hui. Tu veux voir ?`,
    (n, p) => `Level ${n.level} atteint ! Le travail paie toujours 🎨`,
    (n, p) => `T'es passé où ces derniers temps ${p} ? Le monde tourne sans toi 😄`,
    (n, p) => `Inspiration totale là. T'as un truc qui t'excite en ce moment ?`,
    (n, p) => `Cinéma ce soir ? Y'a un film qui a l'air de ouf.`,
    (n, p) => `Je suis au ${n.mood}% d'humeur là. Créativité au max.`,
  ],
  leila: [
    (n, p) => `Séance de course ce matin, 5km non-stop. Tu viens la prochaine fois ${p} ?`,
    (n, p) => `Le parc ce matin était incroyable. T'as besoin de sortir un peu ?`,
    (n, p) => `Je prépare une marche en groupe ce weekend. Tu joins ? 🌿`,
    (n, p) => `Énergie à ${n.energy}% après ma séance. Comment tu te sens ?`,
    (n, p) => `Respire. Prends l'air. Le monde dehors est beau ${p}. 🌿`,
    (n, p) => `Un exercice de respiration ça t'aiderait. Tu stresses ?`,
    (n, p) => `J'ai découvert un nouveau parcours au parc. On le teste ensemble ?`,
    (n, p) => `Niveau ${n.level} ! Le corps et l'esprit progressent ensemble.`,
  ],
  yan: [
    (n, p) => `Analyse rapide : t'as l'air de bien grinder ${p}. Continue.`,
    (n, p) => `Niveau ${n.level}, XP en hausse. On est sur la même trajectoire.`,
    (n, p) => `J'ai closé 3 objectifs aujourd'hui. Toi ${p} ?`,
    (n, p) => `Action beats intention. Tu bossas aujourd'hui ?`,
    (n, p) => `Networking ce soir ? J'ai des contacts qui pourraient t'être utiles.`,
    (n, p) => `Réputation à ${n.reputation}. La mienne monte. La tienne ?`,
    (n, p) => `Je t'observe ${p}. T'as du potentiel. Faut juste être consistant.`,
    (n, p) => `${n.money} crédits de revenue cette session. Le travail paie.`,
  ],
  sana: [
    (n, p) => `Cardio intense ce matin. Je sens les progrès. Tu t'entraînes ${p} ?`,
    (n, p) => `Mon niveau fitness monte. Le gym c'est la vie. T'es venu récemment ?`,
    (n, p) => `Session salle demain matin ? Je cherche quelqu'un de motivé. 💪`,
    (n, p) => `La discipline physique change tout le reste ${p}. Tu le ressens ?`,
    (n, p) => `Niveau ${n.level} atteint ! Le corps suit quand le mental lead. 💪`,
    (n, p) => `J'ai testé un nouveau programme. Les résultats sont dingues. Tu veux des tips ?`,
    (n, p) => `Énergie à ${n.energy}% après ma séance. Le sport recharge vraiment.`,
    (n, p) => `Streak de ${n.streak} jours d'entraînement. La régularité c'est le secret.`,
  ],
};

// ─── Messages contextuels selon action en cours ───────────────────────────────
const ACTION_CONTEXT_MSG: Record<string, Record<string, MsgFn>> = {
  ava: {
    eating:     (n, p) => `Je suis en train de manger un truc sympa. Tu manges bien toi ${p} ?`,
    exercising: (n, p) => `Je fais un peu de sport ! Surprenant pour moi non ? 😄`,
    chatting:   (n, p) => `J'étais en grande discussion là. La vie sociale c'est tout.`,
    sleeping:   (n, p) => `Je me repose un peu. On se parle après ?`,
  },
  malik: {
    working:    (n, p) => `En pleine session de boulot. Les chiffres sont bons là.`,
    exercising: (n, p) => `Corps et esprit. Les deux à entraîner. Tu fais du sport ?`,
    eating:     (n, p) => `Repas rapide. Faut recharger les batteries pour bosser.`,
    sleeping:   (n, p) => `Je récupère. L'opérateur de nuit doit se reposer parfois.`,
  },
  noa: {
    working:    (n, p) => `Je suis en mode création totale là. Ne me dérange pas trop 😄`,
    chatting:   (n, p) => `Discussions créatives en cours. Les idées fusent.`,
    walking:    (n, p) => `Je me balade pour l'inspiration. La ville me donne des idées.`,
    eating:     (n, p) => `Je mange en scrollant mes feeds. Trop d'inspiration d'un coup.`,
  },
  leila: {
    exercising: (n, p) => `En pleine séance ! Ça fait du bien de bouger ${p}.`,
    walking:    (n, p) => `Je me promène au parc. L'air frais c'est gratuit et ça change tout.`,
    eating:     (n, p) => `Repas équilibré. Le carburant de la journée !`,
    sleeping:   (n, p) => `Récupération active. Le repos fait partie du programme.`,
  },
  yan: {
    working:    (n, p) => `Productivité max. Pas le temps de traîner. Tu travailles ?`,
    eating:     (n, p) => `Repas de travail. L'efficacité ne s'arrête jamais.`,
    exercising: (n, p) => `Mens sana in corpore sano. Les deux comptent.`,
    chatting:   (n, p) => `Networking en cours. Chaque conversation est une opportunité.`,
  },
  sana: {
    exercising: (n, p) => `En pleine séance cardio ! Viens me rejoindre la prochaine fois !`,
    eating:     (n, p) => `Repas post-training. Les macros comptent autant que le sport.`,
    sleeping:   (n, p) => `Récupération musculaire en cours. Phase essentielle du programme.`,
    walking:    (n, p) => `Cool down après l'entraînement. Le corps dit merci.`,
  },
};

// ─── Activités invitables selon personnalité ──────────────────────────────────
const NPC_INVITE_POOL: Record<string, string[]> = {
  ava:   ["coffee-meetup", "restaurant-out", "market-shop"],
  malik: ["coffee-meetup", "cinema-date", "restaurant-out"],
  noa:   ["cinema-date", "coffee-meetup", "walk"],
  leila: ["walk", "gym-session", "coffee-meetup"],
  yan:   ["coffee-meetup", "restaurant-out", "gym-session"],
  sana:  ["gym-session", "walk", "coffee-meetup"],
};

// ─── Helper: choisir un message ───────────────────────────────────────────────
function pickMessage(npc: NpcState, playerName: string): string {
  // 30% chance d'utiliser un message contextuel (action en cours)
  const ctxMap = ACTION_CONTEXT_MSG[npc.id];
  if (ctxMap && ctxMap[npc.action] && Math.random() < 0.3) {
    return ctxMap[npc.action](npc, playerName);
  }
  const pool = NPC_MESSAGES[npc.id] ?? NPC_MESSAGES["ava"];
  return pool[Math.floor(Math.random() * pool.length)](npc, playerName);
}

// ─── Générateur principal d'événements ───────────────────────────────────────
export function generateNpcEvents(
  newNpcs:       NpcState[],
  prevNpcs:      NpcState[],
  relationships: RelationshipRecord[],
  playerName:    string
): { events: NpcProactiveEvent[]; updatedNpcs: NpcState[] } {
  const events: NpcProactiveEvent[] = [];
  const now = Date.now();
  const updatedNpcs = newNpcs.map((npc) => {
    let out = { ...npc };
    const prev  = prevNpcs.find((p) => p.id === npc.id);
    const rel   = relationships.find((r) => r.residentId === npc.id);
    const score = rel?.score ?? 0;

    // ── 1. Level up ──────────────────────────────────────────────────────────
    if (prev && npc.level > prev.level) {
      events.push({
        kind:     "level_up",
        npcId:    npc.id,
        npcName:  npc.name,
        newLevel: npc.level,
        xpGained: npc.xp - prev.xp,
      });
    }

    // ── 2. Activité complétée (action changée + XP gagné) ────────────────────
    if (prev && prev.action !== npc.action && npc.xp - prev.xp >= ACTIVITY_MIN_XP) {
      const actLabel = getActionLabel(prev.action, npc.id);
      events.push({
        kind:         "activity_done",
        npcId:        npc.id,
        npcName:      npc.name,
        activityLabel: actLabel,
        xpGained:     npc.xp - prev.xp,
        moneyGained:  Math.max(0, npc.money - (prev?.money ?? npc.money)),
      });
    }

    // ── 3. Message proactif ──────────────────────────────────────────────────
    const lastMsgMs = npc.lastMessageAt ? now - new Date(npc.lastMessageAt).getTime() : Infinity;
    const wantToMsg  = npc.mood > 40 && npc.energy > 25;
    // Probabilité proportionnelle au score relation + humeur
    const msgProb = 0.12 + (score / 100) * 0.15 + (npc.mood / 100) * 0.08;
    if (lastMsgMs > MSG_COOLDOWN_MS && wantToMsg && Math.random() < msgProb) {
      events.push({
        kind:    "message",
        npcId:   npc.id,
        npcName: npc.name,
        message: pickMessage(npc, playerName),
      });
      out = { ...out, lastMessageAt: new Date(now).toISOString() };
    }

    // ── 4. Invitation ────────────────────────────────────────────────────────
    const lastInvMs = npc.lastInviteAt ? now - new Date(npc.lastInviteAt).getTime() : Infinity;
    const wantInvite = npc.mood > 60 && npc.energy > 45 && score >= 20;
    const invProb    = 0.06 + (score / 100) * 0.10;
    if (lastInvMs > INVITE_COOLDOWN_MS && wantInvite && Math.random() < invProb) {
      const pool    = NPC_INVITE_POOL[npc.id] ?? ["coffee-meetup"];
      const slug    = pool[Math.floor(Math.random() * pool.length)];
      const activity = PROPOSABLE_ACTIVITIES.find((a) => a.slug === slug);
      events.push({
        kind:          "invitation",
        npcId:         npc.id,
        npcName:       npc.name,
        activitySlug:  slug,
        activityLabel: activity?.label ?? slug,
      });
      out = { ...out, lastInviteAt: new Date(now).toISOString() };
    }

    return out;
  });

  return { events, updatedNpcs };
}

// ─── Labels lisibles pour les actions ────────────────────────────────────────
function getActionLabel(action: string, npcId: string): string {
  const LABELS: Record<string, string> = {
    sleeping:   "dormi",
    eating:     "mangé",
    chatting:   "socialisé",
    exercising: "fait du sport",
    walking:    "marché",
    working:    "travaillé",
    idle:       "soufflé",
    studying:   "étudié",
    cooking:    "cuisiné",
    reading:    "lu",
  };
  return LABELS[action] ?? action;
}

// ─── Stats NPC lisibles pour l'UI ────────────────────────────────────────────
export function getNpcStatusLine(npc: NpcState): string {
  if (npc.action === "sleeping")   return `😴 Dort (énergie ${npc.energy}%)`;
  if (npc.action === "eating")     return `🍽️ Mange (faim ${npc.hunger}%)`;
  if (npc.action === "chatting")   return `💬 Socialise (humeur ${npc.mood}%)`;
  if (npc.action === "exercising") return `💪 S'entraîne (énergie ${npc.energy}%)`;
  if (npc.action === "walking")    return `🚶 Se promène`;
  if (npc.action === "working")    return `💼 Travaille (+cr)`;
  return `💭 En pause (niv. ${npc.level})`;
}

export function getNpcMoodEmoji(mood: number): string {
  if (mood >= 80) return "😄";
  if (mood >= 60) return "🙂";
  if (mood >= 40) return "😐";
  if (mood >= 20) return "😟";
  return "😞";
}
