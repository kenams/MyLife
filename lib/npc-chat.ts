import { supabase } from "./supabase";

export type NpcChatTurn = { role: "me" | "npc"; text: string };

export async function sendNpcMessage(
  npcName: string, npcMood: string | null, history: NpcChatTurn[], message: string
): Promise<{ ok: boolean; reply?: string; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { ok: false, error: "Non connecté" };

  try {
    const res = await fetch("/api/npc-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        npcName, npcMood,
        history: history.map((h) => ({ role: h.role === "me" ? "user" : "npc", text: h.text })),
        message,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error ?? "Erreur PNJ" };
    return { ok: true, reply: data.reply };
  } catch {
    return { ok: false, error: "Erreur réseau" };
  }
}
