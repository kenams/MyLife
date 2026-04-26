import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual } from "@/lib/avatar-visual";
import { getHousingTier } from "@/lib/housing";
import { getActivePremiumBoost, getBoostMultiplier } from "@/lib/premium";
import { getLevelTitle } from "@/lib/progression";
import { getMomentumState, getSocialRankLabel, getSocialRankProgressData, RANK_ORDER } from "@/lib/selectors";
import { useGameStore } from "@/stores/game-store";

// ─── Light theme local ────────────────────────────────────────────────────────
const L = {
  bg:         "#e8edf5",
  card:       "#f0f4fa",
  cardAlt:    "#f8faff",
  text:       "#1e2a3a",
  textSoft:   "#4a5568",
  muted:      "#8fa3b8",
  border:     "#ccd4e0",
  primary:    "#6366f1",
  primaryBg:  "#eef2ff",
  green:      "#10b981",
  greenBg:    "#ecfdf5",
  gold:       "#f59e0b",
  goldBg:     "#fffbeb",
  red:        "#ef4444",
  redBg:      "#fef2f2",
  blue:       "#3b82f6",
  blueBg:     "#eff6ff",
  pink:       "#ec4899",
  pinkBg:     "#fdf2f8",
  purple:     "#8b5cf6",
  purpleBg:   "#f5f3ff",
  teal:       "#14b8a6",
  tealBg:     "#f0fdfa",
  shadow:     "rgba(99,102,241,0.08)",
};

const XP_PER_LEVEL = 200;

const RANK_LABELS: Record<string, string> = {
  precaire: "Précaire", modeste: "Modeste", stable: "Stable",
  confortable: "Confortable", influent: "Influent", elite: "Élite"
};
const RANK_EMOJIS: Record<string, string> = {
  precaire: "🪨", modeste: "🌱", stable: "⚡", confortable: "💎", influent: "👑", elite: "🌟"
};

// ─── StatBar ─────────────────────────────────────────────────────────────────
function StatBar({ label, value, icon, color, bg }: {
  label: string; value: number; icon: string; color: string; bg: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  const barW = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  const urgent = pct < 25;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: L.border }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: bg,
        alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: L.textSoft, fontSize: 13, fontWeight: "600" }}>{label}</Text>
          <Text style={{ color: urgent ? L.red : color, fontSize: 13, fontWeight: "800" }}>{Math.round(pct)}</Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: L.border, overflow: "hidden" }}>
          <Animated.View style={{ height: 6, borderRadius: 3, width: barW,
            backgroundColor: urgent ? L.red : color }} />
        </View>
      </View>
    </View>
  );
}

// ─── QuickAction ─────────────────────────────────────────────────────────────
function QuickAction({ emoji, label, color, bg, route }: {
  emoji: string; label: string; color: string; bg: string; route: string;
}) {
  return (
    <Pressable onPress={() => router.push(route as never)}
      style={{ flex: 1, minWidth: 80, backgroundColor: bg, borderRadius: 16,
        paddingVertical: 14, alignItems: "center", gap: 6,
        borderWidth: 1, borderColor: color + "30",
        shadowColor: color, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

// ─── AssetCard ───────────────────────────────────────────────────────────────
function AssetCard({ emoji, label, value, color, bg }: {
  emoji: string; label: string; value: string; color: string; bg: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 14, padding: 12, gap: 4,
      borderWidth: 1, borderColor: color + "20",
      shadowColor: color, shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={{ color, fontSize: 13, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: L.muted, fontSize: 10 }}>{label}</Text>
    </View>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const session          = useGameStore((s) => s.avatar);
  const avatar           = useGameStore((s) => s.avatar);
  const stats            = useGameStore((s) => s.stats);
  const relationships    = useGameStore((s) => s.relationships);
  const datePlans        = useGameStore((s) => s.datePlans);
  const signOut          = useGameStore((s) => s.signOut);
  const resetAll         = useGameStore((s) => s.resetAll);
  const loadTestAccount  = useGameStore((s) => s.loadTestAccount);
  const syncToSupabase   = useGameStore((s) => s.syncToSupabase);
  const isPremium        = useGameStore((s) => s.isPremium);
  const premiumTier      = useGameStore((s) => s.premiumTier);
  const activeBoosts     = useGameStore((s) => s.activeBoosts);
  const moneyTransfers   = useGameStore((s) => s.moneyTransfers);
  const playerXp         = useGameStore((s) => s.playerXp ?? 0);
  const playerLevel      = useGameStore((s) => s.playerLevel ?? 1);
  const housingTier      = useGameStore((s) => s.housingTier);
  const wealthScore      = useGameStore((s) => s.wealthScore);
  const sessionData      = useGameStore((s) => s.session);

  const momentum    = getMomentumState(stats);
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
  const slideAnim = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const xpBarAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(xpBarAnim, { toValue: xpPct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [xpPct]);
  const xpBarWidth = xpBarAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  // Résumé de l'état
  const stateLabel = stats.energy < 25 ? "Fatigué" : stats.hunger < 25 ? "A faim" : stats.hygiene < 25 ? "Besoin d'hygiène" : stats.mood < 30 ? "Moral bas" : "En forme ✓";
  const stateColor = stats.energy < 25 || stats.hunger < 25 || stats.hygiene < 25 || stats.mood < 30 ? L.red : L.green;

  const activeRels = relationships.filter((r) => r.score > 30);
  const showTest   = process.env.NODE_ENV !== "production";

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: L.bg }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── HERO ── */}
        <View style={{ backgroundColor: L.primary, paddingTop: 54, paddingBottom: 32, paddingHorizontal: 20, overflow: "hidden" }}>
          {/* Décor */}
          <View style={{ position: "absolute", top: -40, right: -30, width: 180, height: 180, borderRadius: 90,
            backgroundColor: "rgba(255,255,255,0.08)" }} />
          <View style={{ position: "absolute", bottom: -20, left: -20, width: 120, height: 120, borderRadius: 60,
            backgroundColor: "rgba(255,255,255,0.05)" }} />

          {/* Top badges */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {isPremium && (
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>⭐ PREMIUM</Text>
                </View>
              )}
              {activeBoost && (
                <View style={{ backgroundColor: "rgba(245,158,11,0.3)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "800" }}>⚡ ×{boostMult}</Text>
                </View>
              )}
            </View>
            <Pressable onPress={() => router.push("/(app)/avatar-edit" as never)}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="pencil" size={15} color="#fff" />
            </Pressable>
          </View>

          {/* Avatar + infos */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ position: "relative" }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(255,255,255,0.15)",
                borderWidth: 3, borderColor: "rgba(255,255,255,0.5)",
                alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {avatar
                  ? <AvatarSprite visual={getAvatarVisual(avatar)} action={stats.energy < 20 ? "sleeping" : "idle"} size="sm" />
                  : <Text style={{ fontSize: 38 }}>🧑</Text>
                }
              </View>
              <View style={{ position: "absolute", bottom: -2, right: -4,
                backgroundColor: stateColor, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2,
                borderWidth: 2, borderColor: "#fff" }}>
                <Text style={{ color: "#fff", fontSize: 8, fontWeight: "900" }}>{stateLabel}</Text>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 24 }}>
                {avatar?.displayName ?? "Joueur"}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 2 }}>
                {housing.emoji} {housing.name} · {levelTitle}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1 }}>
                {sessionData?.email ?? "Mode local"}
              </Text>
            </View>
          </View>

          {/* XP Bar */}
          <View style={{ marginTop: 20, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700" }}>
                Niveau {playerLevel}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{xpInLevel} / {XP_PER_LEVEL} XP</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
              <Animated.View style={{ height: 8, borderRadius: 4, width: xpBarWidth,
                backgroundColor: "#fff" }} />
            </View>
          </View>

          {/* Mini stats row */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            {[
              { label: "Argent",    value: `${stats.money}`,           color: "#fde68a" },
              { label: "Réputation",value: `${stats.reputation}`,      color: "rgba(255,255,255,0.9)" },
              { label: "Streak",    value: `${stats.streak}j`,         color: "#fca5a5" },
              { label: "Richesse",  value: `${(wealthScore/1000).toFixed(1)}k`, color: "rgba(255,255,255,0.7)" },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12,
                paddingVertical: 8, alignItems: "center", gap: 2 }}>
                <Text style={{ color: item.color, fontWeight: "900", fontSize: 13 }}>{item.value}</Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 9 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Animated.View style={{ transform: [{ translateY: slideAnim }], gap: 16, padding: 16 }}>

          {/* ── ACTIONS RAPIDES ── */}
          <View>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
              ACTIONS RAPIDES
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <QuickAction emoji="🍽️" label="Manger"    color={L.gold}    bg={L.goldBg}    route="/(app)/health" />
              <QuickAction emoji="😴" label="Dormir"    color={L.blue}    bg={L.blueBg}    route="/(app)/health" />
              <QuickAction emoji="🚿" label="Hygiène"   color={L.teal}    bg={L.tealBg}    route="/(app)/health" />
              <QuickAction emoji="💼" label="Travailler" color={L.primary} bg={L.primaryBg} route="/(app)/work" />
              <QuickAction emoji="💪" label="Sport"     color={L.green}   bg={L.greenBg}   route="/(app)/health" />
              <QuickAction emoji="🌍" label="Sortir"    color={L.pink}    bg={L.pinkBg}    route="/(app)/(tabs)/world" />
            </View>
          </View>

          {/* ── STATISTIQUES ── */}
          <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16,
            shadowColor: L.shadow, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
            borderWidth: 1, borderColor: L.border }}>
            <Text style={{ color: L.text, fontSize: 15, fontWeight: "800", marginBottom: 4 }}>Statistiques</Text>
            <Text style={{ color: L.muted, fontSize: 11, marginBottom: 12 }}>État actuel de ton personnage</Text>
            <StatBar label="Énergie"     value={stats.energy}          icon="⚡"  color={L.blue}    bg={L.blueBg} />
            <StatBar label="Faim"        value={stats.hunger}          icon="🍽️" color={L.gold}    bg={L.goldBg} />
            <StatBar label="Santé"       value={stats.health}          icon="❤️"  color={L.red}     bg={L.redBg} />
            <StatBar label="Hygiène"     value={stats.hygiene}         icon="🚿"  color={L.teal}    bg={L.tealBg} />
            <StatBar label="Moral"       value={stats.mood}            icon="😊"  color={L.purple}  bg={L.purpleBg} />
            <StatBar label="Attractivité" value={stats.attractiveness} icon="✨"  color={L.pink}    bg={L.pinkBg} />
            <StatBar label="Fitness"     value={stats.fitness}         icon="💪"  color={L.green}   bg={L.greenBg} />
            <StatBar label="Discipline"  value={stats.discipline}      icon="🎯"  color={L.primary} bg={L.primaryBg} />
          </View>

          {/* ── POSSESSIONS ── */}
          <View>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
              POSSESSIONS
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <AssetCard emoji={housing.emoji} label="Logement"  value={housing.name}       color={L.primary} bg={L.primaryBg} />
              <AssetCard emoji="💰"           label="Argent"     value={`${stats.money} cr`} color={L.gold}    bg={L.goldBg} />
              <AssetCard emoji="⭐"           label="Réputation" value={`${stats.reputation}`} color={L.purple} bg={L.purpleBg} />
              <AssetCard emoji="📱"           label="Niveau"     value={`Niv. ${playerLevel}`} color={L.green}  bg={L.greenBg} />
            </View>
          </View>

          {/* ── RANG SOCIAL ── */}
          <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16,
            shadowColor: L.shadow, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
            borderWidth: 1, borderColor: L.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View>
                <Text style={{ color: L.text, fontSize: 15, fontWeight: "800" }}>Rang social</Text>
                <Text style={{ color: L.muted, fontSize: 11, marginTop: 2 }}>Ta position dans la ville</Text>
              </View>
              <View style={{ backgroundColor: L.primaryBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                borderWidth: 1, borderColor: L.primary + "30" }}>
                <Text style={{ color: L.primary, fontWeight: "800", fontSize: 13 }}>
                  {RANK_EMOJIS[currentRank]} {RANK_LABELS[currentRank]}
                </Text>
              </View>
            </View>

            {/* Steps */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
              {RANK_ORDER.map((rank, i) => {
                const passed  = i < currentIdx;
                const current = rank === currentRank;
                return (
                  <View key={rank} style={{ flex: 1, alignItems: "center" }}>
                    {i > 0 && (
                      <View style={{ position: "absolute", left: 0, right: "50%", height: 2, top: 13,
                        backgroundColor: passed || current ? L.primary + "60" : L.border }} />
                    )}
                    <View style={{ width: current ? 28 : 20, height: current ? 28 : 20,
                      borderRadius: current ? 14 : 10,
                      backgroundColor: passed ? L.primary + "20" : current ? L.primary : L.border,
                      borderWidth: current ? 2 : 1,
                      borderColor: passed ? L.primary + "60" : current ? L.primary : L.border,
                      alignItems: "center", justifyContent: "center",
                      shadowColor: current ? L.primary : "transparent", shadowOpacity: 0.3, shadowRadius: 8 }}>
                      <Text style={{ fontSize: current ? 12 : 9 }}>{RANK_EMOJIS[rank]}</Text>
                    </View>
                    <Text style={{ color: current ? L.primary : L.muted,
                      fontSize: 7, fontWeight: current ? "800" : "400", marginTop: 4, textAlign: "center" }}>
                      {RANK_LABELS[rank].slice(0, 4)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Progress */}
            <View style={{ gap: 5 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: L.textSoft, fontSize: 12 }}>Score : {rp.score}</Text>
                {rp.nextRank
                  ? <Text style={{ color: L.muted, fontSize: 12 }}>+{rp.scoreToNext} → {RANK_LABELS[rp.nextRank]}</Text>
                  : <Text style={{ color: L.green, fontSize: 12, fontWeight: "700" }}>🌟 Rang max</Text>
                }
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: L.border, overflow: "hidden" }}>
                <View style={{ height: 8, borderRadius: 4, width: `${rp.progress}%`,
                  backgroundColor: L.primary }} />
              </View>
            </View>

            {rp.tips.length > 0 && (
              <View style={{ marginTop: 10, gap: 4 }}>
                {rp.tips.slice(0, 2).map((tip, i) => (
                  <Text key={i} style={{ color: L.muted, fontSize: 11 }}>· {tip}</Text>
                ))}
              </View>
            )}
          </View>

          {/* ── VIE SOCIALE ── */}
          <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16,
            shadowColor: L.shadow, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
            borderWidth: 1, borderColor: L.border }}>
            <Text style={{ color: L.text, fontSize: 15, fontWeight: "800", marginBottom: 12 }}>Vie sociale</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Relations",  value: activeRels.length,                                                            emoji: "👥", color: L.primary },
                { label: "Dates",      value: datePlans.filter((d) => d.status === "accepted" || d.status === "proposed").length, emoji: "💘", color: L.pink },
                { label: "Transferts", value: moneyTransfers.length,                                                        emoji: "💸", color: L.gold },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, backgroundColor: item.color + "0d", borderRadius: 14,
                  padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: item.color + "20" }}>
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
          <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16,
            shadowColor: L.shadow, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
            borderWidth: 1, borderColor: L.border, gap: 10 }}>
            <Text style={{ color: L.text, fontSize: 15, fontWeight: "800" }}>Identité</Text>
            {avatar?.bio && (
              <Text style={{ color: L.textSoft, fontSize: 13, lineHeight: 19 }}>{avatar.bio}</Text>
            )}
            {[
              { icon: "🎭", label: "Trait",   value: avatar?.personalityTrait ?? "—" },
              { icon: "🎯", label: "Ambition", value: avatar?.ambition ?? "—" },
              { icon: "🌍", label: "Origine",  value: avatar?.originStyle ?? "—" },
              { icon: "👗", label: "Style",    value: avatar?.outfitStyle ?? "—" },
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: L.border }}>
                <Text style={{ fontSize: 15, width: 24 }}>{item.icon}</Text>
                <Text style={{ color: L.muted, fontSize: 12, width: 70 }}>{item.label}</Text>
                <Text style={{ color: L.textSoft, fontSize: 13, flex: 1 }}>{item.value}</Text>
              </View>
            ))}
            <Pressable onPress={() => router.push("/(app)/avatar-edit" as never)}
              style={{ backgroundColor: L.primaryBg, borderRadius: 12, padding: 12,
                alignItems: "center", borderWidth: 1, borderColor: L.primary + "30" }}>
              <Text style={{ color: L.primary, fontWeight: "700", fontSize: 13 }}>✏️ Modifier le profil</Text>
            </Pressable>
          </View>

          {/* ── ACCÈS RAPIDE ── */}
          <View>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
              PAGES
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: "🏆 Classement",   route: "/(app)/leaderboard",    color: L.gold,    bg: L.goldBg    },
                { label: "⚡ Progression",   route: "/(app)/progression",    color: L.primary, bg: L.primaryBg },
                { label: "🎯 Missions",      route: "/(app)/missions",       color: L.red,     bg: L.redBg     },
                { label: "⭐ Premium",       route: "/(app)/premium",        color: L.purple,  bg: L.purpleBg  },
                { label: "🏠 Logement",      route: "/(app)/housing",        color: L.teal,    bg: L.tealBg    },
                { label: "👤 Profil public", route: "/(app)/profile-public", color: L.blue,    bg: L.blueBg    },
              ].map((item) => (
                <Pressable key={item.route} onPress={() => router.push(item.route as never)}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
                    backgroundColor: item.bg, borderWidth: 1, borderColor: item.color + "25" }}>
                  <Text style={{ color: item.color, fontWeight: "600", fontSize: 12 }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── PREMIUM CTA ── */}
          {!isPremium && (
            <Pressable onPress={() => router.push("/(app)/premium" as never)}
              style={{ backgroundColor: L.purpleBg, borderRadius: 18, padding: 16,
                borderWidth: 1.5, borderColor: L.purple + "30",
                flexDirection: "row", alignItems: "center", gap: 14,
                shadowColor: L.purple, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
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
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }}>MODE TEST</Text>
              <Pressable onPress={() => { loadTestAccount("live"); router.replace("/(app)/(tabs)/home"); }}
                style={{ backgroundColor: L.border, borderRadius: 10, padding: 11, alignItems: "center" }}>
                <Text style={{ color: L.textSoft, fontWeight: "700", fontSize: 12 }}>⚡ Activer test live</Text>
              </Pressable>
            </View>
          )}

          {/* ── SESSION ── */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => { signOut(); router.replace("/(auth)/sign-in"); }}
              style={{ flex: 1, paddingVertical: 13, borderRadius: 14,
                backgroundColor: "#fff0f0", borderWidth: 1, borderColor: "#fecaca", alignItems: "center" }}>
              <Text style={{ color: L.red, fontWeight: "700", fontSize: 12 }}>⏏ Déconnexion</Text>
            </Pressable>
            <Pressable onPress={() => { resetAll(); router.replace("/(auth)/welcome"); }}
              style={{ flex: 1, paddingVertical: 13, borderRadius: 14,
                backgroundColor: L.card, borderWidth: 1, borderColor: L.border, alignItems: "center" }}>
              <Text style={{ color: L.muted, fontWeight: "700", fontSize: 12 }}>↺ Reset</Text>
            </Pressable>
          </View>

        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}
