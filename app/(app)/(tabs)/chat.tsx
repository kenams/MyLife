import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual, getNpcVisual } from "@/lib/avatar-visual";
import { activities, starterResidents } from "@/lib/game-engine";
import { getBestProfileMatches } from "@/lib/profile-matching";
import { buildSocialHubSnapshot, relationshipScore } from "@/lib/social-hub";
import type { Conversation, NpcState, Room, RoomMessage } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

// ─── Light theme ──────────────────────────────────────────────────────────────
const L = {
  bg:        "#f5f7fa",
  card:      "#ffffff",
  text:      "#1e2a3a",
  textSoft:  "#4a5568",
  muted:     "#94a3b8",
  border:    "#e8edf5",
  primary:   "#6366f1",
  primaryBg: "#eef2ff",
  green:     "#10b981",
  greenBg:   "#ecfdf5",
  gold:      "#f59e0b",
  goldBg:    "#fffbeb",
  red:       "#ef4444",
  redBg:     "#fef2f2",
  blue:      "#3b82f6",
  blueBg:    "#eff6ff",
  pink:      "#ec4899",
  pinkBg:    "#fdf2f8",
  purple:    "#8b5cf6",
  purpleBg:  "#f5f3ff",
  teal:      "#14b8a6",
  tealBg:    "#f0fdfa",
  shadow:    "rgba(99,102,241,0.08)",
};

type Tab = "contacts" | "rooms" | "lounge";
type IconName = ComponentProps<typeof Ionicons>["name"];

const WIZZ_TOKEN = "[[WIZZ]]";
const EMOJI_SHORTCUTS = ["😀", "😂", "😍", "🔥", "👍", "👀", "💯", "✨", "☕", "🎮", "💬", "❤️"];
const REACTION_SHORTCUTS = ["❤️", "😂", "👍", "🔥"];
const MSN_NUDGES = ["Tu es là ?", "Réponds quand tu peux.", "Je viens d'arriver.", "On se capte dans une room ?"];

function relColor(score: number) {
  if (score >= 60) return L.green;
  if (score >= 35) return L.gold;
  return L.muted;
}

function Dot({ online }: { online: boolean }) {
  return <View style={[s.dot, { backgroundColor: online ? "#22c55e" : L.muted }]} />;
}

function NpcFace({ npc, size = 44 }: { npc: NpcState; size?: number }) {
  return (
    <View style={[s.faceWrap, { width: size, height: size }]}>
      <View style={{ transform: [{ scale: size <= 34 ? 0.7 : 0.86 }] }}>
        <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action as never} size={size <= 34 ? "xs" : "sm"} />
      </View>
      <View style={s.dotAbs}><Dot online={npc.presenceOnline} /></View>
    </View>
  );
}

function PlayerFace({ name, size = 42, visual }: {
  name?: string; size?: number; visual?: ReturnType<typeof getNpcVisual> | null
}) {
  if (visual) {
    return (
      <View style={[s.faceWrap, { width: size, height: size, borderRadius: size / 2, overflow: "hidden",
        borderWidth: 2, borderColor: L.primary + "40", backgroundColor: L.primaryBg }]}>
        <View style={{ transform: [{ scale: size <= 34 ? 0.72 : 0.88 }] }}>
          <AvatarSprite visual={visual} action="idle" size={size <= 34 ? "xs" : "sm"} />
        </View>
      </View>
    );
  }
  return (
    <View style={[s.playerFace, { width: size, height: size }]}>
      <Text style={s.playerInitial}>{(name ?? "Moi").slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

function Win({ title, subtitle, onBack, right, children }: {
  title: string; subtitle: string; onBack?: () => void; right?: ReactNode; children: ReactNode;
}) {
  return (
    <View style={s.root}>
      <View style={s.win}>
        <View style={s.titleBar}>
          {onBack && (
            <Pressable onPress={onBack} style={s.back}>
              <Ionicons name="chevron-back" size={20} color={L.text} />
            </Pressable>
          )}
          <View style={s.logo}>
            <Ionicons name="chatbubble-ellipses" size={18} color={L.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{title}</Text>
            <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
          {right}
        </View>
        {children}
      </View>
    </View>
  );
}

function Status({ text, color = L.primary }: { text: string; color?: string }) {
  return (
    <View style={[s.status, { backgroundColor: color + "12", borderColor: color + "30" }]}>
      <View style={[s.statusDot, { backgroundColor: color }]} />
      <Text style={[s.statusText, { color }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function Tools({ actions }: { actions: { label: string; icon: IconName; onPress: () => void; active?: boolean }[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tools} contentContainerStyle={s.toolsBody}>
      {actions.map((a) => (
        <Pressable key={a.label} onPress={a.onPress} style={[s.toolBtn, a.active && s.toolBtnActive]}>
          <Ionicons name={a.icon} size={20} color={a.active ? L.primary : L.muted} />
          <Text style={[s.toolText, a.active && { color: L.primary }]}>{a.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Quick({ items, pick }: { items: string[]; pick: (text: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quick} contentContainerStyle={s.quickBody}>
      {items.map((item) => (
        <Pressable key={item} onPress={() => pick(item)} style={s.quickChip}>
          <Text style={s.quickText} numberOfLines={1}>{item}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Composer({ value, change, send, macro, wizz }: {
  value: string; change: (t: string) => void; send: () => void; macro: (t: string) => void; wizz: () => void
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const buttons: { icon: IconName; text: string; color: string }[] = [
    { icon: "happy",          text: "😀",                                  color: L.gold    },
    { icon: "mic",            text: "Message vocal rapide.",                color: L.teal    },
    { icon: "image",          text: "Je partage une image mentale.",        color: L.purple  },
    { icon: "game-controller", text: "On lance une activite ensemble ?",   color: L.pink    },
  ];
  return (
    <View style={s.composer}>
      <View style={s.formatLine}>
        <Text style={s.bigA}>A</Text>
        <Pressable onPress={() => setEmojiOpen((o) => !o)}
          style={[s.macro, { backgroundColor: L.goldBg, borderColor: L.gold + "35" }]}>
          <Ionicons name="happy" size={18} color={L.gold} />
        </Pressable>
        <Pressable onPress={wizz}
          style={[s.wizzBtn, { backgroundColor: L.primaryBg, borderColor: L.primary + "40" }]}>
          <Ionicons name="flash" size={16} color={L.primary} />
          <Text style={[s.wizzBtnText, { color: L.primary }]}>Wizz</Text>
        </Pressable>
        {buttons.map((b) => (
          <Pressable key={b.icon} onPress={() => macro(b.text)}
            style={[s.macro, { backgroundColor: b.color + "12", borderColor: b.color + "25" }]}>
            <Ionicons name={b.icon} size={18} color={b.color} />
          </Pressable>
        ))}
      </View>
      {emojiOpen && (
        <View style={s.emojiTray}>
          {EMOJI_SHORTCUTS.map((emoji) => (
            <Pressable key={emoji} onPress={() => change(`${value}${emoji}`)} style={s.emojiBtn}>
              <Text style={s.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.nudgeBar} contentContainerStyle={s.nudgeBody}>
        {MSN_NUDGES.map((text) => (
          <Pressable key={text} onPress={() => macro(text)} style={s.nudgeChip}>
            <Text style={s.nudgeText}>{text}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.inputLine}>
        <TextInput
          value={value} onChangeText={change} onSubmitEditing={send}
          placeholder="Écrire un message…" placeholderTextColor={L.muted}
          returnKeyType="send" multiline style={s.input}
        />
        <Pressable onPress={send} style={s.send}>
          <Ionicons name="send" size={14} color="#fff" />
          <Text style={s.sendText}>Envoyer</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Bubble({ body, time, me, author, npc, reaction, onReact }: {
  body: string; time: string; me: boolean; author?: string;
  npc?: NpcState | null; reaction?: string; onReact?: (emoji: string) => void;
}) {
  const wizz = body.includes(WIZZ_TOKEN) || /^wizz/i.test(body.trim());
  const cleanBody = body.replace(WIZZ_TOKEN, "").trim() || "Wizz !";
  const shake = useRef(new Animated.Value(0)).current;
  const [reactOpen, setReactOpen] = useState(false);

  useEffect(() => {
    if (!wizz) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shake, wizz]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  return (
    <Animated.View style={[s.msgRow, me && { flexDirection: "row-reverse" }, wizz && { transform: [{ translateX }] }]}>
      {!me && (npc
        ? <NpcFace npc={npc} size={32} />
        : <View style={s.anon}><Ionicons name="person" size={14} color={L.muted} /></View>
      )}
      <View style={s.bubbleCol}>
        {!me && author && <Text style={s.author}>{author}</Text>}
        <Pressable
          onPress={() => setReactOpen((o) => !o)}
          onLongPress={() => setReactOpen(true)}
          style={[s.bubble, me ? s.bubbleMe : s.bubbleOther, wizz && s.wizzBubble]}
        >
          {wizz && (
            <View style={s.wizzHeader}>
              <Ionicons name="flash" size={13} color={me ? "#fff" : L.gold} />
              <Text style={[s.wizzLabel, me && { color: "rgba(255,255,255,0.9)" }]}>WIZZ</Text>
            </View>
          )}
          <Text style={[s.bubbleText, me && { color: "#fff" }, wizz && !me && { color: L.gold }]}>
            {cleanBody}
          </Text>
          <Text style={[s.time, me && { color: "rgba(255,255,255,0.6)", textAlign: "right" }]}>{time}</Text>
        </Pressable>
        {(reactOpen || reaction) && (
          <View style={[s.reactionLine, me && { justifyContent: "flex-end" }]}>
            {REACTION_SHORTCUTS.map((emoji) => (
              <Pressable key={emoji}
                onPress={() => { onReact?.(reaction === emoji ? "" : emoji); setReactOpen(false); }}
                style={[s.reactionBtn, reaction === emoji && s.reactionBtnActive]}>
                <Text style={s.reactionText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {reaction && (
          <View style={[s.reactionBadge, me && { alignSelf: "flex-end" }]}>
            <Text style={s.reactionText}>{reaction}</Text>
          </View>
        )}
        {me && <Text style={[s.delivery, { textAlign: "right" }]}>envoyé</Text>}
      </View>
    </Animated.View>
  );
}

function TypingIndicator({ name }: { name: string }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.4, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={s.typingRow}>
      <Animated.View style={[s.typingBubble, { opacity: pulse }]}>
        <View style={s.typingDots}>
          {[0, 1, 2].map((d) => <View key={d} style={s.typingDot} />)}
        </View>
        <Text style={s.typingText}>{name} écrit…</Text>
      </Animated.View>
    </View>
  );
}

function InfoPanel({ icon, title, body, action, onPress }: {
  icon: IconName; title: string; body: string; action?: string; onPress?: () => void
}) {
  return (
    <View style={s.infoPanel}>
      <View style={s.infoIcon}><Ionicons name={icon} size={16} color={L.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoTitle} numberOfLines={1}>{title}</Text>
        <Text style={s.infoBody} numberOfLines={2}>{body}</Text>
      </View>
      {action && onPress && (
        <Pressable onPress={onPress} style={s.infoAction}>
          <Text style={s.infoActionText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function MemberRail({ me, online, invite }: { me: string; online: NpcState[]; invite: (id: string) => void }) {
  return (
    <View style={s.memberRail}>
      <View style={s.memberMe}>
        <PlayerFace name={me} size={34} />
        <Text style={s.memberName} numberOfLines={1}>{me}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.memberList}>
        {online.slice(0, 10).map((npc) => (
          <Pressable key={npc.id} onPress={() => invite(npc.id)} style={s.memberItem}>
            <NpcFace npc={npc} size={34} />
            <Text style={s.memberName} numberOfLines={1}>{npc.name.split(" ")[0]}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ConversationView({ conv, npc, back }: { conv: Conversation; npc: NpcState | null; back: () => void }) {
  const sendMessage          = useGameStore((x) => x.sendMessage);
  const markConversationRead = useGameStore((x) => x.markConversationRead);
  const avatar               = useGameStore((x) => x.avatar);
  const session              = useGameStore((x) => x.session);
  const [input, setInput]    = useState("");
  const [typing, setTyping]  = useState(false);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const scroll               = useRef<ScrollView>(null);
  const typingTimer          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const info                 = npc ? starterResidents.find((r) => r.id === npc.id) : null;
  const name                 = info?.name ?? conv.title;
  const me                   = avatar?.displayName ?? "Moi";
  const myId                 = session?.email ?? "local";

  useEffect(() => {
    markConversationRead(conv.id);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 80);
  }, [conv.id, markConversationRead]);
  useEffect(() => { scroll.current?.scrollToEnd({ animated: true }); }, [conv.messages.length]);
  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);

  function startTyping(ms = 1000) {
    if (!conv.peerId) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setTyping(true);
    typingTimer.current = setTimeout(() => setTyping(false), ms);
  }
  function post(text: string) {
    const clean = text.trim();
    if (!clean) return;
    sendMessage(conv.id, clean);
    startTyping(clean.includes(WIZZ_TOKEN) ? 520 : 1050);
  }
  function send() { post(input); setInput(""); }
  function sendWizz() { post(`${WIZZ_TOKEN} Wizz ! ${name.split(" ")[0]}, tu es là ?`); }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Win
        title={name}
        subtitle={npc?.presenceOnline ? "En ligne" : "Absent"}
        onBack={back}
        right={<Status text={npc?.presenceOnline ? "En ligne" : "Absent"}
          color={npc?.presenceOnline ? L.green : L.muted} />}
      >
        <Tools actions={[
          { label: "Inviter",    icon: "person-add",     active: true, onPress: () => post("Tu veux me rejoindre dans une room ?") },
          { label: "Fichiers",   icon: "folder-open",    onPress: () => post("Je t'envoie une idée à tester.") },
          { label: "Vidéo",      icon: "videocam",       onPress: () => post("On lance un appel vidéo ?") },
          { label: "Wizz",       icon: "flash",          active: true, onPress: sendWizz },
          { label: "Vocal",      icon: "mic",            onPress: () => post("Message vocal : je suis connecté.") },
          { label: "Activités",  icon: "sparkles",       onPress: () => post("On lance une activité ensemble ?") },
          { label: "Sorties",    icon: "game-controller", onPress: () => post("Petit défi : on teste une sortie ?") },
        ]} />
        <InfoPanel
          icon={npc?.presenceOnline ? "flash" : "time"}
          title={npc?.presenceOnline ? "Contact disponible" : "Contact absent"}
          body={info?.bio ?? "Conversation privée. Utilise les actions pour proposer une room ou une activité."}
          action="Room"
          onPress={() => post("Je crée une room, tu me rejoins ?")}
        />
        <ScrollView ref={scroll} style={{ flex: 1 }}
          contentContainerStyle={s.msgList} showsVerticalScrollIndicator={false}>
          {conv.messages.length === 0 && (
            <Text style={s.empty}>Commence avec un message ou un Wizz.</Text>
          )}
          {conv.messages.map((m) => {
            const isMe = m.authorId === myId || ["player", "user", "self", "local"].includes(m.authorId);
            if (m.kind === "system") return <Text key={m.id} style={s.system}>{m.body}</Text>;
            return (
              <Bubble
                key={m.id}
                body={m.body}
                time={new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                me={isMe}
                author={isMe ? me : name}
                npc={isMe ? null : npc}
                reaction={reactions[m.id]}
                onReact={(emoji) => setReactions((cur) => ({ ...cur, [m.id]: emoji }))}
              />
            );
          })}
          {typing && <TypingIndicator name={name.split(" ")[0]} />}
        </ScrollView>
        <Quick items={[`Salut ${name.split(" ")[0]} !`, "Tu fais quoi ? 😀", "On se retrouve quelque part ? 🔥", "Je t'invite pour un café ☕"]} pick={post} />
        <Composer value={input} change={setInput} send={send} macro={post} wizz={sendWizz} />
      </Win>
    </KeyboardAvoidingView>
  );
}

function RoomView({ id, name, back }: { id: string; name: string; back: () => void }) {
  const sendRoomMessage  = useGameStore((x) => x.sendRoomMessage);
  const messages         = useGameStore((x) => x.roomMessages[id] ?? []);
  const npcs             = useGameStore((x) => x.npcs);
  const rooms            = useGameStore((x) => x.rooms);
  const avatar           = useGameStore((x) => x.avatar);
  const session          = useGameStore((x) => x.session);
  const inviteNpcToRoom  = useGameStore((x) => x.inviteNpcToRoom);
  const room             = rooms.find((r) => r.id === id);
  const online           = npcs.filter((n) => n.presenceOnline);
  const me               = avatar?.displayName ?? "Moi";
  const myId             = session?.email ?? "local";
  const [input, setInput]   = useState("");
  const [invite, setInvite] = useState(false);
  const [typing, setTyping] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const scroll           = useRef<ScrollView>(null);
  const typingTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 80); }, []);
  useEffect(() => { scroll.current?.scrollToEnd({ animated: true }); }, [messages.length]);
  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);

  function startTyping(ms = 1100) {
    if (online.length === 0) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setTyping(true);
    typingTimer.current = setTimeout(() => setTyping(false), ms);
  }
  function post(text: string) {
    const clean = text.trim();
    if (!clean) return;
    sendRoomMessage(id, clean);
    startTyping(clean.includes(WIZZ_TOKEN) ? 600 : 1200);
  }
  function send() { post(input); setInput(""); }
  function sendWizz() { post(`${WIZZ_TOKEN} Wizz collectif ! Qui est là ?`); }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Win title={name} subtitle={`${online.length + 1} en ligne`} onBack={back}
        right={<Status text={`${online.length + 1} live`} color={L.teal} />}>
        <Tools actions={[
          { label: "Inviter",    icon: "person-add", active: true, onPress: () => room?.kind === "private" ? setInvite((v) => !v) : post("Qui rejoint ?") },
          { label: "Code",       icon: "key",        onPress: () => room?.code && post(`Code room : ${room.code}`) },
          { label: "Wizz",       icon: "flash",      active: true, onPress: sendWizz },
          { label: "Vocal",      icon: "mic",        onPress: () => post("Message vocal : connecté.") },
          { label: "Live",       icon: "radio",      onPress: () => post("Live check : qui est là ?") },
          { label: "Activités",  icon: "sparkles",   onPress: () => post("Activité de groupe ?") },
          { label: "Jeux",       icon: "game-controller", onPress: () => post("Mini-jeu social ?") },
        ]} />
        {invite && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={s.invites} contentContainerStyle={{ gap: 12, padding: 12 }}>
            {online.map((n) => (
              <Pressable key={n.id} onPress={() => { inviteNpcToRoom(id, n.id); setInvite(false); }} style={s.inviteNpc}>
                <NpcFace npc={n} size={42} />
                <Text style={s.inviteText} numberOfLines={1}>{n.name.split(" ")[0]}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <MemberRail me={me} online={online} invite={(npcId) => inviteNpcToRoom(id, npcId)} />
        <InfoPanel
          icon="radio"
          title={room?.kind === "private" ? "Room privée" : "Room publique"}
          body="Les messages partent dans la room. Invite des contacts pour qu'ils rejoignent."
          action={room?.code ? `#${room.code}` : "Live"}
          onPress={() => room?.code ? post(`Code : ${room.code}`) : post("Live check !")}
        />
        <ScrollView ref={scroll} style={{ flex: 1 }}
          contentContainerStyle={s.msgList} showsVerticalScrollIndicator={false}>
          {messages.length === 0 && <Text style={s.empty}>La room est ouverte. Écris ou invite un contact.</Text>}
          {messages.map((m) => {
            const isMe = m.authorId === myId || m.authorId === "local" || m.authorName === me;
            const npc  = npcs.find((n) => n.id === m.authorId) ?? null;
            if (m.kind === "system") return <Text key={m.id} style={s.systemGold}>{m.body}</Text>;
            return (
              <Bubble key={m.id}
                body={m.body}
                time={new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                me={isMe} author={m.authorName} npc={npc}
                reaction={reactions[m.id]}
                onReact={(emoji) => setReactions((cur) => ({ ...cur, [m.id]: emoji }))}
              />
            );
          })}
          {typing && <TypingIndicator name={online[0]?.name.split(" ")[0] ?? "La room"} />}
        </ScrollView>
        <Quick items={["Salut la room ! 😀", "Je viens d'arriver.", "Activité de groupe ? 🎮", "Qui est là ? 👀"]} pick={post} />
        <Composer value={input} change={setInput} send={send} macro={post} wizz={sendWizz} />
      </Win>
    </KeyboardAvoidingView>
  );
}

function ContactRow({ c, npc, score, open }: { c: Conversation; npc: NpcState | null; score?: number; open: () => void }) {
  const last = c.messages.at(-1);
  return (
    <Pressable onPress={open} style={[s.rowCard, c.unreadCount > 0 && s.rowUnread]}>
      {npc ? <NpcFace npc={npc} size={48} /> : <PlayerFace name={c.title} size={48} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.rowTop}>
          <Text style={s.rowTitle} numberOfLines={1}>{c.title}</Text>
          {last && <Text style={s.rowTime}>{new Date(last.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</Text>}
        </View>
        <Text style={{ color: npc?.presenceOnline ? L.green : L.muted, fontSize: 10, fontWeight: "700" }} numberOfLines={1}>
          {npc?.presenceOnline ? "● En ligne" : score !== undefined ? `Lien ${score}%` : c.subtitle}
        </Text>
        <Text style={s.preview} numberOfLines={1}>{last?.body ?? "Commencer une conversation"}</Text>
      </View>
      {score !== undefined && (
        <View style={s.relTrack}>
          <View style={{ height: 4, width: `${Math.min(100, score)}%`, backgroundColor: relColor(score), borderRadius: 2 }} />
        </View>
      )}
      {c.unreadCount > 0 && (
        <View style={s.badge}><Text style={s.badgeText}>{c.unreadCount}</Text></View>
      )}
    </Pressable>
  );
}

function RoomRow({ room, last, open }: { room: Room; last?: RoomMessage; open: () => void }) {
  const prv = room.kind === "private";
  return (
    <Pressable onPress={open} style={[s.rowCard, prv && { backgroundColor: L.purpleBg, borderColor: L.purple + "30" }]}>
      <View style={[s.roomIcon, {
        backgroundColor: prv ? L.purpleBg : L.primaryBg,
        borderColor: prv ? L.purple + "35" : L.primary + "30"
      }]}>
        <Ionicons name={prv ? "lock-closed" : "people"} size={20} color={prv ? L.purple : L.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.rowTop}>
          <Text style={s.rowTitle} numberOfLines={1}>{room.name}</Text>
          {room.code && <Text style={s.code}>#{room.code}</Text>}
        </View>
        <Text style={s.rowMeta}>{room.memberCount}/{room.maxMembers} membres · {room.kind}</Text>
        <Text style={s.preview} numberOfLines={1}>{last?.body ?? room.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={L.muted} />
    </Pressable>
  );
}

export default function ChatScreen() {
  const conversations         = useGameStore((x) => x.conversations);
  const npcs                  = useGameStore((x) => x.npcs);
  const relationships         = useGameStore((x) => x.relationships);
  const rooms                 = useGameStore((x) => x.rooms);
  const joinedRooms           = useGameStore((x) => x.joinedRooms);
  const roomInvites           = useGameStore((x) => x.roomInvites);
  const createPrivateRoom     = useGameStore((x) => x.createPrivateRoom);
  const respondRoomInvite     = useGameStore((x) => x.respondRoomInvite);
  const invitations           = useGameStore((x) => x.invitations);
  const respondInvitation     = useGameStore((x) => x.respondInvitation);
  const startDirectConversation = useGameStore((x) => x.startDirectConversation);
  const avatar                = useGameStore((x) => x.avatar);
  const roomMessages          = useGameStore((x) => x.roomMessages);
  const [tab, setTab]         = useState<Tab>("contacts");
  const [convId, setConvId]   = useState<string | null>(null);
  const [roomId, setRoomId]   = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName]     = useState("");
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [tab, fade]);

  const openConv = conversations.find((c) => c.id === convId);
  if (convId && openConv) return (
    <ConversationView
      conv={openConv}
      npc={openConv.peerId ? npcs.find((n) => n.id === openConv.peerId) ?? null : null}
      back={() => setConvId(null)}
    />
  );
  if (roomId) {
    const room = rooms.find((r) => r.id === roomId);
    return <RoomView id={roomId} name={room?.name ?? "Room"} back={() => setRoomId(null)} />;
  }

  const hub            = buildSocialHubSnapshot({ avatar, conversations, npcs, relationships, rooms, joinedRooms, roomInvites, invitations, roomMessages });
  const online         = hub.onlineNpcs;
  const sorted         = hub.sortedConversations;
  const myRooms        = hub.myRooms;
  const otherRooms     = hub.otherRooms;
  const pendingRooms   = hub.pendingRoomInvites;
  const pendingInvites = hub.pendingInvitations;
  const unread         = hub.unreadTotal;
  const loungeLast     = hub.loungeLastMessage;
  const topMatches     = getBestProfileMatches(avatar, starterResidents, relationships).slice(0, 3);

  const tabMeta: Record<Tab, { label: string; icon: IconName; badge: number }> = {
    contacts: { label: "Contacts", icon: "person",  badge: unread          },
    rooms:    { label: "Rooms",    icon: "people",   badge: pendingRooms.length },
    lounge:   { label: "Ville",    icon: "globe",    badge: 0               },
  };

  function makeRoom() {
    const room = createPrivateRoom(roomName.trim() || "Room privée");
    setRoomName(""); setCreateOpen(false); setRoomId(room.id);
  }
  function openMatch(residentId: string, residentName: string) {
    const existing = conversations.find((c) => c.kind === "direct" && c.peerId === residentId);
    startDirectConversation(residentId, residentName);
    setConvId(existing?.id ?? `dm-${residentId}`);
  }

  return (
    <Win
      title="Messages"
      subtitle={`${online.length} en ligne${unread ? ` · ${unread} non lu` : ""}`}
      right={<PlayerFace name={avatar?.displayName} visual={avatar ? getAvatarVisual(avatar) : null} size={38} />}
    >
      {/* Hub */}
      <View style={s.hub}>
        {/* Shortcuts */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shortcuts}>
          <Pressable onPress={() => router.push("/(app)/(tabs)/world")}
            style={[s.shortcut, { backgroundColor: L.primaryBg, borderColor: L.primary + "30" }]}>
            <Ionicons name="map" size={16} color={L.primary} />
            <Text style={[s.shortcutText, { color: L.primary }]}>Carte</Text>
          </Pressable>
          <Pressable onPress={() => setRoomId("room-lounge-global")}
            style={[s.shortcut, { backgroundColor: L.tealBg, borderColor: L.teal + "30" }]}>
            <Ionicons name="radio" size={16} color={L.teal} />
            <Text style={[s.shortcutText, { color: L.teal }]}>Live chat</Text>
          </Pressable>
          <Pressable onPress={() => { const room = createPrivateRoom("Groupe"); setRoomId(room.id); }}
            style={[s.shortcut, { backgroundColor: L.purpleBg, borderColor: L.purple + "30" }]}>
            <Ionicons name="add-circle" size={16} color={L.purple} />
            <Text style={[s.shortcutText, { color: L.purple }]}>Groupe</Text>
          </Pressable>
        </ScrollView>

        {/* Métriques */}
        <View style={s.dashboard}>
          {[
            { value: online.length, label: "en ligne",  color: L.green  },
            { value: unread,        label: "non lus",   color: unread > 0 ? L.red : L.muted },
            { value: myRooms.length, label: "rooms",    color: L.primary },
            { value: pendingInvites.length + pendingRooms.length, label: "invitations", color: L.gold },
          ].map((m) => (
            <View key={m.label} style={[s.metric, { borderColor: m.color + "20", backgroundColor: m.color + "08" }]}>
              <Text style={[s.metricValue, { color: m.color }]}>{m.value}</Text>
              <Text style={s.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Contacts en ligne */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.onlineStrip}>
          {online.map((npc) => {
            const c     = conversations.find((conv) => conv.peerId === npc.id);
            const score = relationshipScore(relationships, npc.id);
            return (
              <Pressable key={npc.id} onPress={() => c && setConvId(c.id)} style={s.onlineItem}>
                <NpcFace npc={npc} size={48} />
                <Text style={{ color: score >= 40 ? L.primary : L.muted, fontSize: 10, fontWeight: "700" }} numberOfLines={1}>
                  {npc.name.split(" ")[0]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Tabs */}
        <View style={s.tabs}>
          {(["contacts", "rooms", "lounge"] as Tab[]).map((key) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[s.tab, tab === key && s.tabActive]}>
              <Ionicons name={tabMeta[key].icon} size={14} color={tab === key ? L.primary : L.muted} />
              <Text style={{ color: tab === key ? L.primary : L.muted, fontSize: 12, fontWeight: "800" }}>
                {tabMeta[key].label}
              </Text>
              {tabMeta[key].badge > 0 && (
                <View style={s.tabBadge}><Text style={s.badgeText}>{tabMeta[key].badge}</Text></View>
              )}
            </Pressable>
          ))}
        </View>
      </View>

      {/* Contenu */}
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>

          {/* Invitations */}
          {(pendingInvites.length > 0 || pendingRooms.length > 0) && (
            <View style={s.inviteBox}>
              <Text style={s.inviteTitle}>Invitations en attente</Text>
              {pendingInvites.map((i) => (
                <View key={i.id} style={s.inviteLine}>
                  <Text style={s.inviteBody}>{i.residentName} propose {activities.find((a) => a.slug === i.activitySlug)?.name ?? i.activitySlug}</Text>
                  <Pressable onPress={() => respondInvitation(i.id, "accepted")} style={s.ok}><Ionicons name="checkmark" size={16} color={L.green} /></Pressable>
                  <Pressable onPress={() => respondInvitation(i.id, "declined")} style={s.no}><Ionicons name="close" size={16} color={L.red} /></Pressable>
                </View>
              ))}
              {pendingRooms.map((i) => (
                <View key={i.id} style={s.inviteLine}>
                  <Text style={s.inviteBody}>{i.fromName} t'invite dans {i.roomName}</Text>
                  <Pressable onPress={() => respondRoomInvite(i.id, "accepted")} style={s.ok}><Ionicons name="checkmark" size={16} color={L.green} /></Pressable>
                  <Pressable onPress={() => respondRoomInvite(i.id, "declined")} style={s.no}><Ionicons name="close" size={16} color={L.red} /></Pressable>
                </View>
              ))}
            </View>
          )}

          {tab === "contacts" && (
            <View>
              <Text style={s.section}>SUGGESTIONS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.matchStrip}>
                {topMatches.map((match) => {
                  const npc = npcs.find((item) => item.id === match.resident.id) ?? null;
                  return (
                    <Pressable key={match.resident.id}
                      onPress={() => openMatch(match.resident.id, match.resident.name)} style={s.matchCard}>
                      {npc ? <NpcFace npc={npc} size={42} /> : <PlayerFace name={match.resident.name} size={42} />}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.matchName} numberOfLines={1}>{match.resident.name}</Text>
                        <Text style={s.matchScore}>Match {match.score}%</Text>
                        <Text style={s.matchReason} numberOfLines={1}>{match.reasons[0]}</Text>
                      </View>
                      <Ionicons name="chatbubble-ellipses" size={16} color={L.primary} />
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={s.section}>EN LIGNE</Text>
              {hub.friendOnline.length === 0 && (
                <InfoPanel icon="person" title="Aucun proche en ligne" body="Les contacts restent accessibles dans Messages. Rejoins le lounge pour trouver du monde."
                  action="Lounge" onPress={() => setRoomId("room-lounge-global")} />
              )}
              {hub.friendOnline.map((npc) => {
                const c = conversations.find((conv) => conv.peerId === npc.id);
                const score = relationships.find((r) => r.residentId === npc.id)?.score;
                return c ? <ContactRow key={npc.id} c={c} npc={npc} score={score} open={() => setConvId(c.id)} /> : null;
              })}

              <Text style={s.section}>MESSAGES</Text>
              {sorted.map((c) => {
                const npc   = c.peerId ? npcs.find((n) => n.id === c.peerId) ?? null : null;
                const score = c.peerId ? relationships.find((r) => r.residentId === c.peerId)?.score : undefined;
                return <ContactRow key={c.id} c={c} npc={npc} score={score} open={() => setConvId(c.id)} />;
              })}
            </View>
          )}

          {tab === "rooms" && (
            <View>
              <View style={s.createBox}>
                {!createOpen
                  ? <Pressable onPress={() => setCreateOpen(true)} style={s.createBtn}>
                      <Ionicons name="add-circle" size={20} color={L.primary} />
                      <Text style={s.createText}>Créer une room groupée</Text>
                    </Pressable>
                  : <View style={{ gap: 10 }}>
                      <TextInput value={roomName} onChangeText={setRoomName} placeholder="Nom de la room"
                        placeholderTextColor={L.muted} style={s.createInput} />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={makeRoom} style={s.createOk}><Text style={s.createOkText}>Créer</Text></Pressable>
                        <Pressable onPress={() => { setCreateOpen(false); setRoomName(""); }} style={s.createCancel}>
                          <Text style={s.createCancelText}>Annuler</Text>
                        </Pressable>
                      </View>
                    </View>
                }
              </View>
              <Text style={s.section}>MES ROOMS</Text>
              {myRooms.map((r) => <RoomRow key={r.id} room={r} last={(roomMessages[r.id] ?? []).at(-1)} open={() => setRoomId(r.id)} />)}
              {myRooms.length === 0 && (
                <InfoPanel icon="people" title="Pas encore de room active"
                  body="Crée une room groupée pour inviter des contacts et tester le chat live."
                  action="Créer" onPress={makeRoom} />
              )}
              <Text style={s.section}>REJOINDRE</Text>
              {otherRooms.map((r) => <RoomRow key={r.id} room={r} last={(roomMessages[r.id] ?? []).at(-1)} open={() => setRoomId(r.id)} />)}
            </View>
          )}

          {tab === "lounge" && (
            <View>
              <View style={s.loungeCard}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: L.tealBg,
                  alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.teal + "30" }}>
                  <Ionicons name="globe" size={26} color={L.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.loungeTitle}>Lounge ville</Text>
                  <Text style={s.loungeBody}>Chat public, residents, rooms et présence live.</Text>
                  {loungeLast && (
                    <Text style={s.loungeLast} numberOfLines={2}>{loungeLast.authorName}: {loungeLast.body}</Text>
                  )}
                </View>
                <Pressable onPress={() => setRoomId("room-lounge-global")} style={s.loungeBtn}>
                  <Ionicons name="enter" size={16} color="#fff" />
                  <Text style={s.loungeBtnText}>Entrer</Text>
                </Pressable>
              </View>
              <Text style={s.section}>DERNIERS MESSAGES</Text>
              {(roomMessages["room-lounge-global"] ?? []).slice(-10).reverse().map((m) =>
                m.kind === "system" ? null : (
                  <View key={m.id} style={s.publicMsg}>
                    <Text style={s.publicAuthor}>{m.authorName}</Text>
                    <Text style={s.preview} numberOfLines={2}>{m.body}</Text>
                  </View>
                )
              )}
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </Win>
  );
}

const s = StyleSheet.create({
  root:               { flex: 1, backgroundColor: L.bg },
  win:                { flex: 1, backgroundColor: L.bg },
  titleBar:           { paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
                        backgroundColor: L.card, flexDirection: "row", alignItems: "center", gap: 10,
                        borderBottomWidth: 1, borderBottomColor: L.border,
                        shadowColor: "rgba(0,0,0,0.04)", shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  back:               { width: 34, height: 34, borderRadius: 10, backgroundColor: L.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.border },
  logo:               { width: 36, height: 36, borderRadius: 10, backgroundColor: L.primaryBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.primary + "30" },
  title:              { color: L.text, fontSize: 17, fontWeight: "900" },
  subtitle:           { color: L.muted, fontSize: 11, fontWeight: "600" },
  status:             { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  statusDot:          { width: 7, height: 7, borderRadius: 4 },
  statusText:         { fontSize: 10, fontWeight: "800" },
  dot:                { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: L.card },
  dotAbs:             { position: "absolute", right: 0, bottom: 0 },
  faceWrap:           { position: "relative", alignItems: "center", justifyContent: "center" },
  playerFace:         { borderRadius: 12, backgroundColor: L.primaryBg, borderWidth: 2, borderColor: L.primary + "40", alignItems: "center", justifyContent: "center" },
  playerInitial:      { color: L.primary, fontSize: 14, fontWeight: "900" },
  tools:              { backgroundColor: L.card, borderBottomWidth: 1, borderBottomColor: L.border },
  toolsBody:          { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  toolBtn:            { width: 68, minHeight: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: L.bg, borderWidth: 1, borderColor: L.border },
  toolBtnActive:      { backgroundColor: L.primaryBg, borderColor: L.primary + "40" },
  toolText:           { color: L.muted, fontSize: 9, fontWeight: "700", textAlign: "center" },
  quick:              { backgroundColor: L.card, borderTopWidth: 1, borderTopColor: L.border },
  quickBody:          { gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  quickChip:          { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: L.primaryBg, borderWidth: 1, borderColor: L.primary + "25" },
  quickText:          { color: L.primary, fontSize: 12, fontWeight: "700" },
  composer:           { backgroundColor: L.card, borderTopWidth: 1, borderTopColor: L.border },
  formatLine:         { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  bigA:               { color: L.muted, fontSize: 18, fontWeight: "900" },
  macro:              { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  wizzBtn:            { height: 34, borderRadius: 10, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, flexDirection: "row", gap: 4 },
  wizzBtnText:        { fontSize: 11, fontWeight: "800" },
  emojiTray:          { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  emojiBtn:           { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: L.bg, borderWidth: 1, borderColor: L.border },
  emojiText:          { fontSize: 18 },
  nudgeBar:           { borderTopWidth: 1, borderTopColor: L.border },
  nudgeBody:          { gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  nudgeChip:          { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: L.bg, borderWidth: 1, borderColor: L.border },
  nudgeText:          { color: L.textSoft, fontSize: 11, fontWeight: "600" },
  inputLine:          { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 12, paddingBottom: 10 },
  input:              { flex: 1, minHeight: 44, maxHeight: 110, backgroundColor: L.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, color: L.text, fontSize: 14, borderWidth: 1, borderColor: L.border },
  send:               { width: 80, height: 44, borderRadius: 14, backgroundColor: L.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  sendText:           { color: "#fff", fontSize: 12, fontWeight: "800" },
  msgList:            { padding: 16, gap: 10 },
  msgRow:             { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  anon:               { width: 32, height: 32, borderRadius: 10, backgroundColor: L.bg, borderWidth: 1, borderColor: L.border, alignItems: "center", justifyContent: "center" },
  bubbleCol:          { maxWidth: "78%", gap: 3 },
  author:             { color: L.primary, fontSize: 10, fontWeight: "800", marginLeft: 6 },
  bubble:             { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1 },
  bubbleMe:           { backgroundColor: L.primary, borderColor: L.primary, borderBottomRightRadius: 4 },
  bubbleOther:        { backgroundColor: L.card, borderColor: L.border, borderBottomLeftRadius: 4,
                        shadowColor: "rgba(0,0,0,0.04)", shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  wizzBubble:         { backgroundColor: L.goldBg, borderColor: L.gold + "60" },
  wizzHeader:         { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  wizzLabel:          { color: L.gold, fontSize: 9, fontWeight: "900" },
  wizzText:           { fontWeight: "900" },
  bubbleText:         { color: L.text, fontSize: 14, lineHeight: 20 },
  time:               { color: L.muted, fontSize: 9, marginTop: 4 },
  delivery:           { color: L.muted, fontSize: 9, marginTop: 2, paddingHorizontal: 4 },
  reactionLine:       { flexDirection: "row", gap: 4, marginTop: 4 },
  reactionBtn:        { width: 28, height: 28, borderRadius: 14, backgroundColor: L.bg, borderWidth: 1, borderColor: L.border, alignItems: "center", justifyContent: "center" },
  reactionBtnActive:  { backgroundColor: L.primaryBg, borderColor: L.primary + "50" },
  reactionBadge:      { marginTop: -4, minWidth: 28, height: 22, borderRadius: 11, backgroundColor: L.card, borderWidth: 1, borderColor: L.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, alignSelf: "flex-start" },
  reactionText:       { fontSize: 14 },
  typingRow:          { flexDirection: "row", alignItems: "center", marginTop: 2 },
  typingBubble:       { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: L.card, borderWidth: 1, borderColor: L.border, alignSelf: "flex-start" },
  typingDots:         { flexDirection: "row", gap: 3 },
  typingDot:          { width: 5, height: 5, borderRadius: 3, backgroundColor: L.primary },
  typingText:         { color: L.muted, fontSize: 11, fontWeight: "600" },
  system:             { color: L.muted, fontSize: 11, textAlign: "center" },
  systemGold:         { color: L.gold, fontSize: 11, textAlign: "center" },
  empty:              { color: L.muted, textAlign: "center", marginTop: 30, fontSize: 13 },
  invites:            { backgroundColor: L.card, borderBottomWidth: 1, borderBottomColor: L.border },
  inviteNpc:          { width: 62, alignItems: "center", gap: 4 },
  inviteText:         { color: L.textSoft, fontSize: 10, fontWeight: "700" },
  hub:                { backgroundColor: L.card, borderBottomWidth: 1, borderBottomColor: L.border },
  shortcuts:          { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  shortcut:           { minWidth: 100, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  shortcutText:       { fontSize: 12, fontWeight: "700" },
  onlineStrip:        { paddingHorizontal: 14, paddingBottom: 12, gap: 12 },
  onlineItem:         { alignItems: "center", gap: 4, width: 56 },
  tabs:               { flexDirection: "row", paddingHorizontal: 12, gap: 4, borderTopWidth: 1, borderTopColor: L.border },
  tab:                { flex: 1, paddingVertical: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5, position: "relative" },
  tabActive:          { borderBottomWidth: 2.5, borderBottomColor: L.primary },
  tabBadge:           { position: "absolute", top: 5, right: 10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: L.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText:          { color: "#fff", fontSize: 9, fontWeight: "900" },
  inviteBox:          { backgroundColor: L.goldBg, borderRadius: 16, borderWidth: 1, borderColor: L.gold + "30", padding: 12, gap: 8, marginBottom: 14 },
  inviteTitle:        { color: L.gold, fontSize: 12, fontWeight: "800" },
  inviteLine:         { flexDirection: "row", alignItems: "center", gap: 8 },
  inviteBody:         { color: L.textSoft, fontSize: 12, flex: 1 },
  ok:                 { padding: 7, borderRadius: 8, backgroundColor: L.greenBg, borderWidth: 1, borderColor: L.green + "25" },
  no:                 { padding: 7, borderRadius: 8, backgroundColor: L.redBg, borderWidth: 1, borderColor: L.red + "25" },
  section:            { color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 10, marginBottom: 8 },
  rowCard:            { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: L.card, borderWidth: 1, borderColor: L.border, marginBottom: 8,
                        shadowColor: "rgba(0,0,0,0.04)", shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  rowUnread:          { backgroundColor: L.primaryBg, borderColor: L.primary + "25" },
  rowTop:             { flexDirection: "row", alignItems: "center", gap: 6 },
  rowTitle:           { color: L.text, fontSize: 14, fontWeight: "800", flex: 1 },
  rowTime:            { color: L.muted, fontSize: 10 },
  rowMeta:            { color: L.muted, fontSize: 11, marginTop: 2 },
  preview:            { color: L.muted, fontSize: 12, marginTop: 3 },
  relTrack:           { width: 40, height: 4, borderRadius: 2, backgroundColor: L.border, overflow: "hidden" },
  badge:              { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: L.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  roomIcon:           { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  code:               { color: L.gold, fontSize: 10, fontWeight: "800" },
  createBox:          { backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.border, padding: 12, marginBottom: 14 },
  createBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: L.primaryBg, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: L.primary + "30" },
  createText:         { color: L.primary, fontSize: 13, fontWeight: "700" },
  createInput:        { backgroundColor: L.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: L.text, borderWidth: 1, borderColor: L.border },
  createOk:           { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", backgroundColor: L.primary },
  createOkText:       { color: "#fff", fontSize: 12, fontWeight: "800" },
  createCancel:       { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", backgroundColor: L.bg, borderWidth: 1, borderColor: L.border },
  createCancelText:   { color: L.textSoft, fontSize: 12, fontWeight: "700" },
  loungeCard:         { backgroundColor: L.card, borderRadius: 18, borderWidth: 1, borderColor: L.teal + "25", padding: 16, marginBottom: 14, gap: 12, flexDirection: "row", alignItems: "flex-start",
                        shadowColor: L.teal, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  loungeTitle:        { color: L.text, fontSize: 16, fontWeight: "800" },
  loungeBody:         { color: L.muted, fontSize: 12, marginTop: 2 },
  loungeLast:         { color: L.textSoft, fontSize: 12, backgroundColor: L.bg, borderRadius: 10, padding: 8, marginTop: 6 },
  loungeBtn:          { borderRadius: 12, backgroundColor: L.teal, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", flexDirection: "row", gap: 6, marginTop: 4 },
  loungeBtnText:      { color: "#fff", fontSize: 12, fontWeight: "800" },
  publicMsg:          { padding: 11, borderRadius: 12, backgroundColor: L.card, borderWidth: 1, borderColor: L.border, marginBottom: 8 },
  publicAuthor:       { color: L.primary, fontSize: 11, fontWeight: "800" },
  infoPanel:          { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, marginTop: 8, marginBottom: 6, padding: 12, borderRadius: 14, backgroundColor: L.primaryBg, borderWidth: 1, borderColor: L.primary + "20" },
  infoIcon:           { width: 32, height: 32, borderRadius: 10, backgroundColor: L.primaryBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.primary + "30" },
  infoTitle:          { color: L.text, fontSize: 12, fontWeight: "800" },
  infoBody:           { color: L.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  infoAction:         { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: L.primary },
  infoActionText:     { color: "#fff", fontSize: 11, fontWeight: "800" },
  memberRail:         { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: L.bg, borderBottomWidth: 1, borderBottomColor: L.border },
  memberMe:           { width: 70, alignItems: "center", gap: 3, borderRightWidth: 1, borderRightColor: L.border, paddingRight: 10 },
  memberList:         { gap: 10 },
  memberItem:         { width: 54, alignItems: "center", gap: 3 },
  memberName:         { color: L.muted, fontSize: 9, fontWeight: "700", textAlign: "center" },
  dashboard:          { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  metric:             { flex: 1, minHeight: 56, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  metricValue:        { fontSize: 18, fontWeight: "900" },
  metricLabel:        { color: L.muted, fontSize: 9, fontWeight: "700" },
  matchStrip:         { gap: 10, paddingBottom: 10 },
  matchCard:          { width: 220, minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 16, backgroundColor: L.primaryBg, borderWidth: 1, borderColor: L.primary + "25",
                        shadowColor: L.primary, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  matchName:          { color: L.text, fontSize: 13, fontWeight: "800" },
  matchScore:         { color: L.primary, fontSize: 11, fontWeight: "800", marginTop: 2 },
  matchReason:        { color: L.muted, fontSize: 10, marginTop: 2 },
});
