/**
 * Neo Paris — Carte Ville Immersive
 * Grille de quartiers live : présence NPCs, néons, interactions directes
 */
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Easing, KeyboardAvoidingView,
  Platform, Pressable, ScrollView,
  Text, TextInput, View,
} from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getNpcVisual } from "@/lib/avatar-visual";
import {
  getNpcActivityResponse, getNpcDialogue,
  getNpcEmoteReaction, PROPOSABLE_ACTIVITIES, QUICK_EMOTES,
} from "@/lib/npc-dialogue";
import { colors } from "@/lib/theme";
import type { NpcState } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

// ─── Districts ────────────────────────────────────────────────────────────────
type District = {
  slug:    string;
  label:   string;
  emoji:   string;
  desc:    string;
  color:   string;
  neon:    string;
  span?:   "wide" | "tall";
};

const DISTRICTS: District[] = [
  { slug: "home",       label: "Résidences",    emoji: "🏠", desc: "Quartier calme · Vie quotidienne",   color: "#0d1e3c", neon: "#60a5fa" },
  { slug: "office",     label: "Tour Affaires",  emoji: "💼", desc: "Business · Networking · Carrière",   color: "#0a1530", neon: "#8b7cff" },
  { slug: "market",     label: "Grand Marché",   emoji: "🛒", desc: "Shopping · Alimentation · Échanges", color: "#062415", neon: "#38c793" },
  { slug: "cafe",       label: "Café Social",    emoji: "☕", desc: "Détente · Rencontres · Convivialité", color: "#2a1000", neon: "#f6b94f", span: "wide" },
  { slug: "park",       label: "Parc Riverside", emoji: "🌳", desc: "Nature · Sport · Bien-être",         color: "#040c04", neon: "#4ade80" },
  { slug: "gym",        label: "Gym Pulse",      emoji: "💪", desc: "Fitness · Énergie · Performance",    color: "#1e0505", neon: "#f87171" },
  { slug: "restaurant", label: "Restaurant",     emoji: "🍽️", desc: "Gastronomie · Dates · Sorties",      color: "#250510", neon: "#f472b6" },
  { slug: "cinema",     label: "Cinéma Luma",    emoji: "🎬", desc: "Culture · Divertissement · Art",     color: "#030318", neon: "#818cf8" },
  { slug: "club",       label: "Club Nuit",      emoji: "🎵", desc: "Soirées · Ambiance · Liberté",       color: "#120020", neon: "#c084fc", span: "wide" },
];

// NPC accent colors
const NPC_COLORS: Record<string, string> = {
  ava: "#38c793", malik: "#60a5fa", noa: "#f472b6",
  leila: "#84cc16", yan: "#f6b94f", sana: "#8b7cff",
};

function npcColor(id: string) {
  return NPC_COLORS[id] ?? colors.accent;
}

// ─── NPC dot ─────────────────────────────────────────────────────────────────
function NpcDot({ npc, onPress }: { npc: NpcState; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!npc.presenceOnline) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.25, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [npc.presenceOnline, pulse]);

  const c = npcColor(npc.id);
  return (
    <Pressable onPress={onPress}>
      <Animated.View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: c + (npc.presenceOnline ? "22" : "0a"),
        borderWidth: 1.5,
        borderColor: npc.presenceOnline ? c : c + "30",
        alignItems: "center", justifyContent: "center",
        transform: [{ scale: pulse }],
        shadowColor: c, shadowOpacity: npc.presenceOnline ? 0.6 : 0, shadowRadius: 6,
      }}>
        <View style={{ transform: [{ scale: 0.7 }] }}>
          <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action as never} size="xs" />
        </View>
        {!npc.presenceOnline && (
          <View style={{ position: "absolute", bottom: 0, right: 0,
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: "#666", borderWidth: 1, borderColor: "#0a0f1a" }} />
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── District card ────────────────────────────────────────────────────────────
function DistrictCard({
  district, npcsHere, isCurrentLocation, onTravel, onNpcPress,
}: {
  district: District;
  npcsHere: NpcState[];
  isCurrentLocation: boolean;
  onTravel: () => void;
  onNpcPress: (npc: NpcState) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onlineCount = npcsHere.filter((n) => n.presenceOnline).length;
  const glow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!isCurrentLocation) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1,   duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.4, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isCurrentLocation, glow]);

  function pressIn()  { Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start(); }
  function pressOut() { Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 60 }).start(); }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], flex: district.span === "wide" ? 2 : 1, minWidth: 150 }}>
      <Pressable onPress={onTravel} onPressIn={pressIn} onPressOut={pressOut} style={{
        flex: 1,
        backgroundColor: district.color,
        borderRadius: 18,
        borderWidth: isCurrentLocation ? 1.5 : 1,
        borderColor: isCurrentLocation ? district.neon : district.neon + "25",
        padding: 14,
        gap: 10,
        overflow: "hidden",
        shadowColor: district.neon,
        shadowOpacity: isCurrentLocation ? 0.35 : 0.1,
        shadowRadius: 12,
      }}>
        {/* Neon glow top */}
        <Animated.View style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          backgroundColor: district.neon,
          opacity: isCurrentLocation ? glow : 0.2,
        }} />

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <View style={{
            width: 42, height: 42, borderRadius: 12,
            backgroundColor: district.neon + "18",
            borderWidth: 1, borderColor: district.neon + "40",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 22 }}>{district.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>
              {district.label}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 9, marginTop: 1 }}>
              {district.desc}
            </Text>
          </View>
          {isCurrentLocation && (
            <View style={{
              backgroundColor: district.neon + "20",
              borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
              borderWidth: 1, borderColor: district.neon + "60",
            }}>
              <Text style={{ color: district.neon, fontSize: 8, fontWeight: "900" }}>ICi</Text>
            </View>
          )}
        </View>

        {/* NPC dots */}
        {npcsHere.length > 0 && (
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {npcsHere.map((npc) => (
              <NpcDot key={npc.id} npc={npc} onPress={() => onNpcPress(npc)} />
            ))}
          </View>
        )}

        {/* Pied de carte */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: onlineCount > 0 ? "#38c793" : colors.muted }} />
            <Text style={{ color: onlineCount > 0 ? "#38c793" : colors.muted, fontSize: 9, fontWeight: "700" }}>
              {onlineCount > 0 ? `${onlineCount} en ligne` : "vide"}
            </Text>
          </View>
          {npcsHere.length > 0 && (
            <Text style={{ color: colors.muted, fontSize: 9 }}>{npcsHere.length} résidents</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── NPC Panel (bottom sheet) ─────────────────────────────────────────────────
type ChatLine = { id: string; from: "player" | "npc"; text: string };

function NpcPanel({ npc, onClose }: { npc: NpcState; onClose: () => void }) {
  const sendInvitation = useGameStore((s) => s.sendInvitation);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);
  const avatar = useGameStore((s) => s.avatar);

  const [chat, setChat] = useState<ChatLine[]>([{
    id: "greeting",
    from: "npc",
    text: getNpcDialogue(npc.id, npc.action, npc.mood, "greeting"),
  }]);
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<"chat" | "activités">("chat");
  const scrollRef = useRef<ScrollView>(null);
  const sheetY = useRef(new Animated.Value(500)).current;
  const c = npcColor(npc.id);
  const playerName = avatar?.displayName ?? "Toi";

  useEffect(() => {
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
  }, [sheetY]);

  function addLine(from: "player" | "npc", text: string) {
    setChat((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, from, text }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  function send() {
    const t = input.trim();
    if (!t) return;
    setInput("");
    addLine("player", t);
    setTimeout(() => {
      const busy = npc.action === "sleeping" || npc.energy < 20;
      addLine("npc", getNpcDialogue(npc.id, npc.action, npc.mood, busy ? "busy" : "topic"));
    }, 600 + Math.random() * 500);
  }

  function sendEmote(e: string) {
    addLine("player", e);
    setTimeout(() => addLine("npc", getNpcEmoteReaction(npc.id, e)), 500);
  }

  function proposeActivity(slug: string) {
    const act = PROPOSABLE_ACTIVITIES.find((a) => a.slug === slug);
    if (!act) return;
    setTab("chat");
    addLine("player", `${act.emoji} Je propose : ${act.label}`);
    setTimeout(() => {
      const result = getNpcActivityResponse(npc.id, npc, slug);
      addLine("npc", result.line);
      if (result.accepted) {
        sendInvitation(npc.id, slug);
      }
    }, 700);
  }

  const moodColor = npc.mood > 65 ? "#38c793" : npc.mood > 35 ? "#f6b94f" : "#ef4444";

  return (
    <Animated.View style={{
      transform: [{ translateY: sheetY }],
      backgroundColor: "#07111f",
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderTopWidth: 1, borderColor: c + "40",
      paddingBottom: 24,
      shadowColor: c, shadowOpacity: 0.2, shadowRadius: 20,
    }}>
      {/* Handle */}
      <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)" }} />
      </View>

      {/* Header NPC */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c + "18", borderWidth: 1.5, borderColor: c + "55", alignItems: "center", justifyContent: "center" }}>
          <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action as never} size="sm" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{npc.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: npc.presenceOnline ? "#38c793" : colors.muted }} />
            <Text style={{ color: npc.presenceOnline ? "#38c793" : colors.muted, fontSize: 10 }}>
              {npc.presenceOnline ? "En ligne" : "Hors ligne"}
            </Text>
            <Text style={{ color: moodColor, fontSize: 10 }}>· humeur {npc.mood}%</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>· énergie {npc.energy}%</Text>
          </View>
        </View>
        <Pressable
          onPress={() => { startDirectConversation(npc.id, npc.name); router.push("/(app)/(tabs)/chat"); onClose(); }}
          style={{ backgroundColor: c, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}
        >
          <Text style={{ color: "#07111f", fontSize: 11, fontWeight: "900" }}>DM</Text>
        </Pressable>
        <Pressable onPress={onClose} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="close" size={16} color={colors.muted} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, marginBottom: 10 }}>
        {(["chat", "activités"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{
            paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
            backgroundColor: tab === t ? c + "22" : "rgba(255,255,255,0.05)",
            borderWidth: 1, borderColor: tab === t ? c + "55" : "rgba(255,255,255,0.07)",
          }}>
            <Text style={{ color: tab === t ? c : colors.muted, fontSize: 12, fontWeight: "800" }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "chat" ? (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {/* Emotes rapides */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
            {QUICK_EMOTES.map((e) => (
              <Pressable key={e} onPress={() => sendEmote(e)} style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.05)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 18 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Messages */}
          <ScrollView ref={scrollRef} style={{ maxHeight: 180, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
            {chat.map((line) => (
              <View key={line.id} style={{ marginBottom: 8, alignItems: line.from === "player" ? "flex-end" : "flex-start" }}>
                <View style={{
                  maxWidth: "78%",
                  backgroundColor: line.from === "player" ? c + "22" : "rgba(255,255,255,0.07)",
                  borderRadius: 14,
                  paddingHorizontal: 12, paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: line.from === "player" ? c + "40" : "rgba(255,255,255,0.08)",
                }}>
                  <Text style={{ color: line.from === "player" ? c : colors.text, fontSize: 13, lineHeight: 18 }}>
                    {line.text}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Input */}
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              placeholder={`Parler à ${npc.name.split(" ")[0]}…`}
              placeholderTextColor={colors.muted}
              style={{
                flex: 1, backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                color: colors.text, fontSize: 13,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
              }}
            />
            <Pressable onPress={send} style={{
              width: 42, height: 42, borderRadius: 12,
              backgroundColor: c, alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="send" size={16} color="#07111f" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView style={{ paddingHorizontal: 16, maxHeight: 260 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8 }}>
            {PROPOSABLE_ACTIVITIES.map((act) => (
              <Pressable key={act.slug} onPress={() => proposeActivity(act.slug)} style={{
                flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: "rgba(255,255,255,0.04)",
                borderRadius: 14, padding: 12,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
              }}>
                <View style={{
                  width: 38, height: 38, borderRadius: 10,
                  backgroundColor: c + "18", alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 20 }}>{act.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>{act.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>📍 {act.locationSlug}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

// ─── Screen principal ─────────────────────────────────────────────────────────
export default function WorldLiveScreen() {
  const npcs               = useGameStore((s) => s.npcs);
  const tickNpcs           = useGameStore((s) => s.tickNpcs);
  const relationships      = useGameStore((s) => s.relationships);
  const travelTo           = useGameStore((s) => s.travelTo);
  const currentLocation    = useGameStore((s) => s.currentLocationSlug);
  const notifications      = useGameStore((s) => s.notifications);

  const [selectedNpc, setSelectedNpc] = useState<NpcState | null>(null);
  const [filter, setFilter] = useState<"all" | "online">("all");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    tickNpcs();
    const t = setInterval(() => tickNpcs(), 30_000);
    return () => clearInterval(t);
  }, [tickNpcs]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const onlineCount = npcs.filter((n) => n.presenceOnline).length;
  const goodMoodCount = npcs.filter((n) => n.mood > 60).length;

  function npcsAt(slug: string) {
    return npcs.filter((n) => n.locationSlug === slug);
  }

  const getNpcRelScore = useCallback((id: string) => {
    return relationships.find((r) => r.residentId === id)?.score ?? 0;
  }, [relationships]);

  // NPCs triés par score relation (proches en premier)
  const sortedNpcs = [...npcs].sort((a, b) => getNpcRelScore(b.id) - getNpcRelScore(a.id));
  const displayedNpcs = filter === "online" ? sortedNpcs.filter((n) => n.presenceOnline) : sortedNpcs;

  return (
    <Animated.View style={{ flex: 1, backgroundColor: "#040810", opacity: fadeAnim }}>
      {/* ── Header ── */}
      <View style={{
        paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
        backgroundColor: "rgba(4,8,16,0.97)",
        borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
        flexDirection: "row", alignItems: "center", gap: 12,
      }}>
        <Pressable onPress={() => router.back()} style={{
          width: 36, height: 36, borderRadius: 12,
          backgroundColor: "rgba(255,255,255,0.07)",
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>🏙️ Neo Paris</Text>
          <Text style={{ color: colors.muted, fontSize: 10 }}>
            {onlineCount} en ligne · {goodMoodCount} de bonne humeur · {npcs.length} résidents
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/(app)/(tabs)/notifications")}
          style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: unreadCount > 0 ? "#ef444420" : "rgba(255,255,255,0.06)",
            borderWidth: 1, borderColor: unreadCount > 0 ? "#ef4444" : "rgba(255,255,255,0.08)",
            alignItems: "center", justifyContent: "center",
          }}
        >
          {unreadCount > 0
            ? <Text style={{ color: "#ef4444", fontWeight: "900", fontSize: 11 }}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            : <Ionicons name="notifications-outline" size={16} color={colors.muted} />
          }
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 48 }}>

        {/* ── Stats ville ── */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { label: "En ligne",     value: `${onlineCount}`,     color: "#38c793" },
            { label: "Bonne humeur", value: `${goodMoodCount}`,   color: "#f6b94f" },
            { label: "Résidents",    value: `${npcs.length}`,     color: "#60a5fa" },
          ].map((item) => (
            <View key={item.label} style={{
              flex: 1,
              backgroundColor: item.color + "10",
              borderRadius: 14, paddingVertical: 10, alignItems: "center",
              borderWidth: 1, borderColor: item.color + "30",
            }}>
              <Text style={{ color: item.color, fontWeight: "900", fontSize: 20 }}>{item.value}</Text>
              <Text style={{ color: colors.muted, fontSize: 9, marginTop: 1 }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Grille quartiers ── */}
        <View>
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 }}>
            QUARTIERS
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {DISTRICTS.map((d) => (
              <DistrictCard
                key={d.slug}
                district={d}
                npcsHere={npcsAt(d.slug)}
                isCurrentLocation={currentLocation === d.slug}
                onTravel={() => { travelTo(d.slug); }}
                onNpcPress={(npc) => setSelectedNpc(npc)}
              />
            ))}
          </View>
        </View>

        {/* ── Résidents ── */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
              RÉSIDENTS ({displayedNpcs.length})
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(["all", "online"] as const).map((f) => (
                <Pressable key={f} onPress={() => setFilter(f)} style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                  backgroundColor: filter === f ? colors.accent + "22" : "rgba(255,255,255,0.05)",
                  borderWidth: 1, borderColor: filter === f ? colors.accent + "55" : "rgba(255,255,255,0.07)",
                }}>
                  <Text style={{ color: filter === f ? colors.accent : colors.muted, fontSize: 10, fontWeight: "800" }}>
                    {f === "all" ? "Tous" : "En ligne"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {displayedNpcs.map((npc) => {
              const relScore = getNpcRelScore(npc.id);
              const c = npcColor(npc.id);
              const moodC = npc.mood > 65 ? "#38c793" : npc.mood > 35 ? "#f6b94f" : "#ef4444";
              const district = DISTRICTS.find((d) => d.slug === npc.locationSlug);
              return (
                <Pressable key={npc.id} onPress={() => setSelectedNpc(npc)} style={{
                  flexDirection: "row", alignItems: "center", gap: 12,
                  backgroundColor: "rgba(255,255,255,0.035)",
                  borderRadius: 16, padding: 12,
                  borderWidth: 1,
                  borderColor: npc.presenceOnline ? c + "30" : "rgba(255,255,255,0.06)",
                }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 13,
                    backgroundColor: c + "18",
                    borderWidth: 1.5, borderColor: npc.presenceOnline ? c + "60" : c + "20",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action as never} size="sm" />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>{npc.name}</Text>
                      {npc.presenceOnline && (
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#38c793" }} />
                      )}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>
                      {district?.emoji ?? "📍"} {district?.label ?? npc.locationSlug}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Text style={{ color: moodC, fontSize: 9, fontWeight: "800" }}>😊 {npc.mood}%</Text>
                      <Text style={{ color: "#60a5fa", fontSize: 9, fontWeight: "800" }}>⚡ {npc.energy}%</Text>
                      {relScore > 0 && (
                        <Text style={{ color: c, fontSize: 9, fontWeight: "800" }}>🔗 {relScore}%</Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── NPC Panel ── */}
      {selectedNpc && (
        <Pressable
          onPress={() => setSelectedNpc(null)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <NpcPanel npc={selectedNpc} onClose={() => setSelectedNpc(null)} />
            </Pressable>
          </View>
        </Pressable>
      )}
    </Animated.View>
  );
}
