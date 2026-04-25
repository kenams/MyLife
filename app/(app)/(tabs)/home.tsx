"use client";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual } from "@/lib/avatar-visual";

import { getHousingTier } from "@/lib/housing";
import { getMomentumState, getWellbeingScore } from "@/lib/selectors";
import { getTimeModeDescription, getSuggestedActions, useTimeContext } from "@/lib/time-context";
import { colors } from "@/lib/theme";
import type { LifeActionId } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

// ─── Constantes ───────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 200;

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
  { id: "healthy-meal",  emoji: "🍱", label: "Repas sain",     costLabel: "14 cr",   gainLabel: "+Faim +Santé",       category: "survie" },
  { id: "home-cooking",  emoji: "🍳", label: "Cuisiner",        costLabel: "8 cr",    gainLabel: "+Faim ×2 économique",category: "survie" },
  { id: "sleep",         emoji: "🛌", label: "Dormir",          costLabel: "temps",   gainLabel: "+Énergie max",        category: "survie" },
  { id: "nap",           emoji: "💤", label: "Sieste 20 min",   costLabel: "temps",   gainLabel: "+Énergie rapide",     category: "survie" },
  { id: "shower",        emoji: "🚿", label: "Douche",          costLabel: "3 cr",    gainLabel: "+Hygiène +Humeur",    category: "survie" },
  { id: "work-shift",    emoji: "💼", label: "Travailler",      costLabel: "énergie", gainLabel: "+Argent +Rép",        category: "travail", minEnergy: 20 },
  { id: "cafe-chat",     emoji: "☕", label: "Café social",     costLabel: "8 cr",    gainLabel: "+Social +Humeur",     category: "social",  minMoney: 8 },
  { id: "team-sport",    emoji: "🏀", label: "Sport collectif", costLabel: "énergie", gainLabel: "+Social +Forme",      category: "social",  minEnergy: 25 },
  { id: "walk",          emoji: "🏃", label: "Marcher",         costLabel: "énergie", gainLabel: "+Humeur -Stress",     category: "santé" },
  { id: "gym",           emoji: "🏋️", label: "Salle de sport",  costLabel: "12 cr",   gainLabel: "+Forme +Discipline",  category: "santé",   minEnergy: 22, minMoney: 12 },
  { id: "meditate",      emoji: "🧘", label: "Méditer",         costLabel: "temps",   gainLabel: "-Stress +Zen",        category: "santé" },
  { id: "read-book",     emoji: "📚", label: "Lire",            costLabel: "énergie", gainLabel: "+Motivation +Calme",  category: "santé" },
  { id: "shopping",      emoji: "🛍️", label: "Shopping",        costLabel: "35 cr",   gainLabel: "+Image +Humeur",      category: "social",  minMoney: 35 },
];

const CATEGORY_COLORS: Record<ActionDef["category"], string> = {
  survie:  "#f97316",
  travail: "#3b82f6",
  social:  "#a855f7",
  santé:   "#22c55e",
};

const CATEGORY_LABELS: Record<ActionDef["category"], string> = {
  survie:  "🏠 Survie",
  travail: "💼 Travail",
  social:  "👥 Social",
  santé:   "💚 Santé",
};

// ─── Barre de besoin ──────────────────────────────────────────────────────────

function NeedBar({ emoji, label, value, color }: { emoji: string; label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const isLow = pct < 28;
  const isCrit = pct < 15;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  const barColor = isCrit ? colors.danger : isLow ? colors.gold : color;

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 13 }}>{emoji}</Text>
        {isCrit && <Text style={{ fontSize: 9, color: colors.danger, fontWeight: "900" }}>!</Text>}
        <Text style={{ color: isLow ? barColor : colors.muted, fontSize: 10, fontWeight: "800" }}>{Math.round(pct)}</Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <Animated.View style={{ height: 5, borderRadius: 3, width: barWidth, backgroundColor: barColor }} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 9, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

// ─── XP Bar ───────────────────────────────────────────────────────────────────

function XpBar({ xp, level }: { xp: number; level: number }) {
  const xpInLevel = xp % XP_PER_LEVEL;
  const pct = (xpInLevel / XP_PER_LEVEL) * 100;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.goldGlow, borderWidth: 2, borderColor: colors.gold,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 14 }}>{level}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.gold, fontSize: 11, fontWeight: "800" }}>Niveau {level}</Text>
          <Text style={{ color: colors.muted, fontSize: 10 }}>{xpInLevel}/{XP_PER_LEVEL} XP</Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <Animated.View style={{ height: 6, borderRadius: 3, width: barWidth, backgroundColor: colors.gold }} />
        </View>
      </View>
    </View>
  );
}

// ─── Carte d'action ───────────────────────────────────────────────────────────

function ActionCard({
  action, onPress, disabled, isPriority, compact = false
}: { action: ActionDef; onPress: () => void; disabled: boolean; isPriority: boolean; compact?: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const color = CATEGORY_COLORS[action.category];

  return (
    <Animated.View style={{
      flex: compact ? undefined : 1,
      width: compact ? 154 : undefined,
      minWidth: compact ? 154 : "47%",
      transform: [{ scale: scaleAnim }]
    }}>
      <Pressable
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, speed: 60 }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 60 }).start()}
        onPress={onPress}
        disabled={disabled}
        style={{
          borderRadius: 16, padding: compact ? 12 : 14, gap: 6,
          backgroundColor: isPriority ? color + "18" : disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
          borderWidth: isPriority ? 1.5 : 1,
          borderColor: isPriority ? color + "60" : "rgba(255,255,255,0.08)",
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {isPriority && (
          <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: color + "30",
            borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
            <Text style={{ color, fontSize: 8, fontWeight: "900" }}>À faire</Text>
          </View>
        )}
        <Text style={{ fontSize: compact ? 22 : 26 }}>{action.emoji}</Text>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>{action.label}</Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Text style={{ color: "#f87171", fontSize: 10 }}>-{action.costLabel}</Text>
          <Text style={{ color: color, fontSize: 10 }}>{action.gainLabel}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Event du jour Modal ──────────────────────────────────────────────────────

function DailyEventModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const dailyEvent = useGameStore((s) => s.dailyEvent);
  const resolveDailyEvent = useGameStore((s) => s.resolveDailyEvent);
  if (!dailyEvent || dailyEvent.resolved || !visible) return null;

  const kindColor =
    dailyEvent.kind === "opportunity" ? colors.accent :
    dailyEvent.kind === "windfall"    ? colors.gold :
    dailyEvent.kind === "encounter"   ? colors.purple :
    dailyEvent.kind === "social"      ? colors.blue : colors.danger;
  const kindEmoji =
    dailyEvent.kind === "opportunity" ? "✨" :
    dailyEvent.kind === "windfall"    ? "🎁" :
    dailyEvent.kind === "encounter"   ? "👤" :
    dailyEvent.kind === "social"      ? "🤝" : "⚠️";

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end", padding: 16 }}>
        <View style={{
          backgroundColor: "#0d1117", borderRadius: 28, padding: 24, gap: 18,
          borderWidth: 1.5, borderColor: kindColor + "40",
          shadowColor: kindColor, shadowOpacity: 0.4, shadowRadius: 40,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: kindColor + "20",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 28 }}>{kindEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: kindColor, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 2 }}>
                ÉVÉNEMENT DU JOUR
              </Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{dailyEvent.title}</Text>
            </View>
          </View>
          <Text style={{ color: colors.textSoft, fontSize: 14, lineHeight: 22 }}>{dailyEvent.body}</Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: kindColor + "12", borderRadius: 14, padding: 12,
              borderWidth: 1, borderColor: kindColor + "30" }}>
              <Text style={{ color: kindColor, fontWeight: "800", fontSize: 12, marginBottom: 6 }}>✓ {dailyEvent.actionLabel}</Text>
              {Object.entries(dailyEvent.effects).filter(([, v]) => v).map(([k, v]) => (
                <Text key={k} style={{ color: colors.accent, fontSize: 11 }}>
                  {(v as number) > 0 ? "+" : ""}{v} {k}
                </Text>
              ))}
            </View>
            {dailyEvent.kind !== "windfall" && (
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 12,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>✗ Ignorer</Text>
                {Object.entries(dailyEvent.skipEffects).filter(([, v]) => v).map(([k, v]) => (
                  <Text key={k} style={{ color: colors.danger, fontSize: 11 }}>
                    {(v as number) > 0 ? "+" : ""}{v} {k}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => { resolveDailyEvent("accepted"); onClose(); }}
              style={{ flex: 2, paddingVertical: 16, borderRadius: 16, backgroundColor: kindColor + "22",
                borderWidth: 1.5, borderColor: kindColor + "55", alignItems: "center" }}>
              <Text style={{ color: kindColor, fontWeight: "900", fontSize: 15 }}>{dailyEvent.actionLabel}</Text>
            </Pressable>
            {dailyEvent.kind !== "windfall" && (
              <Pressable onPress={() => { resolveDailyEvent("skipped"); onClose(); }}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center" }}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Passer</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Streak Badge ─────────────────────────────────────────────────────────────

function StreakBadge({ streak }: { streak: number }) {
  const color = streak >= 30 ? "#ff4500" : streak >= 14 ? "#ff7f00" : streak >= 7 ? colors.gold : "#60a5fa";
  const emoji = streak >= 30 ? "🔥" : streak >= 14 ? "⚡" : streak >= 7 ? "⭐" : "💧";
  return (
    <View style={{
      backgroundColor: color + "18", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
      borderWidth: 1.5, borderColor: color + "40", alignItems: "center" }}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={{ color, fontWeight: "900", fontSize: 18 }}>{streak}</Text>
      <Text style={{ color: colors.muted, fontSize: 8 }}>streak</Text>
    </View>
  );
}

// ─── Screen principal ─────────────────────────────────────────────────────────

export default function HomeScreen() {
  const avatar           = useGameStore((s) => s.avatar);
  const stats            = useGameStore((s) => s.stats);
  const currentLocation  = useGameStore((s) => s.currentLocationSlug);
  const performAction    = useGameStore((s) => s.performAction);
  const dailyGoals       = useGameStore((s) => s.dailyGoals);
  const bootstrap        = useGameStore((s) => s.bootstrap);
  const dailyEvent       = useGameStore((s) => s.dailyEvent);
  const playerXp         = useGameStore((s) => s.playerXp ?? 0);
  const playerLevel      = useGameStore((s) => s.playerLevel ?? 1);
  const housingTier      = useGameStore((s) => s.housingTier);
  const checkHousingRent = useGameStore((s) => s.checkHousingRent);
  const lifeFeed         = useGameStore((s) => s.lifeFeed ?? []);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  useFocusEffect(useCallback(() => { bootstrap(); checkHousingRent(); }, [bootstrap, checkHousingRent]));

  const timeCtx     = useTimeContext();
  const wellbeing   = getWellbeingScore(stats);
  const momentum    = getMomentumState(stats);
  const housing     = getHousingTier(housingTier);
  const suggested   = getSuggestedActions(timeCtx);
  const doneGoals   = dailyGoals.filter((g) => g.completed).length;
  const totalGoals  = dailyGoals.length;
  const goalPct     = totalGoals > 0 ? (doneGoals / totalGoals) * 100 : 0;
  const wbColor     = wellbeing > 65 ? colors.accent : wellbeing > 40 ? colors.gold : colors.danger;

  const isAvailable = (a: ActionDef) => {
    if (a.minEnergy && stats.energy < a.minEnergy) return false;
    if (a.minMoney  && stats.money  < a.minMoney)  return false;
    if (a.id === "work-shift" && !timeCtx.workAvailable) return false;
    return true;
  };

  // Catégories groupées
  const categories: ActionDef["category"][] = ["survie", "travail", "social", "santé"];
  const byCategory = (cat: ActionDef["category"]) =>
    ALL_ACTIONS.filter((a) => a.category === cat);

  // Alertes critiques
  const crises = [
    stats.hunger < 18  && { emoji: "🍱", label: "Tu as faim — mange maintenant",         action: "healthy-meal" as LifeActionId },
    stats.energy < 15  && { emoji: "🛌", label: "Épuisement critique — dors",              action: "sleep" as LifeActionId },
    stats.hygiene < 15 && { emoji: "🚿", label: "Hygiène au sol — douche urgente",         action: "shower" as LifeActionId },
    stats.mood < 15    && { emoji: "🧘", label: "Mental au fond — médite 10 min",           action: "meditate" as LifeActionId },
    stats.money < 20   && { emoji: "💸", label: "Budget serré — travaille maintenant",      action: "work-shift" as LifeActionId },
  ].filter(Boolean) as { emoji: string; label: string; action: LifeActionId }[];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>
        <DailyEventModal visible={eventModalOpen} onClose={() => setEventModalOpen(false)} />

        {/* ── HERO ── */}
        <View style={{ backgroundColor: "#060d1a", paddingBottom: 20, overflow: "hidden" }}>
          {/* Glows de fond */}
          <View style={{ position: "absolute", top: -60, left: -40, width: 220, height: 220, borderRadius: 110,
            backgroundColor: wbColor + "10" }} />
          <View style={{ position: "absolute", top: 10, right: -50, width: 180, height: 180, borderRadius: 90,
            backgroundColor: "#7c3aed10" }} />

          {/* Top bar: localisation + housing + argent */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 18, paddingTop: 52, marginBottom: 18, gap: 8 }}>
            <Pressable onPress={() => router.push("/(app)/(tabs)/world" as never)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6,
                backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Text style={{ fontSize: 12 }}>📍</Text>
              <Text style={{ color: colors.textSoft, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
                {currentLocation === "home" ? "Chez toi" : currentLocation}
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 7 }}>
              <Pressable onPress={() => router.push("/(app)/housing" as never)}
                style={{ flexDirection: "row", alignItems: "center", gap: 5,
                  backgroundColor: housing.color + "15", borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6,
                  borderWidth: 1, borderColor: housing.color + "40" }}>
                <Text style={{ fontSize: 12 }}>{housing.emoji}</Text>
                <Text style={{ color: housing.color, fontSize: 10, fontWeight: "800" }}>{housing.name}</Text>
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: colors.goldGlow, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6,
                borderWidth: 1, borderColor: colors.gold + "50" }}>
                <Text style={{ fontSize: 12 }}>💰</Text>
                <Text style={{ color: colors.gold, fontSize: 13, fontWeight: "900" }}>{stats.money}</Text>
              </View>
            </View>
          </View>

          {/* Avatar + nom + wellbeing */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 14, marginBottom: 16 }}>
            <View style={{ alignItems: "center" }}>
              {/* Halo d'ambiance */}
              <View style={{
                position: "absolute", width: 90, height: 90, borderRadius: 45,
                backgroundColor: wbColor + "18",
                borderWidth: 2, borderColor: wbColor + "50",
                shadowColor: wbColor, shadowOpacity: 0.55, shadowRadius: 16,
              }} />
              {avatar ? (
                <AvatarSprite
                  visual={getAvatarVisual(avatar)}
                  action={
                    stats.energy < 20 ? "sleeping" :
                    stats.sociability < 25 ? "walking" :
                    "idle"
                  }
                  size="md"
                />
              ) : (
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: wbColor + "15",
                  borderWidth: 2.5, borderColor: wbColor + "80",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 36 }}>🧑</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22, letterSpacing: -0.5 }}>
                {avatar?.displayName ?? "Mon personnage"}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <View style={{ backgroundColor: wbColor + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                  borderWidth: 1, borderColor: wbColor + "45" }}>
                  <Text style={{ color: wbColor, fontSize: 11, fontWeight: "800" }}>♥ {wellbeing}%</Text>
                </View>
                <Text style={{ color: timeCtx.color, fontSize: 11 }}>{timeCtx.emoji} {timeCtx.label}</Text>
                {momentum.multiplier > 1.1 && (
                  <View style={{ backgroundColor: colors.goldGlow, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
                    borderWidth: 1, borderColor: colors.gold + "40" }}>
                    <Text style={{ color: colors.gold, fontSize: 10, fontWeight: "900" }}>×{momentum.multiplier.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <XpBar xp={playerXp} level={playerLevel} />
            </View>
          </View>

          {/* Besoins — 6 barres horizontales */}
          <View style={{ paddingHorizontal: 18, marginBottom: 10 }}>
            <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 12,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <NeedBar emoji="🍱" label="Faim"    value={stats.hunger}       color={colors.gold} />
                <NeedBar emoji="⚡" label="Énergie" value={stats.energy}       color={colors.blue} />
                <NeedBar emoji="😊" label="Humeur"  value={stats.mood}         color={colors.purple} />
                <NeedBar emoji="👥" label="Social"  value={stats.sociability}  color={colors.accent} />
                <NeedBar emoji="🚿" label="Hygiène" value={stats.hygiene}      color={colors.teal} />
                <NeedBar emoji="🧘" label="Zen"     value={100-stats.stress}   color="#a78bfa" />
              </View>
            </View>
          </View>

          {/* Stats secondaires */}
          <View style={{ flexDirection: "row", paddingHorizontal: 18, gap: 8 }}>
            <StreakBadge streak={stats.streak} />
            {[
              { emoji: "⭐", label: "Réputation", value: stats.reputation, color: "#60a5fa" },
              { emoji: "💪", label: "Discipline",  value: stats.discipline, color: colors.accent },
              { emoji: "🏃", label: "Forme",       value: stats.fitness,    color: "#4ade80" },
            ].map((s) => (
              <View key={s.label} style={{ flex: 1, backgroundColor: s.color + "12", borderRadius: 14, padding: 10,
                alignItems: "center", borderWidth: 1, borderColor: s.color + "30" }}>
                <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
                <Text style={{ color: s.color, fontWeight: "900", fontSize: 16 }}>{s.value}</Text>
                <Text style={{ color: colors.muted, fontSize: 8 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── CORPS ── */}
        <View style={{ padding: 18, gap: 22 }}>

          {/* ALERTES CRITIQUES */}
          {crises.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>⚠️ URGENT</Text>
              {crises.map((c) => (
                <Pressable key={c.action} onPress={() => performAction(c.action)}
                  style={{ backgroundColor: colors.dangerGlow, borderRadius: 14, padding: 12,
                    borderWidth: 1.5, borderColor: colors.danger + "55",
                    flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
                  <Text style={{ color: colors.danger, fontWeight: "900", fontSize: 13, flex: 1 }}>{c.label}</Text>
                  <Text style={{ color: colors.danger, fontSize: 18 }}>→</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* ÉVÉNEMENT DU JOUR */}
          {dailyEvent && !dailyEvent.resolved && (
            <Pressable onPress={() => setEventModalOpen(true)}
              style={{ backgroundColor: colors.goldGlow, borderRadius: 16, padding: 14,
                borderWidth: 1.5, borderColor: colors.gold + "40",
                flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 26 }}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 13 }}>Événement prêt</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{dailyEvent.title}</Text>
              </View>
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "900" }}>Voir</Text>
            </Pressable>
          )}

          {/* OBJECTIFS DU JOUR */}
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>
                📋 OBJECTIFS DU JOUR
              </Text>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>
                {doneGoals}/{totalGoals}
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 10 }}>
              <View style={{ height: 6, borderRadius: 3, width: `${goalPct}%` as `${number}%`, backgroundColor: colors.accent }} />
            </View>
            {dailyGoals.slice(0, 4).map((g) => (
              <View key={g.id} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                paddingVertical: 8, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.04)" }}>
                <View style={{ width: 20, height: 20, borderRadius: 10,
                  backgroundColor: g.completed ? colors.accent + "30" : "rgba(255,255,255,0.06)",
                  borderWidth: g.completed ? 0 : 1.5, borderColor: "rgba(255,255,255,0.12)",
                  alignItems: "center", justifyContent: "center" }}>
                  {g.completed && <Text style={{ fontSize: 11, color: colors.accent }}>✓</Text>}
                </View>
                <Text style={{ flex: 1, color: g.completed ? colors.muted : colors.text,
                  fontSize: 13, textDecorationLine: g.completed ? "line-through" : "none" }}>
                  {g.label}
                </Text>
              </View>
            ))}
            <Pressable onPress={() => router.push("/(app)/missions" as never)}
              style={{ marginTop: 8, alignItems: "center" }}>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>
                Voir toutes les missions →
              </Text>
            </Pressable>
          </View>

          {/* ACTIONS PAR CATÉGORIE */}
          {categories.map((cat) => {
            const actions = byCategory(cat);
            const catColor = CATEGORY_COLORS[cat];
            return (
              <View key={cat}>
                <Text style={{ color: catColor, fontSize: 11, fontWeight: "900", letterSpacing: 1.5, marginBottom: 10 }}>
                  {CATEGORY_LABELS[cat]}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingRight: 18 }}>
                  {actions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      onPress={() => performAction(action.id)}
                      disabled={!isAvailable(action)}
                      isPriority={suggested.includes(action.id)}
                      compact
                    />
                  ))}
                </ScrollView>
              </View>
            );
          })}

          {/* LIENS RAPIDES */}
          <View>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.8, marginBottom: 10 }}>
              🔗 EXPLORER
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { emoji: "🗺️", label: "Carte",          route: "/(app)/(tabs)/world" },
                { emoji: "👤", label: "Relations",      route: "/(app)/relations" },
                { emoji: "💊", label: "Santé",          route: "/(app)/health" },
                { emoji: "🏢", label: "Logement",       route: "/(app)/housing" },
                { emoji: "🎯", label: "Missions",       route: "/(app)/missions" },
                { emoji: "💼", label: "Travail",        route: "/(app)/work" },
              ].map((item) => (
                <Pressable key={item.route} onPress={() => router.push(item.route as never)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6,
                    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20,
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                  <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
                  <Text style={{ color: colors.textSoft, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* JOURNAL — événements récents */}
          {lifeFeed.length > 0 && (
            <View>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.8, marginBottom: 10 }}>
                📰 JOURNAL
              </Text>
              <View style={{ gap: 8 }}>
                {lifeFeed.slice(0, 2).map((item) => (
                  <View key={item.id} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 12,
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{item.title}</Text>
                    <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, marginTop: 3, lineHeight: 18 }}>{item.body}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* MÉTÉO + TEMPS */}
          <View style={{ backgroundColor: timeCtx.color + "10", borderRadius: 18, padding: 14,
            borderWidth: 1, borderColor: timeCtx.color + "30", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 28 }}>{timeCtx.weatherEmoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: timeCtx.color, fontWeight: "900", fontSize: 14 }}>{timeCtx.label}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{getTimeModeDescription(timeCtx)}</Text>
              {!timeCtx.workAvailable && (
                <Text style={{ color: "#f87171", fontSize: 11, marginTop: 2 }}>Bureau fermé — hors horaires</Text>
              )}
            </View>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {timeCtx.hour.toString().padStart(2,"0")}:{timeCtx.minutes.toString().padStart(2,"0")}
            </Text>
          </View>

          <View style={{ height: 80 }} />
        </View>
      </ScrollView>
    </Animated.View>
  );
}
