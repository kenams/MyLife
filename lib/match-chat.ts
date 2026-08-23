// Chat consenti réel — backé par matches/chat_conversations/chat_messages
// (voir migration feelings_matches_chat). À la différence de lib/live-chat.ts
// (table dm_messages, RLS grand ouvert — "Read own DM"/"Insert DM" avaient
// qual/with_check = true, aucune vérification de participant), tout ici passe
// par des RPC SECURITY DEFINER qui vérifient match + blocage à chaque appel.
import { supabase } from "./supabase";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export async function sendFeeling(targetUserId: string): Promise<{ matched: boolean; conversationId: string | null; error?: string }> {
  if (!supabase) return { matched: false, conversationId: null, error: "Non connecté" };
  const { data, error } = await supabase.rpc("send_feeling", { target: targetUserId });
  if (error) return { matched: false, conversationId: null, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { matched: !!row?.matched, conversationId: row?.conversation_id ?? null };
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as ChatMessage[]) ?? [];
}

export async function sendMatchMessage(conversationId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { error } = await supabase.rpc("send_message", { conv_id: conversationId, msg_body: body });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function subscribeToConversation(conversationId: string, onMessage: (m: ChatMessage) => void) {
  if (!supabase) return null;
  return supabase
    .channel(`chat_conversation_${conversationId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "chat_messages",
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => onMessage(payload.new as ChatMessage))
    .subscribe();
}
