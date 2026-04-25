import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual } from "@/lib/avatar-visual";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { getHousingTier } from "@/lib/housing";
import { getActivePremiumBoost, getBoostMultiplier } from "@/lib/premium";
import { getLevelTitle } from "@/lib/progression";
import { getMomentumState, getSocialRankLabel, getSocialRankProgressData, RANK_ORDER } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

const XP_PER_LEVEL = 200;

const RANK_LABELS: Record<string, string> = {
  precaire: "Précaire", modeste: "Modeste", stable: "Stable",
  confortable: "Confortable", influent: "Influent", elite: "Élite"
};
const RANK_EMOJIS: Record<string, string> = {
  precaire: "🪨", modeste: "🌱", stable: "⚡", confortable: "💎", influent: "👑", elite: "🌟"
};

// ─── Métrique ronde ───────────────────────────────────────────────────────────
function RoundStat({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  const barW = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 5 }}>
      <View style={{ width: 50, height: 50, borderRadius: 25,
        backgroundColor: color + "18", borderWidth: 2, borderColor: color + "55",
        alignItems: "center", justifyContent: "center",
        shadowColor: color, shadowOpacity: 0.3, shadowRadius: 8 }}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <View style={{ width: "85%", height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <Animated.View style={{ height: 3, borderRadius: 2, width: barW, backgroundColor: color }} />
      </View>
      <Text style={{ color, fontWeight: "900", fontSize: 12 }}>{Math.round(pct)}</Text>
      <Text style={{ color: colors.muted, fontSize: 9 }}>{label}</Text>
    </View>
  );
}

// ─── Ligne info ───────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 16, width: 24 }}>{icon}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, width: 90 }}>{label}</Text>
      <Text style={{ color: color ?? colors.textSoft, fontSize: 13, fontWeight: "600", flex: 1 }}>{value}</Text>
    </View>
  );
}

// ─── Social rank step ─────────────────────────────────────────────────────────
function RankStep({ rank, current, passed }: { rank: string; current: boolean; passed: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!current) return;
    Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
    ])).start();
  }, [current]);

  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Animated.View style={{
        width: current ? 40 : 28, height: current ? 40 : 28,
        borderRadius: current ? 20 : 14,
        backgroundColor: passed ? colors.accent + "30" : current ? colors.accent + "22" : "rgba(255,255,255,0.06)",
        borderWidth: current ? 2.5 : 1.5,
        borderColor: passed ? colors.accent + "80" : current ? colors.accent : "rgba(255,255,255,0.12)",
        alignItems: "center", justifyContent: "center",
        shadowColor: current ? colors.accent : "transparent", shadowOpacity: 0.5, shadowRadius: 8,
        transform: [{ scale: scaleAnim }],
      }}>
        <Text style={{ fontSize: current ? 16 : 12 }}>{RANK_EMOJIS[rank]}</Text>
      </Animated.View>
      <Text style={{ color: current ? colors.accent : passed ? colors.accent + "aa" : colors.muted,
        fontSize: 8, fontWeight: current ? "900" : "400", marginTop: 4, textAlign: "center" }}>
        {RANK_LABELS[rank]}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const session          = useGameStore((s) => s.session);
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
  const equippedCosmetics= useGameStore((s) => s.equippedCosmetics);
  const moneyTransfers   = useGameStore((s) => s.moneyTransfers);
  const playerXp         = useGameStore((s) => s.playerXp ?? 0);
  const playerLevel      = useGameStore((s) => s.playerLevel ?? 1);
  const housingTier      = useGameStore((s) => s.housingTier);
  const wealthScore      = useGameStore((s) => s.wealthScore);

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
  const slideAnim = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const xpBarAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(xpBarAnim, { toValue: xpPct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [xpPct]);
  const xpBarWidth = xpBarAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  const showTestMode = process.env.NODE_ENV !== "production";

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* ── HERO ── */}
        <View style={{ backgroundColor: "#060d18", paddingBottom: 28, overflow: "hidden",
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
          {/* Ambient */}
          <View style={{ position: "absolute", top: -40, left: -40, width: 180, height: 180, borderRadius: 90,
            backgroundColor: colors.accentGlow }} />
          <View style={{ position: "absolute", top: -10, right: -50, width: 160, height: 160, borderRadius: 80,
            backgroundColor: housing.color + "14" }} />
          <View style={{ position: "absolute", bottom: -20, left: "40%", width: 100, height: 100, borderRadius: 50,
            backgroundColor: colors.purpleGlow }} />

          {/* Top badges */}
          <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16, gap: 8, flexWrap: "wrap" }}>
            {session?.provider === "supabase"
              ? <View style={{ backgroundColor: colors.accentGlow, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
                  borderWidth: 1, borderColor: colors.accent + "55" }}>
                  <Text style={{ color: colors.accent, fontSize: 10, fontWeight: "800" }}>☁️ Supabase</Text>
                </View>
              : <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>Mode local</Text>
                </View>
            }
            {isPremium && (
              <View style={{ backgroundColor: colors.purpleGlow, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
                borderWidth: 1, borderColor: colors.purple + "55" }}>
                <Text style={{ color: colors.purple, fontSize: 10, fontWeight: "800" }}>
                  ⭐ PREMIUM {premiumTier === "yearly" ? "ANNUEL" : "MENSUEL"}
                </Text>
              </View>
            )}
            {activeBoost && (
              <View style={{ backgroundColor: colors.goldGlow, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
                borderWidth: 1, borderColor: colors.gold + "55" }}>
                <Text style={{ color: colors.gold, fontSize: 10, fontWeight: "800" }}>⚡ BOOST ×{boostMult}</Text>
              </View>
            )}
          </View>

          {/* Avatar + nom */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 16, marginBottom: 20 }}>
            <View style={{ position: "relative" }}>
              <View style={{ width: 80, height: 80, borderRadius: 40,
                backgroundColor: colors.accentGlow,
                borderWidth: 3, borderColor: housing.color,
                alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                shadowColor: housing.color, shadowOpacity: 0.5, shadowRadius: 16 }}>
                {avatar ? (
                  <AvatarSprite
                    visual={getAvatarVisual(avatar)}
                    action={stats.energy < 20 ? "sleeping" : "idle"}
                    size="sm"
                  />
                ) : (
                  <Text style={{ fontSize: 36 }}>🧑</Text>
                )}
              </View>
              {/* Housing badge */}
              <View style={{ position: "absolute", bottom: -4, right: -6,
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: colors.bg, alignItems: "center", justifyContent: "center",
                borderWidth: 1.5, borderColor: housing.color }}>
                <Text style={{ fontSize: 14 }}>{housing.emoji}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 22 }}>
                {avatar?.displayName ?? "Joueur"}
              </Text>
              <Text style={{ color: housing.color, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
                {housing.name} · {levelTitle}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {session?.email ?? "Mode local"}
              </Text>
            </View>
            <Pressable onPress={() => router.push("/(app)/avatar-edit" as never)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.07)",
                alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="pencil" size={16} color={colors.muted} />
            </Pressable>
          </View>

          {/* XP Bar */}
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.goldGlow,
                  borderWidth: 1.5, borderColor: colors.gold + "60",
                  alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 12 }}>{playerLevel}</Text>
                </View>
                <Text style={{ color: colors.gold, fontWeight: "800", fontSize: 12 }}>Niveau {playerLevel}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 10 }}>{xpInLevel} / {XP_PER_LEVEL} XP</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <Animated.View style={{ height: 6, borderRadius: 3, width: xpBarWidth,
                backgroundColor: colors.gold,
                shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 6 }} />
            </View>
          </View>

          {/* Quick stats row */}
          <View style={{ flexDirection: "row", paddingHorizontal: 20, marginTop: 16, gap: 8 }}>
            {[
              { label: "Richesse", value: `${(wealthScore / 1000).toFixed(1)}k`, color: colors.gold,   icon: "💰" },
              { label: "Réputation", value: `${stats.reputation}`,               color: colors.accent, icon: "⭐" },
              { label: "Streak",   value: `${stats.streak}j`,                    color: "#f87171",     icon: "🔥" },
              { label: "Argent",   value: `${stats.money} cr`,                   color: colors.blue,   icon: "💳" },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, backgroundColor: item.color + "12", borderRadius: 14,
                paddingVertical: 10, paddingHorizontal: 8, alignItems: "center", gap: 3,
                borderWidth: 1, borderColor: item.color + "35",
                shadowColor: item.color, shadowOpacity: 0.15, shadowRadius: 6 }}>
                <Text style={{ fontSize: 16 }}>{item.icon}</Text>
                <Text style={{ color: item.color, fontWeight: "900", fontSize: 13 }}>{item.value}</Text>
                <Text style={{ color: colors.muted, fontSize: 8, letterSpacing: 0.3 }}>{item.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>

        <Animated.View style={{ gap: 16, padding: 20, transform: [{ translateY: slideAnim }] }}>

          {/* ── RANG SOCIAL ── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 14,
            borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>RANG SOCIAL</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
                backgroundColor: colors.accentGlow, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
                borderWidth: 1, borderColor: colors.accent + "40" }}>
                <Text style={{ fontSize: 13 }}>{RANK_EMOJIS[currentRank]}</Text>
                <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 12 }}>
                  {RANK_LABELS[currentRank]}
                </Text>
              </View>
            </View>

            {/* Étapes visuelles */}
            <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
              {RANK_ORDER.map((rank, i) => {
                const isPassed  = i < currentIdx;
                const isCurrent = rank === currentRank;
                return (
                  <View key={rank} style={{ flex: 1, alignItems: "center" }}>
                    {/* Connector */}
                    {i > 0 && (
                      <View style={{ position: "absolute", left: 0, right: "50%", height: 2, top: isCurrent ? 20 : 14,
                        backgroundColor: isPassed || isCurrent ? colors.accent + "60" : "rgba(255,255,255,0.08)" }} />
                    )}
                    <RankStep rank={rank} current={isCurrent} passed={isPassed} />
                  </View>
                );
              })}
            </View>

            {/* Progress bar */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Score : {rp.score}</Text>
                {rp.nextRank
                  ? <Text style={{ color: colors.muted, fontSize: 11 }}>+{rp.scoreToNext} → {RANK_LABELS[rp.nextRank]}</Text>
                  : <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>🌟 Rang maximum</Text>
                }
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <View style={{ height: 6, borderRadius: 3, width: `${rp.progress}%`, backgroundColor: colors.accent,
                  shadowColor: colors.accent, shadowOpacity: 0.8, shadowRadius: 4 }} />
              </View>
            </View>

            {rp.tips.length > 0 && (
              <View style={{ gap: 4 }}>
                {rp.tips.slice(0, 2).map((tip, i) => (
                  <Text key={i} style={{ color: colors.muted, fontSize: 11 }}>· {tip}</Text>
                ))}
              </View>
            )}
          </View>

          {/* ── STATS VISUELLES ── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16,
            borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 14 }}>
              STATISTIQUES
            </Text>
            <View style={{ flexDirection: "row", gap: 4 }}>
              <RoundStat label="Faim"    value={stats.hunger}          icon="🍽️" color={colors.gold}    />
              <RoundStat label="Énergie" value={stats.energy}          icon="⚡" color={colors.blue}    />
              <RoundStat label="Humeur"  value={stats.mood}            icon="😊" color={colors.purple}  />
              <RoundStat label="Social"  value={stats.sociability}     icon="👥" color={colors.accent}  />
              <RoundStat label="Hygiène" value={stats.hygiene}         icon="🚿" color={colors.teal}    />
              <RoundStat label="Zen"     value={100 - stats.stress}    icon="🧘" color="#a78bfa"        />
            </View>
            <View style={{ flexDirection: "row", gap: 4, marginTop: 14 }}>
              <RoundStat label="Santé"      value={stats.health}        icon="❤️" color="#f87171"       />
              <RoundStat label="Fitness"    value={stats.fitness}       icon="💪" color={colors.gold}   />
              <RoundStat label="Discipline" value={stats.discipline}    icon="🎯" color={colors.accent} />
              <RoundStat label="Motivation" value={stats.motivation}    icon="🚀" color={colors.blue}   />
              <RoundStat label="Attrait"    value={stats.attractiveness}icon="✨" color={colors.purple} />
              <RoundStat label="Mémoire"    value={stats.reputation}    icon="⭐" color={colors.gold}   />
            </View>
          </View>

          {/* ── LOGEMENT + MOMENTUM ── */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={() => router.push("/(app)/housing" as never)}
              style={{ flex: 1, backgroundColor: housing.color + "12", borderRadius: 16, padding: 14,
                borderWidth: 1.5, borderColor: housing.color + "45",
                shadowColor: housing.color, shadowOpacity: 0.15, shadowRadius: 8 }}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>{housing.emoji}</Text>
              <Text style={{ color: housing.color, fontWeight: "900", fontSize: 14 }}>{housing.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>
                {housing.rentPerDay > 0 ? `${housing.rentPerDay} cr/j` : "Gratuit"}
              </Text>
              <Text style={{ color: housing.color, fontSize: 10, fontWeight: "700", marginTop: 6 }}>Gérer →</Text>
            </Pressable>
            <View style={{ flex: 1, backgroundColor: colors.goldGlow, borderRadius: 16, padding: 14,
              borderWidth: 1.5, borderColor: colors.gold + "40" }}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>⚡</Text>
              <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 14 }}>{momentum.label}</Text>
              <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>×{momentum.multiplier.toFixed(2)} multiplicateur</Text>
              <Text style={{ color: colors.gold, fontSize: 10, marginTop: 4 }}>{stats.streak}j streak</Text>
            </View>
          </View>

          {/* ── IDENTITÉ ── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 4,
            borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 }}>
              IDENTITÉ
            </Text>
            {avatar?.bio && (
              <Text style={{ color: colors.textSoft, fontSize: 13, lineHeight: 19, marginBottom: 10 }}>{avatar.bio}</Text>
            )}
            <InfoRow icon="👤" label="Genre"       value={avatar?.gender ?? "-"} />
            <InfoRow icon="🌍" label="Origine"     value={avatar?.originStyle ?? "-"} />
            <InfoRow icon="🎭" label="Trait"       value={avatar?.personalityTrait ?? "-"} color={colors.accent} />
            <InfoRow icon="🎯" label="Ambition"    value={avatar?.ambition ?? "-"} />
            <InfoRow icon="⏰" label="Rythme"      value={avatar?.lifeRhythm ?? "-"} />
            <InfoRow icon="🏆" label="Objectif"    value={avatar?.personalGoal ?? "-"} />
            <InfoRow icon="👗" label="Style"        value={avatar?.outfitStyle ?? "-"} />
            <Pressable onPress={() => router.push("/(app)/avatar-edit" as never)}
              style={{ marginTop: 10, backgroundColor: colors.accentGlow, borderRadius: 12, padding: 11,
                alignItems: "center", borderWidth: 1, borderColor: colors.accent + "45" }}>
              <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 13 }}>✏️ Éditer le profil</Text>
            </Pressable>
          </View>

          {/* ── VIE SOCIALE ── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16,
            borderWidth: 1, borderColor: colors.border, gap: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>VIE SOCIALE</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { label: "Relations actives", value: relationships.filter((r) => r.score > 30).length, emoji: "👥", color: colors.accent },
                { label: "Dates planifiés",   value: datePlans.filter((d) => d.status === "accepted" || d.status === "proposed").length, emoji: "💘", color: "#f87171" },
                { label: "Transferts",        value: moneyTransfers.length, emoji: "💸", color: colors.gold },
                { label: "Cosmétiques",       value: equippedCosmetics.length, emoji: "✨", color: colors.purple },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, backgroundColor: item.color + "10", borderRadius: 12,
                  padding: 10, alignItems: "center", borderWidth: 1, borderColor: item.color + "30" }}>
                  <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                  <Text style={{ color: item.color, fontWeight: "900", fontSize: 16, marginTop: 4 }}>{item.value}</Text>
                  <Text style={{ color: colors.muted, fontSize: 8, marginTop: 2, textAlign: "center" }}>{item.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => router.push("/(app)/relations" as never)}
                style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 11,
                  alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textSoft, fontWeight: "700", fontSize: 12 }}>👥 Relations</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/dates" as never)}
                style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 11,
                  alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textSoft, fontWeight: "700", fontSize: 12 }}>💘 Dates</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/economy" as never)}
                style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 11,
                  alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textSoft, fontWeight: "700", fontSize: 12 }}>💸 Wallet</Text>
              </Pressable>
            </View>
          </View>

          {/* ── ACCÈS RAPIDE ── */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>ACCÈS RAPIDE</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: "🏆 Classement",   route: "/(app)/leaderboard",    color: colors.gold   },
                { label: "⚡ Progression",   route: "/(app)/progression",    color: colors.accent },
                { label: "🎯 Missions",      route: "/(app)/missions",       color: "#f87171"     },
                { label: "⭐ Premium",       route: "/(app)/premium",        color: colors.purple },
                { label: "🏠 Rooms",         route: "/(app)/rooms",          color: colors.teal   },
                { label: "👤 Profil public", route: "/(app)/profile-public", color: colors.blue   },
              ].map((item) => (
                <Pressable key={item.route} onPress={() => router.push(item.route as never)}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
                    backgroundColor: item.color + "12", borderWidth: 1, borderColor: item.color + "35" }}>
                  <Text style={{ color: item.color, fontWeight: "700", fontSize: 12 }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── PREMIUM CTA ── */}
          {!isPremium && (
            <Pressable onPress={() => router.push("/(app)/premium" as never)}
              style={{ backgroundColor: colors.purpleGlow, borderRadius: 16, padding: 16,
                borderWidth: 1.5, borderColor: colors.purple + "55",
                flexDirection: "row", alignItems: "center", gap: 14,
                shadowColor: colors.purple, shadowOpacity: 0.2, shadowRadius: 12 }}>
              <Text style={{ fontSize: 28 }}>⭐</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.purple, fontWeight: "900", fontSize: 15 }}>Passer Premium</Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                  XP ×2 · cosmétiques · accès elite
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.purple} />
            </Pressable>
          )}

          {/* ── TEST MODE ── */}
          {showTestMode && (
          <View style={{ backgroundColor: colors.cardAlt, borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>MODE TEST</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Charge toutes les données test : premium, boosts, relations, argent, travail.
            </Text>
            <Pressable onPress={() => { loadTestAccount("live"); router.replace("/(app)/(tabs)/home"); }}
              style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 11,
                alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textSoft, fontWeight: "700", fontSize: 12 }}>⚡ Activer test live</Text>
            </Pressable>
          </View>
          )}

          {/* ── SYNC SUPABASE ── */}
          {session?.provider === "supabase" && (
            <Pressable onPress={() => { void syncToSupabase(); }}
              style={{ backgroundColor: colors.accentGlow, borderRadius: 12, padding: 12,
                alignItems: "center", borderWidth: 1, borderColor: colors.accent + "45" }}>
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>☁️ Synchroniser Supabase</Text>
            </Pressable>
          )}

          {/* ── SESSION ── */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => { signOut(); router.replace("/(auth)/sign-in"); }}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 13, backgroundColor: "rgba(255,80,80,0.08)",
                borderWidth: 1, borderColor: "rgba(255,80,80,0.2)", alignItems: "center" }}>
              <Text style={{ color: "#ff8d8d", fontWeight: "700", fontSize: 12 }}>⏏ Déconnexion</Text>
            </Pressable>
            <Pressable onPress={() => { resetAll(); router.replace("/(auth)/welcome"); }}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 13, backgroundColor: "rgba(255,80,80,0.03)",
                borderWidth: 1, borderColor: "rgba(255,80,80,0.08)", alignItems: "center" }}>
              <Text style={{ color: "rgba(255,141,141,0.4)", fontWeight: "700", fontSize: 12 }}>↺ Reset</Text>
            </Pressable>
          </View>

          <View style={{ height: 8 }} />
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}
