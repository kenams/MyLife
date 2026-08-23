// Relations réelles (amis/blocage) — toute mutation passe par les RPC
// SECURITY DEFINER de la migration friend_relationships (pas d'insert/update
// direct possible sur la table, RLS + grants l'interdisent explicitement).
import { supabase } from "./supabase";

export type FriendStatus = "pending" | "accepted" | "declined" | "cancelled" | "blocked";

export type FriendRelationship = {
  id: string;
  user_low: string;
  user_high: string;
  requester_id: string;
  status: FriendStatus;
  blocked_by: string | null;
};

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; data?: T; error?: string }> {
  if (!supabase) return { ok: false, error: "Non connecté" };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as T };
}

export const requestFriend  = (target: string) => callRpc<FriendRelationship>("request_friend", { target });
export const respondFriend  = (target: string, accept: boolean) => callRpc<FriendRelationship>("respond_friend", { target, accept });
export const cancelFriend   = (target: string) => callRpc<FriendRelationship>("cancel_friend_request", { target });
export const removeFriend   = (target: string) => callRpc<FriendRelationship>("remove_friend", { target });
export const blockRelation  = (target: string) => callRpc<FriendRelationship>("block_user_relationship", { target });
export const unblockRelation = (target: string) => callRpc<FriendRelationship>("unblock_user_relationship", { target });

export async function getRelationshipWith(targetId: string): Promise<FriendRelationship | null> {
  if (!supabase) return null;
  const { data: authData } = await supabase.auth.getUser();
  const me = authData?.user?.id;
  if (!me) return null;
  const low = me < targetId ? me : targetId;
  const high = me < targetId ? targetId : me;
  const { data } = await supabase
    .from("friend_relationships")
    .select("*")
    .eq("user_low", low)
    .eq("user_high", high)
    .maybeSingle();
  return (data as FriendRelationship) ?? null;
}
