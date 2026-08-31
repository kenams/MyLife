import AsyncStorage from "@react-native-async-storage/async-storage";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type PlayerCloudState = Record<string, unknown>;

export type PlayerCloudEnvelope = {
  state: PlayerCloudState;
  revision: number;
  updatedAt: string | null;
  applied: boolean;
  duplicate: boolean;
  conflict: boolean;
};

export type PendingPlayerMutation = {
  mutationId: string;
  expectedRevision: number;
  state: PlayerCloudState;
};

const QUEUE_PREFIX = "@mylife-player-cloud-queue:";
const MAX_PENDING = 50;

function queueKey(userId: string) {
  return `${QUEUE_PREFIX}${userId}`;
}

function parseEnvelope(value: unknown): PlayerCloudEnvelope | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const state = row.state;
  const revision = Number(row.revision);
  if (!state || typeof state !== "object" || Array.isArray(state) || !Number.isSafeInteger(revision) || revision < 0) {
    return null;
  }
  return {
    state: state as PlayerCloudState,
    revision,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    applied: row.applied === true,
    duplicate: row.duplicate === true,
    conflict: row.conflict === true,
  };
}

export function createPlayerMutationId(prefix = "state"): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}:${Date.now().toString(36)}:${random}`;
}

export async function pullPlayerCloudState(userId: string): Promise<{
  ok: boolean;
  envelope?: PlayerCloudEnvelope;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configure" };

  const { data, error } = await supabase
    .from("player_cloud_state")
    .select("state, revision, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true };
  const envelope = parseEnvelope(data);
  return envelope ? { ok: true, envelope } : { ok: false, error: "Etat cloud invalide" };
}

export async function pushPlayerCloudState(input: PendingPlayerMutation): Promise<{
  ok: boolean;
  envelope?: PlayerCloudEnvelope;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configure" };

  const { data, error } = await supabase.rpc("sync_player_cloud_state", {
    p_state: input.state,
    p_expected_revision: input.expectedRevision,
    p_mutation_id: input.mutationId,
  });
  if (error) return { ok: false, error: error.message };
  const envelope = parseEnvelope(data);
  return envelope ? { ok: true, envelope } : { ok: false, error: "Reponse cloud invalide" };
}

export async function readPendingPlayerMutations(userId: string): Promise<PendingPlayerMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PendingPlayerMutation => {
      if (!item || typeof item !== "object") return false;
      const row = item as Partial<PendingPlayerMutation>;
      return typeof row.mutationId === "string"
        && Number.isSafeInteger(row.expectedRevision)
        && (row.expectedRevision ?? -1) >= 0
        && !!row.state
        && typeof row.state === "object"
        && !Array.isArray(row.state);
    }).slice(-MAX_PENDING);
  } catch {
    return [];
  }
}

export async function enqueuePlayerMutation(userId: string, mutation: PendingPlayerMutation): Promise<void> {
  const pending = await readPendingPlayerMutations(userId);
  const next = [...pending.filter((item) => item.mutationId !== mutation.mutationId), mutation].slice(-MAX_PENDING);
  await AsyncStorage.setItem(queueKey(userId), JSON.stringify(next));
}

export async function removePendingPlayerMutation(userId: string, mutationId: string): Promise<void> {
  const pending = await readPendingPlayerMutations(userId);
  const next = pending.filter((item) => item.mutationId !== mutationId);
  if (next.length === 0) {
    await AsyncStorage.removeItem(queueKey(userId));
  } else {
    await AsyncStorage.setItem(queueKey(userId), JSON.stringify(next));
  }
}

export async function clearPendingPlayerMutations(userId: string): Promise<void> {
  await AsyncStorage.removeItem(queueKey(userId));
}
