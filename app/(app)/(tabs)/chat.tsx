import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, Easing, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, Text, TextInput, View
} from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getNpcVisual } from "@/lib/avatar-visual";
import { activities, starterResidents } from "@/lib/game-engine";
import { getRelationshipLabel } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import type { Conversation, NpcState, RoomMessage } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

type Tab = "amis" | "rooms" | "lounge";

function relColor(score: number) {
  if (score > 60) return colors.accent;
  if (score > 30) return colors.gold;
  return colors.muted;
}

// ─── Online dot ───────────────────────────────────────────────────────────────
function OnlineDot({ online }: { online: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!online) return;
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, [online]);

  if (!online) return (
    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.muted + "88",
      borderWidth: 1.5, borderColor: colors.bg }} />
  );
  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: 10, height: 10, borderRadius: 5,
        backgroundColor: "#22c55e44", transform: [{ scale: pulseAnim }] }} />
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#22c55e",
        borderWidth: 1.5, borderColor: colors.bg }} />
    </View>
  );
}

function QuickReplyBar({ replies, onPick }: { replies: string[]; onPick: (text: string) => void }) {
  if (replies.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 8 }}
      style={{ backgroundColor: colors.bgSoft, borderTopWidth: 1, borderTopColor: colors.border }}
    >
      {replies.map((reply) => (
        <Pressable
          key={reply}
          onPress={() => onPick(reply)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 18,
            backgroundColor: colors.accent + "14",
            borderWidth: 1,
            borderColor: colors.accent + "35"
          }}
        >
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>{reply}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Avatar NPC avec dot ──────────────────────────────────────────────────────
function NpcAvatar({ npc, size = 40, showOnline = false }: {
  npc: NpcState; size?: number; showOnline?: boolean;
}) {
  const visual = getNpcVisual(npc.id);
  return (
    <View style={{ position: "relative", width: size, height: size }}>
      <AvatarSprite visual={visual} action={npc.action as never} size="sm" />
      {showOnline && (
        <View style={{ position: "absolute", bottom: 0, right: 0 }}>
          <OnlineDot online={npc.presenceOnline ?? false} />
        </View>
      )}
    </View>
  );
}

// ─── DM Conversation individuelle ────────────────────────────────────────────
function ConversationView({ conv, npc, onBack }: {
  conv: Conversation;
  npc: NpcState | null;
  onBack: () => void;
}) {
  const sendMessage         = useGameStore((s) => s.sendMessage);
  const markConversationRead = useGameStore((s) => s.markConversationRead);
  const [input, setInput]   = useState("");
  const scrollRef           = useRef<ScrollView>(null);
  const npcInfo             = npc ? starterResidents.find((r) => r.id === npc.id) : null;

  useEffect(() => {
    markConversationRead(conv.id);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, [conv.id]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [conv.messages.length]);

  function send() {
    if (!input.trim()) return;
    sendText(input.trim());
    setInput("");
  }

  function sendText(text: string) {
    sendMessage(conv.id, text);
  }

  const firstName = npcInfo?.name.split(" ")[0] ?? conv.title.split(" ")[0];
  const quickReplies = [
    `Salut ${firstName}, ça va ?`,
    "Tu fais quoi en ce moment ?",
    "On se retrouve en ville ?",
    "Tu veux prendre un café ?"
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14,
        backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </Pressable>
        {npc && <NpcAvatar npc={npc} size={40} showOnline />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
            {npcInfo?.name ?? conv.title}
          </Text>
          <Text style={{ color: npc?.presenceOnline ? "#22c55e" : colors.muted, fontSize: 11, fontWeight: "600" }}>
            {npc?.presenceOnline ? "● En ligne" : "○ Hors ligne"} · {npcInfo?.role ?? ""}
          </Text>
        </View>
      </View>

      {/* NPC bio intro */}
      {conv.messages.length <= 3 && npcInfo && (
        <View style={{ margin: 16, backgroundColor: colors.accentGlow, borderRadius: 14, padding: 12,
          borderWidth: 1, borderColor: colors.accent + "35" }}>
          <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 11, marginBottom: 4 }}>
            {npcInfo.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{npcInfo.bio}</Text>
        </View>
      )}

      {/* Messages */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}>
        {conv.messages.map((msg) => {
          const isMe = msg.authorId === "player" || msg.authorId === "user";
          const isSystem = msg.kind === "system";
          if (isSystem) return (
            <View key={msg.id} style={{ alignItems: "center", paddingVertical: 4 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontStyle: "italic" }}>{msg.body}</Text>
            </View>
          );
          return (
            <View key={msg.id} style={{ flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
              {!isMe && npc && (
                <View style={{ width: 28, height: 28, flexShrink: 0 }}>
                  <AvatarSprite visual={getNpcVisual(npc.id)} action="idle" size="xs" />
                </View>
              )}
              <View style={{
                maxWidth: "75%",
                backgroundColor: isMe ? colors.accent + "25" : colors.cardAlt,
                borderRadius: 16,
                borderBottomRightRadius: isMe ? 4 : 16,
                borderBottomLeftRadius: isMe ? 16 : 4,
                padding: 10, paddingHorizontal: 13,
                borderWidth: 1,
                borderColor: isMe ? colors.accent + "40" : colors.border,
              }}>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{msg.body}</Text>
                <Text style={{ color: colors.muted, fontSize: 9, marginTop: 4, textAlign: isMe ? "right" : "left" }}>
                  {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <QuickReplyBar replies={quickReplies} onPick={sendText} />

      {/* Input */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10,
        paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          placeholder="Écrire un message..."
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          style={{ flex: 1, backgroundColor: colors.cardAlt, borderRadius: 22,
            paddingHorizontal: 16, paddingVertical: 10,
            color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border }}
        />
        <Pressable onPress={send}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent,
            alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="send" size={16} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Room Chat (Lounge ou Room privée) ───────────────────────────────────────
function RoomChatView({ roomId, roomName, onBack }: {
  roomId: string; roomName: string; onBack: () => void;
}) {
  const sendRoomMessage  = useGameStore((s) => s.sendRoomMessage);
  const roomMessages     = useGameStore((s) => s.roomMessages[roomId] ?? []);
  const npcs             = useGameStore((s) => s.npcs);
  const avatar           = useGameStore((s) => s.avatar);
  const rooms            = useGameStore((s) => s.rooms);
  const inviteNpcToRoom  = useGameStore((s) => s.inviteNpcToRoom);
  const room             = rooms.find((r) => r.id === roomId);
  const onlineNpcs       = npcs.filter((n) => n.presenceOnline ?? false);

  const [input, setInput] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [roomMessages.length]);

  function send() {
    if (!input.trim()) return;
    sendText(input.trim());
    setInput("");
  }

  function sendText(text: string) {
    sendRoomMessage(roomId, text);
  }

  const roomQuickReplies = [
    "Qui est dispo ici ?",
    "Je viens d'arriver dans la room.",
    "On teste une sortie ensemble ?",
    "Quelqu'un veut discuter ?"
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14,
        backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{roomName}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {room?.memberCount ?? onlineNpcs.length} membre(s) · {onlineNpcs.length} en ligne
          </Text>
        </View>
        {room?.kind === "private" && (
          <Pressable onPress={() => setShowInvite((v) => !v)}
            style={{ backgroundColor: colors.purpleGlow, borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.purple + "55" }}>
            <Text style={{ color: colors.purple, fontSize: 11, fontWeight: "800" }}>+ Inviter</Text>
          </Pressable>
        )}
        {room?.kind === "private" && room.code && (
          <View style={{ backgroundColor: colors.cardAlt, borderRadius: 8,
            paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.gold, fontSize: 10, fontWeight: "900" }}>#{room.code}</Text>
          </View>
        )}
      </View>

      {/* Panel invite NPC */}
      {showInvite && (
        <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
          padding: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 }}>
            INVITER UN AMI EN LIGNE
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {onlineNpcs.map((npc) => (
                <Pressable key={npc.id} onPress={() => { inviteNpcToRoom(roomId, npc.id); setShowInvite(false); }}
                  style={{ alignItems: "center", gap: 4 }}>
                  <NpcAvatar npc={npc} size={40} showOnline />
                  <Text style={{ color: colors.textSoft, fontSize: 9 }}>{npc.name.split(" ")[0]}</Text>
                </Pressable>
              ))}
              {onlineNpcs.length === 0 && (
                <Text style={{ color: colors.muted, fontSize: 12 }}>Aucun ami en ligne</Text>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Online members strip */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8,
        paddingHorizontal: 14, paddingVertical: 8,
        backgroundColor: colors.bgSoft, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>EN LIGNE :</Text>
        {/* Player */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accentGlow,
            alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.accent }}>
            <Text style={{ fontSize: 12 }}>🧑</Text>
          </View>
          <Text style={{ color: colors.accent, fontSize: 10, fontWeight: "700" }}>
            {avatar?.displayName?.split(" ")[0] ?? "Moi"}
          </Text>
        </View>
        {onlineNpcs.slice(0, 5).map((npc) => (
          <View key={npc.id} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <NpcAvatar npc={npc} size={24} />
            <Text style={{ color: colors.textSoft, fontSize: 10 }}>{npc.name.split(" ")[0]}</Text>
          </View>
        ))}
        {onlineNpcs.length > 5 && (
          <Text style={{ color: colors.muted, fontSize: 10 }}>+{onlineNpcs.length - 5}</Text>
        )}
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 14, gap: 8 }} showsVerticalScrollIndicator={false}>
        {roomMessages.length === 0 && (
          <View style={{ alignItems: "center", paddingTop: 40, gap: 8 }}>
            <Text style={{ fontSize: 32 }}>💬</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Personne n'a encore écrit</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Sois le premier !</Text>
          </View>
        )}
        {roomMessages.map((msg) => {
          const isMe = msg.authorId === (useGameStore.getState().session?.email ?? "local")
            || msg.authorId === "local"
            || (msg.authorName === (useGameStore.getState().avatar?.displayName ?? "__"));
          const isSystem = msg.kind === "system";
          const isEmote  = msg.kind === "emote";
          const npc = npcs.find((n) => n.id === msg.authorId);

          if (isSystem) return (
            <View key={msg.id} style={{ alignItems: "center", paddingVertical: 4 }}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 10, fontStyle: "italic" }}>{msg.body}</Text>
              </View>
            </View>
          );

          if (isEmote) return (
            <View key={msg.id} style={{ alignItems: "center", paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {msg.authorName} : <Text style={{ fontSize: 22 }}>{msg.body}</Text>
              </Text>
            </View>
          );

          return (
            <View key={msg.id} style={{ flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
              {!isMe && (
                <View style={{ width: 28, height: 28, flexShrink: 0 }}>
                  {npc
                    ? <AvatarSprite visual={getNpcVisual(npc.id)} action="idle" size="xs" />
                    : <View style={{ width: 28, height: 28, borderRadius: 14,
                        backgroundColor: colors.cardAlt, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 14 }}>👤</Text>
                      </View>
                  }
                </View>
              )}
              <View>
                {!isMe && (
                  <Text style={{ color: npc ? relColor(60) : colors.muted, fontSize: 10, fontWeight: "700",
                    marginBottom: 3, marginLeft: 4 }}>
                    {msg.authorName}
                  </Text>
                )}
                <View style={{
                  maxWidth: 260,
                  backgroundColor: isMe ? colors.accent + "22" : colors.cardAlt,
                  borderRadius: 14,
                  borderBottomRightRadius: isMe ? 4 : 14,
                  borderBottomLeftRadius: isMe ? 14 : 4,
                  padding: 9, paddingHorizontal: 13,
                  borderWidth: 1,
                  borderColor: isMe ? colors.accent + "40" : colors.border,
                }}>
                  <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{msg.body}</Text>
                  <Text style={{ color: colors.muted, fontSize: 9, marginTop: 3, textAlign: isMe ? "right" : "left" }}>
                    {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <QuickReplyBar replies={roomQuickReplies} onPick={sendText} />

      {/* Input */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10,
        paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          placeholder="Écrire dans la room..."
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          style={{ flex: 1, backgroundColor: colors.cardAlt, borderRadius: 22,
            paddingHorizontal: 16, paddingVertical: 10,
            color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border }}
        />
        <Pressable onPress={send}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent,
            alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="send" size={16} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const conversations  = useGameStore((s) => s.conversations);
  const npcs           = useGameStore((s) => s.npcs);
  const relationships  = useGameStore((s) => s.relationships);
  const rooms          = useGameStore((s) => s.rooms);
  const joinedRooms    = useGameStore((s) => s.joinedRooms);
  const roomInvites    = useGameStore((s) => s.roomInvites);
  const createPrivateRoom  = useGameStore((s) => s.createPrivateRoom);
  const respondRoomInvite  = useGameStore((s) => s.respondRoomInvite);
  const invitations    = useGameStore((s) => s.invitations);
  const respondInvitation  = useGameStore((s) => s.respondInvitation);
  const avatar         = useGameStore((s) => s.avatar);
  const roomMessages   = useGameStore((s) => s.roomMessages);

  const [tab, setTab]           = useState<Tab>("amis");
  const [openConvId, setOpenConvId]   = useState<string | null>(null);
  const [openRoomId, setOpenRoomId]   = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName]   = useState("");

  const tabAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(tabAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    tabAnim.setValue(0);
    Animated.timing(tabAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [tab]);

  // ── Navigation ouvrir conversation ────────────────────────────────────────
  const openConv = conversations.find((c) => c.id === openConvId);
  const openNpc  = openConv?.peerId ? npcs.find((n) => n.id === openConv.peerId) ?? null : null;

  if (openConvId && openConv) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ConversationView conv={openConv} npc={openNpc} onBack={() => setOpenConvId(null)} />
      </View>
    );
  }

  if (openRoomId) {
    const room = rooms.find((r) => r.id === openRoomId);
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <RoomChatView
          roomId={openRoomId}
          roomName={room?.name ?? "Room"}
          onBack={() => setOpenRoomId(null)}
        />
      </View>
    );
  }

  // ── Données ───────────────────────────────────────────────────────────────
  const onlineNpcs = npcs.filter((n) => n.presenceOnline ?? false);
  const friendOnline = onlineNpcs.filter((n) => {
    const rel = relationships.find((r) => r.residentId === n.id);
    return rel && rel.score >= 40;
  });

  const sortedConvs = [...conversations].sort((a, b) => {
    const aLast = a.messages.at(-1)?.createdAt ?? a.id;
    const bLast = b.messages.at(-1)?.createdAt ?? b.id;
    return bLast.localeCompare(aLast);
  });

  const myRooms   = rooms.filter((r) => joinedRooms.includes(r.id));
  const otherRooms = rooms.filter((r) => !joinedRooms.includes(r.id) && r.isActive);
  const pendingRoomInvites = roomInvites.filter((i) => i.status === "pending" && i.toId === (avatar?.displayName ?? "__"));
  const pendingInvites     = invitations.filter((i) => i.status === "pending");
  const unreadTotal        = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const lounge             = rooms.find((r) => r.id === "room-lounge-global");
  const loungeLastMsg      = (roomMessages["room-lounge-global"] ?? []).at(-1);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── Header MSN ── */}
      <View style={{ backgroundColor: "#050e1a", paddingTop: 52, paddingBottom: 0,
        borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {/* Titre */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}>Messenger</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {onlineNpcs.length} en ligne · {unreadTotal > 0 ? `${unreadTotal} non lus` : "tout lu"}
            </Text>
          </View>
          {/* Player bubble */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentGlow,
              borderWidth: 2, borderColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18 }}>🧑</Text>
            </View>
            <OnlineDot online />
          </View>
        </View>

        {/* ── Amis en ligne strip ── */}
        {onlineNpcs.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 14, gap: 16, flexDirection: "row" }}>
            {onlineNpcs.map((npc) => {
              const rel = relationships.find((r) => r.residentId === npc.id);
              const isFriend = rel && rel.score >= 40;
              return (
                <Pressable key={npc.id}
                  onPress={() => {
                    const conv = conversations.find((c) => c.peerId === npc.id);
                    if (conv) setOpenConvId(conv.id);
                  }}
                  style={{ alignItems: "center", gap: 4 }}>
                  <NpcAvatar npc={npc} size={44} showOnline />
                  <Text style={{ color: isFriend ? colors.accent : colors.textSoft, fontSize: 10,
                    fontWeight: isFriend ? "800" : "400" }}>
                    {npc.name.split(" ")[0]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ── Tabs ── */}
        <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 4 }}>
          {(["amis", "rooms", "lounge"] as Tab[]).map((t) => {
            const active = tab === t;
            const badge = t === "amis" ? unreadTotal : t === "rooms" ? pendingRoomInvites.length : 0;
            const labels: Record<Tab, string> = { amis: "Messages", rooms: "Rooms", lounge: "Ville" };
            const icons: Record<Tab, string> = { amis: "💬", rooms: "🏠", lounge: "🌍" };
            return (
              <Pressable key={t} onPress={() => setTab(t)}
                style={{ flex: 1, paddingVertical: 10, alignItems: "center", position: "relative",
                  borderBottomWidth: active ? 2.5 : 0, borderBottomColor: colors.accent }}>
                <Text style={{ color: active ? colors.accent : colors.muted, fontSize: 12, fontWeight: active ? "900" : "500" }}>
                  {icons[t]} {labels[t]}
                </Text>
                {badge > 0 && (
                  <View style={{ position: "absolute", top: 4, right: 12,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: "#e74c3c", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
                    <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{badge}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Contenu tabs ── */}
      <Animated.View style={{ flex: 1, opacity: tabAnim }}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

          {/* ── INVITATIONS EN ATTENTE ── */}
          {(pendingInvites.length > 0 || pendingRoomInvites.length > 0) && (
            <View style={{ margin: 14, backgroundColor: colors.goldGlow, borderRadius: 14,
              borderWidth: 1, borderColor: colors.gold + "40", padding: 12, gap: 8 }}>
              <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 12 }}>
                📨 {pendingInvites.length + pendingRoomInvites.length} invitation(s) en attente
              </Text>
              {pendingInvites.map((inv) => {
                const act = activities.find((a) => a.slug === inv.activitySlug);
                return (
                  <View key={inv.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ color: colors.textSoft, fontSize: 13, flex: 1 }}>
                      {inv.residentName} → {act?.name ?? inv.activitySlug}
                    </Text>
                    <Pressable onPress={() => respondInvitation(inv.id, "accepted")}
                      style={{ backgroundColor: colors.accent + "25", borderRadius: 10,
                        paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.accent + "55" }}>
                      <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "800" }}>Accepter</Text>
                    </Pressable>
                    <Pressable onPress={() => respondInvitation(inv.id, "declined")}
                      style={{ backgroundColor: "rgba(255,80,80,0.1)", borderRadius: 10,
                        paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: colors.danger, fontSize: 11 }}>Refuser</Text>
                    </Pressable>
                  </View>
                );
              })}
              {pendingRoomInvites.map((inv) => (
                <View key={inv.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ color: colors.textSoft, fontSize: 13, flex: 1 }}>
                    {inv.fromName} t'invite dans "{inv.roomName}"
                  </Text>
                  <Pressable onPress={() => respondRoomInvite(inv.id, "accepted")}
                    style={{ backgroundColor: colors.accent + "25", borderRadius: 10,
                      paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.accent + "55" }}>
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "800" }}>Rejoindre</Text>
                  </Pressable>
                  <Pressable onPress={() => respondRoomInvite(inv.id, "declined")}
                    style={{ backgroundColor: "rgba(255,80,80,0.1)", borderRadius: 10,
                      paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: colors.danger, fontSize: 11 }}>Refuser</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* ── DÉMARRAGE RAPIDE ── */}
          <View style={{
            marginHorizontal: 14,
            marginTop: 14,
            backgroundColor: "rgba(255,255,255,0.035)",
            borderRadius: 16,
            padding: 12,
            gap: 10,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.07)"
          }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>
              COMMENCER
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setOpenRoomId("room-lounge-global")}
                style={{
                  flex: 1,
                  backgroundColor: colors.accent + "15",
                  borderRadius: 12,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: colors.accent + "35"
                }}
              >
                <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 12 }}>🌍 Ville</Text>
                <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>Chat public</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const npc = onlineNpcs[0];
                  const conv = npc ? conversations.find((c) => c.peerId === npc.id) : sortedConvs[0];
                  if (conv) setOpenConvId(conv.id);
                }}
                style={{
                  flex: 1,
                  backgroundColor: colors.purpleGlow,
                  borderRadius: 12,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: colors.purple + "35"
                }}
              >
                <Text style={{ color: colors.purple, fontWeight: "900", fontSize: 12 }}>💬 Parler</Text>
                <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>NPC en ligne</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const room = createPrivateRoom("Room test rapide");
                  setOpenRoomId(room.id);
                }}
                style={{
                  flex: 1,
                  backgroundColor: colors.goldGlow,
                  borderRadius: 12,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: colors.gold + "35"
                }}
              >
                <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 12 }}>🔒 Room</Text>
                <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>Créer</Text>
              </Pressable>
            </View>
          </View>

          {/* ═══════ TAB AMIS ═══════ */}
          {tab === "amis" && (
            <View style={{ paddingBottom: 20 }}>
              {/* Amis avec relation forte */}
              {friendOnline.length > 0 && (
                <View style={{ marginHorizontal: 14, marginTop: 14 }}>
                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 }}>
                    🟢 AMIS EN LIGNE
                  </Text>
                  {friendOnline.map((npc) => {
                    const rel = relationships.find((r) => r.residentId === npc.id);
                    const conv = conversations.find((c) => c.peerId === npc.id);
                    return (
                      <Pressable key={npc.id}
                        onPress={() => conv && setOpenConvId(conv.id)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
                          paddingHorizontal: 14, backgroundColor: "#22c55e08", borderRadius: 12, marginBottom: 6,
                          borderWidth: 1, borderColor: "#22c55e20" }}>
                        <NpcAvatar npc={npc} size={44} showOnline />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{npc.name}</Text>
                          <Text style={{ color: "#22c55e", fontSize: 11 }}>
                            ● En ligne · {npc.action}
                          </Text>
                        </View>
                        {conv && conv.unreadCount > 0 && (
                          <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#e74c3c",
                            alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>{conv.unreadCount}</Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Toutes les conversations */}
              <View style={{ marginHorizontal: 14, marginTop: 14 }}>
                <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 }}>
                  MESSAGES
                </Text>
                {sortedConvs.map((conv) => {
                  const npc      = conv.peerId ? npcs.find((n) => n.id === conv.peerId) : null;
                  const rel      = conv.peerId ? relationships.find((r) => r.residentId === conv.peerId) : null;
                  const lastMsg  = conv.messages.at(-1);
                  const isOnline = npc?.presenceOnline ?? false;
                  return (
                    <Pressable key={conv.id} onPress={() => setOpenConvId(conv.id)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12,
                        borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      {npc
                        ? <NpcAvatar npc={npc} size={46} showOnline />
                        : <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.cardAlt,
                            alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="chatbubbles" size={20} color={colors.muted} />
                          </View>
                      }
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ color: colors.text, fontWeight: conv.unreadCount > 0 ? "900" : "600",
                            fontSize: 14, flex: 1 }} numberOfLines={1}>
                            {conv.title}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 10 }}>
                            {lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {rel && (
                            <View style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                              <View style={{ height: 3, borderRadius: 2, width: `${rel.score}%`, backgroundColor: relColor(rel.score) }} />
                            </View>
                          )}
                          <Text style={{ color: colors.muted, fontSize: 11, flex: 1 }} numberOfLines={1}>
                            {lastMsg ? lastMsg.body : "Commencer une conversation"}
                          </Text>
                          {isOnline && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#22c55e" }} />}
                        </View>
                      </View>
                      {conv.unreadCount > 0 && (
                        <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#e74c3c",
                          alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>{conv.unreadCount}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* ═══════ TAB ROOMS ═══════ */}
          {tab === "rooms" && (
            <View style={{ padding: 14, gap: 14 }}>
              {/* Create room */}
              <View style={{ gap: 10 }}>
                {!showCreateRoom ? (
                  <Pressable onPress={() => setShowCreateRoom(true)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: colors.accentGlow, borderRadius: 14, padding: 14,
                      borderWidth: 1, borderColor: colors.accent + "40" }}>
                    <Ionicons name="add-circle" size={22} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 14 }}>Créer une room privée</Text>
                  </Pressable>
                ) : (
                  <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, gap: 10,
                    borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>Nom de la room</Text>
                    <TextInput
                      value={newRoomName}
                      onChangeText={setNewRoomName}
                      placeholder="ex: Soirée cinema, Squad..."
                      placeholderTextColor={colors.muted}
                      style={{ backgroundColor: colors.cardAlt, borderRadius: 12, paddingHorizontal: 14,
                        paddingVertical: 10, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border }}
                    />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Pressable onPress={() => {
                        if (newRoomName.trim()) {
                          const r = createPrivateRoom(newRoomName.trim());
                          setShowCreateRoom(false);
                          setNewRoomName("");
                          setOpenRoomId(r.id);
                        }
                      }} style={{ flex: 1, backgroundColor: colors.accent + "22", borderRadius: 10,
                        padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.accent + "55" }}>
                        <Text style={{ color: colors.accent, fontWeight: "800" }}>Créer</Text>
                      </Pressable>
                      <Pressable onPress={() => { setShowCreateRoom(false); setNewRoomName(""); }}
                        style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10,
                          padding: 12, alignItems: "center" }}>
                        <Text style={{ color: colors.muted, fontWeight: "600" }}>Annuler</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>

              {/* Mes rooms */}
              {myRooms.length > 0 && (
                <View>
                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 }}>
                    MES ROOMS
                  </Text>
                  {myRooms.map((room) => {
                    const msgs = roomMessages[room.id] ?? [];
                    const lastM = msgs.at(-1);
                    const onlineInRoom = onlineNpcs.length;
                    return (
                      <Pressable key={room.id} onPress={() => setOpenRoomId(room.id)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12,
                          borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <View style={{ width: 46, height: 46, borderRadius: 14,
                          backgroundColor: room.kind === "private" ? colors.purpleGlow : colors.accentGlow,
                          alignItems: "center", justifyContent: "center",
                          borderWidth: 1, borderColor: room.kind === "private" ? colors.purple + "55" : colors.accent + "55" }}>
                          <Text style={{ fontSize: 22 }}>
                            {room.kind === "private" ? "🔒" : room.id === "room-lounge-global" ? "🌍" : "💬"}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{room.name}</Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                            {lastM ? lastM.body : room.description}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          {room.kind === "private" && (
                            <Text style={{ color: colors.gold, fontSize: 9, fontWeight: "900" }}>#{room.code}</Text>
                          )}
                          <Text style={{ color: colors.muted, fontSize: 10 }}>
                            {onlineInRoom} en ligne
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Rooms disponibles */}
              {otherRooms.length > 0 && (
                <View>
                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 }}>
                    REJOINDRE
                  </Text>
                  {otherRooms.map((room) => (
                    <Pressable key={room.id} onPress={() => setOpenRoomId(room.id)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12,
                        borderBottomWidth: 1, borderBottomColor: colors.border, opacity: 0.75 }}>
                      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.cardAlt,
                        alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 22 }}>💬</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{room.name}</Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>{room.description}</Text>
                      </View>
                      <Ionicons name="enter" size={18} color={colors.accent} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ═══════ TAB LOUNGE ═══════ */}
          {tab === "lounge" && lounge && (
            <View style={{ flex: 1 }}>
              {/* Banner */}
              <View style={{ margin: 14, backgroundColor: "#0a1628", borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: colors.accentGlow + "88",
                shadowColor: colors.accent, shadowOpacity: 0.15, shadowRadius: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <Text style={{ fontSize: 28 }}>🌍</Text>
                  <View>
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Lounge — La ville</Text>
                    <Text style={{ color: "#22c55e", fontSize: 11 }}>
                      {onlineNpcs.length + 1} connecté(s) · Chat public
                    </Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <View style={{ flexDirection: "row" }}>
                    {onlineNpcs.slice(0, 4).map((npc) => (
                      <View key={npc.id} style={{ marginLeft: -8 }}>
                        <NpcAvatar npc={npc} size={28} showOnline />
                      </View>
                    ))}
                  </View>
                </View>
                <Pressable onPress={() => setOpenRoomId("room-lounge-global")}
                  style={{ backgroundColor: colors.accent + "20", borderRadius: 10, padding: 12,
                    alignItems: "center", borderWidth: 1, borderColor: colors.accent + "55" }}>
                  <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 13 }}>Entrer dans le Lounge →</Text>
                </Pressable>
              </View>

              {/* Derniers messages */}
              {(roomMessages["room-lounge-global"] ?? []).length > 0 && (
                <View style={{ marginHorizontal: 14 }}>
                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 }}>
                    DERNIERS MESSAGES
                  </Text>
                  {(roomMessages["room-lounge-global"] ?? []).slice(-8).map((msg) => {
                    const npc = npcs.find((n) => n.id === msg.authorId);
                    if (msg.kind === "system") return null;
                    return (
                      <View key={msg.id} style={{ flexDirection: "row", gap: 10, paddingVertical: 8,
                        borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        {npc
                          ? <NpcAvatar npc={npc} size={32} />
                          : <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cardAlt,
                              alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ fontSize: 16 }}>🧑</Text>
                            </View>
                        }
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "800" }}>{msg.authorName}</Text>
                            <Text style={{ color: colors.muted, fontSize: 9 }}>
                              {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                          </View>
                          <Text style={{ color: colors.textSoft, fontSize: 13 }}>{msg.body}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </View>
  );
}
