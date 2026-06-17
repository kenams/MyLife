import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import type { ShiftRecord } from "@/lib/types";
import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual } from "@/lib/avatar-visual";
import { getHousingTier } from "@/lib/housing";
import { getActivePremiumBoost, getBoostMultiplier } from "@/lib/premium";
import { getLevelTitle } from "@/lib/progression";
import { getMomentumState, getSocialRankLabel, getSocialRankProgressData, RANK_ORDER } from "@/lib/selectors";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import { useGameStore } from "@/stores/game-store";

const L = {
  bg:        "#080808",
  card:      "#111111",
  cardAlt:   "#181818",
  card2:     "#141414",
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
  pink:      "#FF2D78",
  pinkBg:    "#1A0818",
  purple:    "#BF5FFF",
  purpleBg:  "#18082A",
  teal:      "#00FFD1",
  tealBg:    "#001A14",
  orange:    "#FF6B00",
  orangeBg:  "#1A0D00",
};

const XP_PER_LEVEL = 200;

const RANK_LABELS: Record<string, string> = {
  precaire: "Précaire", modeste: "Modeste", stable: "Stable",
  confortable: "Confort", influent: "Influent", elite: "Élite"
};
const RANK_EMOJIS: Record<string, string> = {
  precaire: "🪨", modeste: "🌱", stable: "⚡", confortable: "💎", influent: "👑", elite: "🌟"
};

// ─── StatBar dark ─────────────────────────────────────────────────────────────
function StatBar({ label, value, icon, color }: {
  label: string; value: number; icon: string; color: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  const barW = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  const urgent = pct < 25;
  const barColor = urgent ? L.red : color;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: L.border }}>
      <Text style={{ fontSize: 15, width: 22, textAlign: "center" }}>{icon}</Text>
      <Text style={{ color: L.textSoft, fontSize: 12, fontWeight: "600", width: 80 }}>{label}</Text>
      <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.05)" }}>
        <Animated.View style={{ height: 3, borderRadius: 2, width: barW,
          backgroundColor: barColor,
          shadowColor: barColor, shadowOpacity: urgent ? 0.8 : 0.4, shadowRadius: 4 }} />
      </View>
      <Text style={{ color: urgent ? L.red : L.muted, fontSize: 11, fontWeight: "800", width: 28, textAlign: "right" }}>
        {Math.round(pct)}
      </Text>
    </View>
  );
}

// ─── XP Ring SVG-like (pure RN) ──────────────────────────────────────────────
function XpRing({ pct, level }: { pct: number; level: number }) {
  const SIZE = 84;
  const STROKE = 5;
  const INNER = SIZE - STROKE * 2;

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const glowAnim  = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1.03, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.97, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1800, useNativeDriver: true }),
      ]),
    ])).start();
  }, []);

  return (
    <Animated.View style={{
      width: SIZE, height: SIZE,
      borderRadius: SIZE / 2,
      borderWidth: STROKE,
      borderColor: L.primary,
      alignItems: "center", justifyContent: "center",
      transform: [{ scale: scaleAnim }],
      shadowColor: L.primary,
      shadowOpacity: glowAnim as unknown as number,
      shadowRadius: 16,
      backgroundColor: L.primaryBg,
    }}>
      <View style={{
        position: "absolute", bottom: -2, left: "50%",
        transform: [{ translateX: -20 }],
        backgroundColor: L.primary, borderRadius: 6,
        paddingHorizontal: 6, paddingVertical: 2,
        borderWidth: 1.5, borderColor: L.bg,
      }}>
        <Text style={{ color: "#080808", fontSize: 8, fontWeight: "900" }}>NIV.{level}</Text>
      </View>
      <Text style={{ color: L.primary, fontSize: 18, fontWeight: "900" }}>{Math.round(pct)}%</Text>
    </Animated.View>
  );
}

// ─── WeekBar ─────────────────────────────────────────────────────────────────
function WeekBar({ value, max, label, isToday }: {
  value: number; max: number; label: string; isToday?: boolean;
}) {
  const BAR_HEIGHT = 56;
  const barAnim = useRef(new Animated.Value(0)).current;
  const pct = max > 0 ? value / max : 0;
  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct * BAR_HEIGHT, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, barAnim]);
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <View style={{ height: BAR_HEIGHT, justifyContent: "flex-end", width: "100%" }}>
        <Animated.View style={{
          height: barAnim, borderRadius: 4,
          backgroundColor: isToday ? L.primary : L.primary + "40",
          shadowColor: isToday ? L.primary : "transparent",
          shadowOpacity: 0.5, shadowRadius: 4,
        }} />
      </View>
      <Text style={{ color: isToday ? L.primary : L.muted, fontSize: 9, fontWeight: isToday ? "800" : "400" }}>
        {label}
      </Text>
      {value > 0 && <Text style={{ color: L.muted, fontSize: 8 }}>{value}</Text>}
    </View>
  );
}

function WeekChart({ history }: { history: ShiftRecord[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const DAY_SHORT = ["D", "L", "M", "M", "J", "V", "S"];
  const days = Array.from({ length: 7 }, (_, i) => todayMs - (6 - i) * 86_400_000);
  const earned = days.map((dayStart) =>
    history.filter((r) => {
      const t = new Date(r.completedAt).getTime();
      return t >= dayStart && t < dayStart + 86_400_000;
    }).reduce((sum, r) => sum + r.earnedCoins, 0)
  );
  const max = Math.max(...earned, 1);
  return (
    <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16,
      borderWidth: 1, borderColor: L.border }}>
      <Text style={{ color: L.text, fontSize: 14, fontWeight: "800", marginBottom: 2 }}>7 derniers jours</Text>
      <Text style={{ color: L.muted, fontSize: 10, marginBottom: 14 }}>Revenus journaliers (thunes)</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5 }}>
        {earned.map((val, i) => {
          const d = new Date(days[i]);
          return <WeekBar key={i} value={val} max={max} label={DAY_SHORT[d.getDay()]} isToday={days[i] === todayMs} />;
        })}
      </View>
    </View>
  );
}

// ─── LivePulse ────────────────────────────────────────────────────────────────
function LivePulse({ color = L.green }: { color?: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.6, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: 10, height: 10, borderRadius: 5,
        backgroundColor: color, opacity: 0.35, transform: [{ scale: pulse }] }} />
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const avatar          = useGameStore((s) => s.avatar);
  const stats           = useGameStore((s) => s.stats);
  const relationships   = useGameStore((s) => s.relationships);
  const datePlans       = useGameStore((s) => s.datePlans);
  const signOut         = useGameStore((s) => s.signOut);
  const resetAll        = useGameStore((s) => s.resetAll);
  const loadTestAccount = useGameStore((s) => s.loadTestAccount);
  const isPremium       = useGameStore((s) => s.isPremium);
  const activeBoosts    = useGameStore((s) => s.activeBoosts);
  const moneyTransfers  = useGameStore((s) => s.moneyTransfers);
  const shiftHistory    = useGameStore((s) => s.shiftHistory);
  const playerXp        = useGameStore((s) => s.playerXp ?? 0);
  const playerLevel     = useGameStore((s) => s.playerLevel ?? 1);
  const housingTier     = useGameStore((s) => s.housingTier);
  const wealthScore     = useGameStore((s) => s.wealthScore);
  const sessionData     = useGameStore((s) => s.session);
  const appTheme        = useGameStore((s) => s.appTheme);
  const setAppTheme     = useGameStore((s) => s.setAppTheme);

  const activeBoost = getActivePremiumBoost(activeBoosts);
  const boostMult   = getBoostMultiplier(activeBoosts);
  const rp          = getSocialRankProgressData(stats);
  const currentRank = getSocialRankLabel(stats.socialRankScore);
  const currentIdx  = RANK_ORDER.indexOf(currentRank);
  const housing     = getHousingTier(housingTier);
  const levelTitle  = getLevelTitle(playerLevel);
  const xpInLevel   = playerXp % XP_PER_LEVEL;
  const xpPct       = (xpInLevel / XP_PER_LEVEL) * 100;

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 330, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const stateLabel = stats.energy < 25 ? "À plat 🪫" : stats.hunger < 25 ? "Dalle 🍱" : stats.hygiene < 25 ? "Carton 👟" : stats.mood < 30 ? "Mood 0 😤" : "En forme 🔥";
  const stateColor = (stats.energy < 25 || stats.hunger < 25 || stats.hygiene < 25 || stats.mood < 30) ? L.red : L.green;

  const activeRels  = relationships.filter((r) => r.score > 30);
  const showTest    = process.env.NODE_ENV !== "production";
  const totalEarned = shiftHistory.reduce((s, r) => s + r.earnedCoins, 0);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: L.bg }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── HERO DARK ── */}
        <View style={{ paddingTop: 54, paddingBottom: 28, paddingHorizontal: 20,
          backgroundColor: L.card, borderBottomWidth: 1, borderBottomColor: L.border }}>

          {/* Top row — badges + edit */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {isPremium && (
                <View style={{ backgroundColor: L.primary + "20", borderRadius: 20,
                  paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: L.primary + "40" }}>
                  <Text style={{ color: L.primary, fontSize: 10, fontWeight: "900" }}>⭐ PREMIUM</Text>
                </View>
              )}
              {activeBoost && (
                <View style={{ backgroundColor: L.orange + "20", borderRadius: 20,
                  paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: L.orange + "40" }}>
                  <Text style={{ color: L.orange, fontSize: 10, fontWeight: "900" }}>⚡ ×{boostMult}</Text>
                </View>
              )}
            </View>
            <Pressable onPress={() => router.push("/(app)/avatar-edit" as never)}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: L.cardAlt,
                alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: L.border }}>
              <Ionicons name="pencil" size={15} color={L.textSoft} />
            </Pressable>
          </View>

          {/* Avatar + XP ring + infos */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
            <XpRing pct={xpPct} level={playerLevel} />

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: L.text, fontWeight: "900", fontSize: 22, letterSpacing: -0.5 }}>
                {avatar?.displayName ?? "Joueur"}
              </Text>
              <Text style={{ color: L.textSoft, fontSize: 12 }}>{housing.emoji} {housing.name} · {levelTitle}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <LivePulse color={stateColor} />
                <Text style={{ color: stateColor, fontSize: 11, fontWeight: "800" }}>{stateLabel}</Text>
              </View>
              <Text style={{ color: L.muted, fontSize: 10, marginTop: 2 }}>
                {sessionData?.email ?? "Mode local"}
              </Text>
            </View>
          </View>

          {/* XP bar */}
          <View style={{ marginTop: 18, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: L.muted, fontSize: 11 }}>XP vers niveau {playerLevel + 1}</Text>
              <Text style={{ color: L.primary, fontSize: 11, fontWeight: "800" }}>{xpInLevel} / {XP_PER_LEVEL}</Text>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <View style={{ height: 4, borderRadius: 2, width: `${xpPct}%` as `${number}%`,
                backgroundColor: L.primary,
                shadowColor: L.primary, shadowOpacity: 0.8, shadowRadius: 4 }} />
            </View>
          </View>

          {/* Mini stats */}
          <View style={{ flexDirection: "row", gap: 6, marginTop: 14 }}>
            {[
              { label: "Argent",   value: `${Math.round(stats.money)}`,              color: L.gold   },
              { label: "Côte",     value: `${stats.reputation}`,                     color: L.purple },
              { label: "Streak",   value: `${stats.streak}j`,                        color: L.green  },
              { label: "Revenus",  value: `${(totalEarned / 1000).toFixed(1)}k`,     color: L.teal   },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, backgroundColor: item.color + "12",
                borderRadius: 10, paddingVertical: 8, alignItems: "center", gap: 2,
                borderWidth: 1, borderColor: item.color + "20" }}>
                <Text style={{ color: item.color, fontWeight: "900", fontSize: 13 }}>{item.value}</Text>
                <Text style={{ color: L.muted, fontSize: 9 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Animated.View style={{ transform: [{ translateY: slideAnim }], padding: 16, gap: 16 }}>

          {/* ── STATISTIQUES ── */}
          <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 16,
            borderWidth: 1, borderColor: L.border }}>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 12 }}>
              TON ÉTAT
            </Text>
            <StatBar label="Pêche"        value={stats.energy}          icon="⚡"  color={L.blue}    />
            <StatBar label="Faim"         value={stats.hunger}          icon="🍽️" color={L.gold}    />
            <StatBar label="Forme"        value={stats.health}          icon="❤️"  color={L.red}     />
            <StatBar label="Look"         value={stats.hygiene}         icon="👟"  color={L.teal}    />
            <StatBar label="Mood"         value={stats.mood}            icon="😤"  color={L.purple}  />
            <StatBar label="Attractivité" value={stats.attractiveness}  icon="✨"  color={L.pink}    />
            <StatBar label="Fitness"      value={stats.fitness}         icon="💪"  color={L.green}   />
            <StatBar label="Discipline"   value={stats.discipline}      icon="🎯"  color={L.primary} />
          </View>

          {/* ── PROGRESSION ── */}
          <WeekChart history={shiftHistory} />

          {/* ── RANG SOCIAL ── */}
          <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 16,
            borderWidth: 1, borderColor: L.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={{ color: L.text, fontSize: 14, fontWeight: "800" }}>Rang social</Text>
              <View style={{ backgroundColor: L.primaryBg, borderRadius: 20,
                paddingHorizontal: 12, paddingVertical: 5,
                borderWidth: 1, borderColor: L.primary + "30" }}>
                <Text style={{ color: L.primary, fontWeight: "800", fontSize: 12 }}>
                  {RANK_EMOJIS[currentRank]} {RANK_LABELS[currentRank]}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
              {RANK_ORDER.map((rank, i) => {
                const passed  = i < currentIdx;
                const current = rank === currentRank;
                return (
                  <View key={rank} style={{ flex: 1, alignItems: "center" }}>
                    {i > 0 && (
                      <View style={{ position: "absolute", left: 0, right: "50%", height: 2, top: 11,
                        backgroundColor: passed || current ? L.primary + "50" : "rgba(255,255,255,0.06)" }} />
                    )}
                    <View style={{ width: current ? 26 : 18, height: current ? 26 : 18,
                      borderRadius: current ? 13 : 9,
                      backgroundColor: passed ? L.primary + "18" : current ? L.primary : "rgba(255,255,255,0.06)",
                      borderWidth: current ? 2 : 1,
                      borderColor: passed ? L.primary + "50" : current ? L.primary : "rgba(255,255,255,0.1)",
                      alignItems: "center", justifyContent: "center",
                      shadowColor: current ? L.primary : "transparent", shadowOpacity: 0.5, shadowRadius: 8 }}>
                      <Text style={{ fontSize: current ? 11 : 8 }}>{RANK_EMOJIS[rank]}</Text>
                    </View>
                    <Text style={{ color: current ? L.primary : L.muted,
                      fontSize: 7, fontWeight: current ? "800" : "400", marginTop: 4 }}>
                      {RANK_LABELS[rank].slice(0, 6)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={{ gap: 5 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: L.textSoft, fontSize: 11 }}>Score : {rp.score}</Text>
                {rp.nextRank
                  ? <Text style={{ color: L.muted, fontSize: 11 }}>+{rp.scoreToNext} → {RANK_LABELS[rp.nextRank]}</Text>
                  : <Text style={{ color: L.green, fontSize: 11, fontWeight: "700" }}>🌟 Rang max</Text>
                }
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <View style={{ height: 4, borderRadius: 2, width: `${rp.progress}%` as `${number}%`,
                  backgroundColor: L.primary }} />
              </View>
            </View>
          </View>

          {/* ── VIE SOCIALE ── */}
          <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 16,
            borderWidth: 1, borderColor: L.border }}>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 12 }}>
              VIE SOCIALE
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Relations",  value: activeRels.length,
                  emoji: "👥", color: L.primary },
                { label: "Dates",      value: datePlans.filter((d) => d.status === "accepted" || d.status === "proposed").length,
                  emoji: "💘", color: L.pink },
                { label: "Transferts", value: moneyTransfers.length,
                  emoji: "💸", color: L.gold },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, backgroundColor: item.color + "10",
                  borderRadius: 14, padding: 12, alignItems: "center", gap: 4,
                  borderWidth: 1, borderColor: item.color + "20" }}>
                  <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                  <Text style={{ color: item.color, fontWeight: "900", fontSize: 18 }}>{item.value}</Text>
                  <Text style={{ color: L.muted, fontSize: 10 }}>{item.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => router.push("/(app)/relations" as never)}
                style={{ flex: 1, backgroundColor: L.primaryBg, borderRadius: 12, padding: 11,
                  alignItems: "center", borderWidth: 1, borderColor: L.primary + "25" }}>
                <Text style={{ color: L.primary, fontWeight: "700", fontSize: 12 }}>👥 Relations</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/dates" as never)}
                style={{ flex: 1, backgroundColor: L.pinkBg, borderRadius: 12, padding: 11,
                  alignItems: "center", borderWidth: 1, borderColor: L.pink + "25" }}>
                <Text style={{ color: L.pink, fontWeight: "700", fontSize: 12 }}>💘 Dates</Text>
              </Pressable>
            </View>
          </View>

          {/* ── IDENTITÉ ── */}
          {avatar && (
            <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 16,
              borderWidth: 1, borderColor: L.border, gap: 10 }}>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>IDENTITÉ</Text>
              {avatar.bio && (
                <Text style={{ color: L.textSoft, fontSize: 13, lineHeight: 19 }}>{avatar.bio}</Text>
              )}
              {[
                { icon: "🎭", label: "Trait",    value: avatar.personalityTrait ?? "—" },
                { icon: "🎯", label: "Ambition", value: avatar.ambition ?? "—" },
                { icon: "🌍", label: "Origine",  value: avatar.originStyle ?? "—" },
                { icon: "👗", label: "Style",    value: avatar.outfitStyle ?? "—" },
              ].map((item) => (
                <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                  paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: L.border }}>
                  <Text style={{ fontSize: 14, width: 22 }}>{item.icon}</Text>
                  <Text style={{ color: L.muted, fontSize: 11, width: 70 }}>{item.label}</Text>
                  <Text style={{ color: L.textSoft, fontSize: 13, flex: 1 }}>{item.value}</Text>
                </View>
              ))}
              <Pressable onPress={() => router.push("/(app)/avatar-edit" as never)}
                style={{ backgroundColor: L.primaryBg, borderRadius: 12, padding: 11,
                  alignItems: "center", borderWidth: 1, borderColor: L.primary + "30" }}>
                <Text style={{ color: L.primary, fontWeight: "700", fontSize: 12 }}>✏️ Modifier le profil</Text>
              </Pressable>
            </View>
          )}

          {/* ── THÈME ── */}
          <View>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 10 }}>
              DIRECTION ARTISTIQUE
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(Object.values(THEMES) as (typeof THEMES)[ThemeId][]).map((t) => {
                const active = appTheme === t.id;
                return (
                  <Pressable key={t.id} onPress={() => setAppTheme(t.id as ThemeId)}
                    style={{ flex: 1, borderRadius: 16, padding: 12, alignItems: "center", gap: 4,
                      backgroundColor: active ? t.primary + "15" : L.card,
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? t.primary : L.border }}>
                    <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
                    <Text style={{ color: active ? t.primary : L.muted,
                      fontSize: 9, fontWeight: "800", textAlign: "center" }}>
                      {t.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── ACCÈS RAPIDE ── */}
          <View>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 10 }}>
              PAGES
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: "🏆 Classement",   route: "/(app)/leaderboard",    color: L.gold    },
                { label: "⚡ Progression",   route: "/(app)/progression",    color: L.primary },
                { label: "🎯 Missions",      route: "/(app)/missions",       color: L.red     },
                { label: "⭐ Premium",       route: "/(app)/premium",        color: L.purple  },
                { label: "🏠 Logement",      route: "/(app)/housing",        color: L.teal    },
                { label: "👤 Profil public", route: "/(app)/profile-public", color: L.blue    },
              ].map((item) => (
                <Pressable key={item.route} onPress={() => router.push(item.route as never)}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
                    backgroundColor: item.color + "12", borderWidth: 1, borderColor: item.color + "25" }}>
                  <Text style={{ color: item.color, fontWeight: "700", fontSize: 11 }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── PREMIUM CTA ── */}
          {!isPremium && (
            <Pressable onPress={() => router.push("/(app)/premium" as never)}
              style={{ backgroundColor: L.purpleBg, borderRadius: 18, padding: 16,
                borderWidth: 1, borderColor: L.purple + "30",
                flexDirection: "row", alignItems: "center", gap: 14,
                shadowColor: L.purple, shadowOpacity: 0.2, shadowRadius: 12 }}>
              <Text style={{ fontSize: 28 }}>⭐</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: L.purple, fontWeight: "900", fontSize: 15 }}>Passer Premium</Text>
                <Text style={{ color: L.muted, fontSize: 11, marginTop: 2 }}>XP ×2 · cosmétiques · accès élite</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={L.purple} />
            </Pressable>
          )}

          {/* ── TEST ── */}
          {showTest && (
            <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: L.border, gap: 8 }}>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>MODE TEST</Text>
              <Pressable onPress={() => { loadTestAccount("live"); router.replace("/(app)/(tabs)/home"); }}
                style={{ backgroundColor: L.primaryBg, borderRadius: 10, padding: 11,
                  alignItems: "center", borderWidth: 1, borderColor: L.primary + "30" }}>
                <Text style={{ color: L.primary, fontWeight: "700", fontSize: 12 }}>⚡ Activer test live</Text>
              </Pressable>
            </View>
          )}

          {/* ── SESSION ── */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => { signOut(); router.replace("/(auth)/sign-in"); }}
              style={{ flex: 1, paddingVertical: 13, borderRadius: 14,
                backgroundColor: L.redBg, borderWidth: 1, borderColor: L.red + "30", alignItems: "center" }}>
              <Text style={{ color: L.red, fontWeight: "700", fontSize: 12 }}>⏏ Déconnexion</Text>
            </Pressable>
            <Pressable onPress={() => { resetAll(); router.replace("/(auth)/welcome"); }}
              style={{ flex: 1, paddingVertical: 13, borderRadius: 14,
                backgroundColor: L.card, borderWidth: 1, borderColor: L.border, alignItems: "center" }}>
              <Text style={{ color: L.muted, fontWeight: "700", fontSize: 12 }}>Supprimer profil</Text>
            </Pressable>
          </View>

        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}
