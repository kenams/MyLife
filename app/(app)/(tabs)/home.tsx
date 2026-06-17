"use client";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual } from "@/lib/avatar-visual";
import { getHousingTier } from "@/lib/housing";
import { hapticImpact } from "@/lib/safe-haptics";
import { getWellbeingScore } from "@/lib/selectors";
import { getSuggestedActions, useTimeContext } from "@/lib/time-context";
import type { LifeActionId } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";
import { useAppTheme } from "@/hooks/use-app-theme";

const L = {
  bg:        "#080808",
  card:      "#111111",
  cardAlt:   "#181818",
  text:      "#F5F2E8",
  textSoft:  "#A8A49A",
  muted:     "#4A4844",
  border:    "rgba(255,255,255,0.07)",
  primary:   "#FFD600",
  primaryBg: "#1A1500",
  green:     "#39FF14",
  greenBg:   "#091A03",
  gold:      "#FFD600",
  goldBg:    "#1A1500",
  red:       "#FF3B3B",
  redBg:     "#1A0808",
  blue:      "#00B4FF",
  blueBg:    "#001A2A",
  purple:    "#BF5FFF",
  purpleBg:  "#18082A",
  pink:      "#FF2D78",
  pinkBg:    "#1A0818",
  teal:      "#00FFD1",
  tealBg:    "#001A14",
  orange:    "#FF6B00",
  orangeBg:  "#1A0D00",
};

type ActionDef = {
  id: LifeActionId;
  emoji: string;
  label: string;
  costLabel: string;
  gainLabel: string;
  category: "survie" | "travail" | "social" | "santé";
  minEnergy?: number;
  minMoney?: number;
};

const ALL_ACTIONS: ActionDef[] = [
  { id: "healthy-meal",  emoji: "🍱", label: "Manger propre",     costLabel: "14 bl",  gainLabel: "+Dalle +Forme",      category: "survie" },
  { id: "home-cooking",  emoji: "🍳", label: "Faire la popote",   costLabel: "8 bl",   gainLabel: "+Dalle économe",     category: "survie" },
  { id: "sleep",         emoji: "🛌", label: "Roupiller",         costLabel: "temps",  gainLabel: "+Pêche max",         category: "survie" },
  { id: "nap",           emoji: "💤", label: "Piquer un som",     costLabel: "temps",  gainLabel: "+Pêche rapide",      category: "survie" },
  { id: "shower",        emoji: "🚿", label: "Se laver",          costLabel: "3 bl",   gainLabel: "+Look +Mood",        category: "survie" },
  { id: "work-shift",    emoji: "💼", label: "Aller au taff",     costLabel: "pêche",  gainLabel: "+Thunes +Côte",      category: "travail", minEnergy: 20 },
  { id: "cafe-chat",     emoji: "☕", label: "Poser au bando",    costLabel: "8 bl",   gainLabel: "+Réseau +Mood",      category: "social",  minMoney: 8 },
  { id: "team-sport",    emoji: "🏀", label: "Terrain de foot",   costLabel: "pêche",  gainLabel: "+Réseau +Forme",     category: "social",  minEnergy: 25 },
  { id: "walk",          emoji: "🏃", label: "Faire un tour",     costLabel: "pêche",  gainLabel: "+Mood -Stress",      category: "santé" },
  { id: "gym",           emoji: "🏋️", label: "Aller à la salle",  costLabel: "12 bl",  gainLabel: "+Forme +Discipline", category: "santé",   minEnergy: 22, minMoney: 12 },
  { id: "meditate",      emoji: "🧘", label: "Se poser",          costLabel: "temps",  gainLabel: "-Stress +Zen",       category: "santé" },
  { id: "read-book",     emoji: "📚", label: "S'instruire",       costLabel: "pêche",  gainLabel: "+Motivation",        category: "santé" },
  { id: "shopping",      emoji: "🛍️", label: "Le Marais / SNKRS", costLabel: "35 bl",  gainLabel: "+Look +Mood",        category: "social",  minMoney: 35 },
];

// ─── LivePulse ────────────────────────────────────────────────────────────────
function LivePulse({ color = "#39FF14", size = 8 }: { color?: string; size?: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.8, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={{ width: size + 4, height: size + 4, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: size + 4, height: size + 4, borderRadius: (size + 4) / 2,
        backgroundColor: color, opacity: 0.3, transform: [{ scale: pulse }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

// ─── NPC Story bubble ─────────────────────────────────────────────────────────
type NpcStory = { name: string; emoji: string; body: string; quartier: string; is_star: boolean; created_at: string };

function NpcStoryBubble({ story, onPress }: { story: NpcStory; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable onPress={onPress}
        style={{ width: 72, alignItems: "center", gap: 6 }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: story.is_star ? L.purpleBg : L.card,
          borderWidth: 2.5,
          borderColor: story.is_star ? L.purple : L.primary + "60",
          alignItems: "center", justifyContent: "center",
          shadowColor: story.is_star ? L.purple : L.primary,
          shadowOpacity: 0.35, shadowRadius: 8,
        }}>
          <Text style={{ fontSize: 26 }}>{story.emoji}</Text>
          {story.is_star && (
            <View style={{ position: "absolute", top: -4, right: -4,
              backgroundColor: L.purple, borderRadius: 8, paddingHorizontal: 3, paddingVertical: 1,
              borderWidth: 1.5, borderColor: L.bg }}>
              <Text style={{ color: "#fff", fontSize: 7, fontWeight: "900" }}>★</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={{ color: L.textSoft, fontSize: 9, fontWeight: "700", textAlign: "center" }}>
          {story.name.split(".")[0]}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Live Paris Widget ────────────────────────────────────────────────────────
function LiveParisWidget() {
  const [count,  setCount]  = useState<number | null>(null);
  const [stories, setStories] = useState<NpcStory[]>([]);
  const countAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!supabase) return;

    // Compteur joueurs actifs (non ghost)
    supabase.from("life_map_players")
      .select("id", { count: "exact" })
      .neq("status", "ghost")
      .then(({ count: n }) => {
        const total = n ?? 0;
        setCount(total);
        Animated.timing(countAnim, { toValue: total, duration: 1200, useNativeDriver: false }).start();
      });

    // Stories NPCs — derniers messages
    supabase.from("quartier_messages")
      .select("display_name, avatar_emoji, body, quartier, is_star, created_at")
      .eq("is_npc", true)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const seen = new Set<string>();
          const unique = data.filter((m) => {
            if (seen.has(m.display_name)) return false;
            seen.add(m.display_name);
            return true;
          });
          setStories(unique.map((m) => ({
            name: m.display_name, emoji: m.avatar_emoji,
            body: m.body, quartier: m.quartier,
            is_star: m.is_star, created_at: m.created_at,
          })));
        }
      });
  }, []);

  const displayCount = count ?? 0;

  return (
    <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: L.card,
      borderRadius: 18, borderWidth: 1, borderColor: L.border, overflow: "hidden" }}>

      {/* Header live */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: L.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LivePulse />
          <Text style={{ color: L.text, fontSize: 13, fontWeight: "900" }}>Paris en direct</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ backgroundColor: L.greenBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
            borderWidth: 1, borderColor: L.green + "30", flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ color: L.green, fontSize: 12, fontWeight: "900" }}>{displayCount}</Text>
            <Text style={{ color: L.green, fontSize: 10 }}>actifs</Text>
          </View>
          <Pressable onPress={() => router.push("/(app)/(tabs)/map" as never)}
            style={{ backgroundColor: L.primaryBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
              borderWidth: 1, borderColor: L.primary + "30" }}>
            <Text style={{ color: L.primary, fontSize: 10, fontWeight: "800" }}>MAP →</Text>
          </Pressable>
        </View>
      </View>

      {/* Stories NPCs */}
      {stories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 4 }}>
          {stories.map((story) => (
            <NpcStoryBubble key={story.name} story={story}
              onPress={() => router.push(`/(app)/live-chat?quartier=${story.quartier}` as never)} />
          ))}
          <Pressable onPress={() => router.push("/(app)/quartiers" as never)}
            style={{ width: 72, alignItems: "center", gap: 6 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: L.cardAlt,
              borderWidth: 2, borderColor: L.border, borderStyle: "dashed",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: L.muted, fontSize: 22 }}>+</Text>
            </View>
            <Text style={{ color: L.muted, fontSize: 9, fontWeight: "700" }}>Quartiers</Text>
          </Pressable>
        </ScrollView>
      )}

      {stories.length === 0 && (
        <View style={{ padding: 16, alignItems: "center", gap: 6 }}>
          <Pressable onPress={() => router.push("/(app)/quartiers" as never)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8,
              backgroundColor: L.tealBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
              borderWidth: 1, borderColor: L.teal + "30" }}>
            <Text style={{ fontSize: 14 }}>📡</Text>
            <Text style={{ color: L.teal, fontSize: 12, fontWeight: "800" }}>Rejoindre un quartier live</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Daily Event Modal ────────────────────────────────────────────────────────
function DailyEventModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const dailyEvent        = useGameStore((s) => s.dailyEvent);
  const resolveDailyEvent = useGameStore((s) => s.resolveDailyEvent);
  if (!dailyEvent || dailyEvent.resolved || !visible) return null;

  const kindColor =
    dailyEvent.kind === "opportunity" ? L.primary :
    dailyEvent.kind === "windfall"    ? L.gold :
    dailyEvent.kind === "encounter"   ? L.purple : L.red;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end", padding: 16 }}>
        <View style={{ backgroundColor: L.card, borderRadius: 24, padding: 24, gap: 20,
          borderWidth: 1, borderColor: kindColor + "20" }}>
          <View style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: L.border, alignSelf: "center" }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Text style={{ fontSize: 32 }}>
              {dailyEvent.kind === "opportunity" ? "✨" : dailyEvent.kind === "windfall" ? "🎁" : dailyEvent.kind === "encounter" ? "👤" : "⚠️"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: kindColor, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>ÉVÉNEMENT DU JOUR</Text>
              <Text style={{ color: L.text, fontWeight: "900", fontSize: 18, marginTop: 2 }}>{dailyEvent.title}</Text>
            </View>
          </View>
          <Text style={{ color: L.textSoft, fontSize: 14, lineHeight: 22 }}>{dailyEvent.body}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => { resolveDailyEvent("accepted"); onClose(); }}
              style={{ flex: 2, paddingVertical: 16, borderRadius: 14, backgroundColor: kindColor, alignItems: "center" }}>
              <Text style={{ color: "#080808", fontWeight: "900", fontSize: 15 }}>{dailyEvent.actionLabel}</Text>
            </Pressable>
            {dailyEvent.kind !== "windfall" && (
              <Pressable onPress={() => { resolveDailyEvent("skipped"); onClose(); }}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: L.cardAlt,
                  borderWidth: 1, borderColor: L.border, alignItems: "center" }}>
                <Text style={{ color: L.muted, fontWeight: "700", fontSize: 14 }}>Passer</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── StatRow ──────────────────────────────────────────────────────────────────
function StatRow({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  const pct     = Math.max(0, Math.min(100, value));
  const danger  = pct < 30;
  const warn    = pct < 55;
  const color   = danger ? L.red : warn ? L.gold : L.green;
  const barAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 750, useNativeDriver: false }).start();
    if (danger) {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])).start();
    }
  }, [pct]);

  const barW = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <View style={{
      marginBottom: 8, borderRadius: 14, overflow: "hidden",
      borderWidth: 1,
      borderColor: danger ? L.red + "30" : color + "15",
      backgroundColor: danger ? L.red + "07" : "rgba(255,255,255,0.018)",
    }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5,
        backgroundColor: color, opacity: danger ? 0.8 : 0.4 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10,
        paddingHorizontal: 14, paddingVertical: 13 }}>
        <Animated.Text style={{ fontSize: 18, width: 24, textAlign: "center",
          opacity: danger ? glowAnim : 1 }}>{emoji}</Animated.Text>
        <Text style={{ color: color, fontSize: 10, fontWeight: "900",
          letterSpacing: 1, width: 54, textTransform: "uppercase" }}>{label}</Text>
        <View style={{ flex: 1, height: 6, borderRadius: 3,
          backgroundColor: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <Animated.View style={{ height: 6, borderRadius: 3, width: barW,
            backgroundColor: color,
            shadowColor: color, shadowOpacity: danger ? 1 : 0.7, shadowRadius: 10 }} />
        </View>
        <Text style={{ color: color, fontSize: 16, fontWeight: "900",
          width: 30, textAlign: "right" }}>
          {Math.round(pct)}
        </Text>
      </View>
    </View>
  );
}

// ─── ActionRow ────────────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  survie:  L.orange,
  travail: L.blue,
  social:  L.purple,
  santé:   L.green,
};

function ActionRow({ action, onPress, isNext, blockedReason }: {
  action: ActionDef;
  onPress: () => void;
  isNext: boolean;
  blockedReason?: string;
}) {
  const blocked   = !!blockedReason;
  const catColor  = CAT_COLOR[action.category] ?? L.muted;
  const accentColor = blocked ? L.muted + "40" : isNext ? L.primary : catColor;
  const scale     = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => !blocked && Animated.spring(scale, { toValue: 0.985, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
        onPress={() => { if (!blocked) { hapticImpact("light"); onPress(); } }}
        style={{ flexDirection: "row", alignItems: "center", gap: 12,
          paddingVertical: 14, paddingRight: 4,
          borderBottomWidth: 1, borderBottomColor: L.border,
          opacity: blocked ? 0.38 : 1 }}>
        {/* Left category neon bar */}
        <View style={{ width: 3, height: 38, borderRadius: 2,
          backgroundColor: accentColor,
          shadowColor: accentColor, shadowOpacity: blocked ? 0 : 0.8, shadowRadius: 6 }} />
        <View style={{
          width: 42, height: 42, borderRadius: 13,
          backgroundColor: isNext ? L.primary + "18" : catColor + "10",
          borderWidth: 1,
          borderColor: isNext ? L.primary + "45" : catColor + "28",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 21 }}>{blocked ? "🔒" : action.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: isNext ? L.primary : blocked ? L.muted : L.text,
            fontSize: 15, fontWeight: "800" }}>
            {action.label}
          </Text>
          <Text style={{ color: blocked ? L.muted + "70" : catColor + "99",
            fontSize: 11, marginTop: 2, fontWeight: "600" }}>
            {blocked ? blockedReason : action.gainLabel}
          </Text>
        </View>
        {isNext ? (
          <View style={{ backgroundColor: L.primary, borderRadius: 6,
            paddingHorizontal: 9, paddingVertical: 4,
            shadowColor: L.primary, shadowOpacity: 0.55, shadowRadius: 10 }}>
            <Text style={{ color: "#080808", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }}>
              MAINTENANT
            </Text>
          </View>
        ) : !blocked ? (
          <Text style={{ color: L.muted, fontSize: 11 }}>{action.costLabel}</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const avatar           = useGameStore((s) => s.avatar);
  const stats            = useGameStore((s) => s.stats);
  const performAction    = useGameStore((s) => s.performAction);
  const dailyGoals       = useGameStore((s) => s.dailyGoals);
  const bootstrap        = useGameStore((s) => s.bootstrap);
  const dailyEvent       = useGameStore((s) => s.dailyEvent);
  const playerLevel      = useGameStore((s) => s.playerLevel ?? 1);
  const housingTier      = useGameStore((s) => s.housingTier);
  const checkHousingRent = useGameStore((s) => s.checkHousingRent);
  const lifeFeed         = useGameStore((s) => s.lifeFeed ?? []);
  const worldEvent       = useGameStore((s) => s.worldEvent);
  const worldEventJoined = useGameStore((s) => s.worldEventJoined ?? false);
  const joinWorldEvent   = useGameStore((s) => s.joinWorldEvent);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  useFocusEffect(useCallback(() => { bootstrap(); checkHousingRent(); }, [bootstrap, checkHousingRent]));

  const timeCtx    = useTimeContext();
  const wellbeing  = getWellbeingScore(stats);
  const housing    = getHousingTier(housingTier);
  const suggested  = getSuggestedActions(timeCtx);
  const doneGoals  = dailyGoals.filter((g) => g.completed).length;
  const totalGoals = dailyGoals.length;

  // ── Seuils réalistes — alerte avant que ce soit trop tard ─────────────────
  const crises = [
    stats.energy < 25  && { emoji: "🛌", label: "T'es à plat",     body: "Roupille avant de faire quoi que ce soit.",  action: "sleep"        as LifeActionId },
    stats.hunger < 30  && { emoji: "🍱", label: "T'as la dalle",   body: "Mange quelque chose maintenant.",            action: "healthy-meal" as LifeActionId },
    stats.mood < 30    && { emoji: "🧘", label: "Mood au fond",     body: "Pose-toi. Ça changera tout.",                action: "meditate"     as LifeActionId },
    stats.hygiene < 25 && { emoji: "🚿", label: "Look en carton",  body: "Vas te laver avant de sortir.",              action: "shower"       as LifeActionId },
    stats.money < 20   && { emoji: "💼", label: "Plus de thunes",  body: "File au taff dès que t'as de la pêche.",     action: "work-shift"   as LifeActionId },
  ].filter(Boolean) as { emoji: string; label: string; body: string; action: LifeActionId }[];

  const topCrisis  = crises[0];
  const actionById = new Map(ALL_ACTIONS.map((a) => [a.id, a]));

  // Raison de blocage explicite
  function blockedReason(a: ActionDef): string | undefined {
    if (a.id === "work-shift" && !timeCtx.workAvailable) return "Pas dispo à cette heure";
    if (a.minEnergy && stats.energy < a.minEnergy) return `Pêche insuffisante (${Math.round(stats.energy)}/${a.minEnergy})`;
    if (a.minMoney  && stats.money  < a.minMoney)  return `Manque de thunes (${Math.round(stats.money)}/${a.minMoney} bl)`;
    return undefined;
  }

  // Liste : crise prioritaire + suggestions + essentiels, dispo d'abord puis bloqués
  const wantedIds = Array.from(new Set([
    topCrisis?.action,
    ...suggested,
    "work-shift", "healthy-meal", "sleep", "shower", "walk", "meditate",
  ].filter(Boolean) as LifeActionId[])).slice(0, 8);

  const allRows = wantedIds
    .map((id) => {
      const action = actionById.get(id);
      if (!action) return null;
      return { action, blocked: blockedReason(action) };
    })
    .filter(Boolean) as { action: ActionDef; blocked: string | undefined }[];

  const availableRows = allRows.filter((r) => !r.blocked).slice(0, 5);
  const blockedRows   = allRows.filter((r) => r.blocked).slice(0, 2);
  const listRows      = [...availableRows, ...blockedRows];

  // Greeting selon l'heure
  const hour   = new Date().getHours();
  const salut  = hour < 12 ? "Bon matin" : hour < 18 ? "Bon aprèm" : "Bonne nuit";
  const name   = avatar?.displayName?.split(" ")[0] ?? "frère";

  // État de vie
  const wbColor  = wellbeing > 65 ? L.green : wellbeing > 40 ? L.gold : L.red;
  const wbLabel  = wellbeing > 65 ? "En forme 🔥" : wellbeing > 40 ? "Ça va tenir ⚡" : "Danger 🚨";

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim         = useRef(new Animated.Value(0)).current;
  const toastTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim          = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  function showToast(text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => setToast(null));
    toastTimer.current = setTimeout(() => setToast(null), 2100);
  }

  function handleAction(id: LifeActionId) {
    performAction(id);
    hapticImpact("medium");
    const msgs: Record<string, string> = {
      "work-shift":   "+thunes +côte 💰",
      "sleep":        "pêche rechargée ⚡",
      "nap":          "+pêche rapide ⚡",
      "healthy-meal": "+dalle +forme 🍱",
      "home-cooking": "+dalle 🍳",
      "shower":       "+look +mood 👟",
      "walk":         "+mood -stress 🏃",
      "gym":          "+forme 💪",
      "meditate":     "-stress +zen 🧘",
      "cafe-chat":    "+réseau ☕",
      "team-sport":   "+réseau +forme 🏀",
      "read-book":    "+motivation 📚",
      "shopping":     "+look 🛍️",
    };
    showToast(msgs[id] ?? "+xp 🔥");
  }

  const statRows = [
    { emoji: "⚡", label: "Pêche",  value: stats.energy   },
    { emoji: "🍱", label: "Dalle",  value: stats.hunger   },
    { emoji: "👟", label: "Look",   value: stats.hygiene  },
    { emoji: "😤", label: "Mood",   value: stats.mood     },
  ].sort((a, b) => a.value - b.value);

  return (
    <Animated.View style={{ flex: 1, backgroundColor: L.bg, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}>
        <DailyEventModal visible={eventModalOpen} onClose={() => setEventModalOpen(false)} />

        {/* ── HEADER ── */}
        <View style={{ paddingTop: 54, paddingHorizontal: 20, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: L.border }}>

          {/* Top row: greeting + money */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            marginBottom: 16 }}>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "900",
              letterSpacing: 2.5, textTransform: "uppercase" }}>
              {salut}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4,
              backgroundColor: L.primaryBg, borderRadius: 20,
              paddingHorizontal: 12, paddingVertical: 6,
              borderWidth: 1, borderColor: L.primary + "35",
              shadowColor: L.primary, shadowOpacity: 0.2, shadowRadius: 10 }}>
              <Text style={{ fontSize: 12 }}>💰</Text>
              <Text style={{ color: L.primary, fontSize: 14, fontWeight: "900" }}>
                {Math.round(stats.money)} BL
              </Text>
            </View>
          </View>

          {/* Avatar + Identity */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {/* Avatar with animated neon ring */}
            <View style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center" }}>
              <Animated.View style={{
                position: "absolute", width: 56, height: 56, borderRadius: 28,
                borderWidth: 2, borderColor: wbColor,
                shadowColor: wbColor, shadowOpacity: 0.7, shadowRadius: 12,
                opacity: fadeAnim,
              }} />
              <View style={{ width: 50, height: 50, borderRadius: 25,
                backgroundColor: L.card, borderWidth: 1, borderColor: wbColor + "30",
                alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {avatar
                  ? <AvatarSprite visual={getAvatarVisual(avatar)} action={stats.energy < 20 ? "sleeping" : "idle"} size="sm" />
                  : <Text style={{ fontSize: 24 }}>🧢</Text>}
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: L.text, fontSize: 19, fontWeight: "900",
                letterSpacing: -0.5 }}>
                {name.toUpperCase()}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
                <View style={{ backgroundColor: L.purple + "18", borderRadius: 6,
                  paddingHorizontal: 7, paddingVertical: 2,
                  borderWidth: 1, borderColor: L.purple + "30" }}>
                  <Text style={{ color: L.purple, fontSize: 10, fontWeight: "900" }}>
                    NIV {playerLevel}
                  </Text>
                </View>
                <Text style={{ color: L.muted, fontSize: 11 }}>
                  {housing.emoji} {housing.name}
                </Text>
              </View>
            </View>

            {/* Wellbeing status badge */}
            <View style={{ alignItems: "center", gap: 2 }}>
              <View style={{ backgroundColor: wbColor + "15", borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 6,
                borderWidth: 1, borderColor: wbColor + "35",
                shadowColor: wbColor, shadowOpacity: 0.3, shadowRadius: 8 }}>
                <Text style={{ color: wbColor, fontSize: 11, fontWeight: "900" }}>{wbLabel}</Text>
              </View>
            </View>
          </View>

          {/* XP / Wellbeing bar */}
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between",
              alignItems: "center", marginBottom: 6 }}>
              <Text style={{ color: L.muted, fontSize: 9, fontWeight: "900", letterSpacing: 2 }}>
                ÉTAT GÉNÉRAL
              </Text>
              <Text style={{ color: wbColor, fontSize: 9, fontWeight: "900" }}>
                {Math.round(wellbeing)}/100
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)",
              overflow: "hidden" }}>
              <View style={{ height: 8, borderRadius: 4,
                width: `${Math.max(0, Math.min(100, wellbeing))}%` as `${number}%`,
                backgroundColor: wbColor,
                shadowColor: wbColor, shadowOpacity: 0.9, shadowRadius: 8 }} />
            </View>
          </View>
        </View>

        {/* ── LIVE PARIS ── */}
        <LiveParisWidget />

        <View style={{ paddingHorizontal: 20 }}>

          {/* ── URGENT — bouton pleine largeur ── */}
          {topCrisis && (() => {
            const action = actionById.get(topCrisis.action);
            const avail  = action ? !blockedReason(action) : false;
            return (
              <View style={{ marginTop: 20, backgroundColor: L.card, borderRadius: 16,
                padding: 18, gap: 14, borderWidth: 1, borderColor: L.red + "22" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 28 }}>{topCrisis.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: L.red, fontSize: 9, fontWeight: "900",
                      letterSpacing: 1.5 }}>URGENT</Text>
                    <Text style={{ color: L.text, fontSize: 17, fontWeight: "900",
                      marginTop: 2 }}>
                      {topCrisis.label}
                    </Text>
                    <Text style={{ color: L.textSoft, fontSize: 13, marginTop: 3 }}>
                      {topCrisis.body}
                    </Text>
                  </View>
                </View>
                {crises.length > 1 && (
                  <Text style={{ color: L.muted, fontSize: 11 }}>
                    +{crises.length - 1} autre{crises.length > 2 ? "s" : ""} point{crises.length > 2 ? "s" : ""} à régler
                  </Text>
                )}
                <Pressable
                  onPress={() => { if (action && avail) handleAction(topCrisis.action); }}
                  style={{ backgroundColor: avail ? L.red : L.cardAlt,
                    borderRadius: 12, paddingVertical: 16, alignItems: "center",
                    shadowColor: L.red, shadowOpacity: avail ? 0.3 : 0, shadowRadius: 10 }}>
                  <Text style={{ color: avail ? "#fff" : L.muted, fontSize: 15, fontWeight: "900" }}>
                    {avail ? `${topCrisis.emoji}  Faire maintenant` : "Non disponible maintenant"}
                  </Text>
                </Pressable>
              </View>
            );
          })()}

          {/* ── TON ÉTAT ── */}
          <View style={{ marginTop: 28 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Text style={{ color: L.muted, fontSize: 9, fontWeight: "900", letterSpacing: 3 }}>
                TON ÉTAT
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: wbColor + "25" }} />
              <Text style={{ color: wbColor, fontSize: 9, fontWeight: "700", letterSpacing: 1 }}>
                {wbLabel}
              </Text>
            </View>
            {statRows.map((s) => <StatRow key={s.label} {...s} />)}
          </View>

          {/* ── CE QUE TU FAIS ── */}
          <View style={{ marginTop: 28 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 }}>
              <Text style={{ color: L.muted, fontSize: 9, fontWeight: "900", letterSpacing: 3 }}>
                CE QUE TU FAIS
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: L.primary + "20" }} />
            </View>
            {listRows.map(({ action, blocked }, i) => (
              <ActionRow
                key={action.id}
                action={action}
                isNext={i === 0 && !blocked && !topCrisis}
                blockedReason={blocked}
                onPress={() => handleAction(action.id)}
              />
            ))}
          </View>

          {/* ── MISSIONS ── */}
          {totalGoals > 0 && (
            <Pressable onPress={() => router.push("/(app)/missions" as never)}
              style={{ marginTop: 24, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>
                MISSIONS
              </Text>
              <Text style={{ color: doneGoals === totalGoals ? L.green : L.textSoft,
                fontSize: 11, fontWeight: "800" }}>
                {doneGoals}/{totalGoals}
              </Text>
              <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: L.card, overflow: "hidden" }}>
                <View style={{ height: 3, borderRadius: 2,
                  width: `${(doneGoals / totalGoals) * 100}%` as `${number}%`,
                  backgroundColor: doneGoals === totalGoals ? L.green : L.primary }} />
              </View>
              <Text style={{ color: L.muted, fontSize: 12 }}>→</Text>
            </Pressable>
          )}

          {/* ── ÉVÉNEMENTS ── */}
          {worldEvent && (
            <Pressable onPress={() => !worldEventJoined && joinWorldEvent()}
              style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: L.card, borderRadius: 12, padding: 14,
                borderWidth: 1, borderColor: worldEventJoined ? L.border : L.teal + "22" }}>
              <Text style={{ fontSize: 20 }}>{worldEvent.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: L.teal, fontSize: 9, fontWeight: "800", letterSpacing: 1 }}>
                  ÉVÉNEMENT
                </Text>
                <Text numberOfLines={1} style={{ color: L.text, fontSize: 13, fontWeight: "700", marginTop: 1 }}>
                  {worldEvent.title}
                </Text>
              </View>
              <Text style={{ color: worldEventJoined ? L.green : L.teal, fontSize: 12, fontWeight: "800" }}>
                {worldEventJoined ? "✓" : "+XP →"}
              </Text>
            </Pressable>
          )}

          {dailyEvent && !dailyEvent.resolved && (
            <Pressable onPress={() => setEventModalOpen(true)}
              style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: L.card, borderRadius: 12, padding: 14,
                borderWidth: 1, borderColor: L.primary + "18" }}>
              <Text style={{ fontSize: 18 }}>📅</Text>
              <Text numberOfLines={1} style={{ color: L.text, fontSize: 13, fontWeight: "700", flex: 1 }}>
                {dailyEvent.title}
              </Text>
              <Text style={{ color: L.primary, fontSize: 12, fontWeight: "800" }}>→</Text>
            </Pressable>
          )}

          {/* ── FEED ── 3 lignes max ── */}
          {lifeFeed.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 2 }}>
                LE FEED
              </Text>
              {lifeFeed.slice(0, 3).map((item, i) => (
                <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                  paddingVertical: 10,
                  borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: L.border }}>
                  <Text style={{ fontSize: 14 }}>
                    {item.id.includes("lvl") ? "⬆️" : item.id.includes("encounter") ? "👤" : "·"}
                  </Text>
                  <Text style={{ color: L.textSoft, fontSize: 13, flex: 1 }}>{item.title}</Text>
                </View>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── Toast ── */}
      {toast && (
        <Animated.View pointerEvents="none" style={{
          position: "absolute", bottom: 100, left: 24, right: 24,
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0,1], outputRange: [8,0] }) }],
        }}>
          <View style={{ backgroundColor: L.card, borderRadius: 12,
            paddingHorizontal: 20, paddingVertical: 13,
            borderWidth: 1, borderColor: L.primary + "25", alignItems: "center" }}>
            <Text style={{ color: L.text, fontSize: 14, fontWeight: "800" }}>{toast}</Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
