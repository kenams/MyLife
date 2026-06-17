/**
 * Carte Sociale Monde — style Snapchat Map
 * Zoom 1×→4× smooth · clic NPC → proposition activité virtuelle → chat live
 */
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Easing, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, Text, TextInput, View,
} from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { cityForNpc, WorldLiveMap } from "@/components/world-live-map";
import { getNpcVisual } from "@/lib/avatar-visual";
import { buildDirectBotReply } from "@/lib/bot-brain";
import { getNpcDialogue, getNpcEmoteReaction, PROPOSABLE_ACTIVITIES, QUICK_EMOTES } from "@/lib/npc-dialogue";
import { useGameStore, worldLocations } from "@/stores/game-store";
import type { NpcState } from "@/lib/types";

// ─── Couleurs dark Snapchat ────────────────────────────────────────────────────
const D = {
  bg:       "#020b18",
  card:     "#071525",
  cardAlt:  "#0c1e35",
  border:   "rgba(59,130,246,0.18)",
  text:     "#e2e8f0",
  textSoft: "#94a3b8",
  muted:    "#475569",
  primary:  "#3b82f6",
  green:    "#22c55e",
  gold:     "#fbbf24",
  red:      "#ef4444",
  purple:   "#8b5cf6",
  teal:     "#14b8a6",
  pink:     "#ec4899",
};

const NPC_COLORS: Record<string, string> = {
  ava: "#22c55e", malik: "#3b82f6", noa: "#ec4899",
  leila: "#fbbf24", yan: "#8b5cf6", sana: "#14b8a6",
};
function npcColor(id: string) { return NPC_COLORS[id] ?? D.primary; }

const ACTION_LABELS: Record<string, string> = {
  sleeping: "🛌 Dort", eating: "🍽️ Mange", chatting: "💬 Discute",
  exercising: "💪 Sport", walking: "🚶 Marche", working: "💼 Travaille",
  idle: "💭 Pause", waving: "👋 Salue",
};

// Activités virtuelles proposables en 1 clic
const QUICK_ACTIVITIES = [
  { slug: "cafe",       emoji: "☕", label: "Café virtuel",    desc: "Discutez autour d'un café",       color: "#f97316" },
  { slug: "cinema",     emoji: "🎬", label: "Ciné ensemble",   desc: "Regardez un film en sync",         color: "#6366f1" },
  { slug: "restaurant", emoji: "🍕", label: "Dîner virtuel",   desc: "Partagez un repas en live",        color: "#ef4444" },
  { slug: "park",       emoji: "🌳", label: "Balade commune",  desc: "Promenade dans Toulouse",          color: "#22c55e" },
  { slug: "gym",        emoji: "💪", label: "Sport ensemble",  desc: "Session fitness partagée",         color: "#f59e0b" },
  { slug: "rooftop-bar",emoji: "🍸", label: "Cocktail lounge", desc: "Soirée au Sky Lounge",             color: "#8b5cf6" },
];

type ChatLine = { id: string; from: "player" | "npc"; text: string; ts: number };
type RdvState = { slug: string; label: string; emoji: string; status: "moving" | "confirmed" };

// ─── Panel NPC Social ──────────────────────────────────────────────────────────
function SocialNpcPanel({ npc, onClose }: { npc: NpcState; onClose: () => void }) {
  const avatar              = useGameStore((s) => s.avatar);
  const relationships       = useGameStore((s) => s.relationships);
  const travelTo            = useGameStore((s) => s.travelTo);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);

  const [tab, setTab]       = useState<"profil" | "chat" | "activités">("profil");
  const [chat, setChat]     = useState<ChatLine[]>([]);
  const [input, setInput]   = useState("");
  const [rdv, setRdv]       = useState<RdvState | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const rdvAnim   = useRef(new Animated.Value(0)).current;

  const c         = npcColor(npc.id);
  const rel       = relationships.find((r) => r.residentId === npc.id);
  const relScore  = rel?.score ?? 0;
  const city      = cityForNpc(npc);
  const loc       = worldLocations.find((l) => l.slug === npc.locationSlug);
  const moodColor = npc.mood > 65 ? D.green : npc.mood > 35 ? D.gold : D.red;
  const playerName = avatar?.displayName ?? "Toi";

  // Entrée slide-up
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 68, friction: 11 }).start();
    // Message de bienvenue
    const greeting = getNpcDialogue(npc.id, npc.action, npc.mood, "greeting");
    setChat([{ id: "g", from: "npc", text: greeting, ts: Date.now() }]);
  }, [npc.id]);

  function addLine(from: "player" | "npc", text: string) {
    setChat((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, from, text, ts: Date.now() }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  function send() {
    const t = input.trim();
    if (!t) return;
    setInput("");
    addLine("player", t);
    setTimeout(() => {
      const busy = npc.action === "sleeping" || npc.energy < 20;
      const reply = busy
        ? getNpcDialogue(npc.id, npc.action, npc.mood, "busy")
        : buildDirectBotReply({
            npc, residentId: npc.id, residentName: npc.name,
            playerName, playerMessage: t, relationshipScore: relScore, messageCount: chat.length,
          });
      addLine("npc", reply);
    }, 500 + Math.random() * 600);
  }

  function sendEmote(e: string) {
    addLine("player", e);
    setTimeout(() => addLine("npc", getNpcEmoteReaction(npc.id, e)), 450);
  }

  function proposeActivity(act: typeof QUICK_ACTIVITIES[0]) {
    setTab("chat");
    setRdv({ slug: act.slug, label: act.label, emoji: act.emoji, status: "moving" });
    rdvAnim.setValue(0);
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(rdvAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    addLine("player", `${act.emoji} Je t'invite pour : ${act.label}`);
    setTimeout(() => {
      const actObj = PROPOSABLE_ACTIVITIES.find((a) => a.slug === act.slug);
      const response = actObj
        ? getNpcDialogue(npc.id, npc.action, npc.mood, "topic")
        : `D'accord ! On se retrouve au ${act.label} ?`;
      addLine("npc", response);
      setRdv((prev) => prev ? { ...prev, status: "confirmed" } : null);
      travelTo(act.slug, { cost: 5, energyCost: 3, modeLabel: "RDV" });
    }, 1400);
    setTimeout(() => {
      setRdv(null);
      rdvAnim.setValue(0);
    }, 7000);
  }

  function openDm() {
    startDirectConversation(npc.id, npc.name);
    onClose();
    router.push("/(app)/(tabs)/chat");
  }

  return (
    <Animated.View style={{
      transform: [{ translateY: slideAnim }],
      backgroundColor: D.card,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      borderTopWidth: 1, borderColor: c + "44",
      paddingBottom: Platform.OS === "ios" ? 32 : 20,
      shadowColor: c, shadowOpacity: 0.28, shadowRadius: 24,
      maxHeight: "88%",
    }}>
      {/* Handle */}
      <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)" }} />
      </View>

      {/* ── Header NPC ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{
          width: 52, height: 52, borderRadius: 16,
          backgroundColor: c + "18", borderWidth: 2, borderColor: c + "55",
          alignItems: "center", justifyContent: "center",
          shadowColor: c, shadowOpacity: 0.4, shadowRadius: 10,
        }}>
          <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action as never} size="sm" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: D.text, fontWeight: "900", fontSize: 17 }}>{npc.name}</Text>
            <View style={{ width: 8, height: 8, borderRadius: 4,
              backgroundColor: npc.presenceOnline ? D.green : D.muted }} />
            {relScore > 0 && (
              <View style={{ backgroundColor: c + "22", borderRadius: 8,
                paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: c + "44" }}>
                <Text style={{ color: c, fontSize: 9, fontWeight: "900" }}>🔗 {relScore}%</Text>
              </View>
            )}
          </View>
          <Text style={{ color: D.textSoft, fontSize: 11, marginTop: 2 }}>
            {ACTION_LABELS[npc.action] ?? npc.action} · {city.name}
          </Text>
          <Text style={{ color: D.muted, fontSize: 10, marginTop: 1 }}>
            📍 {loc?.name ?? npc.locationSlug}
          </Text>
        </View>
        <View style={{ gap: 6 }}>
          <Pressable onPress={openDm}
            style={{ backgroundColor: c, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
            <Text style={{ color: "#07111f", fontSize: 11, fontWeight: "900" }}>DM</Text>
          </Pressable>
          <Pressable onPress={onClose}
            style={{ width: 32, height: 32, borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.06)",
              alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={16} color={D.muted} />
          </Pressable>
        </View>
      </View>

      {/* ── Mini stats ── */}
      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, marginBottom: 12 }}>
        {[
          { label: "Humeur", value: npc.mood, color: moodColor },
          { label: "Énergie", value: npc.energy, color: D.primary },
          { label: "Argent", value: npc.money, color: D.gold },
          { label: "Niv.", value: npc.level, color: D.purple },
        ].map((item) => (
          <View key={item.label} style={{ flex: 1, backgroundColor: D.cardAlt, borderRadius: 10,
            padding: 8, alignItems: "center", borderWidth: 1, borderColor: D.border }}>
            <Text style={{ color: item.color, fontWeight: "900", fontSize: 13 }}>{item.value}</Text>
            <Text style={{ color: D.muted, fontSize: 8, marginTop: 1 }}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Tabs ── */}
      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, marginBottom: 12 }}>
        {(["profil", "activités", "chat"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{
            flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: "center",
            backgroundColor: tab === t ? c + "22" : "rgba(255,255,255,0.04)",
            borderWidth: 1, borderColor: tab === t ? c + "55" : "rgba(255,255,255,0.07)",
          }}>
            <Text style={{ color: tab === t ? c : D.muted, fontSize: 11, fontWeight: "900" }}>
              {t === "profil" ? "👤 Profil" : t === "activités" ? "🎯 Activités" : "💬 Chat"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Contenu par tab ── */}

      {tab === "profil" && (
        <ScrollView style={{ paddingHorizontal: 16, maxHeight: 260 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: D.cardAlt, borderRadius: 16, padding: 14, gap: 10,
            borderWidth: 1, borderColor: D.border }}>
            <Text style={{ color: D.textSoft, fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
              À propos de {npc.name}
            </Text>
            {[
              { icon: "🌍", label: "Ville",    value: city.name },
              { icon: "📍", label: "Position", value: loc?.name ?? npc.locationSlug },
              { icon: "⭐", label: "Réputation", value: `${npc.reputation} pts` },
              { icon: "🔥", label: "Streak",   value: `${npc.streak} jours` },
              { icon: "💰", label: "Solde",    value: `${npc.money} cr` },
              { icon: "📊", label: "XP total", value: `${npc.xp} xp` },
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: D.border }}>
                <Text style={{ fontSize: 14, width: 22 }}>{item.icon}</Text>
                <Text style={{ color: D.muted, fontSize: 11, width: 72 }}>{item.label}</Text>
                <Text style={{ color: D.text, fontSize: 12, flex: 1, fontWeight: "700" }}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Barre de progression relation */}
          <View style={{ marginTop: 12, backgroundColor: D.cardAlt, borderRadius: 16, padding: 14,
            borderWidth: 1, borderColor: c + "30" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: D.text, fontSize: 12, fontWeight: "800" }}>Lien avec toi</Text>
              <Text style={{ color: c, fontSize: 12, fontWeight: "900" }}>{relScore}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: D.border, overflow: "hidden" }}>
              <View style={{ height: 6, borderRadius: 3, width: `${relScore}%` as `${number}%`,
                backgroundColor: c }} />
            </View>
            <Text style={{ color: D.muted, fontSize: 10, marginTop: 6 }}>
              {relScore >= 70 ? "💚 Ami proche" : relScore >= 40 ? "🤝 Connaissance" : "🆕 Nouveau contact"}
            </Text>
          </View>
        </ScrollView>
      )}

      {tab === "activités" && (
        <ScrollView style={{ paddingHorizontal: 16, maxHeight: 300 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: D.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1,
            textTransform: "uppercase", marginBottom: 10 }}>
            Proposer une activité virtuelle
          </Text>
          <View style={{ gap: 8 }}>
            {QUICK_ACTIVITIES.map((act) => (
              <Pressable key={act.slug} onPress={() => proposeActivity(act)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12,
                  backgroundColor: D.cardAlt, borderRadius: 16, padding: 14,
                  borderWidth: 1, borderColor: act.color + "30" }}>
                <View style={{ width: 44, height: 44, borderRadius: 14,
                  backgroundColor: act.color + "20", alignItems: "center", justifyContent: "center",
                  borderWidth: 1, borderColor: act.color + "40" }}>
                  <Text style={{ fontSize: 22 }}>{act.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: D.text, fontSize: 14, fontWeight: "800" }}>{act.label}</Text>
                  <Text style={{ color: D.muted, fontSize: 11, marginTop: 2 }}>{act.desc}</Text>
                </View>
                <View style={{ backgroundColor: act.color, borderRadius: 10,
                  paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>Go →</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {tab === "chat" && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {/* Notification RDV */}
          {rdv && (
            <Animated.View style={{
              marginHorizontal: 16, marginBottom: 10,
              backgroundColor: rdv.status === "confirmed" ? D.green + "18" : D.gold + "18",
              borderRadius: 14, padding: 12,
              borderWidth: 1, borderColor: rdv.status === "confirmed" ? D.green + "40" : D.gold + "40",
              flexDirection: "row", alignItems: "center", gap: 10,
              opacity: rdvAnim,
              transform: [{ translateY: rdvAnim.interpolate({ inputRange: [0,1], outputRange: [-20,0] }) }],
            }}>
              <Text style={{ fontSize: 20 }}>{rdv.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: rdv.status === "confirmed" ? D.green : D.gold,
                  fontSize: 11, fontWeight: "900" }}>
                  {rdv.status === "confirmed" ? "✅ RDV confirmé !" : "⏳ En route..."}
                </Text>
                <Text style={{ color: D.textSoft, fontSize: 11, marginTop: 1 }}>
                  {rdv.label} avec {npc.name}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Emotes rapides */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ paddingHorizontal: 16, marginBottom: 8 }}
            contentContainerStyle={{ gap: 6 }}>
            {QUICK_EMOTES.map((e) => (
              <Pressable key={e} onPress={() => sendEmote(e)}
                style={{ width: 36, height: 36, borderRadius: 10,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 18 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Messages */}
          <ScrollView ref={scrollRef} style={{ maxHeight: 170, paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}>
            {chat.map((line) => (
              <View key={line.id} style={{ marginBottom: 8,
                alignItems: line.from === "player" ? "flex-end" : "flex-start" }}>
                <View style={{
                  maxWidth: "80%",
                  backgroundColor: line.from === "player" ? c + "25" : "rgba(255,255,255,0.07)",
                  borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: line.from === "player" ? c + "45" : "rgba(255,255,255,0.09)",
                }}>
                  <Text style={{ color: line.from === "player" ? c : D.text, fontSize: 13, lineHeight: 18 }}>
                    {line.text}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Input */}
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
            <TextInput
              value={input} onChangeText={setInput} onSubmitEditing={send}
              placeholder={`Écrire à ${npc.name.split(" ")[0]}…`}
              placeholderTextColor={D.muted}
              style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
                color: D.text, fontSize: 13,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
            />
            <Pressable onPress={send}
              style={{ width: 44, height: 44, borderRadius: 14,
                backgroundColor: c, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="send" size={16} color="#07111f" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </Animated.View>
  );
}

// ─── Barre du bas avec stats monde ────────────────────────────────────────────
function WorldStats({ online, total }: { online: number; total: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(34,197,94,0.25)" }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: D.green }} />
        <Text style={{ color: D.green, fontWeight: "900", fontSize: 11 }}>{online} live</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: "rgba(59,130,246,0.1)", borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(59,130,246,0.2)" }}>
        <Text style={{ color: D.primary, fontWeight: "700", fontSize: 11 }}>👥 {total} résidents</Text>
      </View>
    </View>
  );
}

// ─── Screen principal ──────────────────────────────────────────────────────────
export default function WorldSocialScreen() {
  const avatar           = useGameStore((s) => s.avatar);
  const npcs             = useGameStore((s) => s.npcs);
  const tickNpcs         = useGameStore((s) => s.tickNpcs);
  const relationships    = useGameStore((s) => s.relationships);
  const currentLocation  = useGameStore((s) => s.currentLocationSlug);
  const travelTo         = useGameStore((s) => s.travelTo);
  const notifications    = useGameStore((s) => s.notifications);

  const [selectedNpcId, setSelectedNpcId]   = useState<string | null>(null);
  const [currentCityId, setCurrentCityId]   = useState("neo-paris");
  const [focusedCityId, setFocusedCityId]   = useState<string | null>(null);
  const [districtSlug, setDistrictSlug]     = useState<string | null>(null);
  const [districtCityId, setDistrictCityId] = useState("neo-paris");
  const [travelingTo, setTravelingTo]       = useState<string | null>(null);
  const travelAnim = useRef(new Animated.Value(0)).current;

  const unreadCount = notifications.filter((n) => !n.read).length;
  const onlineCount = npcs.filter((n) => n.presenceOnline).length;
  const selectedNpc = selectedNpcId ? npcs.find((n) => n.id === selectedNpcId) ?? null : null;

  useFocusEffect(useCallback(() => {
    tickNpcs();
    const id = setInterval(() => tickNpcs(), 30_000);
    return () => clearInterval(id);
  }, [tickNpcs]));

  function handleTravel(slug: string) {
    if (slug === currentLocation) return;
    setTravelingTo(slug);
    travelAnim.setValue(0);
    Animated.timing(travelAnim, { toValue: 1, duration: 800, useNativeDriver: false }).start(() => {
      travelTo(slug);
      setTravelingTo(null);
      travelAnim.setValue(0);
    });
  }

  const travelLoc     = travelingTo ? worldLocations.find((l) => l.slug === travelingTo) : null;
  const travelBarW    = travelAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>

      {/* ── Overlay voyage ─────────────────────────── */}
      {travelingTo && travelLoc && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(3,7,18,0.94)", zIndex: 200,
          alignItems: "center", justifyContent: "center", gap: 18 }}>
          <Text style={{ fontSize: 42 }}>🚶</Text>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>
              EN ROUTE VERS
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 22, fontWeight: "900" }}>{travelLoc.name}</Text>
          </View>
          <View style={{ width: 220, height: 5, borderRadius: 3,
            backgroundColor: "rgba(59,130,246,0.2)", overflow: "hidden" }}>
            <Animated.View style={{ height: 5, borderRadius: 3,
              width: travelBarW, backgroundColor: D.primary }} />
          </View>
        </View>
      )}

      {/* ── Header ─────────────────────────────────── */}
      <View style={{ paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
        backgroundColor: "rgba(2,11,24,0.97)",
        borderBottomWidth: 1, borderBottomColor: "rgba(59,130,246,0.12)",
        flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()}
          style={{ width: 38, height: 38, borderRadius: 13,
            backgroundColor: "rgba(255,255,255,0.06)",
            alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color={D.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: D.text, fontWeight: "900", fontSize: 18 }}>🌍 Carte Sociale</Text>
          <Text style={{ color: D.muted, fontSize: 10 }}>
            Explore · Zoome · Propose une activité
          </Text>
        </View>
        <WorldStats online={onlineCount} total={npcs.length} />
        <Pressable onPress={() => router.push("/(app)/(tabs)/notifications")}
          style={{ width: 38, height: 38, borderRadius: 13,
            backgroundColor: unreadCount > 0 ? "#ef444420" : "rgba(255,255,255,0.05)",
            borderWidth: 1, borderColor: unreadCount > 0 ? "#ef4444" : "rgba(255,255,255,0.08)",
            alignItems: "center", justifyContent: "center" }}>
          {unreadCount > 0
            ? <Text style={{ color: "#ef4444", fontWeight: "900", fontSize: 11 }}>{unreadCount}</Text>
            : <Ionicons name="notifications-outline" size={16} color={D.muted} />}
        </Pressable>
      </View>

      {/* ── Carte monde ────────────────────────────── */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32, alignItems: "center" }}
        showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 10 }}>
          <WorldLiveMap
            currentSlug={currentLocation}
            avatarName={avatar?.displayName ?? "Vous"}
            avatarVisual={null}
            npcs={npcs}
            relationships={relationships}
            events={[]}
            currentCityId={currentCityId}
            focusedCityId={focusedCityId}
            selectedNpcId={selectedNpcId}
            dateRoute={null}
            darkMode={true}
            onCityPress={(cityId) => {
              setSelectedNpcId(null);
              setFocusedCityId(cityId);
            }}
            onBackToWorld={() => {
              setFocusedCityId(null);
              setSelectedNpcId(null);
              setDistrictSlug(null);
            }}
            onLocationPress={(slug) => {
              handleTravel(slug);
            }}
            onPersonPress={(npcId) => {
              setSelectedNpcId(npcId);
              const npc = npcs.find((n) => n.id === npcId);
              if (npc) setFocusedCityId(cityForNpc(npc).id);
            }}
            onZoomToDistrict={(cityId, slug) => {
              setFocusedCityId(cityId);
              setDistrictCityId(cityId);
              setDistrictSlug(slug);
            }}
          />
        </View>

        {/* ── Légende aide ───────────────────────────── */}
        <View style={{ marginTop: 14, paddingHorizontal: 16, width: "100%", maxWidth: 700, gap: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { icon: "👆", text: "Clic ville → zoom" },
              { icon: "🔍", text: "+ / molette → 1× à 4×" },
              { icon: "🧑", text: "Clic avatar → profil & chat" },
              { icon: "☕", text: "Propose une activité virtuelle" },
            ].map((item) => (
              <View key={item.text} style={{ flexDirection: "row", alignItems: "center", gap: 6,
                backgroundColor: "rgba(59,130,246,0.07)", borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 6,
                borderWidth: 1, borderColor: "rgba(59,130,246,0.14)" }}>
                <Text style={{ fontSize: 13 }}>{item.icon}</Text>
                <Text style={{ color: D.muted, fontSize: 11 }}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Liste résidents actifs ─────────────────── */}
        <View style={{ marginTop: 16, paddingHorizontal: 16, width: "100%", maxWidth: 700 }}>
          <Text style={{ color: D.muted, fontSize: 10, fontWeight: "900",
            textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Résidents actifs ({npcs.filter((n) => n.presenceOnline).length} en ligne)
          </Text>
          <View style={{ gap: 8 }}>
            {[...npcs]
              .sort((a, b) => (b.presenceOnline ? 1 : 0) - (a.presenceOnline ? 1 : 0))
              .slice(0, 6)
              .map((npc) => {
                const c = npcColor(npc.id);
                const rel = relationships.find((r) => r.residentId === npc.id);
                const city = cityForNpc(npc);
                return (
                  <Pressable key={npc.id} onPress={() => {
                    setSelectedNpcId(npc.id);
                    setFocusedCityId(cityForNpc(npc).id);
                  }} style={{ flexDirection: "row", alignItems: "center", gap: 12,
                    backgroundColor: D.card, borderRadius: 16, padding: 12,
                    borderWidth: 1, borderColor: npc.presenceOnline ? c + "30" : D.border }}>
                    <View style={{ width: 44, height: 44, borderRadius: 13,
                      backgroundColor: c + "18", borderWidth: 1.5,
                      borderColor: npc.presenceOnline ? c + "60" : c + "20",
                      alignItems: "center", justifyContent: "center" }}>
                      <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action as never} size="sm" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ color: D.text, fontWeight: "800", fontSize: 13 }}>{npc.name}</Text>
                        {npc.presenceOnline && (
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: D.green }} />
                        )}
                      </View>
                      <Text style={{ color: D.muted, fontSize: 10, marginTop: 2 }}>
                        {ACTION_LABELS[npc.action] ?? npc.action} · {city.name}
                      </Text>
                    </View>
                    {(rel?.score ?? 0) > 0 && (
                      <View style={{ backgroundColor: c + "18", borderRadius: 8,
                        paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: c + "30" }}>
                        <Text style={{ color: c, fontSize: 10, fontWeight: "900" }}>
                          🔗 {rel?.score}
                        </Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={14} color={D.muted} />
                  </Pressable>
                );
              })}
          </View>
        </View>

      </ScrollView>

      {/* ── Panel NPC (bottom sheet) ─────────────────── */}
      {selectedNpc && (
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)" }}
          onPress={() => setSelectedNpcId(null)}>
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <SocialNpcPanel
                npc={selectedNpc}
                onClose={() => setSelectedNpcId(null)}
              />
            </Pressable>
          </View>
        </Pressable>
      )}
    </View>
  );
}
