"use client";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual } from "@/lib/avatar-visual";
import { getHousingTier } from "@/lib/housing";
import { hapticImpact } from "@/lib/safe-haptics";
import { getWellbeingScore } from "@/lib/selectors";
import { getSuggestedActions, useTimeContext } from "@/lib/time-context";
import type { LifeActionId } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";
import { useAppTheme } from "@/hooks/use-app-theme";

// ─── Quartier Life static theme tokens ───────────────────────────────────────
const L = {
  bg:         "#080808",
  card:       "#111111",
  cardAlt:    "#181818",
  text:       "#F5F2E8",
  textSoft:   "#A8A49A",
  muted:      "#4A4844",
  border:     "rgba(255,255,255,0.07)",
  primary:    "#FFD600",
  primaryBg:  "#1A1500",
  green:      "#39FF14",
  greenBg:    "#091A03",
  gold:       "#FFD600",
  goldBg:     "#1A1500",
  red:        "#FF3B3B",
  redBg:      "#1A0808",
  blue:       "#00B4FF",
  blueBg:     "#001A2A",
  purple:     "#BF5FFF",
  purpleBg:   "#18082A",
  pink:       "#FF2D78",
  pinkBg:     "#1A0818",
  teal:       "#00FFD1",
  tealBg:     "#001A14",
  orange:     "#FF6B00",
  orangeBg:   "#1A0D00",
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
  { id: "healthy-meal",  emoji: "🍱", label: "Manger propre",    costLabel: "14 bl",   gainLabel: "+Dalle +Forme",         category: "survie" },
  { id: "home-cooking",  emoji: "🍳", label: "Faire la popote",  costLabel: "8 bl",    gainLabel: "+Dalle économe",        category: "survie" },
  { id: "sleep",         emoji: "🛌", label: "Roupiller",        costLabel: "temps",   gainLabel: "+Pêche max",            category: "survie" },
  { id: "nap",           emoji: "💤", label: "Piquer un som",    costLabel: "temps",   gainLabel: "+Pêche rapide",         category: "survie" },
  { id: "shower",        emoji: "🚿", label: "Se laver",         costLabel: "3 bl",    gainLabel: "+Look +Mood",           category: "survie" },
  { id: "work-shift",    emoji: "💼", label: "Aller au taff",    costLabel: "pêche",   gainLabel: "+Thunes +Côte",         category: "travail", minEnergy: 20 },
  { id: "cafe-chat",     emoji: "☕", label: "Poser au bando",   costLabel: "8 bl",    gainLabel: "+Réseau +Mood",         category: "social",  minMoney: 8 },
  { id: "team-sport",    emoji: "🏀", label: "Terrain de foot",  costLabel: "pêche",   gainLabel: "+Réseau +Forme",        category: "social",  minEnergy: 25 },
  { id: "walk",          emoji: "🏃", label: "Faire un tour",    costLabel: "pêche",   gainLabel: "+Mood -Stress",         category: "santé" },
  { id: "gym",           emoji: "🏋️", label: "Aller à la salle", costLabel: "12 bl",   gainLabel: "+Forme +Discipline",    category: "santé",   minEnergy: 22, minMoney: 12 },
  { id: "meditate",      emoji: "🧘", label: "Se poser",         costLabel: "temps",   gainLabel: "-Stress +Zen",          category: "santé" },
  { id: "read-book",     emoji: "📚", label: "S'instruire",      costLabel: "pêche",   gainLabel: "+Motivation +Calme",    category: "santé" },
  { id: "shopping",      emoji: "🛍️", label: "Le Marais / SNKRS", costLabel: "35 bl",  gainLabel: "+Look +Mood",           category: "social",  minMoney: 35 },
];

const CAT_COLOR: Record<ActionDef["category"], string> = {
  survie:  L.orange,
  travail: L.blue,
  social:  L.purple,
  santé:   L.green,
};
const CAT_BG: Record<ActionDef["category"], string> = {
  survie:  L.orangeBg,
  travail: L.blueBg,
  social:  L.purpleBg,
  santé:   L.greenBg,
};

// ─── Daily Event Modal ────────────────────────────────────────────────────────
function DailyEventModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const dailyEvent       = useGameStore((s) => s.dailyEvent);
  const resolveDailyEvent = useGameStore((s) => s.resolveDailyEvent);
  if (!dailyEvent || dailyEvent.resolved || !visible) return null;

  const kindColor =
    dailyEvent.kind === "opportunity" ? L.primary :
    dailyEvent.kind === "windfall"    ? L.gold :
    dailyEvent.kind === "encounter"   ? L.purple :
    dailyEvent.kind === "social"      ? L.blue : L.red;
  const kindEmoji =
    dailyEvent.kind === "opportunity" ? "✨" :
    dailyEvent.kind === "windfall"    ? "🎁" :
    dailyEvent.kind === "encounter"   ? "👤" :
    dailyEvent.kind === "social"      ? "🤝" : "⚠️";

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end", padding: 16 }}>
        <View style={{ backgroundColor: L.card, borderRadius: 28, padding: 24, gap: 18,
          borderWidth: 1, borderColor: kindColor + "25",
          shadowColor: kindColor, shadowOpacity: 0.15, shadowRadius: 30 }}>

          <View style={{ width: 40, height: 4, borderRadius: 2,
            backgroundColor: L.border, alignSelf: "center" }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 54, height: 54, borderRadius: 18,
              backgroundColor: kindColor + "15", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 28 }}>{kindEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: kindColor, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                ÉVÉNEMENT DU JOUR
              </Text>
              <Text style={{ color: L.text, fontWeight: "900", fontSize: 18, marginTop: 2 }}>
                {dailyEvent.title}
              </Text>
            </View>
          </View>

          <Text style={{ color: L.textSoft, fontSize: 14, lineHeight: 22 }}>{dailyEvent.body}</Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: kindColor + "0d", borderRadius: 14, padding: 12,
              borderWidth: 1, borderColor: kindColor + "25" }}>
              <Text style={{ color: kindColor, fontWeight: "800", fontSize: 12, marginBottom: 6 }}>
                ✓ {dailyEvent.actionLabel}
              </Text>
              {Object.entries(dailyEvent.effects).filter(([, v]) => v).map(([k, v]) => (
                <Text key={k} style={{ color: L.green, fontSize: 11 }}>
                  {(v as number) > 0 ? "+" : ""}{v} {k}
                </Text>
              ))}
            </View>
            {dailyEvent.kind !== "windfall" && (
              <View style={{ flex: 1, backgroundColor: L.bg, borderRadius: 14, padding: 12,
                borderWidth: 1, borderColor: L.border }}>
                <Text style={{ color: L.muted, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>✗ Ignorer</Text>
                {Object.entries(dailyEvent.skipEffects).filter(([, v]) => v).map(([k, v]) => (
                  <Text key={k} style={{ color: L.red, fontSize: 11 }}>
                    {(v as number) > 0 ? "+" : ""}{v} {k}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => { resolveDailyEvent("accepted"); onClose(); }}
              style={{ flex: 2, paddingVertical: 16, borderRadius: 16, backgroundColor: kindColor,
                alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>{dailyEvent.actionLabel}</Text>
            </Pressable>
            {dailyEvent.kind !== "windfall" && (
              <Pressable onPress={() => { resolveDailyEvent("skipped"); onClose(); }}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: L.bg,
                  borderWidth: 1, borderColor: L.border, alignItems: "center" }}>
                <Text style={{ color: L.muted, fontWeight: "700", fontSize: 13 }}>Passer</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── NeedTile ────────────────────────────────────────────────────────────────
function NeedTile({ emoji, label, value, color, bg }: {
  emoji: string; label: string; value: number; color: string; bg: string;
}) {
  const pct          = Math.max(0, Math.min(100, value));
  const urgent       = pct < 25;
  const warn         = pct < 45;
  const displayColor = urgent ? L.red : warn ? L.gold : color;
  const displayBg    = urgent ? L.redBg : warn ? L.goldBg : bg;

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!urgent) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.035, duration: 650, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,     duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [urgent, pulse]);

  return (
    <Animated.View style={{ flex: 1, minWidth: 130, backgroundColor: displayBg, borderRadius: 18,
      padding: 14, borderWidth: 1, borderColor: displayColor + "25", gap: 8,
      shadowColor: displayColor, shadowOpacity: urgent ? 0.14 : 0.06, shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 }, transform: [{ scale: pulse }] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        <Text style={{ color: displayColor, fontSize: 20, fontWeight: "900" }}>{Math.round(pct)}</Text>
      </View>
      <Text style={{ color: L.text, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: displayColor + "20", overflow: "hidden" }}>
        <View style={{ height: 6, borderRadius: 3, width: `${pct}%` as `${number}%`, backgroundColor: displayColor }} />
      </View>
    </Animated.View>
  );
}

// ─── ActionButton ────────────────────────────────────────────────────────────
function ActionButton({ action, onPress, disabled, primary }: {
  action: ActionDef; onPress: () => void; disabled: boolean; primary?: boolean;
}) {
  const color = CAT_COLOR[action.category];
  const bg    = CAT_BG[action.category];
  function handlePress() {
    hapticImpact(primary ? "medium" : "light");
    onPress();
  }
  return (
    <Pressable onPress={handlePress} disabled={disabled}
      style={{ flex: 1, minWidth: 145, borderRadius: 18, padding: 14, gap: 8,
        backgroundColor: primary ? color : bg,
        borderWidth: 1, borderColor: primary ? color : color + "30",
        opacity: disabled ? 0.45 : 1,
        shadowColor: color, shadowOpacity: primary ? 0.2 : 0.06,
        shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
      <Text style={{ fontSize: 24 }}>{action.emoji}</Text>
      <Text style={{ color: primary ? "#fff" : L.text, fontSize: 14, fontWeight: "800" }}>
        {action.label}
      </Text>
      <Text numberOfLines={1} style={{ color: primary ? "rgba(255,255,255,0.75)" : color, fontSize: 11, fontWeight: "600" }}>
        {action.gainLabel}
      </Text>
    </Pressable>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const avatar           = useGameStore((s) => s.avatar);
  const stats            = useGameStore((s) => s.stats);
  const currentLocation  = useGameStore((s) => s.currentLocationSlug);
  const performAction    = useGameStore((s) => s.performAction);
  const dailyGoals       = useGameStore((s) => s.dailyGoals);
  const bootstrap        = useGameStore((s) => s.bootstrap);
  const dailyEvent       = useGameStore((s) => s.dailyEvent);
  const playerLevel      = useGameStore((s) => s.playerLevel ?? 1);
  const housingTier      = useGameStore((s) => s.housingTier);
  const checkHousingRent = useGameStore((s) => s.checkHousingRent);
  const lifeFeed         = useGameStore((s) => s.lifeFeed ?? []);
  const npcs             = useGameStore((s) => s.npcs);
  const dailyQuests      = useGameStore((s) => s.dailyQuests ?? []);
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
  const goalPct    = totalGoals > 0 ? (doneGoals / totalGoals) * 100 : 0;
  const wbColor    = wellbeing > 65 ? L.green : wellbeing > 40 ? L.gold : L.red;

  const isAvailable = (a: ActionDef) => {
    if (a.minEnergy && stats.energy < a.minEnergy) return false;
    if (a.minMoney  && stats.money  < a.minMoney)  return false;
    if (a.id === "work-shift" && !timeCtx.workAvailable) return false;
    return true;
  };

  const crises = [
    stats.hunger < 18  && { emoji: "🍱", title: "T'as la dalle",                body: "Mange quelque chose maintenant.",   action: "healthy-meal" as LifeActionId },
    stats.energy < 15  && { emoji: "🛌", title: "T'es à plat",                  body: "Roupille, t'as besoin de pêche.",   action: "sleep" as LifeActionId },
    stats.hygiene < 15 && { emoji: "🚿", title: "Look au plus bas",             body: "Vas te laver, t'as une image.",     action: "shower" as LifeActionId },
    stats.mood < 15    && { emoji: "🧘", title: "Mood à zéro",                  body: "Pose-toi, respire.",                action: "meditate" as LifeActionId },
    stats.money < 20   && { emoji: "💼", title: "Plus de thunes",               body: "File au taff dès que possible.",    action: "work-shift" as LifeActionId },
  ].filter(Boolean) as { emoji: string; title: string; body: string; action: LifeActionId }[];

  const primaryCrisis = crises[0];
  const actionById = new Map(ALL_ACTIONS.map((a) => [a.id, a]));
  const quickIds = Array.from(new Set([
    primaryCrisis?.action,
    ...suggested,
    "healthy-meal", "sleep", "shower", "work-shift", "walk",
  ].filter(Boolean) as LifeActionId[])).slice(0, 4);
  const quickActions   = quickIds.map((id) => actionById.get(id)).filter(Boolean) as ActionDef[];
  const primaryAction  = primaryCrisis ? actionById.get(primaryCrisis.action) : quickActions[0];
  const locationLabel  = currentLocation === "home" ? "Chez toi" : currentLocation;
  const npcsHere       = npcs.filter((n) => n.locationSlug === currentLocation).slice(0, 3);

  const keyNeeds = [
    { emoji: "🍱", label: "Dalle",   value: stats.hunger,        color: L.gold,    bg: L.goldBg    },
    { emoji: "⚡", label: "Pêche",   value: stats.energy,        color: L.blue,    bg: L.blueBg    },
    { emoji: "👟", label: "Look",    value: stats.hygiene,       color: L.teal,    bg: L.tealBg    },
    { emoji: "😤", label: "Mood",    value: stats.mood,          color: L.purple,  bg: L.purpleBg  },
    { emoji: "❤️", label: "Forme",   value: stats.health,        color: L.red,     bg: L.redBg     },
    { emoji: "🤝", label: "Réseau",  value: stats.sociability,   color: L.primary, bg: L.primaryBg },
    { emoji: "🔥", label: "Style",   value: stats.attractiveness,color: L.pink,    bg: L.pinkBg    },
    { emoji: "🧘", label: "Zen",     value: 100 - stats.stress,  color: "#BF5FFF", bg: L.purpleBg  },
  ].sort((a, b) => a.value - b.value).slice(0, 4);

  const nextGoal  = dailyGoals.find((g) => !g.completed);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, []);

  // ── Toast feedback ────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ text: string; color: string } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(text: string, color: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, color });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function handleAction(id: LifeActionId) {
    const before = { money: stats.money, energy: stats.energy, xp: 0 };
    performAction(id);
    const action = actionById.get(id);
    const gains: string[] = [];
    if (id === "work-shift")  gains.push("💰 +thunes", "⭐ +côte");
    else if (id === "sleep")  gains.push("⚡ pêche full");
    else if (id === "nap")    gains.push("⚡ +pêche");
    else if (id === "healthy-meal" || id === "home-cooking") gains.push("🍱 +dalle", "❤️ +forme");
    else if (id === "shower") gains.push("👟 +look", "😤 +mood");
    else if (id === "walk" || id === "gym") gains.push("💪 +forme", "😤 +mood");
    else if (id === "meditate") gains.push("🧘 -stress");
    else if (id === "cafe-chat" || id === "team-sport") gains.push("🤝 +réseau");
    else gains.push("🔥 +XP");
    const color = id === "work-shift" ? L.gold : id === "sleep" || id === "nap" ? L.blue : L.green;
    showToast(gains.join("  "), color);
    hapticImpact("medium");
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: L.bg }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}>
        <DailyEventModal visible={eventModalOpen} onClose={() => setEventModalOpen(false)} />

        {/* ── HERO HEADER ── */}
        <View style={{ backgroundColor: L.primary, paddingTop: 54, paddingBottom: 28,
          paddingHorizontal: 20, overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -40, right: -30, width: 160, height: 160,
            borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)" }} />
          <View style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120,
            borderRadius: 60, backgroundColor: "rgba(255,255,255,0.05)" }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 76, height: 76, borderRadius: 38,
              backgroundColor: "rgba(255,255,255,0.15)",
              borderWidth: 3, borderColor: "rgba(255,255,255,0.4)",
              alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {avatar
                ? <AvatarSprite visual={getAvatarVisual(avatar)} action={stats.energy < 20 ? "sleeping" : "idle"} size="sm" />
                : <Text style={{ fontSize: 34 }}>🧑</Text>
              }
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: "#fff", fontWeight: "900", fontSize: 22 }}>
                {avatar?.displayName ?? "Mon personnage"}
              </Text>
              <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 3 }}>
                {timeCtx.weatherEmoji} {timeCtx.label} · {locationLabel}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20,
                paddingHorizontal: 11, paddingVertical: 6 }}>
                <Text style={{ color: "#FFD600", fontWeight: "900", fontSize: 13 }}>💰 {stats.money} bl</Text>
              </View>
              <Pressable onPress={() => router.push("/(app)/housing" as never)}
                style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20,
                  paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: "rgba(255,255,255,0.9)", fontWeight: "700", fontSize: 11 }}>
                  {housing.emoji} {housing.name}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Wellbeing bar */}
          <View style={{ marginTop: 18, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700" }}>
                VIE {wellbeing}%
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>Niv. {playerLevel}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
              <View style={{ height: 8, borderRadius: 4,
                width: `${Math.max(0, Math.min(100, wellbeing))}%` as `${number}%`,
                backgroundColor: "#fff" }} />
            </View>
          </View>

          {/* Mini stat pills */}
          <View style={{ flexDirection: "row", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {[
              { emoji: "⚡", val: stats.energy,   color: "#93c5fd" },
              { emoji: "🍱", val: stats.hunger,    color: "#fde68a" },
              { emoji: "😊", val: stats.mood,      color: "#d8b4fe" },
              { emoji: "🚿", val: stats.hygiene,   color: "#99f6e4" },
              { emoji: "💰", val: Math.min(100, stats.money / 5), color: "#6ee7b7", label: `${Math.round(stats.money)} cr` },
            ].map((s, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20,
                paddingHorizontal: 9, paddingVertical: 5 }}>
                <Text style={{ fontSize: 11 }}>{s.emoji}</Text>
                <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
                  <View style={{ height: 5, borderRadius: 3,
                    width: `${Math.max(0, Math.min(100, s.val))}%` as `${number}%`,
                    backgroundColor: s.color }} />
                </View>
                {s.label && <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700" }}>{s.label}</Text>}
              </View>
            ))}
          </View>
        </View>

        <View style={{ padding: 16, gap: 16, maxWidth: 980, width: "100%", alignSelf: "center" }}>

          {/* ── PRIORITÉ ── */}
          <Pressable onPress={() => primaryAction ? handleAction(primaryAction.id) : router.push("/(app)/(tabs)/world" as never)}
            style={{ borderRadius: 22, padding: 18,
              backgroundColor: primaryCrisis ? L.redBg : L.greenBg,
              borderWidth: 1.5, borderColor: primaryCrisis ? L.red + "30" : L.green + "30",
              flexDirection: "row", alignItems: "center", gap: 14,
              shadowColor: primaryCrisis ? L.red : L.green,
              shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            <View style={{ width: 52, height: 52, borderRadius: 16,
              backgroundColor: (primaryCrisis ? L.red : L.green) + "15",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 26 }}>{primaryCrisis?.emoji ?? "✅"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: primaryCrisis ? L.red : L.green, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }}>
                PRIORITÉ
              </Text>
              <Text style={{ color: L.text, fontWeight: "900", fontSize: 17, marginTop: 2 }}>
                {primaryCrisis?.title ?? "Tout est stable"}
              </Text>
              <Text numberOfLines={2} style={{ color: L.textSoft, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
                {primaryCrisis?.body ?? "Explore la ville, progresse ou socialise."}
              </Text>
              {crises.length > 1 && (
                <Text style={{ color: L.red, fontSize: 11, fontWeight: "700", marginTop: 5 }}>
                  +{crises.length - 1} point{crises.length > 2 ? "s" : ""} à régler
                </Text>
              )}
            </View>
            <View style={{ backgroundColor: primaryCrisis ? L.red : L.green, borderRadius: 14,
              paddingHorizontal: 13, paddingVertical: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>
                {primaryAction?.label ?? "Ville"}
              </Text>
            </View>
          </Pressable>

          {/* ── BESOINS ── */}
          <View>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
              TON ÉTAT
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {keyNeeds.map((need) => (
                <NeedTile key={need.label} {...need} />
              ))}
            </View>
          </View>

          {/* ── ACTIONS RAPIDES ── */}
          <View>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
              CE QUE TU FAIS CE SOIR
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {quickActions.map((action, i) => (
                <ActionButton key={action.id} action={action} primary={i === 0}
                  disabled={!isAvailable(action)} onPress={() => handleAction(action.id)} />
              ))}
            </View>
          </View>

          {/* ── OBJECTIFS ── */}
          <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, gap: 12,
            borderWidth: 1, borderColor: L.border,
            shadowColor: "rgba(0,0,0,0.04)", shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: L.text, fontSize: 15, fontWeight: "800" }}>Missions du jour</Text>
              <Text style={{ color: L.primary, fontSize: 13, fontWeight: "800" }}>{doneGoals}/{totalGoals}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: L.border, overflow: "hidden" }}>
              <View style={{ height: 8, borderRadius: 4,
                width: `${goalPct}%` as `${number}%`, backgroundColor: L.primary }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12,
                backgroundColor: nextGoal ? L.border : L.greenBg,
                borderWidth: 1, borderColor: nextGoal ? L.border : L.green + "40",
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: nextGoal ? L.muted : L.green, fontSize: 11 }}>
                  {nextGoal ? "·" : "✓"}
                </Text>
              </View>
              <Text numberOfLines={1} style={{ color: L.textSoft, fontSize: 13, flex: 1 }}>
                {nextGoal?.label ?? "Toutes tes missions sont bouclées 🔥"}
              </Text>
              <Pressable onPress={() => router.push("/(app)/missions" as never)}>
                <Text style={{ color: L.primary, fontSize: 12, fontWeight: "700" }}>Voir →</Text>
              </Pressable>
            </View>
          </View>

          {/* ── QUÊTES DU JOUR ── */}
          {dailyQuests.length > 0 && (() => {
            const done = dailyQuests.filter((q) => q.completed).length;
            const claimed = dailyQuests.filter((q) => q.claimed).length;
            const hasClaim = done > claimed;
            return (
              <Pressable onPress={() => router.push("/(app)/quests" as never)}
                style={{ backgroundColor: hasClaim ? L.goldBg : L.card, borderRadius: 20, padding: 16,
                  borderWidth: 1, borderColor: hasClaim ? L.gold + "40" : L.border,
                  shadowColor: hasClaim ? L.gold : "transparent", shadowOpacity: 0.1, shadowRadius: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>{hasClaim ? "🎁" : "🎯"}</Text>
                    <Text style={{ color: L.text, fontWeight: "800", fontSize: 15 }}>
                      Quêtes du jour
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: hasClaim ? L.gold : L.primary, fontSize: 13, fontWeight: "800" }}>
                      {done}/{dailyQuests.length}
                    </Text>
                    {hasClaim && (
                      <View style={{ backgroundColor: L.gold, borderRadius: 10,
                        paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>CLAIM</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {dailyQuests.map((q) => (
                    <View key={q.id} style={{ flex: 1, gap: 4 }}>
                      <View style={{ height: 6, borderRadius: 3,
                        backgroundColor: q.claimed ? L.green : q.completed ? L.gold : L.border }} />
                      <Text numberOfLines={1} style={{ color: L.muted, fontSize: 9, textAlign: "center" }}>
                        {q.claimed ? "✓" : q.completed ? "🎁" : q.emoji}
                      </Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })()}

          {/* ── ÉVÉNEMENT MONDIAL ── */}
          {worldEvent && (
            <Pressable onPress={() => worldEventJoined ? null : joinWorldEvent()}
              style={{ backgroundColor: worldEventJoined ? L.card : L.tealBg, borderRadius: 18, padding: 14,
                borderWidth: 1, borderColor: worldEventJoined ? L.border : L.teal + "30",
                flexDirection: "row", alignItems: "center", gap: 12,
                shadowColor: worldEventJoined ? "transparent" : L.teal, shadowOpacity: 0.1, shadowRadius: 8 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14,
                backgroundColor: L.teal + "18", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 22 }}>{worldEvent.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: worldEventJoined ? L.muted : L.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>
                  🌍 ÉVÉNEMENT MONDIAL · {worldEvent.city.name.toUpperCase()}
                </Text>
                <Text numberOfLines={1} style={{ color: L.text, fontSize: 13, fontWeight: "700", marginTop: 1 }}>
                  {worldEvent.title}
                </Text>
                <Text style={{ color: L.gold, fontSize: 11, fontWeight: "700", marginTop: 1 }}>
                  +{worldEvent.xpReward} XP · +{worldEvent.moneyReward} cr · +{worldEvent.moodBonus} humeur
                </Text>
              </View>
              {worldEventJoined ? (
                <Text style={{ color: L.green, fontSize: 12, fontWeight: "800" }}>✓ Rejoint</Text>
              ) : (
                <Text style={{ color: L.teal, fontSize: 12, fontWeight: "800" }}>Rejoindre →</Text>
              )}
            </Pressable>
          )}

          {/* ── ÉVÉNEMENT DU JOUR ── */}
          {dailyEvent && !dailyEvent.resolved && (
            <Pressable onPress={() => setEventModalOpen(true)}
              style={{ backgroundColor: L.goldBg, borderRadius: 18, padding: 14,
                borderWidth: 1, borderColor: L.gold + "30",
                flexDirection: "row", alignItems: "center", gap: 12,
                shadowColor: L.gold, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: L.gold + "18",
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 22 }}>📅</Text>
              </View>
              <Text numberOfLines={1} style={{ color: L.text, fontSize: 13, fontWeight: "700", flex: 1 }}>
                {dailyEvent.title}
              </Text>
              <Text style={{ color: L.gold, fontSize: 12, fontWeight: "800" }}>Ouvrir →</Text>
            </Pressable>
          )}

          {/* ── NAVIGATION RAPIDE ── */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { emoji: "🏙️", label: "Le Quartier",  route: "/(app)/(tabs)/world",  color: L.teal,    bg: L.tealBg    },
              { emoji: "🌍", label: "Paris Live",  route: "/(app)/world-social",  color: L.blue,    bg: L.blueBg    },
              { emoji: "🔮", label: "La Dalle",    route: "/(app)/world-live",    color: L.purple,  bg: L.purpleBg  },
              { emoji: "🎯", label: "Missions",    route: "/(app)/quests",        color: L.gold,    bg: L.goldBg    },
              { emoji: "👟", label: "SNKRS",       route: "/(app)/shop",          color: L.pink,    bg: L.pinkBg    },
              { emoji: "💼", label: "Le Taff",     route: "/(app)/work",          color: L.blue,    bg: L.blueBg    },
              { emoji: "🤝", label: "Le Cercle",   route: "/(app)/relations",     color: L.primary, bg: L.primaryBg },
            ].map((item) => (
              <Pressable key={item.route} onPress={() => router.push(item.route as never)}
                style={{ flexDirection: "row", alignItems: "center", gap: 7,
                  backgroundColor: item.bg, borderRadius: 20,
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderWidth: 1, borderColor: item.color + "25" }}>
                <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
                <Text style={{ color: item.color, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* ── PRÉSENTS ICI ── */}
          {npcsHere.length > 0 && (
            <View>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
                DANS LE COIN
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {npcsHere.map((npc) => (
                  <View key={npc.id} style={{ flex: 1, backgroundColor: L.card, borderRadius: 16,
                    padding: 12, borderWidth: 1, borderColor: L.primary + "20",
                    alignItems: "center", gap: 5 }}>
                    <Text style={{ fontSize: 20 }}>
                      {npc.action === "working" ? "💼" : npc.action === "eating" ? "🍽️" :
                       npc.action === "sleeping" ? "😴" : npc.action === "chatting" ? "💬" :
                       npc.action === "exercising" ? "💪" : "💭"}
                    </Text>
                    <Text numberOfLines={1} style={{ color: L.text, fontSize: 12, fontWeight: "700" }}>
                      {npc.name}
                    </Text>
                    <Text style={{ color: L.muted, fontSize: 10 }}>{npc.action}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── JOURNAL ── */}
          {lifeFeed.length > 0 && (
            <View style={{ backgroundColor: L.card, borderRadius: 16, padding: 14,
              borderWidth: 1, borderColor: L.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }}>
                  LE FEED
                </Text>
                <Text style={{ color: L.muted, fontSize: 10 }}>{lifeFeed.length} événements</Text>
              </View>
              {lifeFeed.slice(0, 4).map((item, i) => {
                const isEncounter = item.id.includes("encounter");
                const isLevelUp   = item.id.includes("lvl");
                const isNpcAct    = item.id.includes("npc-act");
                const feedEmoji   = isLevelUp ? "⬆️" : isEncounter ? "👤" : isNpcAct ? "🎭" : "📖";
                const feedBg      = isLevelUp ? L.goldBg : isEncounter ? L.primaryBg : L.bg;
                const feedColor   = isLevelUp ? L.gold : isEncounter ? L.primary : L.muted;
                return (
                  <View key={item.id} style={{
                    flexDirection: "row", alignItems: "flex-start", gap: 10,
                    paddingVertical: 8,
                    borderBottomWidth: i < Math.min(lifeFeed.length, 4) - 1 ? 1 : 0,
                    borderBottomColor: L.border,
                  }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8,
                      backgroundColor: feedBg, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                      <Text style={{ fontSize: 13 }}>{feedEmoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: L.text, fontWeight: "700", fontSize: 12 }}>{item.title}</Text>
                      <Text numberOfLines={1} style={{ color: feedColor, fontSize: 11, marginTop: 1 }}>{item.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── Toast feedback action ── */}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute", bottom: 100, left: 20, right: 20,
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}>
          <View style={{
            backgroundColor: toast.color, borderRadius: 20,
            paddingHorizontal: 20, paddingVertical: 14,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            shadowColor: toast.color, shadowOpacity: 0.35, shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 },
          }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", textAlign: "center" }}>
              {toast.text}
            </Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
