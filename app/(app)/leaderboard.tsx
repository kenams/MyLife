import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { getLevelTitle } from "@/lib/progression";
import { computeWealthScore, getHousingTier, HOUSING_TIERS, type HousingTierId } from "@/lib/housing";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

type LeaderEntry = {
  rank:        number;
  displayName: string;
  level:       number;
  playerXp:    number;
  reputation:  number;
  streak:      number;
  money:       number;
  housing:     HousingTierId;
  wealthScore: number;
  isPremium:   boolean;
  isMe?:       boolean;
};

type SortKey = "wealth" | "xp" | "reputation" | "streak";

// NPC leaderboard data — fortune simulée
const NPC_LEADERS: Omit<LeaderEntry, "rank" | "isMe">[] = [
  { displayName: "Ava Laurent",   level: 28, playerXp: 5420, reputation: 94, streak: 42, money: 18400, housing: "villa",      wealthScore: 0, isPremium: true  },
  { displayName: "Noa Kiran",     level: 24, playerXp: 4650, reputation: 88, streak: 35, money: 9200,  housing: "penthouse",  wealthScore: 0, isPremium: true  },
  { displayName: "Leila Benali",  level: 21, playerXp: 3980, reputation: 81, streak: 28, money: 5800,  housing: "loft",       wealthScore: 0, isPremium: false },
  { displayName: "Malik Diop",    level: 18, playerXp: 3210, reputation: 75, streak: 21, money: 3400,  housing: "loft",       wealthScore: 0, isPremium: true  },
  { displayName: "Yan Zhou",      level: 16, playerXp: 2890, reputation: 70, streak: 18, money: 2100,  housing: "appartement",wealthScore: 0, isPremium: false },
  { displayName: "Sana Torres",   level: 14, playerXp: 2340, reputation: 65, streak: 14, money: 980,   housing: "appartement",wealthScore: 0, isPremium: false },
  { displayName: "Alex Dumont",   level: 12, playerXp: 1980, reputation: 58, streak: 10, money: 420,   housing: "studio",     wealthScore: 0, isPremium: false },
  { displayName: "Jade Fontaine", level: 10, playerXp: 1650, reputation: 52, streak: 7,  money: 210,   housing: "studio",     wealthScore: 0, isPremium: false },
  { displayName: "Tom Leclerc",   level: 8,  playerXp: 1180, reputation: 44, streak: 3,  money: 80,    housing: "squat",      wealthScore: 0, isPremium: false },
  { displayName: "Kai Besson",    level: 6,  playerXp: 780,  reputation: 36, streak: 0,  money: 10,    housing: "squat",      wealthScore: 0, isPremium: false },
];

// Ajouter wealth scores aux NPCs
const MOCK_LEADERS: Omit<LeaderEntry, "rank" | "isMe">[] = NPC_LEADERS.map((e) => ({
  ...e,
  wealthScore: computeWealthScore(e.money, e.playerXp, e.reputation, e.streak, e.housing, e.level),
}));

// ─── Podium top 3 ─────────────────────────────────────────────────────────────
function PodiumStep({ entry, height, delay }: { entry: LeaderEntry; height: number; delay: number }) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 600, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 1800, useNativeDriver: true }),
    ])).start();
  }, []);

  const tierInfo  = getHousingTier(entry.housing);
  const rankColor = entry.rank === 1 ? "#f6b94f" : entry.rank === 2 ? "#c0c0c0" : "#cd7f32";
  const rankEmoji = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉";

  return (
    <Animated.View style={{ flex: 1, alignItems: "center", transform: [{ translateY: slideAnim }] }}>
      {/* Crown / medal */}
      <Text style={{ fontSize: entry.rank === 1 ? 28 : 22, marginBottom: 6 }}>{rankEmoji}</Text>
      {/* Avatar circle */}
      <Animated.View style={{
        width: entry.rank === 1 ? 64 : 52, height: entry.rank === 1 ? 64 : 52,
        borderRadius: entry.rank === 1 ? 32 : 26,
        backgroundColor: rankColor + "22",
        borderWidth: entry.rank === 1 ? 3 : 2,
        borderColor: rankColor,
        alignItems: "center", justifyContent: "center",
        shadowColor: rankColor, shadowOpacity: glowAnim as never, shadowRadius: 16,
        marginBottom: 6,
      }}>
        <Text style={{ fontSize: entry.rank === 1 ? 28 : 22 }}>{tierInfo.emoji}</Text>
      </Animated.View>
      <Text style={{ color: entry.isMe ? colors.accent : colors.text, fontWeight: "900",
        fontSize: 11, textAlign: "center" }} numberOfLines={1}>
        {entry.displayName.split(" ")[0]}
      </Text>
      <Text style={{ color: rankColor, fontSize: 10, fontWeight: "700" }}>
        {(entry.wealthScore / 1000).toFixed(0)}k pts
      </Text>
      {/* Platform */}
      <View style={{
        width: "100%", height, borderRadius: 8,
        backgroundColor: rankColor + "18",
        borderWidth: 1, borderColor: rankColor + "40",
        marginTop: 6,
        shadowColor: rankColor, shadowOpacity: 0.2, shadowRadius: 8,
      }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: rankColor, fontWeight: "900", fontSize: entry.rank === 1 ? 18 : 15 }}>
            #{entry.rank}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Ligne classement ─────────────────────────────────────────────────────────
function LeaderRow({ entry, index, sortKey }: { entry: LeaderEntry; index: number; sortKey: SortKey }) {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 280, delay: index * 40, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 280, delay: index * 40, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const tierInfo   = getHousingTier(entry.housing);
  const levelTitle = getLevelTitle(entry.level);
  const isTop10    = entry.rank <= 10;

  const primaryValue = sortKey === "wealth"     ? `${(entry.wealthScore / 1000).toFixed(1)}k pts`
    : sortKey === "xp"         ? `${entry.playerXp.toLocaleString()} XP`
    : sortKey === "reputation" ? `⭐ ${entry.reputation}`
    : `🔥 ${entry.streak}j`;

  const tierColor = tierInfo.color;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={{
        backgroundColor: entry.isMe    ? colors.accent + "12"
          : entry.rank <= 3 ? tierColor + "08"
          : "rgba(255,255,255,0.025)",
        borderRadius: 16, padding: 13,
        borderWidth: entry.isMe ? 1.5 : 1,
        borderColor: entry.isMe    ? colors.accent + "50"
          : entry.rank <= 3 ? tierColor + "30"
          : "rgba(255,255,255,0.06)",
        flexDirection: "row", alignItems: "center", gap: 12,
      }}>
        {/* Rank */}
        <View style={{ width: 32, alignItems: "center" }}>
          {entry.rank <= 3
            ? <Text style={{ fontSize: 20 }}>{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}</Text>
            : <Text style={{ color: entry.rank <= 10 ? colors.textSoft : colors.muted, fontWeight: "800", fontSize: 14 }}>
                #{entry.rank}
              </Text>
          }
        </View>

        {/* Logement emoji */}
        <View style={{ width: 38, height: 38, borderRadius: 12,
          backgroundColor: tierColor + "18",
          borderWidth: 1.5, borderColor: tierColor + "40",
          alignItems: "center", justifyContent: "center",
          shadowColor: tierColor, shadowOpacity: isTop10 ? 0.3 : 0, shadowRadius: 6 }}>
          <Text style={{ fontSize: 20 }}>{tierInfo.emoji}</Text>
        </View>

        {/* Infos */}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: entry.isMe ? colors.accent : colors.text, fontWeight: "800", fontSize: 13 }} numberOfLines={1}>
              {entry.displayName}
            </Text>
            {entry.isMe && (
              <View style={{ backgroundColor: colors.accent + "30", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ color: colors.accent, fontSize: 8, fontWeight: "900" }}>TOI</Text>
              </View>
            )}
            {entry.isPremium && <Text style={{ fontSize: 10 }}>⭐</Text>}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: tierColor, fontSize: 10, fontWeight: "700" }}>{tierInfo.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>· Niv.{entry.level} · {levelTitle}</Text>
          </View>
        </View>

        {/* Score principal */}
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text style={{ color: tierColor, fontWeight: "900", fontSize: 13 }}>{primaryValue}</Text>
          <Text style={{ color: colors.muted, fontSize: 9 }}>💰 {entry.money.toLocaleString()} cr</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Distribution logements ───────────────────────────────────────────────────
function HousingDistribution({ leaders }: { leaders: LeaderEntry[] }) {
  const counts = HOUSING_TIERS.map((t) => ({
    tier: t,
    count: leaders.filter((l) => l.housing === t.id).length,
  })).filter((d) => d.count > 0);
  const total = leaders.length;

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border, gap: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
        DISTRIBUTION DES LOGEMENTS
      </Text>
      {counts.map(({ tier, count }) => (
        <View key={tier.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 16, width: 24 }}>{tier.emoji}</Text>
          <Text style={{ color: colors.textSoft, fontSize: 12, width: 100 }}>{tier.name}</Text>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <View style={{ height: 6, borderRadius: 3, width: `${(count / total) * 100}%`, backgroundColor: tier.color }} />
          </View>
          <Text style={{ color: tier.color, fontSize: 11, fontWeight: "700", width: 24 }}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

export default function LeaderboardScreen() {
  const avatar      = useGameStore((s) => s.avatar);
  const playerXp    = useGameStore((s) => s.playerXp ?? 0);
  const playerLevel = useGameStore((s) => s.playerLevel ?? 1);
  const stats       = useGameStore((s) => s.stats);
  const isPremium   = useGameStore((s) => s.isPremium);
  const housingTier = useGameStore((s) => s.housingTier);
  const wealthScore = useGameStore((s) => s.wealthScore);

  const [sortKey, setSortKey] = useState<SortKey>("wealth");
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const me: LeaderEntry = {
      rank:        0,
      displayName: avatar?.displayName ?? "Toi",
      level:       playerLevel,
      playerXp,
      reputation:  stats.reputation,
      streak:      stats.streak,
      money:       stats.money,
      housing:     housingTier,
      wealthScore: wealthScore || computeWealthScore(stats.money, playerXp, stats.reputation, stats.streak, housingTier, playerLevel),
      isPremium,
      isMe:        true,
    };
    let all = [...MOCK_LEADERS, me];

    if (sortKey === "wealth")     all.sort((a, b) => b.wealthScore - a.wealthScore);
    else if (sortKey === "xp")         all.sort((a, b) => b.playerXp - a.playerXp);
    else if (sortKey === "reputation") all.sort((a, b) => b.reputation - a.reputation);
    else                               all.sort((a, b) => b.streak - a.streak);

    setLeaders(all.map((e, i) => ({ ...e, rank: i + 1 })));
  }, [sortKey, playerXp, stats.reputation, stats.streak, stats.money, housingTier, wealthScore]);

  const myEntry = leaders.find((e) => e.isMe);
  const top3    = leaders.slice(0, 3);
  const rest    = leaders.slice(3);
  const myTier  = getHousingTier(housingTier);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* ── HERO HEADER ── */}
        <View style={{ backgroundColor: "#050b18", paddingHorizontal: 20, paddingTop: 56,
          paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.border, overflow: "hidden" }}>
          {/* Ambient glow */}
          <View style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80,
            backgroundColor: colors.goldGlow }} />
          <View style={{ position: "absolute", bottom: 0, left: -30, width: 120, height: 120, borderRadius: 60,
            backgroundColor: colors.purpleGlow }} />

          <Pressable onPress={() => router.back()} style={{ marginBottom: 14 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28 }}>🏆 Classement</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            Qui règne sur la ville ? Richesse · XP · Réputation
          </Text>

          {/* Ma position */}
          {myEntry && (
            <View style={{ marginTop: 16, backgroundColor: myTier.color + "12", borderRadius: 16,
              padding: 14, borderWidth: 1.5, borderColor: myTier.color + "40",
              flexDirection: "row", alignItems: "center", gap: 12,
              shadowColor: myTier.color, shadowOpacity: 0.15, shadowRadius: 12 }}>
              <Text style={{ fontSize: 26 }}>{myTier.emoji}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: myTier.color, fontWeight: "900", fontSize: 20 }}>#{myEntry.rank}</Text>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{myTier.name}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                  {(myEntry.wealthScore / 1000).toFixed(1)}k pts · {stats.money} cr · {stats.streak}j streak
                </Text>
              </View>
              <Pressable onPress={() => router.push("/(app)/housing" as never)}
                style={{ backgroundColor: myTier.color + "22", borderRadius: 10,
                  paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: myTier.color + "55" }}>
                <Text style={{ color: myTier.color, fontSize: 11, fontWeight: "800" }}>Logement →</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ padding: 20, gap: 20 }}>

          {/* ── Sort tabs ── */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([
              { key: "wealth" as SortKey,     label: "Richesse",   emoji: "💰" },
              { key: "xp" as SortKey,         label: "XP",         emoji: "⚡" },
              { key: "reputation" as SortKey, label: "Réputation", emoji: "⭐" },
              { key: "streak" as SortKey,     label: "Streak",     emoji: "🔥" },
            ] as const).map((s) => (
              <Pressable key={s.key} onPress={() => setSortKey(s.key)}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: "center",
                  backgroundColor: sortKey === s.key ? colors.gold + "22" : "rgba(255,255,255,0.04)",
                  borderWidth: sortKey === s.key ? 1.5 : 1,
                  borderColor: sortKey === s.key ? colors.gold + "55" : "rgba(255,255,255,0.07)" }}>
                <Text style={{ fontSize: 14 }}>{s.emoji}</Text>
                <Text style={{ color: sortKey === s.key ? colors.gold : colors.muted,
                  fontWeight: "700", fontSize: 10, marginTop: 2 }}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* ── PODIUM TOP 3 ── */}
          {top3.length === 3 && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                PODIUM
              </Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 160 }}>
                <PodiumStep entry={top3[1]} height={90}  delay={200} />
                <PodiumStep entry={top3[0]} height={120} delay={0}   />
                <PodiumStep entry={top3[2]} height={70}  delay={350} />
              </View>
            </View>
          )}

          {/* ── LISTE ── */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 4 }}>
              CLASSEMENT COMPLET
            </Text>
            {leaders.map((entry, i) => (
              <LeaderRow key={entry.displayName + entry.rank} entry={entry} index={i} sortKey={sortKey} />
            ))}
          </View>

          {/* ── DISTRIBUTION LOGEMENTS ── */}
          <HousingDistribution leaders={leaders} />

          <Text style={{ color: "rgba(255,255,255,0.1)", fontSize: 10, textAlign: "center" }}>
            Score = argent ×2 + XP ×1.5 + réputation ×80 + streak ×150 + bonus logement
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}
