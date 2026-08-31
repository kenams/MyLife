import { supabase } from "./supabase";
import { getNpcPersonality, runNpcTurn, type NpcIntent } from "./npc-engine";
import { shouldEnhanceNpcTurn } from "./npc-chat-policy";
import { getNpcMultiDayGoal } from "./npc-goals";

export type NpcChatTurn = { role: "me" | "npc"; text: string };

export type NpcReplyResult = {
  ok: boolean;
  reply?: string;
  error?: string;
  intent?: NpcIntent;
  quickReplies?: string[];
  engine?: "local" | "anthropic" | "openai";
};

// ── Circuit breaker pour le LLM externe (facultatif) ──────────────────────
// Le moteur local répond TOUJOURS en premier et instantanément. L'IA générative
// n'est appelée que pour un moment qui compte réellement dans la relation.
const CIRCUIT_COOLDOWN_MS = 10 * 60_000;
let circuitOpenUntil = 0;
const REQUEST_TIMEOUT_MS = 4000;

function circuitIsOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

function tripCircuit() {
  circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
}

/** Moteur local : réponse déterministe, immédiate, sans clé. Toujours disponible. */
export async function sendNpcMessageLocal(
  playerId: string, npcId: string, npcName: string, message: string
): Promise<NpcReplyResult> {
  const turn = await runNpcTurn(playerId, npcId, npcName, message);
  return { ok: true, reply: turn.reply, intent: turn.intent, quickReplies: turn.quickReplies, engine: "local" };
}

/**
 * Enrichissement LLM best-effort. Il reçoit uniquement un contexte de jeu
 * compact : personnalité stable + objectif courant + historique récent.
 */
export async function tryEnhanceWithLlm(
  npcId: string,
  npcName: string,
  npcMood: string | null,
  history: NpcChatTurn[],
  message: string,
): Promise<{ reply: string; engine: "anthropic" | "openai" } | null> {
  if (!supabase || circuitIsOpen()) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return null;

  const personality = getNpcPersonality(npcId);
  const goal = getNpcMultiDayGoal(
    npcId,
    `${personality.ton} ${personality.interet}`,
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("/api/npc-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal: controller.signal,
      body: JSON.stringify({
        npcName,
        npcMood,
        personality: {
          tone: personality.ton,
          interest: personality.interet,
          district: personality.quartier,
        },
        goal: {
          type: goal.type,
          label: goal.label,
          motivation: goal.motivation,
          progress: Math.round(goal.progress * 100),
        },
        history: history.slice(-10).map((h) => ({ role: h.role === "me" ? "user" : "npc", text: h.text })),
        message,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      tripCircuit();
      return null;
    }
    const data = await res.json();
    if (!data?.reply) {
      tripCircuit();
      return null;
    }
    return { reply: data.reply, engine: data.provider === "openai" ? "openai" : "anthropic" };
  } catch {
    clearTimeout(timer);
    tripCircuit();
    return null;
  }
}

/**
 * Point d'entrée principal du chat PNJ : le cerveau local décide et répond.
 * Le texte génératif n'intervient que pour les échanges à forte valeur.
 */
export async function sendNpcMessage(
  playerId: string, npcId: string, npcName: string, npcMood: string | null,
  history: NpcChatTurn[], message: string
): Promise<NpcReplyResult> {
  const local = await sendNpcMessageLocal(playerId, npcId, npcName, message);

  if (!shouldEnhanceNpcTurn(local.intent, history.length, message)) {
    return local;
  }

  const enhanced = await tryEnhanceWithLlm(npcId, npcName, npcMood, history, message);
  if (enhanced) {
    return { ...local, reply: enhanced.reply, engine: enhanced.engine };
  }
  return local;
}
