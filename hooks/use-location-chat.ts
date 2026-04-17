import { useCallback, useEffect, useRef, useState } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { RoomMessage, WorldPresenceMember } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

export function useLocationChat(locationSlug: string, liveMembers: WorldPresenceMember[]) {
  const session = useGameStore((s) => s.session);
  const avatar = useGameStore((s) => s.avatar);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [connected, setConnected] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  useEffect(() => {
    setMessages([]);
    setConnected(false);

    if (!locationSlug || !session || !avatar) {
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setConnected(true);
      return;
    }

    const channel = supabase.channel(`mylife-location-${locationSlug}`, {
      config: { presence: { key: session.email } }
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "message" }, ({ payload }) => {
      const msg = payload as RoomMessage;
      setMessages((prev) => {
        if (prev.some((item) => item.id === msg.id)) return prev;
        return [...prev, msg].slice(-120);
      });
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        await channel.track({
          userId: session.email,
          avatarName: avatar.displayName,
          locationSlug,
          onlineAt: new Date().toISOString()
        });
      }
    });

    return () => {
      void supabase?.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
  }, [locationSlug, session?.email, avatar?.displayName]);

  const sendMessage = useCallback(async (body: string) => {
    const clean = body.trim();
    if (!clean || !session || !avatar) return;

    const msg: RoomMessage = {
      id: `loc-${locationSlug}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      authorId: session.email,
      authorName: avatar.displayName,
      body: clean,
      createdAt: new Date().toISOString(),
      kind: "message"
    };

    setMessages((prev) => [...prev, msg].slice(-120));

    if (isSupabaseConfigured && supabase && channelRef.current) {
      await channelRef.current.send({ type: "broadcast", event: "message", payload: msg });
    }
  }, [avatar?.displayName, locationSlug, session?.email]);

  const addLocalMessage = useCallback((message: RoomMessage) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [...prev, message].slice(-120);
    });
  }, []);

  return {
    addLocalMessage,
    connected,
    messages,
    memberCount: liveMembers.filter((member) => member.locationSlug === locationSlug).length,
    sendMessage
  };
}
