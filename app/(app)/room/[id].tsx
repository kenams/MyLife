import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { RoomInterior } from "@/components/room-interior";
import { RoomTopView } from "@/components/room-top-view";
import { getAvatarVisual, getNpcVisual } from "@/lib/avatar-visual";
import { useRoom } from "@/hooks/use-room";
import { colors } from "@/lib/theme";
import type { RoomMessage } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

const EMOTES = ["👋","🔥","💪","😄","✨","🤝","😂","❤️","🎯","💯","🙏","🎉"];

// ─── NPC auto-messages ────────────────────────────────────────────────────────
const NPC_AUTO: Record<string, string[]> = {
  ava:   ["Salut tout le monde 👋", "Super ambiance ici !", "Vous faites quoi ce soir ?",
          "J'adore cet endroit 😊", "Quelqu'un veut un café ?", "La vibe est bonne ici ✨"],
  noa:   ["Yo les gens 🔥", "C'est chill ici.", "Quelqu'un a des plans ?",
          "J'viens d'arriver, quoi de neuf ?", "On est bien là 💪", "La team est là !"],
  leila: ["Bonne énergie ce soir !", "Salut la room 🌿", "Qui veut faire une marche après ?",
          "Respirez, profitez 😄", "Belle soirée à tous ✨", "Le calme avant la fête 🎉"]
};

function getRandomNpcMsg(npcId: string): string {
  const pool = NPC_AUTO[npcId] ?? ["..."];
  return pool[Math.floor(Math.random() * pool.length)];
}

const NPC_NAMES: Record<string, string> = { ava: "Ava Laurent", noa: "Noa Kiran", leila: "Leila Benali" };

type ViewMode = "chat" | "map";

// ─── Bulle de message ─────────────────────────────────────────────────────────
function Bubble({ msg, isMe }: { msg: RoomMessage; isMe: boolean }) {
  if (msg.kind === "system") {
    return (
      <View style={{ alignItems: "center", paddingVertical: 6 }}>
        <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontStyle: "italic" }}>{msg.body}</Text>
        </View>
      </View>
    );
  }
  if (msg.kind === "emote") {
    return (
      <View style={{ alignItems: isMe ? "flex-end" : "flex-start", marginVertical: 4, paddingHorizontal: 16 }}>
        {!isMe && (
          <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 2, marginLeft: 4 }}>
            {msg.authorName}
          </Text>
        )}
        <Text style={{ fontSize: 32 }}>{msg.body}</Text>
      </View>
    );
  }
  return (
    <View style={{ alignItems: isMe ? "flex-end" : "flex-start", marginVertical: 3, paddingHorizontal: 16 }}>
      {!isMe && (
        <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 3, marginLeft: 8 }}>
          {msg.authorName}
        </Text>
      )}
      <View style={{
        maxWidth: "78%",
        backgroundColor: isMe ? colors.accent : "rgba(255,255,255,0.08)",
        borderRadius: 18,
        borderBottomRightRadius: isMe ? 4 : 18,
        borderBottomLeftRadius:  isMe ? 18 : 4,
        paddingHorizontal: 16, paddingVertical: 10
      }}>
        <Text style={{ color: isMe ? "#07111f" : colors.text, fontSize: 15, lineHeight: 22 }}>
          {msg.body}
        </Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 9, marginTop: 3, marginHorizontal: 8 }}>
        {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </View>
  );
}

// ─── Chip membre ──────────────────────────────────────────────────────────────
function MemberChip({ name, isMe }: { name: string; isMe?: boolean }) {
  const npcId  = Object.keys(NPC_NAMES).find((k) => NPC_NAMES[k] === name);
  const visual = npcId
    ? getNpcVisual(npcId)
    : (useGameStore.getState().avatar ? getAvatarVisual(useGameStore.getState().avatar!) : getNpcVisual(name));

  return (
    <View style={{ alignItems: "center", gap: 4, minWidth: 52 }}>
      <View style={{ position: "relative" }}>
        <AvatarSprite visual={visual} action="idle" size="xs" />
        <View style={{
          position: "absolute", bottom: 0, right: 0,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: "#38c793", borderWidth: 2, borderColor: "#07111f"
        }} />
      </View>
      <Text style={{ color: isMe ? colors.accent : colors.text, fontSize: 9, fontWeight: "700", textAlign: "center" }}>
        {name.split(" ")[0]}{isMe ? " (toi)" : ""}
      </Text>
    </View>
  );
}

// ─── Toggle vue ───────────────────────────────────────────────────────────────
function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <View style={{
      flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 12, padding: 3, gap: 2
    }}>
      {(["chat", "map"] as ViewMode[]).map((m) => (
        <Pressable
          key={m}
          onPress={() => onChange(m)}
          style={{
            paddingHorizontal: 14, paddingVertical: 6, borderRadius: 9,
            backgroundColor: mode === m ? colors.accent + "30" : "transparent",
            flexDirection: "row", alignItems: "center", gap: 5
          }}
        >
          <Ionicons
            name={m === "chat" ? "chatbubbles-outline" : "home-outline"}
            size={13}
            color={mode === m ? colors.accent : colors.muted}
          />
          <Text style={{
            color: mode === m ? colors.accent : colors.muted,
            fontWeight: "700", fontSize: 12
          }}>
            {m === "chat" ? "Chat" : "Lieu"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RoomScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const rooms     = useGameStore((s) => s.rooms);
  const session   = useGameStore((s) => s.session);
  const leaveRoom = useGameStore((s) => s.leaveRoom);

  const room = rooms.find((r) => r.id === id);
  const { messages, members, connected, sendMessage, sendEmote } = useRoom(id ?? null);

  const [text, setText]             = useState("");
  const [showEmotes, setShowEmotes] = useState(false);
  const [viewMode, setViewMode]     = useState<ViewMode>("chat");
  const flatRef = useRef<FlatList>(null);

  // Entry animation
  const scaleAnim   = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1, duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1, duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // NPC messages
  const [localNpcMsgs, setLocalNpcMsgs] = useState<RoomMessage[]>([]);

  const injectNpcMessage = (npcId: string, name: string, body: string) => {
    setLocalNpcMsgs((prev) => [
      ...prev,
      {
        id:         `npc-${npcId}-${Date.now()}`,
        authorId:   `npc-${npcId}`,
        authorName: name,
        body,
        createdAt:  new Date().toISOString(),
        kind:       "message" as const
      }
    ].slice(-50));
  };

  useEffect(() => {
    if (!room) return;
    const npcIds = ["ava", "noa", "leila"];
    const timers: ReturnType<typeof setTimeout>[] = [];
    npcIds.forEach((npcId, i) => {
      const t = setTimeout(() => injectNpcMessage(npcId, NPC_NAMES[npcId], getRandomNpcMsg(npcId)), 2000 + i * 1500);
      timers.push(t);
      const interval = setInterval(() => injectNpcMessage(npcId, NPC_NAMES[npcId], getRandomNpcMsg(npcId)),
        20000 + i * 8000 + Math.random() * 10000);
      timers.push(interval as unknown as ReturnType<typeof setTimeout>);
    });
    return () => timers.forEach(clearTimeout);
  }, [room?.id]);

  const allMessages = [...messages, ...localNpcMsgs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  useEffect(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [allMessages.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    void sendMessage(text.trim());
    setText("");
    const responderId = ["ava", "noa", "leila"][Math.floor(Math.random() * 3)];
    setTimeout(() => injectNpcMessage(responderId, NPC_NAMES[responderId], getRandomNpcMsg(responderId)),
      1500 + Math.random() * 2000);
  };

  const handleLeave = () => {
    if (id) leaveRoom(id);
    router.canGoBack() ? router.back() : router.replace("/(app)/rooms");
  };

  if (!room) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>Room introuvable.</Text>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/rooms")}>
          <Text style={{ color: colors.accent, fontSize: 14 }}>← Retour</Text>
        </Pressable>
      </View>
    );
  }

  const displayMembers = id === "room-test-live"
    ? [
        ...members,
        { userId: "npc-ava",   avatarName: "Ava Laurent",  action: "chatting" as const, joinedAt: room.createdAt, isOnline: true },
        { userId: "npc-noa",   avatarName: "Noa Kiran",    action: "idle"     as const, joinedAt: room.createdAt, isOnline: true },
        { userId: "npc-leila", avatarName: "Leila Benali", action: "chatting" as const, joinedAt: room.createdAt, isOnline: true },
      ].filter((m, i, arr) => arr.findIndex((x) => x.userId === m.userId) === i)
    : members;

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }], opacity: opacityAnim }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── HEADER ── */}
      <View style={{
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10,
        backgroundColor: "#0b1a2d",
        borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.07)"
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={handleLeave} hitSlop={10}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.07)",
              alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
              {room.name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4,
                backgroundColor: connected ? "#38c793" : colors.muted }} />
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {displayMembers.length} en ligne
              </Text>
              {room.code && (
                <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 6,
                  paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>#{room.code}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Toggle chat / vue du dessus */}
          <ViewToggle mode={viewMode} onChange={setViewMode} />

          <Pressable onPress={handleLeave}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
              backgroundColor: "rgba(255,107,107,0.12)", borderWidth: 1, borderColor: "rgba(255,107,107,0.25)" }}>
            <Text style={{ color: "#ff6b6b", fontWeight: "700", fontSize: 11 }}>Quitter</Text>
          </Pressable>
        </View>

        {/* Chips membres — uniquement en mode chat */}
        {viewMode === "chat" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 10, gap: 14 }}>
            {displayMembers.map((m) => (
              <MemberChip key={m.userId} name={m.avatarName} isMe={m.userId === session?.email} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── VUE DU DESSUS ── */}
      {viewMode === "map" ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40, gap: 0 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Scène intérieure du lieu */}
          <RoomInterior roomId={id ?? "home"} />

          <View style={{ padding: 16, gap: 16 }}>
            {/* Info membres en bas */}
            <View style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              borderRadius: 16, padding: 14, gap: 10,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.06)"
            }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                MEMBRES PRÉSENTS
              </Text>
              {displayMembers.map((m) => {
                const npcId  = m.userId.startsWith("npc-") ? m.userId.replace("npc-", "") : null;
                const visual = npcId ? getNpcVisual(npcId)
                             : (useGameStore.getState().avatar ? getAvatarVisual(useGameStore.getState().avatar!) : getNpcVisual("ava"));
                return (
                  <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <AvatarSprite visual={visual} action={m.action ?? "idle"} size="xs" />
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        color: m.userId === session?.email ? colors.accent : colors.text,
                        fontWeight: "700", fontSize: 13
                      }}>
                        {m.avatarName}{m.userId === session?.email ? " (toi)" : ""}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        {(m.action ?? "idle").replace(/([A-Z])/g, " $1").toLowerCase()}
                      </Text>
                    </View>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#38c793" }} />
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      ) : (
        <>
          {/* ── MESSAGES ── */}
          <FlatList
            ref={flatRef}
            data={allMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Bubble msg={item} isMe={item.authorId === session?.email || item.authorId === "local"} />
            )}
            contentContainerStyle={{ paddingVertical: 12, paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
                <Text style={{ fontSize: 48 }}>💬</Text>
                <Text style={{ color: colors.muted, fontSize: 15 }}>Dis bonjour pour commencer !</Text>
              </View>
            }
          />

          {/* ── EMOTES ── */}
          {showEmotes && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ backgroundColor: "#0b1a2d", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
              {EMOTES.map((e) => (
                <Pressable key={e}
                  onPress={() => { void sendEmote(e); setShowEmotes(false); }}
                  style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12 }}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* ── INPUT ── */}
          <View style={{
            flexDirection: "row", gap: 10,
            paddingHorizontal: 12, paddingVertical: 10,
            paddingBottom: Platform.OS === "ios" ? 30 : 12,
            backgroundColor: "#0b1a2d",
            borderTopWidth: 1, borderColor: "rgba(255,255,255,0.07)",
            alignItems: "flex-end"
          }}>
            <Pressable onPress={() => setShowEmotes(!showEmotes)}
              style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center",
                backgroundColor: showEmotes ? colors.accent + "22" : "rgba(255,255,255,0.07)", borderRadius: 21 }}>
              <Text style={{ fontSize: 22 }}>😊</Text>
            </Pressable>

            <TextInput
              style={{
                flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 22,
                paddingHorizontal: 18, paddingVertical: 11,
                color: colors.text, fontSize: 15, maxHeight: 120,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
              }}
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              placeholderTextColor={colors.muted}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />

            <Pressable onPress={handleSend} disabled={!text.trim()}
              style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: text.trim() ? colors.accent : "rgba(255,255,255,0.07)",
                alignItems: "center", justifyContent: "center"
              }}>
              <Ionicons name="send" size={18} color={text.trim() ? "#07111f" : colors.muted} />
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
    </Animated.View>
  );
}
