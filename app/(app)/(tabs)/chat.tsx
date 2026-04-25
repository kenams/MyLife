import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual, getNpcVisual } from "@/lib/avatar-visual";
import { activities, starterResidents } from "@/lib/game-engine";
import { getBestProfileMatches } from "@/lib/profile-matching";
import { buildSocialHubSnapshot, relationshipScore } from "@/lib/social-hub";
import { colors } from "@/lib/theme";
import type { Conversation, NpcState, Room, RoomMessage } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

type Tab = "contacts" | "rooms" | "lounge";
type IconName = ComponentProps<typeof Ionicons>["name"];

const WIZZ_TOKEN = "[[WIZZ]]";
const EMOJI_SHORTCUTS = ["😀", "😂", "😍", "🔥", "👍", "👀", "💯", "✨", "☕", "🎮", "💬", "❤️"];
const REACTION_SHORTCUTS = ["❤️", "😂", "👍", "🔥"];
const MSN_NUDGES = [
  "Tu es la ?",
  "Reponds quand tu peux.",
  "Je viens d'arriver.",
  "On se capte dans une room ?"
];

function relColor(score: number) {
  if (score >= 60) return colors.accent;
  if (score >= 35) return colors.gold;
  return colors.muted;
}

function Dot({ online }: { online: boolean }) {
  return <View style={[s.dot, { backgroundColor: online ? "#22c55e" : colors.muted }]} />;
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

function PlayerFace({ name, size = 42, visual }: { name?: string; size?: number; visual?: ReturnType<typeof getNpcVisual> | null }) {
  if (visual) {
    return (
      <View style={[s.faceWrap, { width: size, height: size, borderRadius: 12, overflow: "hidden",
        borderWidth: 2, borderColor: colors.accent + "55", backgroundColor: colors.accentGlow }]}>
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
          <View style={s.titleBarAccentLine} />
          {onBack && <Pressable onPress={onBack} style={s.back}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>}
          <View style={s.logo}><Ionicons name="chatbubble-ellipses" size={20} color={colors.accent} /></View>
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

function Status({ text, color = colors.accent }: { text: string; color?: string }) {
  return (
    <View style={[s.status, { backgroundColor: color + "18", borderColor: color + "55" }]}>
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
          <Ionicons name={a.icon} size={21} color={a.active ? colors.accent : "#d7ecff"} />
          <Text style={[s.toolText, a.active && { color: colors.accent }]}>{a.label}</Text>
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

function Composer({ value, change, send, macro, wizz }: { value: string; change: (t: string) => void; send: () => void; macro: (t: string) => void; wizz: () => void }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const buttons: { icon: IconName; text: string; color: string }[] = [
    { icon: "happy", text: "😀", color: colors.gold },
    { icon: "mic", text: "Message vocal rapide.", color: colors.teal },
    { icon: "image", text: "Je partage une image mentale du moment.", color: colors.purple },
    { icon: "game-controller", text: "On lance une activite ensemble ?", color: colors.pink }
  ];
  return (
    <View style={s.composer}>
      <View style={s.formatLine}>
        <Text style={s.bigA}>A</Text>
        <Pressable onPress={() => setEmojiOpen((open) => !open)} style={[s.macro, { backgroundColor: colors.gold + "18", borderColor: colors.gold + "35" }]}>
          <Ionicons name="happy" size={18} color={colors.gold} />
        </Pressable>
        <Pressable onPress={wizz} style={[s.wizzBtn, { backgroundColor: colors.accent + "20", borderColor: colors.accent + "60" }]}>
          <Ionicons name="flash" size={18} color={colors.accent} />
          <Text style={s.wizzBtnText}>Wizz</Text>
        </Pressable>
        {buttons.map((b) => (
          <Pressable key={b.icon} onPress={() => macro(b.text)} style={[s.macro, { backgroundColor: b.color + "18", borderColor: b.color + "35" }]}>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.nudgeBar} contentContainerStyle={s.nudgeBody}>
        {MSN_NUDGES.map((text) => (
          <Pressable key={text} onPress={() => macro(text)} style={s.nudgeChip}>
            <Text style={s.nudgeText}>{text}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.inputLine}>
        <TextInput value={value} onChangeText={change} onSubmitEditing={send} placeholder="Écrire un message…" placeholderTextColor={colors.muted} returnKeyType="send" multiline style={s.input} />
        <Pressable onPress={send} style={s.send}><Ionicons name="send" size={15} color="#04100c" /><Text style={s.sendText}>Envoyer</Text></Pressable>
      </View>
    </View>
  );
}

function Bubble({
  body,
  time,
  me,
  author,
  npc,
  reaction,
  onReact
}: {
  body: string;
  time: string;
  me: boolean;
  author?: string;
  npc?: NpcState | null;
  reaction?: string;
  onReact?: (emoji: string) => void;
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
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true })
    ]).start();
  }, [shake, wizz]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  return (
    <Animated.View style={[s.msgRow, me && { flexDirection: "row-reverse" }, wizz && { transform: [{ translateX }] }]}>
      {!me && (npc ? <NpcFace npc={npc} size={32} /> : <View style={s.anon}><Ionicons name="person" size={16} color={colors.textSoft} /></View>)}
      <View style={s.bubbleCol}>
        {!me && author && <Text style={s.author}>{author}</Text>}
        <Pressable onPress={() => setReactOpen((open) => !open)} onLongPress={() => setReactOpen(true)} style={[s.bubble, me ? s.bubbleMe : s.bubbleOther, wizz && s.wizzBubble]}>
          {wizz && (
            <View style={s.wizzHeader}>
              <Ionicons name="flash" size={15} color="#07111f" />
              <Text style={s.wizzLabel}>WIZZ</Text>
            </View>
          )}
          <Text style={[s.bubbleText, me && { color: "#06243a" }, wizz && s.wizzText]}>{cleanBody}</Text>
          <Text style={[s.time, me && { color: "#365870", textAlign: "right" }]}>{time}</Text>
        </Pressable>
        {(reactOpen || reaction) && (
          <View style={[s.reactionLine, me && { justifyContent: "flex-end" }]}>
            {REACTION_SHORTCUTS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  onReact?.(reaction === emoji ? "" : emoji);
                  setReactOpen(false);
                }}
                style={[s.reactionBtn, reaction === emoji && s.reactionBtnActive]}
              >
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
        {me && <Text style={[s.delivery, { textAlign: "right" }]}>envoye</Text>}
      </View>
    </Animated.View>
  );
}

function TypingIndicator({ name }: { name: string }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 520, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={s.typingRow}>
      <Animated.View style={[s.typingBubble, { opacity: pulse }]}>
        <View style={s.typingDots}>
          {[0, 1, 2].map((dot) => <View key={dot} style={s.typingDot} />)}
        </View>
        <Text style={s.typingText}>{name} ecrit...</Text>
      </Animated.View>
    </View>
  );
}

function InfoPanel({ icon, title, body, action, onPress }: { icon: IconName; title: string; body: string; action?: string; onPress?: () => void }) {
  return (
    <View style={s.infoPanel}>
      <View style={s.infoIcon}><Ionicons name={icon} size={18} color={colors.accent} /></View>
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
      <View style={s.memberMe}><PlayerFace name={me} size={34} /><Text style={s.memberName} numberOfLines={1}>{me}</Text></View>
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
  const sendMessage = useGameStore((x) => x.sendMessage);
  const markConversationRead = useGameStore((x) => x.markConversationRead);
  const avatar = useGameStore((x) => x.avatar);
  const session = useGameStore((x) => x.session);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const scroll = useRef<ScrollView>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const info = npc ? starterResidents.find((r) => r.id === npc.id) : null;
  const name = info?.name ?? conv.title;
  const me = avatar?.displayName ?? "Moi";
  const myId = session?.email ?? "local";

  useEffect(() => { markConversationRead(conv.id); setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 80); }, [conv.id, markConversationRead]);
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
  function sendWizz() { post(`${WIZZ_TOKEN} Wizz ! ${name.split(" ")[0]}, tu es la ?`); }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Win title="MSN MyLife 2026" subtitle={`To: ${name}`} onBack={back} right={<Status text={npc?.presenceOnline ? "En ligne" : "Absent"} color={npc?.presenceOnline ? "#22c55e" : colors.gold} />}>
        <Tools actions={[
          { label: "Inviter", icon: "person-add", active: true, onPress: () => post("Tu veux me rejoindre dans une room live ?") },
          { label: "Fichiers", icon: "folder-open", onPress: () => post("Je t'envoie une idee a tester plus tard.") },
          { label: "Video", icon: "videocam", onPress: () => post("On lance un appel video quand tu es dispo ?") },
          { label: "Wizz", icon: "flash", active: true, onPress: sendWizz },
          { label: "Vocal", icon: "mic", onPress: () => post("Message vocal rapide : je suis connecte.") },
          { label: "Activites", icon: "sparkles", onPress: () => post("On lance une activite ensemble ?") },
          { label: "Jeux", icon: "game-controller", onPress: () => post("Petit defi social : on teste une sortie ?") }
        ]} />
        <Text style={s.roomTitle} numberOfLines={1}>Conversation privee avec {name}</Text>
        <InfoPanel
          icon={npc?.presenceOnline ? "flash" : "time"}
          title={npc?.presenceOnline ? "Contact disponible maintenant" : "Contact absent"}
          body={info?.bio ?? "Conversation privee. Utilise les actions MSN pour proposer une room, une activite ou un message rapide."}
          action="Room"
          onPress={() => post("Je cree une room live, tu me rejoins ?")}
        />
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={s.msgList} showsVerticalScrollIndicator={false}>
          {conv.messages.length === 0 && <Text style={s.empty}>Aucun message. Commence avec une phrase simple ou un Wizz.</Text>}
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
                onReact={(emoji) => setReactions((current) => ({ ...current, [m.id]: emoji }))}
              />
            );
          })}
          {typing && <TypingIndicator name={name.split(" ")[0]} />}
        </ScrollView>
        <Quick items={[`Salut ${name.split(" ")[0]}, c'est ${me}. Tu es dispo ?`, "Tu fais quoi en ce moment ? 😀", "On se retrouve dans une room live ? 🔥", "Je t'invite pour un cafe ☕"]} pick={post} />
        <Composer value={input} change={setInput} send={send} macro={post} wizz={sendWizz} />
      </Win>
    </KeyboardAvoidingView>
  );
}

function RoomView({ id, name, back }: { id: string; name: string; back: () => void }) {
  const sendRoomMessage = useGameStore((x) => x.sendRoomMessage);
  const messages = useGameStore((x) => x.roomMessages[id] ?? []);
  const npcs = useGameStore((x) => x.npcs);
  const rooms = useGameStore((x) => x.rooms);
  const avatar = useGameStore((x) => x.avatar);
  const session = useGameStore((x) => x.session);
  const inviteNpcToRoom = useGameStore((x) => x.inviteNpcToRoom);
  const room = rooms.find((r) => r.id === id);
  const online = npcs.filter((n) => n.presenceOnline);
  const me = avatar?.displayName ?? "Moi";
  const myId = session?.email ?? "local";
  const [input, setInput] = useState("");
  const [invite, setInvite] = useState(false);
  const [typing, setTyping] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const scroll = useRef<ScrollView>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  function sendWizz() { post(`${WIZZ_TOKEN} Wizz collectif ! Qui est la ?`); }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Win title="MSN Room 2026" subtitle={`To: ${name}`} onBack={back} right={<Status text={`${online.length + 1} live`} color={colors.teal} />}>
        <Tools actions={[
          { label: "Inviter", icon: "person-add", active: true, onPress: () => room?.kind === "private" ? setInvite((v) => !v) : post("Qui veut rejoindre une room privee avec moi ?") },
          { label: "Code", icon: "key", onPress: () => room?.code && post(`Code room: ${room.code}`) },
          { label: "Wizz", icon: "flash", active: true, onPress: sendWizz },
          { label: "Vocal", icon: "mic", onPress: () => post("Message vocal de groupe : je suis connecte.") },
          { label: "Live", icon: "radio", onPress: () => post("Live check : qui est present maintenant ?") },
          { label: "Activites", icon: "sparkles", onPress: () => post("On lance une activite de groupe ?") },
          { label: "Jeux", icon: "game-controller", onPress: () => post("Mini-jeu social : chacun propose une sortie.") }
        ]} />
        {invite && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.invites} contentContainerStyle={{ gap: 12, padding: 12 }}>{online.map((n) => <Pressable key={n.id} onPress={() => { inviteNpcToRoom(id, n.id); setInvite(false); }} style={s.inviteNpc}><NpcFace npc={n} size={42} /><Text style={s.inviteText} numberOfLines={1}>{n.name.split(" ")[0]}</Text></Pressable>)}</ScrollView>}
        <MemberRail me={me} online={online} invite={(npcId) => inviteNpcToRoom(id, npcId)} />
        <Text style={s.roomTitle} numberOfLines={1}>{room?.description ?? "Chat groupe live"} {room?.code ? `- #${room.code}` : ""}</Text>
        <InfoPanel
          icon="radio"
          title={room?.kind === "private" ? "Room privee active" : "Room publique live"}
          body="Les messages partent dans la room. Les residents peuvent repondre automatiquement et rejoindre si tu les invites."
          action={room?.code ? `#${room.code}` : "Live"}
          onPress={() => room?.code ? post(`Code room: ${room.code}`) : post("Live check : qui est present ?")}
        />
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={s.msgList} showsVerticalScrollIndicator={false}>
          {messages.length === 0 && <Text style={s.empty}>La room est ouverte. Ecris ou invite un contact.</Text>}
          {messages.map((m) => {
            const isMe = m.authorId === myId || m.authorId === "local" || m.authorName === me;
            const npc = npcs.find((n) => n.id === m.authorId) ?? null;
            if (m.kind === "system") return <Text key={m.id} style={s.systemGold}>{m.body}</Text>;
            return (
              <Bubble
                key={m.id}
                body={m.body}
                time={new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                me={isMe}
                author={m.authorName}
                npc={npc}
                reaction={reactions[m.id]}
                onReact={(emoji) => setReactions((current) => ({ ...current, [m.id]: emoji }))}
              />
            );
          })}
          {typing && <TypingIndicator name={online[0]?.name.split(" ")[0] ?? "La room"} />}
        </ScrollView>
        <Quick items={["Salut la room, qui est dispo ? 😀", "Je viens d'arriver, on discute ?", "On lance une activite de groupe ? 🎮", "Qui est dans ce lieu en live ? 👀"]} pick={post} />
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
        <View style={s.rowTop}><Text style={s.rowTitle} numberOfLines={1}>{c.title}</Text>{last && <Text style={s.rowTime}>{new Date(last.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</Text>}</View>
        <Text style={{ color: npc?.presenceOnline ? colors.accent : colors.muted, fontSize: 10, fontWeight: "800" }} numberOfLines={1}>{npc?.presenceOnline ? "En ligne" : score !== undefined ? `Lien ${score}%` : c.subtitle}</Text>
        <Text style={s.preview} numberOfLines={1}>{last?.body ?? "Commencer une conversation"}</Text>
      </View>
      {score !== undefined && <View style={s.relTrack}><View style={{ height: 4, width: `${Math.min(100, score)}%`, backgroundColor: relColor(score) }} /></View>}
      {c.unreadCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{c.unreadCount}</Text></View>}
    </Pressable>
  );
}

function RoomRow({ room, last, open }: { room: Room; last?: RoomMessage; open: () => void }) {
  const privateRoom = room.kind === "private";
  return (
    <Pressable onPress={open} style={[s.rowCard, privateRoom && { backgroundColor: colors.purpleGlow, borderColor: colors.purple + "40" }]}>
      <View style={[s.roomIcon, { backgroundColor: privateRoom ? colors.purple + "22" : colors.accent + "18", borderColor: privateRoom ? colors.purple + "50" : colors.accent + "40" }]}><Ionicons name={privateRoom ? "lock-closed" : "people"} size={22} color={privateRoom ? colors.purple : colors.accent} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.rowTop}><Text style={s.rowTitle} numberOfLines={1}>{room.name}</Text>{room.code && <Text style={s.code}>#{room.code}</Text>}</View>
        <Text style={s.rowMeta}>{room.memberCount}/{room.maxMembers} membres - {room.kind}</Text>
        <Text style={s.preview} numberOfLines={1}>{last?.body ?? room.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

export default function ChatScreen() {
  const conversations = useGameStore((x) => x.conversations);
  const npcs = useGameStore((x) => x.npcs);
  const relationships = useGameStore((x) => x.relationships);
  const rooms = useGameStore((x) => x.rooms);
  const joinedRooms = useGameStore((x) => x.joinedRooms);
  const roomInvites = useGameStore((x) => x.roomInvites);
  const createPrivateRoom = useGameStore((x) => x.createPrivateRoom);
  const respondRoomInvite = useGameStore((x) => x.respondRoomInvite);
  const invitations = useGameStore((x) => x.invitations);
  const respondInvitation = useGameStore((x) => x.respondInvitation);
  const startDirectConversation = useGameStore((x) => x.startDirectConversation);
  const avatar = useGameStore((x) => x.avatar);
  const roomMessages = useGameStore((x) => x.roomMessages);
  const [tab, setTab] = useState<Tab>("contacts");
  const [convId, setConvId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => { fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [tab, fade]);

  const openConv = conversations.find((c) => c.id === convId);
  if (convId && openConv) return <ConversationView conv={openConv} npc={openConv.peerId ? npcs.find((n) => n.id === openConv.peerId) ?? null : null} back={() => setConvId(null)} />;
  if (roomId) {
    const room = rooms.find((r) => r.id === roomId);
    return <RoomView id={roomId} name={room?.name ?? "Room"} back={() => setRoomId(null)} />;
  }

  const hub = buildSocialHubSnapshot({
    avatar,
    conversations,
    npcs,
    relationships,
    rooms,
    joinedRooms,
    roomInvites,
    invitations,
    roomMessages
  });
  const online = hub.onlineNpcs;
  const sorted = hub.sortedConversations;
  const myRooms = hub.myRooms;
  const otherRooms = hub.otherRooms;
  const pendingRooms = hub.pendingRoomInvites;
  const pendingInvites = hub.pendingInvitations;
  const unread = hub.unreadTotal;
  const loungeLast = hub.loungeLastMessage;
  const topMatches = getBestProfileMatches(avatar, starterResidents, relationships).slice(0, 3);
  const tabMeta: Record<Tab, { label: string; icon: IconName; badge: number }> = {
    contacts: { label: "Contacts", icon: "person", badge: unread },
    rooms: { label: "Rooms", icon: "people", badge: pendingRooms.length },
    lounge: { label: "Ville", icon: "globe", badge: 0 }
  };

  function makeRoom() {
    const room = createPrivateRoom(roomName.trim() || "MSN Room privee");
    setRoomName("");
    setCreateOpen(false);
    setRoomId(room.id);
  }

  function openMatch(residentId: string, residentName: string) {
    const existing = conversations.find((conversation) => conversation.kind === "direct" && conversation.peerId === residentId);
    startDirectConversation(residentId, residentName);
    setConvId(existing?.id ?? `dm-${residentId}`);
  }

  return (
    <Win title="MSN MyLife 2026" subtitle={`${online.length} contacts en ligne - ${unread ? `${unread} non lu(s)` : "tout est lu"}`} right={<PlayerFace name={avatar?.displayName} visual={avatar ? getAvatarVisual(avatar) : null} size={38} />}>
      <View style={s.hub}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shortcuts}>
          <Pressable onPress={() => router.push("/(app)/(tabs)/world")} style={[s.shortcut, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "38" }]}><Ionicons name="map" size={18} color={colors.accent} /><Text style={[s.shortcutText, { color: colors.accent }]}>World live</Text></Pressable>
          <Pressable onPress={() => setRoomId("room-lounge-global")} style={[s.shortcut, { backgroundColor: colors.teal + "16", borderColor: colors.teal + "34" }]}><Ionicons name="radio" size={18} color={colors.teal} /><Text style={[s.shortcutText, { color: colors.teal }]}>Live chat</Text></Pressable>
          <Pressable onPress={() => { const room = createPrivateRoom("Room groupe MSN"); setRoomId(room.id); }} style={[s.shortcut, { backgroundColor: colors.purpleGlow, borderColor: colors.purple + "38" }]}><Ionicons name="add-circle" size={18} color={colors.purple} /><Text style={[s.shortcutText, { color: colors.purple }]}>Groupe</Text></Pressable>
        </ScrollView>
        <View style={s.dashboard}>
          <View style={s.metric}><Text style={s.metricValue}>{online.length}</Text><Text style={s.metricLabel}>en ligne</Text></View>
          <View style={s.metric}><Text style={s.metricValue}>{unread}</Text><Text style={s.metricLabel}>non lus</Text></View>
          <View style={s.metric}><Text style={s.metricValue}>{myRooms.length}</Text><Text style={s.metricLabel}>rooms</Text></View>
          <View style={s.metric}><Text style={s.metricValue}>{pendingInvites.length + pendingRooms.length}</Text><Text style={s.metricLabel}>invites</Text></View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.onlineStrip}>
          {online.map((npc) => {
            const c = conversations.find((conv) => conv.peerId === npc.id);
            const score = relationshipScore(relationships, npc.id);
            return <Pressable key={npc.id} onPress={() => c && setConvId(c.id)} style={s.onlineItem}><NpcFace npc={npc} size={48} /><Text style={{ color: score >= 40 ? colors.accent : colors.textSoft, fontSize: 10, fontWeight: "900" }} numberOfLines={1}>{npc.name.split(" ")[0]}</Text></Pressable>;
          })}
        </ScrollView>
        <View style={s.tabs}>{(["contacts", "rooms", "lounge"] as Tab[]).map((key) => <Pressable key={key} onPress={() => setTab(key)} style={[s.tab, tab === key && s.tabActive]}><Ionicons name={tabMeta[key].icon} size={15} color={tab === key ? colors.accent : colors.muted} /><Text style={{ color: tab === key ? colors.accent : colors.muted, fontSize: 12, fontWeight: "900" }}>{tabMeta[key].label}</Text>{tabMeta[key].badge > 0 && <View style={s.tabBadge}><Text style={s.badgeText}>{tabMeta[key].badge}</Text></View>}</Pressable>)}</View>
      </View>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {(pendingInvites.length > 0 || pendingRooms.length > 0) && <View style={s.inviteBox}>
            <Text style={s.inviteTitle}>Invitations en attente</Text>
            {pendingInvites.map((i) => <View key={i.id} style={s.inviteLine}><Text style={s.inviteBody}>{i.residentName} propose {activities.find((a) => a.slug === i.activitySlug)?.name ?? i.activitySlug}</Text><Pressable onPress={() => respondInvitation(i.id, "accepted")} style={s.ok}><Ionicons name="checkmark" size={16} color={colors.accent} /></Pressable><Pressable onPress={() => respondInvitation(i.id, "declined")} style={s.no}><Ionicons name="close" size={16} color={colors.danger} /></Pressable></View>)}
            {pendingRooms.map((i) => <View key={i.id} style={s.inviteLine}><Text style={s.inviteBody}>{i.fromName} t'invite dans {i.roomName}</Text><Pressable onPress={() => respondRoomInvite(i.id, "accepted")} style={s.ok}><Ionicons name="checkmark" size={16} color={colors.accent} /></Pressable><Pressable onPress={() => respondRoomInvite(i.id, "declined")} style={s.no}><Ionicons name="close" size={16} color={colors.danger} /></Pressable></View>)}
          </View>}
          {tab === "contacts" && <View>
            <Text style={s.section}>MATCHS A CONTACTER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.matchStrip}>
              {topMatches.map((match) => {
                const npc = npcs.find((item) => item.id === match.resident.id) ?? null;
                return (
                  <Pressable key={match.resident.id} onPress={() => openMatch(match.resident.id, match.resident.name)} style={s.matchCard}>
                    {npc ? <NpcFace npc={npc} size={42} /> : <PlayerFace name={match.resident.name} size={42} />}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.matchName} numberOfLines={1}>{match.resident.name}</Text>
                      <Text style={s.matchScore}>Match {match.score}%</Text>
                      <Text style={s.matchReason} numberOfLines={1}>{match.reasons[0]}</Text>
                    </View>
                    <Ionicons name="chatbubble-ellipses" size={17} color={colors.accent} />
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={s.section}>CONTACTS EN LIGNE</Text>
            {hub.friendOnline.length === 0 && <InfoPanel icon="person" title="Aucun proche en ligne" body="Les autres contacts restent accessibles dans Messages. Le lounge permet aussi de trouver du monde." action="Lounge" onPress={() => setRoomId("room-lounge-global")} />}
            {hub.friendOnline.map((npc) => {
              const c = conversations.find((conv) => conv.peerId === npc.id);
              const score = relationships.find((r) => r.residentId === npc.id)?.score;
              return c ? <ContactRow key={npc.id} c={c} npc={npc} score={score} open={() => setConvId(c.id)} /> : null;
            })}
            <Text style={s.section}>MESSAGES</Text>
            {sorted.map((c) => {
              const npc = c.peerId ? npcs.find((n) => n.id === c.peerId) ?? null : null;
              const score = c.peerId ? relationships.find((r) => r.residentId === c.peerId)?.score : undefined;
              return <ContactRow key={c.id} c={c} npc={npc} score={score} open={() => setConvId(c.id)} />;
            })}
          </View>}
          {tab === "rooms" && <View>
            <View style={s.createBox}>{!createOpen ? <Pressable onPress={() => setCreateOpen(true)} style={s.createBtn}><Ionicons name="add-circle" size={20} color={colors.accent} /><Text style={s.createText}>Creer une room groupee</Text></Pressable> : <View style={{ gap: 10 }}><TextInput value={roomName} onChangeText={setRoomName} placeholder="Nom de la room" placeholderTextColor={colors.muted} style={s.createInput} /><View style={{ flexDirection: "row", gap: 8 }}><Pressable onPress={makeRoom} style={s.createOk}><Text style={s.createOkText}>Creer</Text></Pressable><Pressable onPress={() => { setCreateOpen(false); setRoomName(""); }} style={s.createCancel}><Text style={s.createCancelText}>Annuler</Text></Pressable></View></View>}</View>
            <Text style={s.section}>MES ROOMS LIVE</Text>{myRooms.map((r) => <RoomRow key={r.id} room={r} last={(roomMessages[r.id] ?? []).at(-1)} open={() => setRoomId(r.id)} />)}
            {myRooms.length === 0 && <InfoPanel icon="people" title="Pas encore de room active" body="Cree une room groupee pour inviter des contacts et tester le chat live." action="Creer" onPress={makeRoom} />}
            <Text style={s.section}>REJOINDRE UNE ROOM</Text>{otherRooms.map((r) => <RoomRow key={r.id} room={r} last={(roomMessages[r.id] ?? []).at(-1)} open={() => setRoomId(r.id)} />)}
          </View>}
          {tab === "lounge" && <View>
            <View style={s.loungeCard}><Ionicons name="globe" size={30} color={colors.teal} /><Text style={s.loungeTitle}>Lounge ville</Text><Text style={s.loungeBody}>Chat public, residents, rooms et presence live.</Text>{loungeLast && <Text style={s.loungeLast} numberOfLines={2}>{loungeLast.authorName}: {loungeLast.body}</Text>}<Pressable onPress={() => setRoomId("room-lounge-global")} style={s.loungeBtn}><Ionicons name="enter" size={18} color="#05211a" /><Text style={s.loungeBtnText}>Entrer dans le lounge</Text></Pressable></View>
            <Text style={s.section}>DERNIERS MESSAGES PUBLICS</Text>{(roomMessages["room-lounge-global"] ?? []).slice(-10).reverse().map((m) => m.kind === "system" ? null : <View key={m.id} style={s.publicMsg}><Text style={s.publicAuthor}>{m.authorName}</Text><Text style={s.preview} numberOfLines={2}>{m.body}</Text></View>)}
          </View>}
        </ScrollView>
      </Animated.View>
    </Win>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  win: { flex: 1, backgroundColor: "#06101f" },
  titleBar: { paddingTop: 44, paddingBottom: 10, paddingHorizontal: 14, backgroundColor: "#060d18", flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  titleBarAccentLine: { position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: colors.accent },
  back: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  logo: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.accent + "18", borderWidth: 1, borderColor: colors.accent + "40", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 17, fontWeight: "900" },
  subtitle: { color: colors.textSoft, fontSize: 11, fontWeight: "700" },
  status: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: "900" },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.bg },
  dotAbs: { position: "absolute", right: 0, bottom: 0 },
  faceWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  playerFace: { borderRadius: 12, backgroundColor: "#0f1e30", borderWidth: 2, borderColor: colors.accent + "60", alignItems: "center", justifyContent: "center" },
  playerInitial: { color: colors.accent, fontSize: 14, fontWeight: "900" },
  tools: { backgroundColor: "#eaf6ff12", borderBottomWidth: 1, borderBottomColor: colors.border },
  toolsBody: { paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  toolBtn: { width: 74, minHeight: 58, borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#ffffff10", borderWidth: 1, borderColor: "#ffffff18" },
  toolBtnActive: { backgroundColor: colors.accent + "20", borderColor: colors.accent + "55" },
  toolText: { color: colors.textSoft, fontSize: 10, fontWeight: "800", textAlign: "center" },
  quick: { backgroundColor: "#f3f8ff10", borderTopWidth: 1, borderTopColor: colors.border },
  quickBody: { gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "#d8f0ff16", borderWidth: 1, borderColor: "#9ed9ff38" },
  quickText: { color: "#bfe6ff", fontSize: 12, fontWeight: "800" },
  composer: { backgroundColor: "#eaf6ff12", borderTopWidth: 1, borderTopColor: colors.border },
  formatLine: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  bigA: { color: "#d7ecff", fontSize: 18, fontWeight: "900" },
  macro: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  wizzBtn: { height: 34, borderRadius: 11, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, flexDirection: "row", gap: 5 },
  wizzBtnText: { color: colors.accent, fontSize: 11, fontWeight: "900" },
  emojiTray: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingHorizontal: 12, paddingBottom: 8 },
  emojiBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff14", borderWidth: 1, borderColor: "#ffffff20" },
  emojiText: { fontSize: 18 },
  nudgeBar: { borderTopWidth: 1, borderTopColor: "#ffffff10" },
  nudgeBody: { gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  nudgeChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 13, backgroundColor: "#ffffff0d", borderWidth: 1, borderColor: "#ffffff18" },
  nudgeText: { color: colors.textSoft, fontSize: 11, fontWeight: "800" },
  inputLine: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 12, paddingBottom: 10 },
  input: { flex: 1, minHeight: 44, maxHeight: 110, backgroundColor: "#0f1a2e", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.accent + "44" },
  send: { width: 78, height: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  sendText: { color: "#05211a", fontSize: 12, fontWeight: "900" },
  msgList: { padding: 16, gap: 10 },
  msgRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  anon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#ffffff12", alignItems: "center", justifyContent: "center" },
  bubbleCol: { maxWidth: "78%", gap: 3 },
  author: { color: colors.accent, fontSize: 10, fontWeight: "900", marginLeft: 6 },
  bubble: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  bubbleMe: { backgroundColor: "#dff4ff", borderColor: "#9ed9ff", borderBottomRightRadius: 5 },
  bubbleOther: { backgroundColor: "#0f2136", borderColor: "#ffffff14", borderBottomLeftRadius: 5 },
  wizzBubble: { backgroundColor: "#f6b94f", borderColor: "#fff0a8", shadowColor: "#f6b94f", shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 },
  wizzHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  wizzLabel: { color: "#07111f", fontSize: 10, fontWeight: "900" },
  wizzText: { color: "#07111f", fontWeight: "900" },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  time: { color: colors.muted, fontSize: 9, marginTop: 5 },
  delivery: { color: colors.muted, fontSize: 9, marginTop: 2, paddingHorizontal: 6 },
  reactionLine: { flexDirection: "row", gap: 5, marginTop: 5 },
  reactionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#ffffff10", borderWidth: 1, borderColor: "#ffffff22", alignItems: "center", justifyContent: "center" },
  reactionBtnActive: { backgroundColor: colors.accent + "20", borderColor: colors.accent + "65" },
  reactionBadge: { marginTop: -4, minWidth: 30, height: 24, borderRadius: 12, backgroundColor: "#ffffffee", borderWidth: 1, borderColor: "#9ed9ff", alignItems: "center", justifyContent: "center", paddingHorizontal: 7, alignSelf: "flex-start" },
  reactionText: { fontSize: 14 },
  typingRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  typingBubble: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "#0f2136", borderWidth: 1, borderColor: "#ffffff14", alignSelf: "flex-start" },
  typingDots: { flexDirection: "row", gap: 3 },
  typingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  typingText: { color: colors.textSoft, fontSize: 11, fontWeight: "800" },
  roomTitle: { color: colors.textSoft, fontSize: 12, fontWeight: "800", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#eaf6ff10" },
  system: { color: colors.muted, fontSize: 11, textAlign: "center" },
  systemGold: { color: colors.gold, fontSize: 11, textAlign: "center" },
  empty: { color: colors.muted, textAlign: "center", marginTop: 30 },
  invites: { backgroundColor: "#eaf6ff12", borderBottomWidth: 1, borderBottomColor: colors.border },
  inviteNpc: { width: 62, alignItems: "center", gap: 4 },
  inviteText: { color: colors.textSoft, fontSize: 10, fontWeight: "800" },
  hub: { backgroundColor: "#060d18", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  shortcuts: { paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  shortcut: { minWidth: 116, borderRadius: 14, padding: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  shortcutText: { fontSize: 12, fontWeight: "900" },
  onlineStrip: { paddingHorizontal: 14, paddingBottom: 12, gap: 14 },
  onlineItem: { alignItems: "center", gap: 4, width: 58 },
  tabs: { flexDirection: "row", paddingHorizontal: 12, gap: 6 },
  tab: { flex: 1, paddingVertical: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, position: "relative" },
  tabActive: { borderBottomWidth: 3, borderBottomColor: colors.accent },
  tabBadge: { position: "absolute", top: 5, right: 14, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  inviteBox: { backgroundColor: colors.goldGlow, borderRadius: 15, borderWidth: 1, borderColor: colors.gold + "44", padding: 12, gap: 9, marginBottom: 14 },
  inviteTitle: { color: colors.gold, fontSize: 12, fontWeight: "900" },
  inviteLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  inviteBody: { color: colors.textSoft, fontSize: 12, flex: 1 },
  ok: { padding: 8, borderRadius: 9, backgroundColor: colors.accent + "18" },
  no: { padding: 8, borderRadius: 9, backgroundColor: colors.dangerGlow },
  section: { color: colors.textSoft, fontSize: 11, fontWeight: "900", marginTop: 8, marginBottom: 8 },
  rowCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, backgroundColor: "#ffffff08", borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  rowUnread: { backgroundColor: "#eaf6ff16", borderColor: "#9ed9ff44" },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: "900", flex: 1 },
  rowTime: { color: colors.muted, fontSize: 10 },
  rowMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  preview: { color: colors.textSoft, fontSize: 12, marginTop: 4 },
  relTrack: { width: 46, height: 4, borderRadius: 999, backgroundColor: "#ffffff18", overflow: "hidden" },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  roomIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  code: { color: colors.gold, fontSize: 10, fontWeight: "900" },
  createBox: { backgroundColor: "#ffffff08", borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 14 },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.accent + "18", borderRadius: 13, padding: 13, borderWidth: 1, borderColor: colors.accent + "40" },
  createText: { color: colors.accent, fontSize: 13, fontWeight: "900" },
  createInput: { backgroundColor: "#0f1a2e", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: colors.text, borderWidth: 1, borderColor: colors.accent + "44" },
  createOk: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", backgroundColor: colors.accent },
  createOkText: { color: "#05211a", fontSize: 12, fontWeight: "900" },
  createCancel: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", backgroundColor: "#ffffff10" },
  createCancelText: { color: colors.textSoft, fontSize: 12, fontWeight: "800" },
  loungeCard: { backgroundColor: "#0b2338", borderRadius: 18, borderWidth: 1, borderColor: "#67d8ff44", padding: 16, marginBottom: 14, gap: 10, alignItems: "flex-start" },
  loungeTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  loungeBody: { color: colors.textSoft, fontSize: 12 },
  loungeLast: { color: colors.textSoft, fontSize: 13, backgroundColor: "#ffffff0d", borderRadius: 12, padding: 10, alignSelf: "stretch" },
  loungeBtn: { borderRadius: 13, backgroundColor: colors.accent, padding: 13, alignSelf: "stretch", alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  loungeBtnText: { color: "#05211a", fontSize: 13, fontWeight: "900" },
  publicMsg: { padding: 11, borderRadius: 13, backgroundColor: "#ffffff08", borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  publicAuthor: { color: colors.accent, fontSize: 11, fontWeight: "900" },
  infoPanel: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, marginTop: 10, marginBottom: 6, padding: 11, borderRadius: 14, backgroundColor: "#ffffff08", borderWidth: 1, borderColor: "#ffffff12" },
  infoIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.accent + "18", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.accent + "35" },
  infoTitle: { color: colors.text, fontSize: 12, fontWeight: "900" },
  infoBody: { color: colors.textSoft, fontSize: 11, lineHeight: 16, marginTop: 2 },
  infoAction: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.accent + "18", borderWidth: 1, borderColor: colors.accent + "35" },
  infoActionText: { color: colors.accent, fontSize: 11, fontWeight: "900" },
  memberRail: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#ffffff08", borderBottomWidth: 1, borderBottomColor: colors.border },
  memberMe: { width: 74, alignItems: "center", gap: 3, borderRightWidth: 1, borderRightColor: colors.border, paddingRight: 10 },
  memberList: { gap: 10 },
  memberItem: { width: 58, alignItems: "center", gap: 3 },
  memberName: { color: colors.textSoft, fontSize: 10, fontWeight: "800", textAlign: "center" },
  dashboard: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  metric: { flex: 1, minHeight: 60, borderRadius: 14, backgroundColor: colors.accentGlow, borderWidth: 1, borderColor: colors.accent + "28", alignItems: "center", justifyContent: "center", gap: 2 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: "900" },
  metricLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  matchStrip: { gap: 10, paddingBottom: 10 },
  matchCard: { width: 224, minHeight: 78, flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 15, backgroundColor: colors.accent + "10", borderWidth: 1, borderColor: colors.accent + "32" },
  matchName: { color: colors.text, fontSize: 13, fontWeight: "900" },
  matchScore: { color: colors.accent, fontSize: 11, fontWeight: "900", marginTop: 2 },
  matchReason: { color: colors.textSoft, fontSize: 10, marginTop: 2 }
});
