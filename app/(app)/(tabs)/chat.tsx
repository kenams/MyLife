import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  Animated, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getNpcVisual } from "@/lib/avatar-visual";
import { activities, starterResidents } from "@/lib/game-engine";
import { buildSocialHubSnapshot, relationshipScore } from "@/lib/social-hub";
import type { Conversation, NpcState, RelationshipRecord, Room, RoomMessage } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

const C = {
  bg:      "#080808",
  card:    "#111111",
  card2:   "#161616",
  text:    "#F5F2E8",
  soft:    "#A8A49A",
  muted:   "#4A4844",
  border:  "rgba(255,255,255,0.07)",
  gold:    "#FFD600",
  goldBg:  "#1A1500",
  green:   "#39FF14",
  red:     "#FF3B3B",
  pink:    "#FF2D78",
  pinkBg:  "#1A0818",
  purple:  "#BF5FFF",
  purpleBg:"#18082A",
  teal:    "#00FFD1",
};

type Tab = "messages" | "rooms" | "love";
type IconName = ComponentProps<typeof Ionicons>["name"];

const WIZZ = "[[WIZZ]]";
const EMOJIS = ["😀","😂","🔥","👍","👀","💯","❤️","☕","✨","😍","💬","🎮"];

// ── Petit avatar NPC ──────────────────────────────────────────────────────────
function NpcAvatar({ npc, size = 44 }: { npc: NpcState; size?: number }) {
  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <View style={{ transform: [{ scale: size <= 36 ? 0.72 : 0.88 }] }}>
        <AvatarSprite visual={getNpcVisual(npc.id)} action="idle" size={size <= 36 ? "xs" : "sm"} />
      </View>
      <View style={[s.onlineDot, { backgroundColor: npc.presenceOnline ? C.green : C.muted }]} />
    </View>
  );
}

// ── Avatar texte ──────────────────────────────────────────────────────────────
function InitialAvatar({ name, size = 44, color = C.gold }: { name: string; size?: number; color?: string }) {
  return (
    <View style={[s.initAvatar, { width: size, height: size, borderRadius: size / 2, borderColor: color + "40", backgroundColor: color + "12" }]}>
      <Text style={[s.initText, { color, fontSize: size * 0.38 }]}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

// ── Bulle de message ──────────────────────────────────────────────────────────
function Bubble({ body, time, me, npc }: { body: string; time: string; me: boolean; npc?: NpcState | null }) {
  const isWizz = body.includes(WIZZ);
  const text = body.replace(WIZZ, "").trim() || "Wizz !";
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isWizz) return;
    Animated.sequence([
      ...([1,-1,1,-1,0]).map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true })),
    ]).start();
  }, [isWizz, shake]);

  return (
    <View style={[s.row, me && { flexDirection: "row-reverse" }]}>
      {!me && (npc
        ? <NpcAvatar npc={npc} size={32} />
        : <View style={s.anonDot}><Ionicons name="person" size={13} color={C.muted} /></View>
      )}
      <Animated.View style={[
        s.bubble,
        me ? s.bubbleMe : s.bubbleOther,
        isWizz && { backgroundColor: C.goldBg, borderColor: C.gold + "50" },
        { transform: [{ translateX: shake.interpolate({ inputRange: [-1,1], outputRange: [-8,8] }) }] },
      ]}>
        {isWizz && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 }}>
            <Ionicons name="flash" size={11} color={me ? "#fff" : C.gold} />
            <Text style={{ color: me ? "rgba(255,255,255,0.8)" : C.gold, fontSize: 9, fontWeight: "900" }}>WIZZ</Text>
          </View>
        )}
        <Text style={[s.bubbleText, me && { color: "#000" }, isWizz && !me && { color: C.gold }]}>{text}</Text>
        <Text style={[s.timeText, me && { color: "rgba(0,0,0,0.5)", textAlign: "right" }]}>{time}</Text>
      </Animated.View>
    </View>
  );
}

// ── Indicateur "écrit…" ────────────────────────────────────────────────────
function Typing({ name }: { name: string }) {
  const op = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.4, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [op]);
  return (
    <Animated.View style={[s.typingBubble, { opacity: op }]}>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {[0,1,2].map((i) => <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold }} />)}
      </View>
      <Text style={{ color: C.muted, fontSize: 11 }}>{name} écrit…</Text>
    </Animated.View>
  );
}

// ── Zone de saisie ────────────────────────────────────────────────────────────
function Composer({ value, onChange, onSend, onWizz }: {
  value: string; onChange: (t: string) => void; onSend: () => void; onWizz: () => void;
}) {
  const [emoji, setEmoji] = useState(false);
  return (
    <View style={s.composer}>
      {emoji && (
        <View style={s.emojiRow}>
          {EMOJIS.map((e) => (
            <Pressable key={e} onPress={() => onChange(value + e)} style={s.emojiBtn}>
              <Text style={{ fontSize: 18 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={s.composerRow}>
        <Pressable onPress={() => setEmoji((v) => !v)} style={[s.iconBtn, emoji && { borderColor: C.gold + "50" }]}>
          <Text style={{ fontSize: 18 }}>😀</Text>
        </Pressable>
        <Pressable onPress={onWizz} style={s.wizzBtn}>
          <Ionicons name="flash" size={14} color={C.gold} />
          <Text style={{ color: C.gold, fontSize: 11, fontWeight: "800" }}>Wizz</Text>
        </Pressable>
        <TextInput
          value={value} onChangeText={onChange} onSubmitEditing={onSend}
          placeholder="Message…" placeholderTextColor={C.muted}
          returnKeyType="send" multiline
          style={s.input}
        />
        <Pressable onPress={onSend} style={s.sendBtn}>
          <Ionicons name="send" size={16} color="#000" />
        </Pressable>
      </View>
    </View>
  );
}

// ── Vue conversation ──────────────────────────────────────────────────────────
function ConvView({ convId, back }: { convId: string; back: () => void }) {
  const conv          = useGameStore((s) => s.conversations.find((c) => c.id === convId));
  const npcs          = useGameStore((s) => s.npcs);
  const avatar        = useGameStore((s) => s.avatar);
  const session       = useGameStore((s) => s.session);
  const sendMessage   = useGameStore((s) => s.sendMessage);
  const markRead      = useGameStore((s) => s.markConversationRead);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const npc  = conv?.peerId ? npcs.find((n) => n.id === conv.peerId) ?? null : null;
  const name = npc ? (starterResidents.find((r) => r.id === npc.id)?.name ?? conv?.title ?? "…") : conv?.title ?? "…";
  const myId = session?.email ?? "local";
  const me   = avatar?.displayName ?? "Moi";

  useEffect(() => {
    if (conv) markRead(conv.id);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 80);
  }, [convId, conv, markRead]);

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [conv?.messages.length]);

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    sendMessage(convId, t);
    if (timer.current) clearTimeout(timer.current);
    setTyping(true);
    timer.current = setTimeout(() => setTyping(false), 1200);
  }
  function handleSend() { send(input); setInput(""); }
  function sendWizz() { send(`${WIZZ} Wizz ! ${name.split(" ")[0]}, tu es là ?`); }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>

      {/* Header */}
      <View style={s.convHeader}>
        <Pressable onPress={back} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </Pressable>
        {npc ? <NpcAvatar npc={npc} size={40} /> : <InitialAvatar name={name} size={40} />}
        <View style={{ flex: 1 }}>
          <Text style={s.convName}>{name}</Text>
          <Text style={{ color: npc?.presenceOnline ? C.green : C.muted, fontSize: 11, fontWeight: "700" }}>
            {npc?.presenceOnline ? "● En ligne" : "● Absent"}
          </Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView ref={scroll} style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}>
        {(!conv || conv.messages.length === 0) && (
          <Text style={s.empty}>Commence la conversation 👋</Text>
        )}
        {conv?.messages.map((m) => {
          const isMe = m.authorId === myId || ["player","user","self","local"].includes(m.authorId);
          if (m.kind === "system") return (
            <Text key={m.id} style={s.sysMsg}>{m.body}</Text>
          );
          return (
            <Bubble key={m.id}
              body={m.body}
              time={new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              me={isMe} npc={isMe ? null : npc}
            />
          );
        })}
        {typing && <Typing name={name.split(" ")[0]} />}
      </ScrollView>

      {/* Suggestions rapides */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
        {[`Salut ${name.split(" ")[0]} !`, "Tu fais quoi ?", "On se retrouve ? 📍", "☕ Café ?"].map((t) => (
          <Pressable key={t} onPress={() => send(t)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
              backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold + "25" }}>
            <Text style={{ color: C.gold, fontSize: 12, fontWeight: "700" }}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Composer value={input} onChange={setInput} onSend={handleSend} onWizz={sendWizz} />
    </KeyboardAvoidingView>
  );
}

// ── Vue room groupe ───────────────────────────────────────────────────────────
function RoomView({ roomId, back }: { roomId: string; back: () => void }) {
  const room         = useGameStore((s) => s.rooms.find((r) => r.id === roomId));
  const messages     = useGameStore((s) => s.roomMessages[roomId] ?? []);
  const npcs         = useGameStore((s) => s.npcs);
  const avatar       = useGameStore((s) => s.avatar);
  const session      = useGameStore((s) => s.session);
  const sendMsg      = useGameStore((s) => s.sendRoomMessage);
  const [input, setInput]  = useState("");
  const [typing, setTyping] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const online = npcs.filter((n) => n.presenceOnline);
  const myId   = session?.email ?? "local";
  const me     = avatar?.displayName ?? "Moi";
  const name   = room?.name ?? "Room";

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 80);
  }, []);
  useEffect(() => { scroll.current?.scrollToEnd({ animated: true }); }, [messages.length]);

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    sendMsg(roomId, t);
    if (online.length > 0) {
      if (timer.current) clearTimeout(timer.current);
      setTyping(true);
      timer.current = setTimeout(() => setTyping(false), 1200);
    }
  }
  function handleSend() { send(input); setInput(""); }
  function sendWizz() { send(`${WIZZ} Wizz collectif ! Qui est là ?`); }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>

      {/* Header */}
      <View style={s.convHeader}>
        <Pressable onPress={back} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </Pressable>
        <View style={[s.roomIconWrap, {
          backgroundColor: room?.kind === "love" ? C.pinkBg : room?.kind === "private" ? C.purpleBg : C.goldBg,
          borderColor: room?.kind === "love" ? C.pink + "40" : room?.kind === "private" ? C.purple + "40" : C.gold + "40",
        }]}>
          <Ionicons
            name={room?.kind === "love" ? "heart" : room?.kind === "private" ? "lock-closed" : "people"}
            size={18}
            color={room?.kind === "love" ? C.pink : room?.kind === "private" ? C.purple : C.gold}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.convName}>{name}</Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>{online.length + 1} membre{online.length > 0 ? "s" : ""} · en ligne</Text>
        </View>
        {room?.code && (
          <View style={{ backgroundColor: C.goldBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.gold + "30" }}>
            <Text style={{ color: C.gold, fontSize: 10, fontWeight: "800" }}>#{room.code}</Text>
          </View>
        )}
      </View>

      {/* Membres online */}
      {online.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
          <View style={{ alignItems: "center", gap: 3 }}>
            <InitialAvatar name={me} size={32} />
            <Text style={{ color: C.soft, fontSize: 9, fontWeight: "700" }}>{me.split(" ")[0]}</Text>
          </View>
          {online.slice(0, 8).map((n) => (
            <View key={n.id} style={{ alignItems: "center", gap: 3 }}>
              <NpcAvatar npc={n} size={32} />
              <Text style={{ color: C.soft, fontSize: 9, fontWeight: "700" }}>{n.name.split(" ")[0]}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Messages */}
      <ScrollView ref={scroll} style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}>
        {messages.length === 0 && <Text style={s.empty}>La room est ouverte. Dis bonjour 👋</Text>}
        {messages.map((m) => {
          const isMe = m.authorId === myId || m.authorId === "local" || m.authorName === me;
          const npc  = npcs.find((n) => n.id === m.authorId) ?? null;
          if (m.kind === "system") return <Text key={m.id} style={[s.sysMsg, { color: C.gold }]}>{m.body}</Text>;
          return (
            <Bubble key={m.id}
              body={m.body}
              time={new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              me={isMe} npc={isMe ? null : npc}
            />
          );
        })}
        {typing && <Typing name={online[0]?.name.split(" ")[0] ?? "…"} />}
      </ScrollView>

      <Composer value={input} onChange={setInput} onSend={handleSend} onWizz={sendWizz} />
    </KeyboardAvoidingView>
  );
}

// ── Ligne de contact ──────────────────────────────────────────────────────────
function ConvRow({ c, npc, score, onPress }: { c: Conversation; npc: NpcState | null; score?: number; onPress: () => void }) {
  const last = c.messages.at(-1);
  const online = npc?.presenceOnline;
  return (
    <Pressable onPress={onPress} style={[s.convRow, c.unreadCount > 0 && { borderColor: C.gold + "30", backgroundColor: C.goldBg }]}>
      {npc ? <NpcAvatar npc={npc} size={48} /> : <InitialAvatar name={c.title} size={48} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[s.convRowName, c.unreadCount > 0 && { color: C.gold }]} numberOfLines={1}>{c.title}</Text>
          {last && <Text style={{ color: C.muted, fontSize: 10, marginLeft: "auto" }}>
            {new Date(last.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </Text>}
        </View>
        <Text style={{ color: online ? C.green : score !== undefined ? C.gold : C.muted, fontSize: 10, fontWeight: "700", marginTop: 1 }}>
          {online ? "● En ligne" : score !== undefined ? `Lien ${score}%` : ""}
        </Text>
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {last?.body ?? "Commencer une conversation"}
        </Text>
      </View>
      {c.unreadCount > 0 && (
        <View style={s.unreadBadge}><Text style={s.badgeText}>{c.unreadCount}</Text></View>
      )}
    </Pressable>
  );
}

// ── Ligne room ────────────────────────────────────────────────────────────────
function RoomRow({ room, last, onPress }: { room: Room; last?: RoomMessage; onPress: () => void }) {
  const isLove = room.kind === "love";
  const isPriv = room.kind === "private";
  return (
    <Pressable onPress={onPress} style={[s.convRow,
      isLove && { backgroundColor: C.pinkBg, borderColor: C.pink + "25" },
      isPriv && { backgroundColor: C.purpleBg, borderColor: C.purple + "25" },
    ]}>
      <View style={[s.roomIconWrap, {
        backgroundColor: isLove ? C.pinkBg : isPriv ? C.purpleBg : C.goldBg,
        borderColor: isLove ? C.pink + "40" : isPriv ? C.purple + "40" : C.gold + "40",
      }]}>
        <Ionicons name={isLove ? "heart" : isPriv ? "lock-closed" : "people"} size={20}
          color={isLove ? C.pink : isPriv ? C.purple : C.gold} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.convRowName} numberOfLines={1}>{room.name}</Text>
          {room.code && <Text style={{ color: C.gold, fontSize: 10, fontWeight: "800" }}>#{room.code}</Text>}
        </View>
        <Text style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>{room.memberCount}/{room.maxMembers} membres</Text>
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {last?.body ?? room.description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.muted} />
    </Pressable>
  );
}

// ── Écran principal ────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const conversations       = useGameStore((s) => s.conversations);
  const npcs                = useGameStore((s) => s.npcs);
  const relationships       = useGameStore((s) => s.relationships);
  const rooms               = useGameStore((s) => s.rooms);
  const joinedRooms         = useGameStore((s) => s.joinedRooms);
  const roomInvites         = useGameStore((s) => s.roomInvites);
  const roomMessages        = useGameStore((s) => s.roomMessages);
  const invitations         = useGameStore((s) => s.invitations);
  const respondInvitation   = useGameStore((s) => s.respondInvitation);
  const respondRoomInvite   = useGameStore((s) => s.respondRoomInvite);
  const createPrivateRoom   = useGameStore((s) => s.createPrivateRoom);
  const startDirectConv     = useGameStore((s) => s.startDirectConversation);
  const avatar              = useGameStore((s) => s.avatar);

  const [tab, setTab]     = useState<Tab>("messages");
  const [convId, setConvId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [newRoom, setNewRoom] = useState(false);
  const [roomName, setRoomName] = useState("");

  // Ouvre directement si on vient de la map (DM deep-link)
  useEffect(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const match = url.match(/targetId=([^&]+)/);
    if (match) {
      const targetId = decodeURIComponent(match[1]);
      const targetName = decodeURIComponent((url.match(/targetName=([^&]+)/) ?? [])[1] ?? targetId);
      startDirectConv(targetId, targetName);
      const c = conversations.find((cv) => cv.peerId === targetId);
      if (c) setConvId(c.id);
    }
  }, []);

  if (convId) return <ConvView convId={convId} back={() => setConvId(null)} />;
  if (roomId) return <RoomView roomId={roomId} back={() => setRoomId(null)} />;

  const hub          = buildSocialHubSnapshot({ avatar, conversations, npcs, relationships, rooms, joinedRooms, roomInvites, invitations, roomMessages });
  const online       = hub.onlineNpcs;
  const sorted       = hub.sortedConversations;
  const myRooms      = hub.myRooms;
  const otherRooms   = hub.otherRooms;
  const pending      = hub.pendingInvitations;
  const pendingRooms = hub.pendingRoomInvites;
  const unread       = hub.unreadTotal;

  // Love candidates
  const loveCandidates = starterResidents
    .filter((r) => r.lookingFor.includes("relation amoureuse"))
    .map((r) => {
      const rel  = relationships.find((x) => x.residentId === r.id);
      const msgs = conversations.find((c) => c.peerId === r.id)?.messages.filter((m) => m.kind === "message").length ?? 0;
      const prog = Math.min(100, Math.round((rel?.score ?? 0) * 0.72 + Math.min(10, msgs) * 3));
      return { r, npc: npcs.find((n) => n.id === r.id) ?? null, prog, unlocked: prog >= 76 };
    })
    .sort((a, b) => b.prog - a.prog);

  const TABS: { key: Tab; label: string; icon: IconName; badge: number }[] = [
    { key: "messages", label: "Messages", icon: "chatbubble-ellipses", badge: unread },
    { key: "rooms",    label: "Rooms",    icon: "people",              badge: pendingRooms.length },
    { key: "love",     label: "Love",     icon: "heart",               badge: loveCandidates.filter((l) => l.unlocked).length },
  ];

  function openConv(residentId: string, residentName: string) {
    startDirectConv(residentId, residentName);
    const c = conversations.find((cv) => cv.peerId === residentId);
    if (c) setConvId(c.id);
    else setTimeout(() => {
      const nc = useGameStore.getState().conversations.find((cv) => cv.peerId === residentId);
      if (nc) setConvId(nc.id);
    }, 50);
  }

  function makeRoom() {
    const r = createPrivateRoom(roomName.trim() || "Room privée");
    setRoomName(""); setNewRoom(false); setRoomId(r.id);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Messages</Text>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: "600", marginTop: 1 }}>
            {online.length} en ligne{unread > 0 ? ` · ${unread} non lu` : ""}
          </Text>
        </View>
        <Pressable onPress={() => router.push("/(app)/(tabs)/map" as never)}
          style={{ backgroundColor: C.goldBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.gold + "30", flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="map" size={14} color={C.gold} />
          <Text style={{ color: C.gold, fontSize: 12, fontWeight: "700" }}>Map</Text>
        </Pressable>
      </View>

      {/* Contacts online */}
      {online.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 14 }}>
          {online.map((npc) => {
            const c = conversations.find((cv) => cv.peerId === npc.id);
            return (
              <Pressable key={npc.id} onPress={() => c ? setConvId(c.id) : openConv(npc.id, npc.name)}
                style={{ alignItems: "center", gap: 4, width: 52 }}>
                <NpcAvatar npc={npc} size={44} />
                <Text style={{ color: C.soft, fontSize: 10, fontWeight: "700" }} numberOfLines={1}>
                  {npc.name.split(" ")[0]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[s.tabItem, tab === t.key && s.tabActive]}>
            <Ionicons name={t.icon} size={15} color={tab === t.key ? C.gold : C.muted} />
            <Text style={{ color: tab === t.key ? C.gold : C.muted, fontSize: 12, fontWeight: "800" }}>{t.label}</Text>
            {t.badge > 0 && (
              <View style={s.tabBadge}><Text style={s.badgeText}>{t.badge}</Text></View>
            )}
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

        {/* Invitations en attente */}
        {(pending.length > 0 || pendingRooms.length > 0) && (
          <View style={s.inviteBox}>
            <Text style={s.inviteTitle}>⏳ Invitations en attente</Text>
            {pending.map((i) => (
              <View key={i.id} style={s.inviteLine}>
                <Text style={s.inviteBody} numberOfLines={1}>
                  {i.residentName} — {activities.find((a) => a.slug === i.activitySlug)?.name ?? i.activitySlug}
                </Text>
                <Pressable onPress={() => respondInvitation(i.id, "accepted")} style={s.okBtn}>
                  <Ionicons name="checkmark" size={16} color={C.green} />
                </Pressable>
                <Pressable onPress={() => respondInvitation(i.id, "declined")} style={s.noBtn}>
                  <Ionicons name="close" size={16} color={C.red} />
                </Pressable>
              </View>
            ))}
            {pendingRooms.map((i) => (
              <View key={i.id} style={s.inviteLine}>
                <Text style={s.inviteBody} numberOfLines={1}>{i.fromName} t'invite dans {i.roomName}</Text>
                <Pressable onPress={() => respondRoomInvite(i.id, "accepted")} style={s.okBtn}>
                  <Ionicons name="checkmark" size={16} color={C.green} />
                </Pressable>
                <Pressable onPress={() => respondRoomInvite(i.id, "declined")} style={s.noBtn}>
                  <Ionicons name="close" size={16} color={C.red} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* ── TAB MESSAGES ── */}
        {tab === "messages" && (
          <View style={{ gap: 8 }}>
            {sorted.length === 0 && (
              <View style={s.emptyState}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
                <Text style={{ color: C.soft, fontSize: 15, fontWeight: "700" }}>Aucun message</Text>
                <Text style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 4 }}>
                  Clique sur un contact en ligne ci-dessus pour commencer.
                </Text>
              </View>
            )}
            {sorted.map((c) => {
              const npc   = c.peerId ? npcs.find((n) => n.id === c.peerId) ?? null : null;
              const score = c.peerId ? relationships.find((r) => r.residentId === c.peerId)?.score : undefined;
              return <ConvRow key={c.id} c={c} npc={npc} score={score} onPress={() => setConvId(c.id)} />;
            })}
          </View>
        )}

        {/* ── TAB ROOMS ── */}
        {tab === "rooms" && (
          <View style={{ gap: 8 }}>
            {/* Créer une room */}
            {!newRoom ? (
              <Pressable onPress={() => setNewRoom(true)} style={s.createRoomBtn}>
                <Ionicons name="add-circle" size={18} color={C.gold} />
                <Text style={{ color: C.gold, fontSize: 13, fontWeight: "700" }}>Créer une room</Text>
              </Pressable>
            ) : (
              <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border, gap: 10 }}>
                <TextInput value={roomName} onChangeText={setRoomName} placeholder="Nom de la room"
                  placeholderTextColor={C.muted} style={s.input} autoFocus />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={makeRoom} style={[s.sendBtn, { flex: 1, height: 44, borderRadius: 12 }]}>
                    <Text style={{ color: "#000", fontWeight: "800", fontSize: 13 }}>Créer</Text>
                  </Pressable>
                  <Pressable onPress={() => { setNewRoom(false); setRoomName(""); }}
                    style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: C.soft, fontWeight: "700", fontSize: 13 }}>Annuler</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {myRooms.length > 0 && (
              <>
                <Text style={s.sectionLabel}>MES ROOMS</Text>
                {myRooms.map((r) => <RoomRow key={r.id} room={r} last={(roomMessages[r.id] ?? []).at(-1)} onPress={() => setRoomId(r.id)} />)}
              </>
            )}
            {otherRooms.length > 0 && (
              <>
                <Text style={s.sectionLabel}>REJOINDRE</Text>
                {otherRooms.map((r) => <RoomRow key={r.id} room={r} last={(roomMessages[r.id] ?? []).at(-1)} onPress={() => setRoomId(r.id)} />)}
              </>
            )}
            {myRooms.length === 0 && otherRooms.length === 0 && (
              <View style={s.emptyState}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🏠</Text>
                <Text style={{ color: C.soft, fontSize: 15, fontWeight: "700" }}>Pas encore de room</Text>
                <Text style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 4 }}>Crée une room pour inviter tes contacts.</Text>
              </View>
            )}
          </View>
        )}

        {/* ── TAB LOVE ── */}
        {tab === "love" && (
          <View style={{ gap: 8 }}>
            <View style={{ backgroundColor: C.pinkBg, borderRadius: 16, borderWidth: 1, borderColor: C.pink + "25", padding: 16, marginBottom: 4, flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Ionicons name="heart" size={24} color={C.pink} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: "900" }}>Love Rooms</Text>
                <Text style={{ color: C.soft, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                  Parle, invite et fais des activités pour débloquer l'accès.
                </Text>
              </View>
            </View>
            {loveCandidates.map(({ r, npc, prog, unlocked }) => (
              <Pressable key={r.id}
                onPress={() => unlocked
                  ? setRoomId(`love-${r.id}`)
                  : openConv(r.id, r.name)
                }
                style={[s.convRow, unlocked && { borderColor: C.pink + "40", backgroundColor: C.pinkBg }]}>
                {npc ? <NpcAvatar npc={npc} size={48} /> : <InitialAvatar name={r.name} size={48} color={C.pink} />}
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={[s.convRowName, { flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={{ color: unlocked ? C.pink : C.muted, fontSize: 11, fontWeight: "900" }}>{prog}%</Text>
                  </View>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: C.border, overflow: "hidden" }}>
                    <View style={{ width: `${prog}%`, height: 5, borderRadius: 3, backgroundColor: unlocked ? C.pink : C.gold }} />
                  </View>
                  <Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={1}>
                    {unlocked ? "💕 Love Room débloquée — Entrer" : "Continue à parler pour débloquer"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header:       { paddingTop: 54, paddingBottom: 14, paddingHorizontal: 18, flexDirection: "row",
                  alignItems: "center", justifyContent: "space-between",
                  backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:  { color: C.text, fontSize: 22, fontWeight: "900" },
  tabs:         { flexDirection: "row", backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tabItem:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 6, paddingVertical: 12, position: "relative" },
  tabActive:    { borderBottomWidth: 2.5, borderBottomColor: C.gold },
  tabBadge:     { position: "absolute", top: 6, right: 12, minWidth: 16, height: 16,
                  borderRadius: 8, backgroundColor: C.red, alignItems: "center",
                  justifyContent: "center", paddingHorizontal: 3 },
  badgeText:    { color: "#fff", fontSize: 9, fontWeight: "900" },

  sectionLabel: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 6, marginBottom: 4 },

  convRow:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 12,
                  borderRadius: 16, backgroundColor: C.card, borderWidth: 1,
                  borderColor: C.border },
  convRowName:  { color: C.text, fontSize: 14, fontWeight: "800" },
  unreadBadge:  { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.red,
                  alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },

  convHeader:   { paddingTop: 52, paddingBottom: 12, paddingHorizontal: 14,
                  backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
                  flexDirection: "row", alignItems: "center", gap: 10 },
  convName:     { color: C.text, fontSize: 16, fontWeight: "900" },
  backBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: C.bg,
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 1, borderColor: C.border },
  roomIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center",
                  justifyContent: "center", borderWidth: 1 },

  row:          { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  anonDot:      { width: 32, height: 32, borderRadius: 10, backgroundColor: C.card,
                  borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  bubble:       { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10,
                  borderRadius: 18, borderWidth: 1 },
  bubbleMe:     { backgroundColor: C.gold, borderColor: C.gold, borderBottomRightRadius: 4 },
  bubbleOther:  { backgroundColor: C.card, borderColor: C.border, borderBottomLeftRadius: 4 },
  bubbleText:   { color: C.text, fontSize: 14, lineHeight: 20 },
  timeText:     { color: C.muted, fontSize: 9, marginTop: 4 },

  typingBubble: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12,
                  paddingVertical: 8, borderRadius: 16, backgroundColor: C.card,
                  borderWidth: 1, borderColor: C.border, alignSelf: "flex-start", marginTop: 4 },

  composer:     { backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  composerRow:  { flexDirection: "row", alignItems: "flex-end", gap: 8,
                  paddingHorizontal: 12, paddingVertical: 10 },
  emojiRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6,
                  paddingHorizontal: 12, paddingTop: 10 },
  emojiBtn:     { width: 36, height: 36, borderRadius: 10, alignItems: "center",
                  justifyContent: "center", backgroundColor: C.bg,
                  borderWidth: 1, borderColor: C.border },
  iconBtn:      { width: 40, height: 40, borderRadius: 12, alignItems: "center",
                  justifyContent: "center", backgroundColor: C.bg,
                  borderWidth: 1, borderColor: C.border },
  wizzBtn:      { flexDirection: "row", alignItems: "center", gap: 4, height: 40,
                  paddingHorizontal: 10, borderRadius: 12, backgroundColor: C.goldBg,
                  borderWidth: 1, borderColor: C.gold + "35" },
  input:        { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: C.bg,
                  borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
                  color: C.text, fontSize: 14, borderWidth: 1, borderColor: C.border },
  sendBtn:      { width: 40, height: 40, borderRadius: 12, backgroundColor: C.gold,
                  alignItems: "center", justifyContent: "center" },

  onlineDot:    { position: "absolute", right: 0, bottom: 0, width: 10, height: 10,
                  borderRadius: 5, borderWidth: 2, borderColor: C.card },
  initAvatar:   { alignItems: "center", justifyContent: "center", borderWidth: 2 },
  initText:     { fontWeight: "900" },

  inviteBox:    { backgroundColor: C.goldBg, borderRadius: 16, borderWidth: 1,
                  borderColor: C.gold + "30", padding: 14, gap: 10, marginBottom: 14 },
  inviteTitle:  { color: C.gold, fontSize: 12, fontWeight: "800" },
  inviteLine:   { flexDirection: "row", alignItems: "center", gap: 8 },
  inviteBody:   { color: C.soft, fontSize: 12, flex: 1 },
  okBtn:        { padding: 7, borderRadius: 8, backgroundColor: "#0B1F07",
                  borderWidth: 1, borderColor: C.green + "25" },
  noBtn:        { padding: 7, borderRadius: 8, backgroundColor: "#1F0707",
                  borderWidth: 1, borderColor: C.red + "25" },

  createRoomBtn:{ flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 8, backgroundColor: C.goldBg, borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: C.gold + "30" },

  emptyState:   { alignItems: "center", paddingVertical: 48 },
  empty:        { color: C.muted, textAlign: "center", marginTop: 30, fontSize: 13 },
  sysMsg:       { color: C.muted, fontSize: 11, textAlign: "center", marginVertical: 4 },
});
