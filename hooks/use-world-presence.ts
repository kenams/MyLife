/**
 * Hook world presence — broadcast + écoute des positions de tous les joueurs
 *
 * Utilise Supabase Realtime Presence pour diffuser :
 * - la position du joueur (locationSlug, posX, posY)
 * - son action actuelle (idle, walking, working...)
 * - son humeur (mood)
 *
 * En mode local (sans Supabase), simule la présence avec les NPCs.
 */

import { useEffect, useRef, useState } from "react";

import type { AvatarAction } from "@/lib/avatar-visual";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { WorldPresenceMember } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

export function useWorldPresence() {
  const session             = useGameStore((s) => s.session);
  const avatar              = useGameStore((s) => s.avatar);
  const stats               = useGameStore((s) => s.stats);
  const currentLocationSlug = useGameStore((s) => s.currentLocationSlug);

  const [members, setMembers] = useState<WorldPresenceMember[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  // Déduire l'action du joueur depuis ses stats
  function derivePlayerAction(): AvatarAction {
    if (stats.energy < 20) return "sleeping";
    if (stats.hunger < 25) return "eating";
    if (stats.sociability < 25) return "walking";
    return "idle";
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !session || !avatar) {
      setMembers([]);
      return;
    }

    const userId     = session.email;
    const avatarName = avatar.displayName;
    const action     = derivePlayerAction();

    const channel = supabase!.channel("mylife-world-presence", {
      config: { presence: { key: userId } }
    });

    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      const all: WorldPresenceMember[] = [];
      for (const key of Object.keys(state)) {
        const list = state[key];
        if (list && list.length > 0) {
          all.push(list[0] as WorldPresenceMember);
        }
      }
      setMembers(all.filter((m) => m.userId !== userId));
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId,
          avatarName,
          locationSlug: currentLocationSlug,
          action,
          mood: stats.mood,
          onlineAt: new Date().toISOString(),
          posX: 50,
          posY: 50
        } satisfies WorldPresenceMember);
      }
    });

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [session?.email]);

  // Re-broadcast quand la position change
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !session || !avatar) return;
    void ch.track({
      userId:       session.email,
      avatarName:   avatar.displayName,
      locationSlug: currentLocationSlug,
      action:       derivePlayerAction(),
      mood:         stats.mood,
      onlineAt:     new Date().toISOString(),
      posX:         50,
      posY:         50
    } satisfies WorldPresenceMember);
  }, [currentLocationSlug, stats.mood, stats.energy]);

  return { members, count: members.length };
}
