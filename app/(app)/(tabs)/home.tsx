import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { getLocationName, getMomentumState, getRecommendedActionMeta, getWellbeingScore } from "@/lib/selectors";
import { getActionTimeScore, getTimeModeDescription, getSuggestedActions, useTimeContext } from "@/lib/time-context";
import { colors } from "@/lib/theme";
import type { LifeActionId } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

// ─── Catalogue actions ────────────────────────────────────────────────────────
const ALL_ACTIONS: { id: LifeActionId; emoji: string; label: string; cost: string; reward: string; minEnergy?: number; minMoney?: number }[] = [
  { id: "healthy-meal",     emoji: "🍽️", label: "Repas sain",      cost: "-14 cr",   reward: "+faim +santé" },
  { id: "home-cooking",     emoji: "🥘", label: "Cuisiner",         cost: "-8 cr",    reward: "+faim ×2" },
  { id: "sleep",            emoji: "😴", label: "Dormir",           cost: "-temps",   reward: "+énergie" },
  { id: "nap",              emoji: "💤", label: "Sieste",           cost: "-temps",   reward: "+énergie" },
  { id: "shower",           emoji: "🚿", label: "Douche",           cost: "-3 cr",    reward: "+hygiène" },
  { id: "work-shift",       emoji: "💼", label: "Travailler",       cost: "-énergie", reward: "+argent",     minEnergy: 20 },
  { id: "walk",             emoji: "🏃", label: "Marcher",          cost: "-énergie", reward: "+humeur" },
  { id: "team-sport",       emoji: "🏀", label: "Sport collectif",  cost: "-énergie", reward: "+social",     minEnergy: 25 },
  { id: "meditate",         emoji: "🧘", label: "Méditer",          cost: "-énergie", reward: "+zen" },
  { id: "read-book",        emoji: "📚", label: "Lire",             cost: "-énergie", reward: "+motivation" },
  { id: "cafe-chat",        emoji: "☕", label: "Café social",      cost: "-argent",  reward: "+social",     minMoney: 5 },
  { id: "shopping",         emoji: "🛍️", label: "Shopping",         cost: "-35 cr",   reward: "+image",      minMoney: 35 },
];

const ACTION_META = Object.fromEntries(ALL_ACTIONS.map((a) => [a.id, a])) as Record<LifeActionId, typeof ALL_ACTIONS[0]>;

const XP_PER_LEVEL = 200;

// ─── XP Bar animée ───────────────────────────────────────────────────────────
function XpBar({ playerXp, playerLevel }: { playerXp: number; playerLevel: number }) {
  const xpInLevel = playerXp % XP_PER_LEVEL;
  const pct = (xpInLevel / XP_PER_LEVEL) * 100;
  const barAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pct]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Animated.View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: "#f6b94f22",
            borderWidth: 2, borderColor: "#f6b94f",
            alignItems: "center", justifyContent: "center",
            opacity: glowAnim,
          }}>
            <Text style={{ color: "#f6b94f", fontWeight: "900", fontSize: 14 }}>{playerLevel}</Text>
          </Animated.View>
          <View>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>Niveau {playerLevel}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{xpInLevel} / {XP_PER_LEVEL} XP</Text>
          </View>
        </View>
        <Text style={{ color: "#f6b94f", fontWeight: "700", fontSize: 12 }}>
          {playerXp} XP total
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <Animated.View style={{
          height: 8, borderRadius: 4, width: barWidth,
          backgroundColor: "#f6b94f",
          shadowColor: "#f6b94f", shadowOpacity: 0.8, shadowRadius: 6,
        }} />
      </View>
    </View>
  );
}

// ─── Barre de stat animée ─────────────────────────────────────────────────────
function StatBar({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const isLow = pct < 30;
  const barAnim = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [pct]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  const barColor = isLow ? "#ff6b6b" : color;

  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: isLow ? barColor : colors.muted, fontSize: 11, fontWeight: isLow ? "800" : "500" }}>
          {icon} {label}{isLow ? " !" : ""}
        </Text>
        <Text style={{ color: barColor, fontSize: 11, fontWeight: "700" }}>{Math.round(pct)}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <Animated.View style={{ height: 6, borderRadius: 3, width: barWidth, backgroundColor: barColor }} />
      </View>
    </View>
  );
}

// ─── Action rapide ────────────────────────────────────────────────────────────
function ActionBtn({ emoji, label, cost, reward, onPress, disabled, prime, primeColor }: {
  emoji: string; label: string; cost: string; reward: string;
  onPress: () => void; disabled?: boolean; prime?: boolean; primeColor?: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  function pressIn() { Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, speed: 50 }).start(); }
  function pressOut() { Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start(); }

  return (
    <Animated.View style={{ flex: 1, minWidth: "45%", transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={{
          flex: 1,
          backgroundColor: prime ? (primeColor ?? colors.accent) + "20" : disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
          borderRadius: 16, padding: 14, gap: 6,
          borderWidth: prime ? 1.5 : 1,
          borderColor: prime ? (primeColor ?? colors.accent) + "60" : disabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)",
          opacity: disabled ? 0.5 : 1
        }}
      >
        <Text style={{ fontSize: 26 }}>{emoji}</Text>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>{label}</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Text style={{ color: "#ff8d8d", fontSize: 10 }}>{cost}</Text>
          <Text style={{ color: "#38c793", fontSize: 10 }}>{reward}</Text>
        </View>
        {prime && <Text style={{ color: primeColor ?? colors.accent, fontSize: 9, fontWeight: "800" }}>★ PRIME</Text>}
      </Pressable>
    </Animated.View>
  );
}

// ─── Quête du jour ────────────────────────────────────────────────────────────
function QuestRow({ label, done, xp }: { label: string; done: boolean; xp?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9,
      borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.04)" }}>
      <View style={{
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: done ? "#38c793" : "rgba(255,255,255,0.08)",
        borderWidth: done ? 0 : 1.5, borderColor: "rgba(255,255,255,0.15)",
        alignItems: "center", justifyContent: "center"
      }}>
        {done && <Text style={{ fontSize: 12, color: "#fff" }}>✓</Text>}
      </View>
      <Text style={{ color: done ? colors.muted : colors.text, fontSize: 13, flex: 1,
        textDecorationLine: done ? "line-through" : "none" }}>
        {label}
      </Text>
      {xp && <Text style={{ color: "#f6b94f", fontSize: 10, fontWeight: "700" }}>+{xp} XP</Text>}
    </View>
  );
}

// ─── Daily Event Modal ────────────────────────────────────────────────────────
function DailyEventModal() {
  const dailyEvent        = useGameStore((s) => s.dailyEvent);
  const resolveDailyEvent = useGameStore((s) => s.resolveDailyEvent);
  const [visible, setVisible] = useState(true);

  if (!dailyEvent || dailyEvent.resolved || !visible) return null;

  const kindColor =
    dailyEvent.kind === "opportunity" ? "#38c793" :
    dailyEvent.kind === "windfall"    ? "#f6b94f" :
    dailyEvent.kind === "encounter"   ? colors.accent :
    dailyEvent.kind === "social"      ? "#60a5fa" : "#ff8d8d";

  const kindLabel =
    dailyEvent.kind === "opportunity" ? "Opportunité" :
    dailyEvent.kind === "windfall"    ? "Coup de chance" :
    dailyEvent.kind === "encounter"   ? "Rencontre" :
    dailyEvent.kind === "social"      ? "Événement social" : "Alerte";

  const kindEmoji =
    dailyEvent.kind === "opportunity" ? "✨" :
    dailyEvent.kind === "windfall"    ? "🎁" :
    dailyEvent.kind === "encounter"   ? "👤" :
    dailyEvent.kind === "social"      ? "🤝" : "⚠️";

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 400, backgroundColor: "#0b1a2d", borderRadius: 24, padding: 24, gap: 16,
          borderWidth: 1.5, borderColor: kindColor + "40" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kindColor + "20",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22 }}>{kindEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: kindColor, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>{kindLabel.toUpperCase()}</Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 17, marginTop: 2 }}>{dailyEvent.title}</Text>
            </View>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>{dailyEvent.body}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: kindColor + "10", borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: kindColor + "30" }}>
              <Text style={{ color: kindColor, fontWeight: "800", fontSize: 12, marginBottom: 6 }}>✓ {dailyEvent.actionLabel}</Text>
              {Object.entries(dailyEvent.effects).filter(([, v]) => v).map(([k, v]) => (
                <Text key={k} style={{ color: colors.muted, fontSize: 11 }}>{(v as number) > 0 ? "+" : ""}{v} {k}</Text>
              ))}
            </View>
            {dailyEvent.kind !== "windfall" && (
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>✗ {dailyEvent.skipLabel}</Text>
                {Object.entries(dailyEvent.skipEffects).filter(([, v]) => v).map(([k, v]) => (
                  <Text key={k} style={{ color: "#ff8d8d", fontSize: 11 }}>{(v as number) > 0 ? "+" : ""}{v} {k}</Text>
                ))}
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => { resolveDailyEvent("accepted"); setVisible(false); }}
              style={{ flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: kindColor + "20",
                borderWidth: 1.5, borderColor: kindColor + "60", alignItems: "center" }}>
              <Text style={{ color: kindColor, fontWeight: "800", fontSize: 14 }}>{dailyEvent.actionLabel}</Text>
            </Pressable>
            {dailyEvent.kind !== "windfall" && (
              <Pressable onPress={() => { resolveDailyEvent("skipped"); setVisible(false); }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center" }}>
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13 }}>{dailyEvent.skipLabel}</Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => setVisible(false)} style={{ alignItems: "center", paddingTop: 4 }}>
            <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Fermer sans choisir</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Streak fire ─────────────────────────────────────────────────────────────
function StreakBadge({ streak }: { streak: number }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const color = streak >= 30 ? "#ff4500" : streak >= 14 ? "#ff7f00" : streak >= 7 ? "#f6b94f" : "#60a5fa";
  const emoji = streak >= 30 ? "🔥" : streak >= 14 ? "⚡" : streak >= 7 ? "✨" : "💧";

  return (
    <Animated.View style={{
      flex: 1, backgroundColor: color + "18", borderRadius: 14, padding: 12,
      alignItems: "center", borderWidth: 1.5, borderColor: color + "40",
      transform: [{ scale: scaleAnim }]
    }}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <Text style={{ color, fontWeight: "900", fontSize: 22 }}>{streak}</Text>
      <Text style={{ color: colors.muted, fontSize: 10 }}>jours de suite</Text>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const avatar              = useGameStore((s) => s.avatar);
  const stats               = useGameStore((s) => s.stats);
  const currentLocationSlug = useGameStore((s) => s.currentLocationSlug);
  const performAction       = useGameStore((s) => s.performAction);
  const claimDailyReward    = useGameStore((s) => s.claimDailyReward);
  const dailyGoals          = useGameStore((s) => s.dailyGoals);
  const bootstrap           = useGameStore((s) => s.bootstrap);
  const signOut             = useGameStore((s) => s.signOut);
  const resetAll            = useGameStore((s) => s.resetAll);
  const dailyEvent          = useGameStore((s) => s.dailyEvent);
  const playerXp            = useGameStore((s) => s.playerXp ?? 0);
  const playerLevel         = useGameStore((s) => s.playerLevel ?? 1);

  useFocusEffect(useCallback(() => { bootstrap(); }, [bootstrap]));

  const timeCtx   = useTimeContext();
  const wellbeing = getWellbeingScore(stats);
  const momentum  = getMomentumState(stats);
  const recommended = getRecommendedActionMeta(stats);
  const doneCount   = dailyGoals.filter((g) => g.completed).length;
  const totalGoals  = dailyGoals.length;
  const questPct    = totalGoals > 0 ? (doneCount / totalGoals) * 100 : 0;
  const wbColor     = wellbeing > 65 ? "#38c793" : wellbeing > 40 ? "#f6b94f" : "#ff6b6b";
  const suggestedActions = getSuggestedActions(timeCtx);
  const isActionPrime = (id: LifeActionId) => suggestedActions.includes(id);

  // Entry animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>
        <DailyEventModal />

        {/* ── TOP HUD GAME ── */}
        <View style={{
          backgroundColor: "#060d18",
          paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)"
        }}>
          {/* Header row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
                📍 {getLocationName(currentLocationSlug).toUpperCase()}
              </Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 22, marginTop: 2 }}>
                {avatar?.displayName ?? "Joueur"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                backgroundColor: wbColor + "22", borderWidth: 1, borderColor: wbColor + "55" }}>
                <Text style={{ color: wbColor, fontWeight: "800", fontSize: 13 }}>♥ {wellbeing}%</Text>
              </View>
              <Text style={{ color: "#f6b94f", fontWeight: "700", fontSize: 13 }}>💰 {stats.money} cr</Text>
            </View>
          </View>

          {/* XP bar */}
          <XpBar playerXp={playerXp} playerLevel={playerLevel} />

          {/* Stats 2 colonnes */}
          <View style={{ gap: 8, marginTop: 14 }}>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <View style={{ flex: 1 }}><StatBar label="Faim"    value={stats.hunger}     color="#f6b94f" icon="🍽️" /></View>
              <View style={{ flex: 1 }}><StatBar label="Énergie" value={stats.energy}     color="#60a5fa" icon="⚡" /></View>
            </View>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <View style={{ flex: 1 }}><StatBar label="Humeur"  value={stats.mood}       color="#c084fc" icon="😊" /></View>
              <View style={{ flex: 1 }}><StatBar label="Social"  value={stats.sociability} color="#38c793" icon="👥" /></View>
            </View>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <View style={{ flex: 1 }}><StatBar label="Hygiène" value={stats.hygiene}    color="#34d399" icon="🚿" /></View>
              <View style={{ flex: 1 }}><StatBar label="Zen"     value={100 - stats.stress} color="#a78bfa" icon="🧘" /></View>
            </View>
          </View>

          {/* Streak + multiplicateur + réputation */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <StreakBadge streak={stats.streak} />
            <View style={{ flex: 1, backgroundColor: "#f6b94f15", borderRadius: 14, padding: 12, alignItems: "center",
              borderWidth: 1.5, borderColor: "#f6b94f30" }}>
              <Text style={{ fontSize: 20 }}>⚡</Text>
              <Text style={{ color: "#f6b94f", fontWeight: "900", fontSize: 20 }}>x{momentum.multiplier.toFixed(1)}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>multiplicateur</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 12, alignItems: "center",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ fontSize: 20 }}>⭐</Text>
              <Text style={{ color: "#60a5fa", fontWeight: "900", fontSize: 20 }}>{stats.reputation}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>réputation</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 20, gap: 22 }}>

          {/* ── HUD TEMPS LIVE ── */}
          <View style={{
            backgroundColor: timeCtx.color + "12", borderRadius: 16, padding: 14,
            borderWidth: 1, borderColor: timeCtx.color + "30", gap: 10,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: timeCtx.color + "25",
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24 }}>{timeCtx.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: timeCtx.color, fontWeight: "900", fontSize: 14 }}>{timeCtx.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {timeCtx.hour.toString().padStart(2, "0")}:{timeCtx.minutes.toString().padStart(2, "0")}
                    {timeCtx.isWeekend ? " · Weekend" : " · Semaine"}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{getTimeModeDescription(timeCtx)}</Text>
              </View>
              {!timeCtx.workAvailable && (
                <View style={{ backgroundColor: "rgba(248,113,113,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: "#f87171", fontSize: 10, fontWeight: "700" }}>Hors bureau</Text>
                </View>
              )}
            </View>
            {/* Météo + jours fériés */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
                backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 8 }}>
                <Text style={{ fontSize: 18 }}>{timeCtx.weatherEmoji}</Text>
                <View>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                    {timeCtx.weather === "sunny" ? "Ensoleillé" : timeCtx.weather === "rainy" ? "Pluvieux" :
                     timeCtx.weather === "cloudy" ? "Nuageux" : timeCtx.weather === "stormy" ? "Orageux" :
                     timeCtx.weather === "snowy" ? "Neigeux" : "Venteux"}
                  </Text>
                  {timeCtx.weatherBonus !== 1 && (
                    <Text style={{ color: timeCtx.weatherBonus > 1 ? "#38c793" : "#ff8d8d", fontSize: 10 }}>
                      {timeCtx.weatherBonus > 1 ? `+${Math.round((timeCtx.weatherBonus - 1) * 100)}%` : `${Math.round((timeCtx.weatherBonus - 1) * 100)}%`} actions extérieures
                    </Text>
                  )}
                </View>
              </View>
              {timeCtx.isPublicHoliday && (
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
                  backgroundColor: "rgba(246,185,79,0.1)", borderRadius: 10, padding: 8,
                  borderWidth: 1, borderColor: "rgba(246,185,79,0.3)" }}>
                  <Text style={{ fontSize: 18 }}>🎉</Text>
                  <View>
                    <Text style={{ color: "#f6b94f", fontSize: 11, fontWeight: "700" }}>Jour Férié</Text>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>{timeCtx.holidayName}</Text>
                  </View>
                </View>
              )}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4,
                backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 8 }}>
                <Text style={{ fontSize: 16 }}>
                  {timeCtx.season === "spring" ? "🌸" : timeCtx.season === "summer" ? "☀️" :
                   timeCtx.season === "autumn" ? "🍂" : "❄️"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>
                  {timeCtx.season === "spring" ? "Printemps" : timeCtx.season === "summer" ? "Été" :
                   timeCtx.season === "autumn" ? "Automne" : "Hiver"}
                </Text>
              </View>
            </View>
          </View>

          {/* ── ÉVÉNEMENT DU JOUR ── */}
          {dailyEvent && !dailyEvent.resolved && (
            <Pressable
              onPress={() => bootstrap()}
              style={{ backgroundColor: "rgba(246,185,79,0.10)", borderRadius: 16, padding: 14,
                borderWidth: 1.5, borderColor: "rgba(246,185,79,0.35)",
                flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Text style={{ fontSize: 24 }}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#f6b94f", fontWeight: "800", fontSize: 13 }}>Événement du jour</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{dailyEvent.title}</Text>
              </View>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#f6b94f" }} />
            </Pressable>
          )}

          {/* ── ACTION RECOMMANDÉE ── */}
          <View>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", marginBottom: 10, letterSpacing: 1.5 }}>
              PRIORITÉ DU MOMENT
            </Text>
            <Pressable
              onPress={() => performAction(recommended.action)}
              style={{ backgroundColor: colors.accent + "18", borderRadius: 18, padding: 18,
                borderWidth: 1.5, borderColor: colors.accent + "55",
                flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.accent + "25",
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 26 }}>⚡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 16 }}>{recommended.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{recommended.copy}</Text>
              </View>
              <Text style={{ color: colors.accent, fontSize: 22 }}>→</Text>
            </Pressable>
          </View>

          {/* ── ACTIONS RAPIDES ── */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>ACTIONS</Text>
              <Text style={{ color: timeCtx.color, fontSize: 11, fontWeight: "700" }}>{timeCtx.emoji} {timeCtx.label}</Text>
            </View>
            {suggestedActions.length > 0 && (
              <View style={{ backgroundColor: timeCtx.color + "0e", borderRadius: 14, padding: 10,
                borderWidth: 1, borderColor: timeCtx.color + "22", marginBottom: 10 }}>
                <Text style={{ color: timeCtx.color, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 8 }}>
                  ★ CRÉNEAU IDÉAL
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {suggestedActions.slice(0, 4).map((actionId) => {
                    const meta = ACTION_META[actionId];
                    if (!meta) return null;
                    const disabled = !!(meta.minEnergy && stats.energy < meta.minEnergy) || !!(meta.minMoney && stats.money < meta.minMoney);
                    return (
                      <ActionBtn
                        key={actionId}
                        emoji={meta.emoji}
                        label={meta.label}
                        cost={meta.cost}
                        reward={meta.reward}
                        onPress={() => performAction(actionId)}
                        disabled={disabled}
                        prime
                        primeColor={timeCtx.color}
                      />
                    );
                  })}
                </View>
              </View>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {ALL_ACTIONS.map(({ id, emoji, label, cost, reward, minEnergy, minMoney }) => {
                const disabled = !!(minEnergy && stats.energy < minEnergy) || !!(minMoney && stats.money < minMoney);
                if (isActionPrime(id)) return null;
                return (
                  <ActionBtn key={id} emoji={emoji} label={label} cost={cost}
                    reward={getActionTimeScore(id, timeCtx).multiplier < 1 ? `${reward} ⚠️` : reward}
                    onPress={() => performAction(id)} disabled={disabled} />
                );
              })}
            </View>
          </View>

          {/* ── EXPLORER ── */}
          <View>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", marginBottom: 10, letterSpacing: 1.5 }}>
              EXPLORER
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => router.push("/(app)/world-live")}
                style={{ flex: 1, backgroundColor: "rgba(139,124,255,0.12)", borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: "rgba(139,124,255,0.3)", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 28 }}>🗺️</Text>
                <Text style={{ color: "#8b7cff", fontWeight: "800", fontSize: 12 }}>Carte Live</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/rooms")}
                style={{ flex: 1, backgroundColor: "rgba(56,199,147,0.12)", borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: "rgba(56,199,147,0.3)", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 28 }}>🏠</Text>
                <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 12 }}>Rooms</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/dates")}
                style={{ flex: 1, backgroundColor: "rgba(255,107,107,0.12)", borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: "rgba(255,107,107,0.3)", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 28 }}>💘</Text>
                <Text style={{ color: "#ff6b6b", fontWeight: "800", fontSize: 12 }}>Dates</Text>
              </Pressable>
            </View>
          </View>

          {/* ── QUÊTES DU JOUR ── */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>QUÊTES DU JOUR</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>{doneCount}/{totalGoals}</Text>
                {doneCount > 0 && <Text style={{ color: "#f6b94f", fontSize: 11 }}>+{doneCount * 15} XP</Text>}
              </View>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", marginBottom: 12, overflow: "hidden" }}>
              <View style={{ height: 6, borderRadius: 3, width: `${questPct}%`, backgroundColor: colors.accent }} />
            </View>
            <View style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, paddingHorizontal: 16,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              {dailyGoals.slice(0, 5).map((g) => (
                <QuestRow key={g.id} label={g.label} done={g.completed} xp={15} />
              ))}
            </View>
            {doneCount === totalGoals && totalGoals > 0 && (
              <Pressable onPress={claimDailyReward}
                style={{ marginTop: 12, backgroundColor: "#f6b94f18", borderRadius: 14, padding: 14,
                  borderWidth: 1.5, borderColor: "#f6b94f55", alignItems: "center",
                  flexDirection: "row", justifyContent: "center", gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🎁</Text>
                <Text style={{ color: "#f6b94f", fontWeight: "800", fontSize: 14 }}>Réclamer la reward du jour</Text>
              </Pressable>
            )}
          </View>

          {/* ── GAME HUB ── */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
              GAME HUB
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => router.push("/(app)/missions")}
                style={{ flex: 1, backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 14, padding: 12,
                  borderWidth: 1, borderColor: "rgba(56,199,147,0.25)", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 22 }}>🎯</Text>
                <Text style={{ color: "#38c793", fontWeight: "700", fontSize: 11 }}>Missions</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/progression")}
                style={{ flex: 1, backgroundColor: "rgba(246,185,79,0.1)", borderRadius: 14, padding: 12,
                  borderWidth: 1, borderColor: "rgba(246,185,79,0.25)", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 22 }}>⚡</Text>
                <Text style={{ color: "#f6b94f", fontWeight: "700", fontSize: 11 }}>Progression</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/leaderboard")}
                style={{ flex: 1, backgroundColor: "rgba(192,132,252,0.1)", borderRadius: 14, padding: 12,
                  borderWidth: 1, borderColor: "rgba(192,132,252,0.25)", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 22 }}>🏆</Text>
                <Text style={{ color: "#c084fc", fontWeight: "700", fontSize: 11 }}>Classement</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/trading")}
                style={{ flex: 1, backgroundColor: "rgba(96,165,250,0.1)", borderRadius: 14, padding: 12,
                  borderWidth: 1, borderColor: "rgba(96,165,250,0.25)", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 22 }}>💱</Text>
                <Text style={{ color: "#60a5fa", fontWeight: "700", fontSize: 11 }}>Trading</Text>
              </Pressable>
            </View>
          </View>

          {/* ── NAVIGATION ── */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { label: "💪 Sport & Santé", route: "/(app)/health" },
              { label: "💼 Travailler",    route: "/(app)/work"   },
              { label: "🍷 Sorties",       route: "/(app)/outings"},
              { label: "💘 Rendez-vous",   route: "/(app)/dates"  },
              { label: "👥 Relations",     route: "/(app)/relations"},
              { label: "🔐 Secret Chat",   route: "/(app)/secret-room"},
              { label: "🤖 Coach ARIA",    route: "/(app)/coach"  },
              { label: "📚 Études",        route: "/(app)/studies"},
              { label: "📊 Stats",         route: "/(app)/tips"   },
              { label: "⭐ Premium",       route: "/(app)/premium" },
              { label: "👤 Mon profil",    route: "/(app)/profile-public" },
            ].map((item) => (
              <Pressable key={item.route} onPress={() => router.push(item.route as never)}
                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* ── SESSION ── */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => { signOut(); router.replace("/(auth)/sign-in"); }}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(255,80,80,0.08)",
                borderWidth: 1, borderColor: "rgba(255,80,80,0.2)", alignItems: "center" }}>
              <Text style={{ color: "#ff8d8d", fontWeight: "700", fontSize: 12 }}>⏏ Déconnexion</Text>
            </Pressable>
            <Pressable onPress={() => { resetAll(); router.replace("/(auth)/welcome"); }}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(255,80,80,0.04)",
                borderWidth: 1, borderColor: "rgba(255,80,80,0.1)", alignItems: "center" }}>
              <Text style={{ color: "#ff8d8d77", fontWeight: "700", fontSize: 12 }}>↺ Reset</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </Animated.View>
  );
}
