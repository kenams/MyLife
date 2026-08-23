import { useEffect } from "react";

import { supabase } from "@/lib/supabase";
import { useGameStore } from "@/stores/game-store";

type SocialNotifRow = {
  id: string;
  type: "friend_request" | "friend_accepted";
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

// Pont entre les notifications sociales réelles (table social_notifications,
// alimentée côté serveur par les RPC friend_relationships) et le centre de
// notifications déjà existant dans le store (jusque-là 100% local). Fetch au
// montage + abonnement Realtime pour les nouvelles pendant que l'app est ouverte.
export function useSocialNotifications() {
  const addSocialNotification = useGameStore((s) => s.addSocialNotification);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    let sub: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid || cancelled) return;

      const { data } = await supabase
        .from("social_notifications")
        .select("id,type,title,body,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(30);

      (data as SocialNotifRow[] | null)?.forEach((row) => {
        addSocialNotification({
          id: row.id,
          kind: "social",
          title: row.title,
          body: row.body ?? undefined,
          createdAt: row.created_at,
          read: !!row.read_at,
        });
      });

      if (cancelled) return;
      sub = supabase
        .channel("social_notifications_live")
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "social_notifications",
          filter: `target_user_id=eq.${uid}`,
        }, (payload) => {
          const row = payload.new as SocialNotifRow;
          addSocialNotification({
            id: row.id,
            kind: "social",
            title: row.title,
            body: row.body ?? undefined,
            createdAt: row.created_at,
            read: false,
          });
        })
        .subscribe();
    })();

    return () => { cancelled = true; sub?.unsubscribe(); };
  }, [addSocialNotification]);
}
