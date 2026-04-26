"use client";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual } from "@/lib/avatar-visual";
import { getHousingTier } from "@/lib/housing";
import { getWellbeingScore } from "@/lib/selectors";
import { getSuggestedActions, useTimeContext } from "@/lib/time-context";
import type { LifeActionId } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

// ─── Light theme ─────────────────────────────────────────────────────────────
const L = {
  bg:        "#e8edf5",
  card:       "#f0f4fa",
  text:      "#1e2a3a",
  textSoft:  "#4a5568",
  muted:     "#8fa3b8",
  border:    "#ccd4e0",
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
  purple:    "#8b5cf6",
  purpleBg:  "#f5f3ff",
  teal:      "#14b8a6",
  tealBg:    "#f0fdfa",
  orange:    "#f97316",
  orangeBg:  "#fff7ed",
  pink:      "#ec4899",
  pinkBg:    "#fdf2f8",
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
  { id: "healthy-meal",  emoji: "🍱", label: "Repas sain",      costLabel: "14 cr",   gainLabel: "+Faim +Santé",        category: "survie" },
  { id: "home-cooking",  emoji: "🍳", label: "Cuisiner",         costLabel: "8 cr",    gainLabel: "+Faim économique",    category: "survie" },
  { id: "sleep",         emoji: "🛌", label: "Dormir",           costLabel: "temps",   gainLabel: "+Énergie max",         category: "survie" },
  { id: "nap",           emoji: "💤", label: "Sieste 20 min",    costLabel: "temps",   gainLabel: "+Énergie rapide",      category: "survie" },
  { id: "shower",        emoji: "🚿", label: "Douche",           costLabel: "3 cr",    gainLabel: "+Hygiène +Humeur",     category: "survie" },
  { id: "work-shift",    emoji: "💼", label: "Travailler",       costLabel: "énergie", gainLabel: "+Argent +Rép",         category: "travail", minEnergy: 20 },
  { id: "cafe-chat",     emoji: "☕", label: "Café social",      costLabel: "8 cr",    gainLabel: "+Social +Humeur",      category: "social",  minMoney: 8 },
  { id: "team-sport",    emoji: "🏀", label: "Sport collectif",  costLabel: "énergie", gainLabel: "+Social +Forme",       category: "social",  minEnergy: 25 },
  { id: "walk",          emoji: "🏃", label: "Marcher",          costLabel: "énergie", gainLabel: "+Humeur -Stress",      category: "santé" },
  { id: "gym",           emoji: "🏋️", label: "Salle de sport",   costLabel: "12 cr",   gainLabel: "+Forme +Discipline",   category: "santé",   minEnergy: 22, minMoney: 12 },
  { id: "meditate",      emoji: "🧘", label: "Méditer",          costLabel: "temps",   gainLabel: "-Stress +Zen",         category: "santé" },
  { id: "read-book",     emoji: "📚", label: "Lire",             costLabel: "énergie", gainLabel: "+Motivation +Calme",   category: "santé" },
  { id: "shopping",      emoji: "🛍️", label: "Shopping",         costLabel: "35 cr",   gainLabel: "+Image +Humeur",       category: "social",  minMoney: 35 },
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
  const pct     = Math.max(0, Math.min(100, value));
  const urgent  = pct < 25;
  const warn    = pct < 45;
  const displayColor = urgent ? L.red : warn ? L.gold : color;
  const displayBg    = urgent ? L.redBg : warn ? L.goldBg : bg;

  return (
    <View style={{ flex: 1, minWidth: 130, backgroundColor: displayBg, borderRadius: 18,
      padding: 14, borderWidth: 1, borderColor: displayColor + "25", gap: 8,
      shadowColor: displayColor, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        <Text style={{ color: displayColor, fontSize: 20, fontWeight: "900" }}>{Math.round(pct)}</Text>
      </View>
      <Text style={{ color: L.text, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: displayColor + "20", overflow: "hidden" }}>
        <View style={{ height: 6, borderRadius: 3, width: `${pct}%` as `${number}%`, backgroundColor: displayColor }} />
      </View>
    </View>
  );
}

// ─── ActionButton ────────────────────────────────────────────────────────────
function ActionButton({ action, onPress, disabled, primary }: {
  action: ActionDef; onPress: () => void; disabled: boolean; primary?: boolean;
}) {
  const color = CAT_COLOR[action.category];
  const bg    = CAT_BG[action.category];
  return (
    <Pressable onPress={onPress} disabled={disabled}
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
    stats.hunger < 18  && { emoji: "🍱", title: "Ton personnage a faim",        body: "Mange maintenant.",                action: "healthy-meal" as LifeActionId },
    stats.energy < 15  && { emoji: "🛌", title: "Il est épuisé",                body: "Dors pour récupérer de l'énergie.", action: "sleep" as LifeActionId },
    stats.hygiene < 15 && { emoji: "🚿", title: "Hygiène trop basse",           body: "Prends une douche.",                action: "shower" as LifeActionId },
    stats.mood < 15    && { emoji: "🧘", title: "Moral très bas",               body: "Fais une pause calme.",             action: "meditate" as LifeActionId },
    stats.money < 20   && { emoji: "💼", title: "Budget serré",                 body: "Travaille dès que possible.",       action: "work-shift" as LifeActionId },
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
    { emoji: "🍱", label: "Faim",    value: stats.hunger,   color: L.gold,   bg: L.goldBg   },
    { emoji: "⚡", label: "Énergie", value: stats.energy,   color: L.blue,   bg: L.blueBg   },
    { emoji: "🚿", label: "Hygiène", value: stats.hygiene,  color: L.teal,   bg: L.tealBg   },
    { emoji: "😊", label: "Moral",   value: stats.mood,     color: L.purple, bg: L.purpleBg },
    { emoji: "❤️", label: "Santé",   value: stats.health,   color: L.red,    bg: L.redBg    },
    { emoji: "👥", label: "Social",  value: stats.sociability, color: L.primary, bg: L.primaryBg },
    { emoji: "✨", label: "Image",   value: stats.attractiveness, color: L.pink, bg: L.pinkBg },
    { emoji: "🧘", label: "Zen",     value: 100 - stats.stress, color: "#a78bfa", bg: L.purpleBg },
  ].sort((a, b) => a.value - b.value).slice(0, 4);

  const nextGoal  = dailyGoals.find((g) => !g.completed);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, []);

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
                <Text style={{ color: "#fde68a", fontWeight: "900", fontSize: 13 }}>💰 {stats.money}</Text>
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
                État général {wellbeing}%
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>Niv. {playerLevel}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
              <View style={{ height: 8, borderRadius: 4,
                width: `${Math.max(0, Math.min(100, wellbeing))}%` as `${number}%`,
                backgroundColor: "#fff" }} />
            </View>
          </View>
        </View>

        <View style={{ padding: 16, gap: 16, maxWidth: 980, width: "100%", alignSelf: "center" }}>

          {/* ── PRIORITÉ ── */}
          <Pressable onPress={() => primaryAction ? performAction(primaryAction.id) : router.push("/(app)/(tabs)/world" as never)}
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
              À SURVEILLER
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
              ACTIONS RAPIDES
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {quickActions.map((action, i) => (
                <ActionButton key={action.id} action={action} primary={i === 0}
                  disabled={!isAvailable(action)} onPress={() => performAction(action.id)} />
              ))}
            </View>
          </View>

          {/* ── OBJECTIFS ── */}
          <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, gap: 12,
            borderWidth: 1, borderColor: L.border,
            shadowColor: "rgba(0,0,0,0.04)", shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: L.text, fontSize: 15, fontWeight: "800" }}>Objectifs du jour</Text>
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
                {nextGoal?.label ?? "Tous les objectifs sont terminés !"}
              </Text>
              <Pressable onPress={() => router.push("/(app)/missions" as never)}>
                <Text style={{ color: L.primary, fontSize: 12, fontWeight: "700" }}>Voir →</Text>
              </Pressable>
            </View>
          </View>

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
              { emoji: "🗺️", label: "Ville",     route: "/(app)/(tabs)/world",  color: L.teal,   bg: L.tealBg    },
              { emoji: "💊", label: "Santé",     route: "/(app)/health",        color: L.red,    bg: L.redBg     },
              { emoji: "💼", label: "Travail",   route: "/(app)/work",          color: L.blue,   bg: L.blueBg    },
              { emoji: "👥", label: "Relations", route: "/(app)/relations",     color: L.purple, bg: L.purpleBg  },
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
                PRÉSENTS ICI
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

          {/* ── DERNIER ÉVÉNEMENT ── */}
          {lifeFeed.length > 0 && (
            <View style={{ backgroundColor: L.card, borderRadius: 16, padding: 14,
              borderWidth: 1, borderColor: L.border }}>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 }}>
                DERNIER ÉVÉNEMENT
              </Text>
              <Text style={{ color: L.text, fontWeight: "700", fontSize: 13 }}>{lifeFeed[0].title}</Text>
              <Text numberOfLines={1} style={{ color: L.muted, fontSize: 12, marginTop: 3 }}>{lifeFeed[0].body}</Text>
            </View>
          )}

        </View>
      </ScrollView>
    </Animated.View>
  );
}
