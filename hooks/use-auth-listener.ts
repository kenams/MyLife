/**
 * useAuthListener — écoute les changements de session Supabase Auth
 * et synchronise l'état du store (session, avatar, stats).
 *
 * À monter UNE SEULE FOIS dans app/_layout.tsx (RootLayout).
 */
import { useEffect } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { pullAvatarFromSupabase } from "@/lib/supabase-sync";
import { useGameStore } from "@/stores/game-store";
import type { AvatarProfile, AvatarStats } from "@/lib/types";

export function useAuthListener() {
  const setSession  = useGameStore((s) => s._setSupabaseSession);
  const signOutLocal = useGameStore((s) => s.signOut);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // Rehydrate session initiale (app cold start)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;

      setSession(session.user.email ?? "", session.user.id);

      const pulled = await pullAvatarFromSupabase(session.user.id);
      if (pulled.ok && pulled.avatar && pulled.avatarId) {
        useGameStore.getState()._hydrateFromSupabase(
          pulled.avatar as AvatarProfile,
          pulled.stats as Partial<AvatarStats> | undefined,
          pulled.avatarId
        );
      }
    });

    // Écoute les changements d'état Auth en temps réel
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          setSession(session.user.email ?? "", session.user.id);

          const pulled = await pullAvatarFromSupabase(session.user.id);
          if (pulled.ok && pulled.avatar && pulled.avatarId) {
            useGameStore.getState()._hydrateFromSupabase(
              pulled.avatar as AvatarProfile,
              pulled.stats as Partial<AvatarStats> | undefined,
              pulled.avatarId
            );
          }
        }

        if (event === "SIGNED_OUT") {
          signOutLocal();
        }

        if (event === "TOKEN_REFRESHED" && session) {
          // Token rafraîchi silencieusement — on met juste à jour l'email
          setSession(session.user.email ?? "", session.user.id);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
