import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { getHousingTier } from "@/lib/housing";
import { getLocationName, getMomentumState, getRecommendedActionMeta, getWellbeingScore } from "@/lib/selectors";
import { getActionTimeScore, getTimeModeDescription, getSuggestedActions, useTimeContext } from "@/lib/time-context";
import { colors } from "@/lib/theme";
import type { LifeActionId } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

const ALL_ACTIONS: { id: LifeActionId; emoji: string; label: string; cost: string; reward: string; minEnergy?: number; minMoney?: number }[] = [
  { id: "healthy-meal",  emoji: "🍽️", label: "Repas sain",     cost: "-14 cr",   reward: "+faim +santé" },
  { id: "home-cooking",  emoji: "🥘", label: "Cuisiner",        cost: "-8 cr",    reward: "+faim ×2" },
  { id: "sleep",         emoji: "😴", label: "Dormir",          cost: "-temps",   reward: "+énergie" },
  { id: "nap",           emoji: "💤", label: "Sieste",          cost: "-temps",   reward: "+énergie" },
  { id: "shower",        emoji: "🚿", label: "Douche",          cost: "-3 cr",    reward: "+hygiène" },
  { id: "work-shift",    emoji: "💼", label: "Travailler",      cost: "-énergie", reward: "+argent",    minEnergy: 20 },
  { id: "walk",          emoji: "🏃", label: "Marcher",         cost: "-énergie", reward: "+humeur" },
  { id: "team-sport",    emoji: "🏀", label: "Sport collectif", cost: "-énergie", reward: "+social",   minEnergy: 25 },
  { id: "meditate",      emoji: "🧘", label: "Méditer",         cost: "-énergie", reward: "+zen" },
  { id: "read-book",     emoji: "📚", label: "Lire",            cost: "-énergie", reward: "+motivation" },
  { id: "cafe-chat",     emoji: "☕", label: "Café social",     cost: "-argent",  reward: "+social",   minMoney: 5 },
  { id: "shopping",      emoji: "🛍️", label: "Shopping",        cost: "-35 cr",   reward: "+image",    minMoney: 35 },
];

const ACTION_META = Object.fromEntries(ALL_ACTIONS.map((a) => [a.id, a])) as Record<LifeActionId, typeof ALL_ACTIONS[0]>;
const XP_PER_LEVEL = 200;

// ─── Stat circulaire ──────────────────────────────────────────────────────────
function StatCircle({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  const pct   = Math.max(0, Math.min(100, value));
  const isLow = pct < 30;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);

  const barW = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  const barC = isLow ? colors.danger : color;

  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <View style={{
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: barC + "18",
        borderWidth: 2, borderColor: isLow ? barC : barC + "55",
        alignItems: "center", justifyContent: "center",
        shadowColor: isLow ? barC : "transparent", shadowOpacity: 0.6, shadowRadius: 8,
      }}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
        {isLow && (
          <View style={{ position: "absolute", top: -3, right: -3,
            width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 7, color: "#fff", fontWeight: "900" }}>!</Text>
          </View>
        )}
      </View>
      <View style={{ width: "90%", height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <Animated.View style={{ height: 4, borderRadius: 2, width: barW, backgroundColor: barC }} />
      </View>
      <Text style={{ color: barC, fontWeight: "900", fontSize: 11 }}>{Math.round(pct)}</Text>
      <Text style={{ color: colors.muted, fontSize: 9 }}>{label}</Text>
    </View>
  );
}

// ─── XP Bar ───────────────────────────────────────────────────────────────────
function XpBar({ playerXp, playerLevel }: { playerXp: number; playerLevel: number }) {
  const xpInLevel = playerXp % XP_PER_LEVEL;
  const pct = (xpInLevel / XP_PER_LEVEL) * 100;
  const barAnim  = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.4, duration: 1400, useNativeDriver: true }),
    ])).start();
  }, [pct]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Animated.View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.goldGlow,
        borderWidth: 2, borderColor: colors.gold,
        alignItems: "center", justifyContent: "center",
        opacity: glowAnim,
        shadowColor: colors.gold, shadowOpacity: 0.9, shadowRadius: 10,
      }}>
        <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 16 }}>{playerLevel}</Text>
      </Animated.View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.gold, fontWeight: "800", fontSize: 12 }}>Niveau {playerLevel}</Text>
          <Text style={{ color: colors.muted, fontSize: 10 }}>{xpInLevel}/{XP_PER_LEVEL} XP</Text>
        </View>
        <View style={{ height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <Animated.View style={{
            height: 7, borderRadius: 4, width: barWidth,
            backgroundColor: colors.gold,
            shadowColor: colors.gold, shadowOpacity: 1, shadowRadius: 8,
          }} />
        </View>
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
  function pressIn()  { Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, speed: 60 }).start(); }
  function pressOut() { Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 60 }).start(); }
  const c = primeColor ?? colors.accent;

  return (
    <Animated.View style={{ flex: 1, minWidth: "46%", transform: [{ scale: scaleAnim }] }}>
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled}
        style={{
          flex: 1, borderRadius: 16, padding: 14, gap: 5,
          backgroundColor: prime ? c + "18" : disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
          borderWidth: prime ? 1.5 : 1,
          borderColor: prime ? c + "55" : disabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.09)",
          opacity: disabled ? 0.45 : 1,
        }}>
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>{label}</Text>
        <View style={{ flexDirection: "row", gap: 5 }}>
          <Text style={{ color: "#ff8d8d", fontSize: 9 }}>{cost}</Text>
          <Text style={{ color: colors.accent, fontSize: 9 }}>{reward}</Text>
        </View>
        {prime && <Text style={{ color: c, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 }}>★ PRIME</Text>}
      </Pressable>
    </Animated.View>
  );
}

// ─── Quest row ────────────────────────────────────────────────────────────────
function QuestRow({ label, done, xp }: { label: string; done: boolean; xp?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10,
      borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.04)" }}>
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: done ? colors.accent : "rgba(255,255,255,0.07)",
        borderWidth: done ? 0 : 1.5, borderColor: "rgba(255,255,255,0.15)",
        alignItems: "center", justifyContent: "center",
      }}>
        {done && <Text style={{ fontSize: 11, color: "#fff", fontWeight: "900" }}>✓</Text>}
      </View>
      <Text style={{ color: done ? colors.muted : colors.text, fontSize: 13, flex: 1,
        textDecorationLine: done ? "line-through" : "none" }}>
        {label}
      </Text>
      {xp && <Text style={{ color: colors.gold, fontSize: 10, fontWeight: "700" }}>+{xp} XP</Text>}
    </View>
  );
}

function JourneyCard({
  emoji,
  title,
  body,
  primary,
  color,
  routes
}: {
  emoji: string;
  title: string;
  body: string;
  primary: { label: string; route: string };
  color: string;
  routes: { label: string; route: string }[];
}) {
  return (
    <View style={{
      backgroundColor: color + "10",
      borderRadius: 18,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: color + "35"
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: color + "20",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: color + "45"
        }}>
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{body}</Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.push(primary.route as never)}
        style={{
          backgroundColor: color + "22",
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: color + "55"
        }}
      >
        <Text style={{ color, fontWeight: "900", fontSize: 13 }}>{primary.label}</Text>
      </Pressable>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {routes.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as never)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.055)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)"
            }}
          >
            <Text style={{ color: colors.textSoft, fontSize: 11, fontWeight: "700" }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
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
    dailyEvent.kind === "opportunity" ? colors.accent :
    dailyEvent.kind === "windfall"    ? colors.gold :
    dailyEvent.kind === "encounter"   ? colors.purple :
    dailyEvent.kind === "social"      ? colors.blue : colors.danger;
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
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <View style={{ width: "100%", maxWidth: 400, backgroundColor: colors.card, borderRadius: 24, padding: 24, gap: 16,
          borderWidth: 1.5, borderColor: kindColor + "45",
          shadowColor: kindColor, shadowOpacity: 0.3, shadowRadius: 30 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: kindColor + "22",
              alignItems: "center", justifyContent: "center",
              shadowColor: kindColor, shadowOpacity: 0.5, shadowRadius: 12 }}>
              <Text style={{ fontSize: 24 }}>{kindEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: kindColor, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>{kindLabel.toUpperCase()}</Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 17, marginTop: 3 }}>{dailyEvent.title}</Text>
            </View>
          </View>
          <Text style={{ color: colors.textSoft, fontSize: 14, lineHeight: 21 }}>{dailyEvent.body}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: kindColor + "10", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: kindColor + "30" }}>
              <Text style={{ color: kindColor, fontWeight: "800", fontSize: 12, marginBottom: 6 }}>✓ {dailyEvent.actionLabel}</Text>
              {Object.entries(dailyEvent.effects).filter(([, v]) => v).map(([k, v]) => (
                <Text key={k} style={{ color: colors.muted, fontSize: 11 }}>{(v as number) > 0 ? "+" : ""}{v} {k}</Text>
              ))}
            </View>
            {dailyEvent.kind !== "windfall" && (
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>✗ {dailyEvent.skipLabel}</Text>
                {Object.entries(dailyEvent.skipEffects).filter(([, v]) => v).map(([k, v]) => (
                  <Text key={k} style={{ color: colors.danger, fontSize: 11 }}>{(v as number) > 0 ? "+" : ""}{v} {k}</Text>
                ))}
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => { resolveDailyEvent("accepted"); setVisible(false); }}
              style={{ flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: kindColor + "20",
                borderWidth: 1.5, borderColor: kindColor + "60", alignItems: "center" }}>
              <Text style={{ color: kindColor, fontWeight: "900", fontSize: 14 }}>{dailyEvent.actionLabel}</Text>
            </Pressable>
            {dailyEvent.kind !== "windfall" && (
              <Pressable onPress={() => { resolveDailyEvent("skipped"); setVisible(false); }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", alignItems: "center" }}>
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13 }}>{dailyEvent.skipLabel}</Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => setVisible(false)} style={{ alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.18)", fontSize: 12 }}>Fermer sans choisir</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Streak badge animé ───────────────────────────────────────────────────────
function StreakBadge({ streak }: { streak: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.07, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  const color = streak >= 30 ? "#ff4500" : streak >= 14 ? "#ff7f00" : streak >= 7 ? colors.gold : colors.blue;
  const emoji = streak >= 30 ? "🔥" : streak >= 14 ? "⚡" : streak >= 7 ? "✨" : "💧";
  return (
    <Animated.View style={{
      flex: 1, backgroundColor: color + "18", borderRadius: 14, padding: 12,
      alignItems: "center", borderWidth: 1.5, borderColor: color + "45",
      transform: [{ scale: pulseAnim }],
      shadowColor: color, shadowOpacity: 0.25, shadowRadius: 10,
    }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ color, fontWeight: "900", fontSize: 22 }}>{streak}</Text>
      <Text style={{ color: colors.muted, fontSize: 9 }}>jours streak</Text>
    </Animated.View>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────
function SectionTitle({ text, right }: { text: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.8 }}>{text}</Text>
      {right}
    </View>
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
  const housingTier         = useGameStore((s) => s.housingTier);
  const checkHousingRent    = useGameStore((s) => s.checkHousingRent);

  useFocusEffect(useCallback(() => { bootstrap(); checkHousingRent(); }, [bootstrap, checkHousingRent]));

  const timeCtx      = useTimeContext();
  const wellbeing    = getWellbeingScore(stats);
  const momentum     = getMomentumState(stats);
  const recommended  = getRecommendedActionMeta(stats);
  const doneCount    = dailyGoals.filter((g) => g.completed).length;
  const totalGoals   = dailyGoals.length;
  const questPct     = totalGoals > 0 ? (doneCount / totalGoals) * 100 : 0;
  const wbColor      = wellbeing > 65 ? colors.accent : wellbeing > 40 ? colors.gold : colors.danger;
  const suggestedActions = getSuggestedActions(timeCtx);
  const isActionPrime    = (id: LifeActionId) => suggestedActions.includes(id);
  const essentialActionIds: LifeActionId[] = ["healthy-meal", "sleep", "shower", "work-shift", "walk", "cafe-chat"];
  const simpleActions = ALL_ACTIONS.filter((action) => essentialActionIds.includes(action.id) && !isActionPrime(action.id));
  const urgentNeeds = [
    stats.hunger < 35 ? "faim" : null,
    stats.energy < 35 ? "énergie" : null,
    stats.hygiene < 35 ? "hygiène" : null,
    stats.mood < 35 ? "humeur" : null
  ].filter(Boolean);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  // Ambient scanline anim
  const scanAnim = useRef(new Animated.Value(-200)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(scanAnim, { toValue: 800, duration: 3600, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>
        <DailyEventModal />

        {/* ── HERO HEADER ── */}
        <View style={{ backgroundColor: "#050d1a", paddingBottom: 24, overflow: "hidden" }}>
          {/* Ambient gradient stripes */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
            <View style={{ position: "absolute", top: -40, left: -60, width: 200, height: 200, borderRadius: 100,
              backgroundColor: colors.accentGlow }} />
            <View style={{ position: "absolute", top: 20, right: -50, width: 160, height: 160, borderRadius: 80,
              backgroundColor: colors.purpleGlow }} />
            <Animated.View style={{ position: "absolute", left: 0, right: 0, height: 2,
              backgroundColor: "rgba(56,199,147,0.12)",
              transform: [{ translateY: scanAnim }] }} />
          </View>

          {/* Top row: location + money + logement */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 56, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20,
              paddingHorizontal: 12, paddingVertical: 6,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ fontSize: 12 }}>📍</Text>
              <Text style={{ color: colors.textSoft, fontSize: 11, fontWeight: "700" }}>
                {getLocationName(currentLocationSlug)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {/* Badge logement */}
              <Pressable onPress={() => router.push("/(app)/housing" as never)}
                style={{ flexDirection: "row", alignItems: "center", gap: 5,
                  backgroundColor: getHousingTier(housingTier).color + "15", borderRadius: 20,
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderWidth: 1, borderColor: getHousingTier(housingTier).color + "45" }}>
                <Text style={{ fontSize: 14 }}>{getHousingTier(housingTier).emoji}</Text>
                <Text style={{ color: getHousingTier(housingTier).color, fontSize: 10, fontWeight: "800" }}>
                  {getHousingTier(housingTier).name}
                </Text>
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: colors.goldGlow, borderRadius: 20,
                paddingHorizontal: 10, paddingVertical: 6,
                borderWidth: 1, borderColor: colors.gold + "55" }}>
                <Text style={{ fontSize: 14 }}>💰</Text>
                <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "900" }}>{stats.money} cr</Text>
              </View>
            </View>
          </View>

          {/* Avatar + nom + wellbeing */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 16, marginBottom: 20 }}>
            <View style={{
              width: 68, height: 68, borderRadius: 34,
              backgroundColor: colors.accentGlow,
              borderWidth: 2.5, borderColor: wbColor,
              alignItems: "center", justifyContent: "center",
              shadowColor: wbColor, shadowOpacity: 0.5, shadowRadius: 16,
            }}>
              <Text style={{ fontSize: 32 }}>🧑</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 24 }}>
                {avatar?.displayName ?? "Joueur"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
                  backgroundColor: wbColor + "20", borderWidth: 1, borderColor: wbColor + "50" }}>
                  <Text style={{ color: wbColor, fontSize: 11, fontWeight: "800" }}>♥ {wellbeing}%</Text>
                </View>
                <Text style={{ color: timeCtx.color, fontSize: 11 }}>{timeCtx.emoji} {timeCtx.label}</Text>
              </View>
            </View>
          </View>

          {/* XP bar */}
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <XpBar playerXp={playerXp} playerLevel={playerLevel} />
          </View>

          {/* Stats circulaires */}
          <View style={{ flexDirection: "row", paddingHorizontal: 14, gap: 4 }}>
            <StatCircle label="Faim"    value={stats.hunger}        color={colors.gold}    icon="🍽️" />
            <StatCircle label="Énergie" value={stats.energy}        color={colors.blue}    icon="⚡" />
            <StatCircle label="Humeur"  value={stats.mood}          color={colors.purple}  icon="😊" />
            <StatCircle label="Social"  value={stats.sociability}   color={colors.accent}  icon="👥" />
            <StatCircle label="Hygiène" value={stats.hygiene}       color={colors.teal}    icon="🚿" />
            <StatCircle label="Zen"     value={100 - stats.stress}  color="#a78bfa"        icon="🧘" />
          </View>

          {/* Streak + multiplier + réputation */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16, paddingHorizontal: 20 }}>
            <StreakBadge streak={stats.streak} />
            <View style={{ flex: 1, backgroundColor: colors.goldGlow, borderRadius: 14, padding: 12, alignItems: "center",
              borderWidth: 1.5, borderColor: colors.gold + "35",
              shadowColor: colors.gold, shadowOpacity: 0.15, shadowRadius: 8 }}>
              <Text style={{ fontSize: 18 }}>⚡</Text>
              <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 20 }}>×{momentum.multiplier.toFixed(1)}</Text>
              <Text style={{ color: colors.muted, fontSize: 9 }}>multiplicateur</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "rgba(96,165,250,0.1)", borderRadius: 14, padding: 12, alignItems: "center",
              borderWidth: 1.5, borderColor: "rgba(96,165,250,0.25)" }}>
              <Text style={{ fontSize: 18 }}>⭐</Text>
              <Text style={{ color: colors.blue, fontWeight: "900", fontSize: 20 }}>{stats.reputation}</Text>
              <Text style={{ color: colors.muted, fontSize: 9 }}>réputation</Text>
            </View>
          </View>
        </View>

        <Animated.View style={{ padding: 20, gap: 24, transform: [{ translateY: slideAnim }] }}>

          {/* ── HUD TEMPS ── */}
          <View style={{
            backgroundColor: timeCtx.color + "10", borderRadius: 18, padding: 14,
            borderWidth: 1, borderColor: timeCtx.color + "30", gap: 10,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: timeCtx.color + "25",
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24 }}>{timeCtx.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: timeCtx.color, fontWeight: "900", fontSize: 14 }}>{timeCtx.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {timeCtx.hour.toString().padStart(2, "0")}:{timeCtx.minutes.toString().padStart(2, "0")}
                    {timeCtx.isWeekend ? " · WE" : " · Sem"}
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
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
                backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 8 }}>
                <Text style={{ fontSize: 16 }}>{timeCtx.weatherEmoji}</Text>
                <View>
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                    {timeCtx.weather === "sunny" ? "Ensoleillé" : timeCtx.weather === "rainy" ? "Pluvieux" :
                     timeCtx.weather === "cloudy" ? "Nuageux" : timeCtx.weather === "stormy" ? "Orageux" :
                     timeCtx.weather === "snowy" ? "Neigeux" : "Venteux"}
                  </Text>
                  {timeCtx.weatherBonus !== 1 && (
                    <Text style={{ color: timeCtx.weatherBonus > 1 ? colors.accent : colors.danger, fontSize: 9 }}>
                      {timeCtx.weatherBonus > 1 ? "+" : ""}{Math.round((timeCtx.weatherBonus - 1) * 100)}% ext.
                    </Text>
                  )}
                </View>
              </View>
              {timeCtx.isPublicHoliday && (
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
                  backgroundColor: colors.goldGlow, borderRadius: 10, padding: 8,
                  borderWidth: 1, borderColor: colors.gold + "35" }}>
                  <Text style={{ fontSize: 16 }}>🎉</Text>
                  <View>
                    <Text style={{ color: colors.gold, fontSize: 10, fontWeight: "700" }}>Jour Férié</Text>
                    <Text style={{ color: colors.muted, fontSize: 9 }}>{timeCtx.holidayName}</Text>
                  </View>
                </View>
              )}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4,
                backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 8 }}>
                <Text style={{ fontSize: 14 }}>
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

          {/* ── BANNIÈRE DE CRISE ── */}
          {(() => {
            const crises: { emoji: string; label: string; action: LifeActionId; urgent: boolean }[] = [];
            if (stats.hunger < 18)  crises.push({ emoji: "🍽️", label: "Tu meurs de faim — mange maintenant", action: "healthy-meal", urgent: true });
            if (stats.energy < 15)  crises.push({ emoji: "😴", label: "Épuisement critique — dors", action: "sleep", urgent: true });
            if (stats.hygiene < 15) crises.push({ emoji: "🚿", label: "Hygiène critique — douche urgente", action: "shower", urgent: false });
            if (stats.mood < 15)    crises.push({ emoji: "💔", label: "Moral à zéro — prends soin de toi", action: "meditate", urgent: false });
            if (crises.length === 0) return null;
            return crises.map((c) => (
              <Pressable key={c.action} onPress={() => performAction(c.action)}
                style={{ backgroundColor: c.urgent ? colors.dangerGlow : colors.goldGlow, borderRadius: 14, padding: 12,
                  borderWidth: 1.5, borderColor: c.urgent ? colors.danger + "60" : colors.gold + "55",
                  flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
                <Text style={{ color: c.urgent ? colors.danger : colors.gold, fontWeight: "900", fontSize: 13, flex: 1 }}>
                  {c.label}
                </Text>
                <View style={{ backgroundColor: c.urgent ? colors.danger + "25" : colors.gold + "25",
                  borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: c.urgent ? colors.danger : colors.gold, fontSize: 11, fontWeight: "800" }}>
                    Agir →
                  </Text>
                </View>
              </Pressable>
            ));
          })()}

          {/* ── ÉVÉNEMENT DU JOUR ── */}
          {dailyEvent && !dailyEvent.resolved && (
            <Pressable onPress={() => bootstrap()}
              style={{ backgroundColor: colors.goldGlow, borderRadius: 16, padding: 14,
                borderWidth: 1.5, borderColor: colors.gold + "40",
                flexDirection: "row", alignItems: "center", gap: 12,
                shadowColor: colors.gold, shadowOpacity: 0.15, shadowRadius: 12 }}>
              <Text style={{ fontSize: 24 }}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.gold, fontWeight: "800", fontSize: 13 }}>Événement du jour</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{dailyEvent.title}</Text>
              </View>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold,
                shadowColor: colors.gold, shadowOpacity: 1, shadowRadius: 6 }} />
            </Pressable>
          )}

          {/* ── MODE SIMPLE ── */}
          <View>
            <SectionTitle text="PLAN SIMPLE" />
            <View style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderRadius: 18,
              padding: 14,
              gap: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)"
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: urgentNeeds.length > 0 ? colors.dangerGlow : colors.accentGlow,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: urgentNeeds.length > 0 ? colors.danger + "45" : colors.accent + "45"
                }}>
                  <Text style={{ fontSize: 22 }}>{urgentNeeds.length > 0 ? "!" : "✓"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
                    {urgentNeeds.length > 0 ? "Commence par stabiliser ton avatar" : "Ton avatar est stable"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {urgentNeeds.length > 0
                      ? `À régler maintenant : ${urgentNeeds.join(", ")}.`
                      : "Tu peux explorer, socialiser ou avancer tes objectifs."}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => performAction(recommended.action)}
                  style={{
                    flex: 1,
                    backgroundColor: colors.accent,
                    borderRadius: 12,
                    paddingVertical: 11,
                    alignItems: "center"
                  }}
                >
                  <Text style={{ color: "#07111f", fontWeight: "900", fontSize: 13 }}>Faire l'action utile</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/(app)/(tabs)/world" as never)}
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    paddingVertical: 11,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)"
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>Aller en ville</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* ── ACTION RECOMMANDÉE ── */}
          <View>
            <SectionTitle text="PRIORITÉ DU MOMENT" />
            <Pressable onPress={() => performAction(recommended.action)}
              style={{ backgroundColor: colors.accentGlow, borderRadius: 18, padding: 18,
                borderWidth: 1.5, borderColor: colors.accent + "50",
                flexDirection: "row", alignItems: "center", gap: 14,
                shadowColor: colors.accent, shadowOpacity: 0.2, shadowRadius: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentGlow,
                alignItems: "center", justifyContent: "center",
                borderWidth: 2, borderColor: colors.accent + "60",
                shadowColor: colors.accent, shadowOpacity: 0.6, shadowRadius: 10 }}>
                <Text style={{ fontSize: 26 }}>⚡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 16 }}>{recommended.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{recommended.copy}</Text>
              </View>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent + "20",
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>→</Text>
              </View>
            </Pressable>
          </View>

          {/* ── ACTIONS ── */}
          <View>
            <SectionTitle text="ACTIONS ESSENTIELLES"
              right={<Text style={{ color: timeCtx.color, fontSize: 11, fontWeight: "700" }}>{timeCtx.emoji} {timeCtx.label}</Text>} />
            {suggestedActions.length > 0 && (
              <View style={{ backgroundColor: timeCtx.color + "0d", borderRadius: 14, padding: 10,
                borderWidth: 1, borderColor: timeCtx.color + "25", marginBottom: 10 }}>
                <Text style={{ color: timeCtx.color, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginBottom: 8 }}>
                  ★ CRÉNEAU IDÉAL
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {suggestedActions.slice(0, 4).map((actionId) => {
                    const meta = ACTION_META[actionId];
                    if (!meta) return null;
                    const disabled = !!(meta.minEnergy && stats.energy < meta.minEnergy) || !!(meta.minMoney && stats.money < meta.minMoney);
                    return (
                      <ActionBtn key={actionId} emoji={meta.emoji} label={meta.label}
                        cost={meta.cost} reward={meta.reward}
                        onPress={() => performAction(actionId)}
                        disabled={disabled} prime primeColor={timeCtx.color} />
                    );
                  })}
                </View>
              </View>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {simpleActions.map(({ id, emoji, label, cost, reward, minEnergy, minMoney }) => {
                const disabled = !!(minEnergy && stats.energy < minEnergy) || !!(minMoney && stats.money < minMoney);
                return (
                  <ActionBtn key={id} emoji={emoji} label={label} cost={cost}
                    reward={getActionTimeScore(id, timeCtx).multiplier < 1 ? `${reward} ⚠️` : reward}
                    onPress={() => performAction(id)} disabled={disabled} />
                );
              })}
            </View>
          </View>

          {/* ── PARCOURS ── */}
          <View>
            <SectionTitle text="PARCOURS" />
            <View style={{ gap: 12 }}>
              <JourneyCard
                emoji="🏙️"
                title="Explorer la ville"
                body="Carte, lieux, rooms et personnes présentes."
                primary={{ label: "Ouvrir la ville", route: "/(app)/(tabs)/world" }}
                color={colors.purple}
                routes={[
                  { label: "Rooms", route: "/(app)/rooms" },
                  { label: "Carte live", route: "/(app)/world-live" },
                  { label: getHousingTier(housingTier).name, route: "/(app)/housing" }
                ]}
              />
              <JourneyCard
                emoji="💬"
                title="Social et rencontres"
                body="Messages, relations, sorties et rendez-vous."
                primary={{ label: "Ouvrir le chat", route: "/(app)/(tabs)/chat" }}
                color={colors.accent}
                routes={[
                  { label: "Relations", route: "/(app)/relations" },
                  { label: "Sorties", route: "/(app)/outings" },
                  { label: "Dates", route: "/(app)/dates" }
                ]}
              />
              <JourneyCard
                emoji="📈"
                title="Progression"
                body="Quêtes, missions, niveau et objectifs."
                primary={{ label: "Voir les quêtes", route: "/(app)/(tabs)/notifications" }}
                color={colors.gold}
                routes={[
                  { label: "Missions", route: "/(app)/missions" },
                  { label: "Talents", route: "/(app)/progression" },
                  { label: "Classement", route: "/(app)/leaderboard" }
                ]}
              />
              <JourneyCard
                emoji="🧭"
                title="Vie pratique"
                body="Travail, santé, argent et coaching."
                primary={{ label: "Travailler", route: "/(app)/work" }}
                color={colors.blue}
                routes={[
                  { label: "Santé", route: "/(app)/health" },
                  { label: "Économie", route: "/(app)/economy" },
                  { label: "Coach", route: "/(app)/coach" }
                ]}
              />
            </View>
          </View>

          {/* ── QUÊTES ── */}
          <View>
            <SectionTitle text="QUÊTES DU JOUR"
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>{doneCount}/{totalGoals}</Text>
                  {doneCount > 0 && <Text style={{ color: colors.gold, fontSize: 11 }}>+{doneCount * 15} XP</Text>}
                </View>
              } />
            <View style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", marginBottom: 12, overflow: "hidden" }}>
              <View style={{ height: 5, borderRadius: 3, width: `${questPct}%`,
                backgroundColor: colors.accent,
                shadowColor: colors.accent, shadowOpacity: 0.8, shadowRadius: 4 }} />
            </View>
            <View style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, paddingHorizontal: 16,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              {dailyGoals.slice(0, 5).map((g) => (
                <QuestRow key={g.id} label={g.label} done={g.completed} xp={15} />
              ))}
            </View>
            {doneCount === totalGoals && totalGoals > 0 && (
              <Pressable onPress={claimDailyReward}
                style={{ marginTop: 12, backgroundColor: colors.goldGlow, borderRadius: 14, padding: 14,
                  borderWidth: 1.5, borderColor: colors.gold + "55", alignItems: "center",
                  flexDirection: "row", justifyContent: "center", gap: 8,
                  shadowColor: colors.gold, shadowOpacity: 0.3, shadowRadius: 12 }}>
                <Text style={{ fontSize: 20 }}>🎁</Text>
                <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 14 }}>Réclamer la reward du jour</Text>
              </Pressable>
            )}
          </View>

          {/* ── OUTILS AVANCÉS ── */}
          <View>
            <SectionTitle text="OUTILS AVANCÉS" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: "📚 Études", route: "/(app)/studies" },
                { label: "💱 Trading", route: "/(app)/trading" },
                { label: "🔐 Secret", route: "/(app)/secret-room" },
                { label: "💡 Conseils", route: "/(app)/tips" },
                { label: "⭐ Premium", route: "/(app)/premium" },
                { label: "👤 Profil public", route: "/(app)/profile-public" },
              ].map((item) => (
                <Pressable key={item.route} onPress={() => router.push(item.route as never)}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
                    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" }}>
                  <Text style={{ color: colors.textSoft, fontWeight: "600", fontSize: 12 }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── SESSION ── */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => { signOut(); router.replace("/(auth)/sign-in"); }}
              style={{ flex: 1, paddingVertical: 11, borderRadius: 13, backgroundColor: "rgba(255,80,80,0.08)",
                borderWidth: 1, borderColor: "rgba(255,80,80,0.2)", alignItems: "center" }}>
              <Text style={{ color: "#ff8d8d", fontWeight: "700", fontSize: 12 }}>⏏ Déconnexion</Text>
            </Pressable>
            <Pressable onPress={() => { resetAll(); router.replace("/(auth)/welcome"); }}
              style={{ flex: 1, paddingVertical: 11, borderRadius: 13, backgroundColor: "rgba(255,80,80,0.04)",
                borderWidth: 1, borderColor: "rgba(255,80,80,0.1)", alignItems: "center" }}>
              <Text style={{ color: "rgba(255,141,141,0.45)", fontWeight: "700", fontSize: 12 }}>↺ Reset</Text>
            </Pressable>
          </View>

        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}
