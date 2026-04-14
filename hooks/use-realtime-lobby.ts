import { useEffect, useState } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type LobbyState = {
  status: "local" | "connecting" | "live";
  members: number;
};

export function useRealtimeLobby() {
  const [state, setState] = useState<LobbyState>({
    status: isSupabaseConfigured ? "connecting" : "local",
    members: 0
  });

  useEffect(() => {
    const client = supabase;

    if (!isSupabaseConfigured || !client) {
      setState({ status: "local", members: 0 });
      return;
    }

    const channel = client.channel("mylife-lobby", {
      config: {
        presence: {
          key: `device-${Date.now()}`
        }
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const presence = channel.presenceState() as Record<string, unknown[]>;
      setState({
        status: "live",
        members: Object.keys(presence).length
      });
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          online_at: new Date().toISOString()
        });
        setState((current) => ({ ...current, status: "live" }));
      }
    });

    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  return state;
}
