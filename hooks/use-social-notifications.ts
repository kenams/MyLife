import { useEffect } from "react";

import { supabase } from "@/lib/supabase";
import { useGameStore } from "@/stores/game-store";

type SeasonNotifType =
  | "friend_request" | "friend_accepted" | "match"
  | "mission_joined" | "mission_validated" | "mission_rejected" | "mission_rewarded"
  | "badge_unlocked" | "level_up" | "district_goal_reached" | "mission_expiring_soon";

type SocialNotifRow = {
  id: string;
  type: SeasonNotifType;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  link_params: { missionId?: string } | null;
};

const SEASON_TYPES = new Set<SeasonNotifType>([
  "mission_joined", "mission_validated", "mission_rejected", "mission_rewarded",
  "badge_unlocked", "level_up", "district_goal_reached", "mission_expiring_soon",
]);

// Pont entre les notifications réelles (table social_notifications,
// alimentée côté serveur — friend_relationships ET les RPC de Saison 1) et
// le centre de notifications déjà existant dans le store (jusque-là 100%
// local). Fetch au montage + abonnement Realtime pour les nouvelles pendant
// que l'app est ouverte.
export function useSocialNotifications() {
  const addSocialNotification = useGameStore((s) => s.addSocialNotification);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    let sub: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    function toItem(row: SocialNotifRow, read: boolean) {
      addSocialNotification({
        id: row.id,
        kind: SEASON_TYPES.has(row.type) ? "reward" : "social",
        title: row.title,
        body: row.body ?? undefined,
        createdAt: row.created_at,
        read,
        linkMissionId: row.link_params?.missionId,
      });
    }

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid || cancelled) return;

      const { data } = await supabase
        .from("social_notifications")
        .select("id,type,title,body,read_at,created_at,link_params")
        .order("created_at", { ascending: false })
        .limit(30);

      (data as SocialNotifRow[] | null)?.forEach((row) => toItem(row, !!row.read_at));

      if (cancelled) return;
      sub = supabase
        .channel("social_notifications_live")
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "social_notifications",
          filter: `target_user_id=eq.${uid}`,
        }, (payload) => toItem(payload.new as SocialNotifRow, false))
        .subscribe();
    })();

    return () => { cancelled = true; sub?.unsubscribe(); };
  }, [addSocialNotification]);
}
