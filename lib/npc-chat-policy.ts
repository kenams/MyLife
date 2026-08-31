import type { NpcIntent } from "./npc-engine";

const HIGH_VALUE_INTENTS = new Set<NpcIntent>([
  "propose_activity",
  "ask_advice",
  "discuss_event",
  "flirt",
]);

const NEVER_ENHANCE_INTENTS = new Set<NpcIntent>([
  "greeting",
  "farewell",
  "refusal",
  "provocation",
]);

/**
 * L'IA générative est un bonus de mise en scène, pas le cerveau du PNJ.
 * On ne dépense un appel externe que lorsqu'une réponse peut réellement
 * donner du relief à une relation, un conseil, une sortie ou un événement.
 */
export function shouldEnhanceNpcTurn(
  intent: NpcIntent | undefined,
  historyLength: number,
  message: string,
): boolean {
  if (!intent || NEVER_ENHANCE_INTENTS.has(intent)) return false;
  if (HIGH_VALUE_INTENTS.has(intent)) return true;

  // Une conversation déjà engagée peut mériter une réponse plus naturelle
  // lorsque le joueur écrit une vraie phrase, même si l'intention locale
  // reste inconnue. Les petits messages restent 100% locaux.
  if (intent === "unknown" && historyLength >= 4 && message.trim().length >= 36) {
    return true;
  }

  return false;
}
