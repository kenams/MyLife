import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { getLevelTitle } from "@/lib/progression";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

type LeaderEntry = {
  rank: number;
  displayName: string;
  level: number;
  playerXp: number;
  reputation: number;
  streak: number;
  isPremium: boolean;
  isMe?: boolean;
};

const MOCK_LEADERS: LeaderEntry[] = [
  { rank: 1, displayName: "Ava Laurent",    level: 28, playerXp: 5420, reputation: 94, streak: 42, isPremium: true  },
  { rank: 2, displayName: "Noa Blanc",      level: 24, playerXp: 4650, reputation: 88, streak: 35, isPremium: true  },
  { rank: 3, displayName: "Leila Moran",    level: 21, playerXp: 3980, reputation: 81, streak: 28, isPremium: false },
  { rank: 4, displayName: "Alex Dumont",    level: 18, playerXp: 3210, reputation: 75, streak: 21, isPremium: true  },
  { rank: 5, displayName: "Jade Fontaine",  level: 16, playerXp: 2890, reputation: 70, streak: 18, isPremium: false },
  { rank: 6, displayName: "Remy Castillo",  level: 14, playerXp: 2340, reputation: 65, streak: 14, isPremium: false },
  { rank: 7, displayName: "Yasmine Petit",  level: 12, playerXp: 1980, reputation: 58, streak: 10, isPremium: false },
  { rank: 8, displayName: "Tom Leclerc",    level: 10, playerXp: 1650, reputation: 52, streak: 7,  isPremium: false },
  { rank: 9, displayName: "Sara Moreau",    level: 9,  playerXp: 1420, reputation: 48, streak: 5,  isPremium: false },
  { rank: 10, displayName: "Kai Besson",    level: 8,  playerXp: 1180, reputation: 44, streak: 3,  isPremium: true  },
];

type SortKey = "xp" | "reputation" | "streak";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Text style={{ fontSize: 22 }}>🥇</Text>;
  if (rank === 2) return <Text style={{ fontSize: 22 }}>🥈</Text>;
  if (rank === 3) return <Text style={{ fontSize: 22 }}>🥉</Text>;
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)",
      alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>{rank}</Text>
    </View>
  );
}

function LeaderRow({ entry, index }: { entry: LeaderEntry; index: number }) {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, delay: index * 50,
        easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const isTop3 = entry.rank <= 3;
  const rowColor = entry.rank === 1 ? "#f6b94f" : entry.rank === 2 ? "#adb5bd" : entry.rank === 3 ? "#cd7f32" : "rgba(255,255,255,0.06)";
  const levelTitle = getLevelTitle(entry.level);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={{
        backgroundColor: entry.isMe ? colors.accent + "15" : isTop3 ? rowColor + "10" : "rgba(255,255,255,0.03)",
        borderRadius: 16, padding: 14,
        borderWidth: entry.isMe ? 1.5 : isTop3 ? 1 : 1,
        borderColor: entry.isMe ? colors.accent + "50" : isTop3 ? rowColor + "30" : "rgba(255,255,255,0.06)",
        flexDirection: "row", alignItems: "center", gap: 12,
      }}>
        <RankBadge rank={entry.rank} />

        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: entry.isMe ? colors.accent : colors.text, fontWeight: "800", fontSize: 14 }}>
              {entry.displayName}
            </Text>
            {entry.isMe && (
              <View style={{ backgroundColor: colors.accent + "30", borderRadius: 6,
                paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: colors.accent, fontSize: 9, fontWeight: "800" }}>TOI</Text>
              </View>
            )}
            {entry.isPremium && <Text style={{ fontSize: 12 }}>⭐</Text>}
          </View>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Niv. {entry.level} · {levelTitle}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text style={{ color: "#f6b94f", fontWeight: "700", fontSize: 13 }}>{entry.playerXp.toLocaleString()} XP</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>⭐ {entry.reputation}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>🔥 {entry.streak}j</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function LeaderboardScreen() {
  const avatar     = useGameStore((s) => s.avatar);
  const playerXp   = useGameStore((s) => s.playerXp ?? 0);
  const playerLevel = useGameStore((s) => s.playerLevel ?? 1);
  const stats      = useGameStore((s) => s.stats);
  const isPremium  = useGameStore((s) => s.isPremium);

  const [sortKey, setSortKey] = useState<SortKey>("xp");
  const [leaders, setLeaders]  = useState<LeaderEntry[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  // Construire liste avec le joueur inséré
  useEffect(() => {
    const me: LeaderEntry = {
      rank: 0,
      displayName: avatar?.displayName ?? "Toi",
      level: playerLevel,
      playerXp,
      reputation: stats.reputation,
      streak: stats.streak,
      isPremium,
      isMe: true,
    };

    let all = [...MOCK_LEADERS, me];

    if (sortKey === "xp") all.sort((a, b) => b.playerXp - a.playerXp);
    else if (sortKey === "reputation") all.sort((a, b) => b.reputation - a.reputation);
    else all.sort((a, b) => b.streak - a.streak);

    setLeaders(all.map((e, i) => ({ ...e, rank: i + 1 })));
  }, [sortKey, playerXp, stats.reputation, stats.streak]);

  // Optionnel : fetch Supabase top players
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from("avatars")
      .select("display_name, avatar_stats(reputation, streak)")
      .order("reputation", { referencedTable: "avatar_stats", ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        // merge avec MOCK si Supabase répond
      });
  }, []);

  const myEntry = leaders.find((e) => e.isMe);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>🏆 Classement</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            Top joueurs de la saison
          </Text>

          {/* Ma position */}
          {myEntry && (
            <View style={{ marginTop: 14, backgroundColor: colors.accent + "12", borderRadius: 14, padding: 12,
              borderWidth: 1, borderColor: colors.accent + "30", flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 22 }}>#{myEntry.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 14 }}>Ta position</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{playerXp} XP · {stats.reputation} rep · {stats.streak}j streak</Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ padding: 20, gap: 16 }}>

          {/* Sort tabs */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([
              { key: "xp" as SortKey,         label: "XP",         emoji: "⚡" },
              { key: "reputation" as SortKey,  label: "Réputation", emoji: "⭐" },
              { key: "streak" as SortKey,      label: "Streak",     emoji: "🔥" },
            ] as const).map((s) => (
              <Pressable key={s.key} onPress={() => setSortKey(s.key)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: "center",
                  backgroundColor: sortKey === s.key ? colors.accent + "22" : "rgba(255,255,255,0.05)",
                  borderWidth: sortKey === s.key ? 1.5 : 1,
                  borderColor: sortKey === s.key ? colors.accent + "50" : "rgba(255,255,255,0.08)" }}>
                <Text style={{ fontSize: 14 }}>{s.emoji}</Text>
                <Text style={{ color: sortKey === s.key ? colors.accent : colors.muted,
                  fontWeight: "700", fontSize: 11, marginTop: 2 }}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Liste */}
          <View style={{ gap: 8 }}>
            {leaders.map((entry, i) => (
              <LeaderRow key={entry.displayName + entry.rank} entry={entry} index={i} />
            ))}
          </View>

          <Text style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, textAlign: "center" }}>
            Mis à jour en temps réel · Saison en cours
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}
