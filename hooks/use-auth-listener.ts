import { useEffect } from "react";
import { router } from "expo-router";

import {
  clearPendingPlayerMutations,
  createPlayerMutationId,
  enqueuePlayerMutation,
  pullPlayerCloudState,
  pushPlayerCloudState,
  readPendingPlayerMutations,
  removePendingPlayerMutation,
  type PlayerCloudEnvelope,
} from "@/lib/player-cloud-sync";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { pullAvatarFromSupabase } from "@/lib/supabase-sync";
import { selectPlayerCloudState, useGameStore } from "@/stores/game-store";
import type { AvatarProfile, AvatarStats } from "@/lib/types";

const SYNC_DEBOUNCE_MS = 800;
const RETRY_DELAY_MS = 5_000;
let authSyncMounted = false;

/** Auth session restore plus local-first, cross-device player-state synchronization. */
export function useAuthListener() {
  const setSession = useGameStore((state) => state._setSupabaseSession);
  const clearSession = useGameStore((state) => state._clearSupabaseSession);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    if (authSyncMounted) return;
    authSyncMounted = true;

    let disposed = false;
    let activeUserId: string | null = null;
    let revision = 0;
    let ready = false;
    let syncing = false;
    let rerun = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let initSequence = 0;
    let lastFingerprint = "";

    const applyCanonical = (envelope: PlayerCloudEnvelope) => {
      revision = envelope.revision;
      useGameStore.getState()._hydratePlayerCloudState(envelope.state);
      lastFingerprint = JSON.stringify(selectPlayerCloudState());
    };

    const scheduleSync = (delay = SYNC_DEBOUNCE_MS) => {
      if (!ready || !activeUserId || disposed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void syncCurrentState(), delay);
    };

    const syncCurrentState = async () => {
      if (!ready || !activeUserId || disposed) return;
      if (syncing) {
        rerun = true;
        return;
      }

      const state = useGameStore.getState();
      const snapshot = selectPlayerCloudState(state);
      const fingerprint = JSON.stringify(snapshot);
      if (fingerprint === lastFingerprint) return;

      syncing = true;
      const userId = activeUserId;
      const mutationId = state._cloudMutationId ?? createPlayerMutationId("state");
      const mutation = { mutationId, expectedRevision: revision, state: snapshot };
      await enqueuePlayerMutation(userId, mutation);
      const result = await pushPlayerCloudState(mutation);

      if (!disposed && userId === activeUserId && result.ok && result.envelope) {
        const envelope = result.envelope;
        await removePendingPlayerMutation(userId, mutationId);
        useGameStore.getState()._clearCloudMutation(mutationId);

        if (envelope.applied) {
          revision = envelope.revision;
          lastFingerprint = fingerprint;
        } else {
          // Duplicate reward or stale revision: server wins, preventing replay
          // from an older device snapshot.
          await clearPendingPlayerMutations(userId);
          applyCanonical(envelope);
        }
      } else if (!disposed && userId === activeUserId) {
        scheduleSync(RETRY_DELAY_MS);
      }

      syncing = false;
      if (rerun) {
        rerun = false;
        scheduleSync(0);
      } else if (JSON.stringify(selectPlayerCloudState()) !== lastFingerprint) {
        scheduleSync();
      }
    };

    const initializeSession = async (email: string, userId: string) => {
      if (activeUserId === userId && (ready || initSequence > 0)) {
        setSession(email, userId);
        return;
      }
      const sequence = ++initSequence;
      ready = false;
      activeUserId = userId;
      setSession(email, userId);

      const [avatarResult, cloudResult, queued] = await Promise.all([
        pullAvatarFromSupabase(userId),
        pullPlayerCloudState(userId),
        readPendingPlayerMutations(userId),
      ]);
      if (disposed || sequence !== initSequence) return;

      if (avatarResult.ok && avatarResult.avatar && avatarResult.avatarId) {
        useGameStore.getState()._hydrateFromSupabase(
          avatarResult.avatar as AvatarProfile,
          avatarResult.stats as Partial<AvatarStats> | undefined,
          avatarResult.avatarId
        );
      }

      if (!cloudResult.ok) {
        console.warn("[player-sync] pull failed", cloudResult.error);
        activeUserId = null;
        return;
      }

      let canonical = cloudResult.envelope;
      revision = canonical?.revision ?? 0;

      for (let index = 0; index < queued.length; index += 1) {
        const pending = queued[index];
        const candidate = {
          ...pending,
          expectedRevision: index === 0 ? pending.expectedRevision : revision,
        };
        const result = await pushPlayerCloudState(candidate);
        if (!result.ok || !result.envelope) break;

        await removePendingPlayerMutation(userId, pending.mutationId);
        canonical = result.envelope;
        revision = canonical.revision;
        if (!canonical.applied) {
          await clearPendingPlayerMutations(userId);
          break;
        }
      }

      if (disposed || sequence !== initSequence) return;
      if (canonical) {
        applyCanonical(canonical);
      } else {
        const snapshot = selectPlayerCloudState();
        const mutation = {
          mutationId: createPlayerMutationId("bootstrap"),
          expectedRevision: 0,
          state: snapshot,
        };
        await enqueuePlayerMutation(userId, mutation);
        const result = await pushPlayerCloudState(mutation);
        if (result.ok && result.envelope) {
          await removePendingPlayerMutation(userId, mutation.mutationId);
          applyCanonical(result.envelope);
        } else {
          activeUserId = null;
          return;
        }
      }

      ready = true;
      lastFingerprint = JSON.stringify(selectPlayerCloudState());
    };

    const unsubscribeStore = useGameStore.subscribe(() => {
      if (!ready) return;
      const fingerprint = JSON.stringify(selectPlayerCloudState());
      if (fingerprint !== lastFingerprint) scheduleSync();
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        void initializeSession(session.user.email ?? "", session.user.id);
      } else if (useGameStore.getState().session?.provider === "supabase") {
        clearSession();
        router.replace("/(auth)/sign-in");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        void initializeSession(session.user.email ?? "", session.user.id);
      }
      if (event === "SIGNED_OUT") {
        initSequence += 1;
        ready = false;
        activeUserId = null;
        clearSession();
        router.replace("/(auth)/sign-in");
      }
      if (event === "TOKEN_REFRESHED" && session) {
        setSession(session.user.email ?? "", session.user.id);
      }
    });

    return () => {
      authSyncMounted = false;
      disposed = true;
      if (timer) clearTimeout(timer);
      unsubscribeStore();
      subscription.unsubscribe();
    };
  // Mounted once in the root layout. Zustand actions are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
