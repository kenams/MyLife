import { supabase } from "./supabase";
import { runNpcTurn, type NpcIntent } from "./npc-engine";

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
// Le moteur local répond TOUJOURS en premier et instantanément. On tente en
// plus, en arrière-plan, un enrichissement LLM seulement si un fournisseur
// n'est pas déjà connu comme indisponible cette session — pour ne jamais
// spammer une clé à plat (quota/crédit épuisé) ni faire attendre le joueur.
const CIRCUIT_COOLDOWN_MS = 10 * 60_000; // 10 min avant de retenter après un échec
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
 * Tentative d'enrichissement LLM, best-effort, jamais bloquante pour le
 * joueur : timeout court, aucune répétition tant que le circuit est ouvert.
 * Retourne null si indisponible — l'appelant garde alors la réponse locale.
 */
export async function tryEnhanceWithLlm(
  npcName: string, npcMood: string | null, history: NpcChatTurn[], message: string
): Promise<{ reply: string; engine: "anthropic" | "openai" } | null> {
  if (!supabase || circuitIsOpen()) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("/api/npc-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal: controller.signal,
      body: JSON.stringify({
        npcName, npcMood,
        history: history.map((h) => ({ role: h.role === "me" ? "user" : "npc", text: h.text })),
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
 * Point d'entrée principal du chat PNJ : réponse locale immédiate (jamais de
 * vide, jamais d'erreur visible côté joueur), avec bonus LLM silencieux si
 * disponible et rapide.
 */
export async function sendNpcMessage(
  playerId: string, npcId: string, npcName: string, npcMood: string | null,
  history: NpcChatTurn[], message: string
): Promise<NpcReplyResult> {
  const local = await sendNpcMessageLocal(playerId, npcId, npcName, message);
  const enhanced = await tryEnhanceWithLlm(npcName, npcMood, history, message);
  if (enhanced) {
    return { ...local, reply: enhanced.reply, engine: enhanced.engine };
  }
  return local;
}
