import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { getActiveMissions, getMission, MISSIONS } from "@/lib/missions";
import type { MissionProgress } from "@/lib/missions";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

const XP_PER_LEVEL = 200;

function MissionCard({ mission, progress, onClaim }: {
  mission: ReturnType<typeof getMission>;
  progress: MissionProgress | undefined;
  onClaim: () => void;
}) {
  if (!mission) return null;

  const status = progress?.status ?? "active";
  const isCompleted = status === "completed";
  const isClaimed   = status === "claimed";

  const cardColor =
    mission.category === "story"   ? "#c084fc" :
    mission.category === "weekly"  ? "#f6b94f" : "#38c793";

  const reqs = progress?.requirements ?? mission.requirements.map((r) => ({ ...r, current: 0 }));

  const scaleAnim = useRef(new Animated.Value(isCompleted ? 1 : 1)).current;
  useEffect(() => {
    if (isCompleted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.02, duration: 800, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isCompleted]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={{
        backgroundColor: isClaimed ? "rgba(255,255,255,0.02)" : cardColor + "0f",
        borderRadius: 18, padding: 16, gap: 12,
        borderWidth: isCompleted ? 1.5 : 1,
        borderColor: isClaimed ? "rgba(255,255,255,0.06)" : isCompleted ? cardColor : cardColor + "30",
        opacity: isClaimed ? 0.5 : 1,
      }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cardColor + "20",
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 22 }}>{mission.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: cardColor, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 }}>
                {mission.category.toUpperCase()}
              </Text>
              {isCompleted && !isClaimed && (
                <View style={{ backgroundColor: cardColor + "30", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: cardColor, fontSize: 9, fontWeight: "800" }}>TERMINÉ !</Text>
                </View>
              )}
              {isClaimed && <Text style={{ color: colors.muted, fontSize: 9 }}>✓ réclamé</Text>}
            </View>
            <Text style={{ color: isClaimed ? colors.muted : colors.text, fontWeight: "800", fontSize: 15, marginTop: 2 }}>
              {mission.title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{mission.description}</Text>
          </View>
        </View>

        {/* Progression par requirement */}
        <View style={{ gap: 8 }}>
          {reqs.map((req, i) => {
            const pct = Math.min(100, (req.current / req.count) * 100);
            return (
              <View key={i} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{req.action.replace("-", " ")}</Text>
                  <Text style={{ color: cardColor, fontWeight: "700", fontSize: 11 }}>{req.current}/{req.count}</Text>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <View style={{ height: 5, borderRadius: 3, width: `${pct}%`, backgroundColor: cardColor }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Récompenses + bouton claim */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Text style={{ color: "#f6b94f", fontSize: 12, fontWeight: "700" }}>+{mission.xpReward} XP</Text>
            {mission.moneyReward > 0 && (
              <Text style={{ color: "#38c793", fontSize: 12, fontWeight: "700" }}>+{mission.moneyReward} cr</Text>
            )}
          </View>
          {isCompleted && !isClaimed && (
            <Pressable onPress={onClaim}
              style={{ backgroundColor: cardColor, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ color: "#000", fontWeight: "900", fontSize: 13 }}>🎁 Réclamer</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function MissionsScreen() {
  const missionProgresses = useGameStore((s) => s.missionProgresses ?? []);
  const playerLevel       = useGameStore((s) => s.playerLevel ?? 1);
  const playerXp          = useGameStore((s) => s.playerXp ?? 0);
  const claimMission      = useGameStore((s) => s.claimMission);

  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const activeMissions = getActiveMissions(missionProgresses, playerLevel);
  const completedCount = missionProgresses.filter((p) => p.status === "claimed").length;

  const xpInLevel = playerXp % XP_PER_LEVEL;
  const xpPct     = (xpInLevel / XP_PER_LEVEL) * 100;

  // Group missions by category
  const daily   = activeMissions.filter((m) => m.category === "daily");
  const weekly  = activeMissions.filter((m) => m.category === "weekly");
  const story   = activeMissions.filter((m) => m.category === "story");

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>🎯 Missions</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
            {completedCount} missions réclamées · Niveau {playerLevel}
          </Text>

          {/* XP mini-bar */}
          <View style={{ marginTop: 14, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#f6b94f", fontSize: 12, fontWeight: "700" }}>Niveau {playerLevel}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{xpInLevel}/{XP_PER_LEVEL} XP</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <View style={{ height: 6, borderRadius: 3, width: `${xpPct}%`, backgroundColor: "#f6b94f" }} />
            </View>
          </View>
        </View>

        <View style={{ padding: 20, gap: 24 }}>

          {/* Daily */}
          {daily.length > 0 && (
            <View style={{ gap: 12 }}>
              <Text style={{ color: "#38c793", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                ⏰ QUÊTES JOURNALIÈRES
              </Text>
              {daily.map((m) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  progress={missionProgresses.find((p) => p.missionId === m.id)}
                  onClaim={() => claimMission(m.id)}
                />
              ))}
            </View>
          )}

          {/* Weekly */}
          {weekly.length > 0 && (
            <View style={{ gap: 12 }}>
              <Text style={{ color: "#f6b94f", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                📅 MISSIONS HEBDOMADAIRES
              </Text>
              {weekly.map((m) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  progress={missionProgresses.find((p) => p.missionId === m.id)}
                  onClaim={() => claimMission(m.id)}
                />
              ))}
            </View>
          )}

          {/* Story */}
          {story.length > 0 && (
            <View style={{ gap: 12 }}>
              <Text style={{ color: "#c084fc", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                📖 MISSIONS HISTOIRE
              </Text>
              {story.map((m) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  progress={missionProgresses.find((p) => p.missionId === m.id)}
                  onClaim={() => claimMission(m.id)}
                />
              ))}
            </View>
          )}

          {/* Missions verrouillées */}
          {playerLevel < 10 && (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
                🔒 MISSIONS VERROUILLÉES
              </Text>
              {MISSIONS.filter((m) => (m.unlockLevel ?? 1) > playerLevel && !activeMissions.find((am) => am.id === m.id))
                .slice(0, 3)
                .map((m) => (
                  <View key={m.id} style={{ backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 16, padding: 14,
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text style={{ fontSize: 22, opacity: 0.4 }}>{m.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>{m.title}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>Déblocage niveau {m.unlockLevel}</Text>
                    </View>
                    <Text style={{ fontSize: 18 }}>🔒</Text>
                  </View>
                ))}
            </View>
          )}

        </View>
      </ScrollView>
    </Animated.View>
  );
}
