/**
 * Hook room — chat + présence live dans une room
 *
 * Chaque room est un channel Supabase Realtime.
 * Les membres voient en temps réel :
 * - les messages des autres
 * - qui est en ligne (présence)
 * - l'action actuelle de chaque membre
 */

import { useEffect, useRef, useState } from "react";

import type { AvatarAction } from "@/lib/avatar-visual";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { RoomMember, RoomMessage } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

export function useRoom(roomId: string | null) {
  const session  = useGameStore((s) => s.session);
  const avatar   = useGameStore((s) => s.avatar);
  const stats    = useGameStore((s) => s.stats);
  const localMessages = useGameStore((s) => roomId ? s.roomMessages[roomId] ?? [] : []);
  const sendLocalRoomMessage = useGameStore((s) => s.sendRoomMessage);

  const [messages, setMessages]   = useState<RoomMessage[]>([]);
  const [members, setMembers]     = useState<RoomMember[]>([]);
  const [connected, setConnected] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  function getMyAction(): AvatarAction {
    if (stats.energy < 20) return "sleeping";
    if (stats.sociability > 70) return "chatting";
    return "idle";
  }

  useEffect(() => {
    if (!roomId) return;

    if (!session || !avatar) {
      setConnected(true);
      setMembers([{
        userId: "local",
        avatarName: avatar?.displayName ?? "Moi",
        action: "chatting",
        joinedAt: new Date().toISOString(),
        isOnline: true
      }]);
      return;
    }

    // Mode local : pas de Supabase
    if (!isSupabaseConfigured || !supabase) {
      setConnected(true);
      setMembers([{
        userId: session.email,
        avatarName: avatar.displayName,
        action: "chatting",
        joinedAt: new Date().toISOString(),
        isOnline: true
      }]);
      return;
    }

    const userId     = session.email;
    const avatarName = avatar.displayName;

    const channel = supabase!.channel(`mylife-room-${roomId}`, {
      config: { presence: { key: userId } }
    });
    channelRef.current = channel;

    // Écoute des nouveaux messages (broadcast)
    channel.on("broadcast", { event: "message" }, ({ payload }) => {
      const msg = payload as RoomMessage;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].slice(-200);
      });
    });

    // Écoute de la présence
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      const all: RoomMember[] = [];
      for (const key of Object.keys(state)) {
        const list = state[key];
        if (list && list.length > 0) {
          all.push({ ...(list[0] as RoomMember), isOnline: true });
        }
      }
      setMembers(all);
    });

    channel.on("presence", { event: "join" }, ({ newPresences }) => {
      const joined = newPresences as unknown as RoomMember[];
      // Message système automatique
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-join-${Date.now()}`,
          authorId: "system",
          authorName: "Système",
          body: `${joined[0]?.avatarName ?? "Quelqu'un"} a rejoint la room.`,
          createdAt: new Date().toISOString(),
          kind: "system"
        }
      ]);
    });

    channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
      const left = leftPresences as unknown as RoomMember[];
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-leave-${Date.now()}`,
          authorId: "system",
          authorName: "Système",
          body: `${left[0]?.avatarName ?? "Quelqu'un"} a quitté la room.`,
          createdAt: new Date().toISOString(),
          kind: "system"
        }
      ]);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        await channel.track({
          userId,
          avatarName,
          action: getMyAction(),
          joinedAt: new Date().toISOString(),
          isOnline: true
        } satisfies RoomMember);
      }
    });

    return () => {
      void supabase?.removeChannel(channel);
      setConnected(false);
      setMembers([]);
    };
  }, [roomId, session?.email, avatar?.displayName]);

  const sendMessage = async (body: string, kind: RoomMessage["kind"] = "message") => {
    if (!body.trim() || !roomId) return;

    if (kind === "emote") {
      const emote: RoomMessage = {
        id: `emote-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        authorId: session?.email ?? "local",
        authorName: avatar?.displayName ?? "Moi",
        body: body.trim(),
        createdAt: new Date().toISOString(),
        kind
      };
      setMessages((prev) => [...prev, emote].slice(-200));
      if (isSupabaseConfigured && supabase && channelRef.current) {
        await channelRef.current.send({ type: "broadcast", event: "message", payload: emote });
      }
      return;
    }

    sendLocalRoomMessage(roomId, body);

    if (!session || !avatar) return;

    const msg: RoomMessage = {
      id:         `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      authorId:   session.email,
      authorName: avatar.displayName,
      body:       body.trim(),
      createdAt:  new Date().toISOString(),
      kind
    };

    // Broadcast aux autres
    if (isSupabaseConfigured && supabase && channelRef.current) {
      await channelRef.current.send({ type: "broadcast", event: "message", payload: msg });
    }
  };

  const sendEmote = (emote: string) => sendMessage(emote, "emote");

  const mergedMessages = [...localMessages, ...messages]
    .filter((message, index, all) => all.findIndex((item) => item.id === message.id) === index)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-200);

  return { messages: mergedMessages, members, connected, sendMessage, sendEmote };
}
