// Onglet "Quêtes" — redirige vers le contenu missions + alertes combinés
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { getActiveMissions, getMission } from "@/lib/missions";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

const XP_PER_LEVEL = 200;

export default function QuestesTab() {
  const missionProgresses = useGameStore((s) => s.missionProgresses ?? []);
  const playerLevel       = useGameStore((s) => s.playerLevel ?? 1);
  const playerXp          = useGameStore((s) => s.playerXp ?? 0);
  const claimMission      = useGameStore((s) => s.claimMission);
  const notifications     = useGameStore((s) => s.notifications);
  const markAllRead       = useGameStore((s) => s.markAllNotificationsRead);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const activeMissions  = getActiveMissions(missionProgresses, playerLevel);
  const claimable       = missionProgresses.filter((p) => p.status === "completed");
  const unreadNotifs    = notifications.filter((n) => !n.read);
  const xpInLevel       = playerXp % XP_PER_LEVEL;
  const xpPct           = (xpInLevel / XP_PER_LEVEL) * 100;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 24 }}>🎯 Quêtes</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            Niveau {playerLevel} · {xpInLevel}/{XP_PER_LEVEL} XP
          </Text>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)",
            marginTop: 10, overflow: "hidden" }}>
            <View style={{ height: 5, borderRadius: 3, width: `${xpPct}%`, backgroundColor: "#f6b94f" }} />
          </View>
        </View>

        <View style={{ padding: 20, gap: 20 }}>

          {/* Missions à réclamer */}
          {claimable.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ color: "#38c793", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                🎁 À RÉCLAMER ({claimable.length})
              </Text>
              {claimable.map((prog) => {
                const mission = getMission(prog.missionId);
                if (!mission) return null;
                const catColor = mission.category === "story" ? "#c084fc" : mission.category === "weekly" ? "#f6b94f" : "#38c793";
                return (
                  <View key={prog.missionId} style={{
                    backgroundColor: catColor + "12", borderRadius: 16, padding: 14,
                    borderWidth: 1.5, borderColor: catColor + "50",
                    flexDirection: "row", alignItems: "center", gap: 12
                  }}>
                    <Text style={{ fontSize: 24 }}>{mission.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{mission.title}</Text>
                      <Text style={{ color: catColor, fontSize: 11 }}>+{mission.xpReward} XP · +{mission.moneyReward} cr</Text>
                    </View>
                    <Pressable onPress={() => claimMission(prog.missionId)}
                      style={{ backgroundColor: catColor, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ color: "#000", fontWeight: "900", fontSize: 13 }}>Claim</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Missions actives preview */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                EN COURS
              </Text>
              <Pressable onPress={() => router.push("/(app)/missions")}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>Tout voir →</Text>
              </Pressable>
            </View>
            {activeMissions.slice(0, 4).map((mission) => {
              const prog = missionProgresses.find((p) => p.missionId === mission.id);
              const reqs = prog?.requirements ?? mission.requirements.map((r) => ({ ...r, current: 0 }));
              const totalCount = reqs.reduce((s, r) => s + r.count, 0);
              const doneCount  = reqs.reduce((s, r) => s + Math.min(r.current, r.count), 0);
              const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
              const catColor = mission.category === "story" ? "#c084fc" : mission.category === "weekly" ? "#f6b94f" : "#38c793";
              return (
                <View key={mission.id} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 12,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 20 }}>{mission.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{mission.title}</Text>
                      <Text style={{ color: catColor, fontSize: 10 }}>+{mission.xpReward} XP</Text>
                    </View>
                    <Text style={{ color: catColor, fontWeight: "700", fontSize: 12 }}>{doneCount}/{totalCount}</Text>
                  </View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    <View style={{ height: 4, borderRadius: 2, width: `${pct}%`, backgroundColor: catColor }} />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Alertes récentes */}
          {unreadNotifs.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                  ALERTES ({unreadNotifs.length})
                </Text>
                <Pressable onPress={markAllRead}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Tout lire</Text>
                </Pressable>
              </View>
              {unreadNotifs.slice(0, 4).map((n) => {
                const kindColor = n.kind === "needs" ? "#ff6b6b" : n.kind === "reward" ? "#38c793" : "#f6b94f";
                return (
                  <View key={n.id} style={{ backgroundColor: kindColor + "0e", borderRadius: 14, padding: 12,
                    borderWidth: 1, borderColor: kindColor + "25", flexDirection: "row", gap: 10 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: kindColor, marginTop: 4 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{n.title}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{n.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Boutons raccourcis */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => router.push("/(app)/missions")}
              style={{ flex: 1, backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(56,199,147,0.25)", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 24 }}>🎯</Text>
              <Text style={{ color: "#38c793", fontWeight: "700", fontSize: 12 }}>Toutes les missions</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/progression")}
              style={{ flex: 1, backgroundColor: "rgba(246,185,79,0.1)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(246,185,79,0.25)", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 24 }}>⚡</Text>
              <Text style={{ color: "#f6b94f", fontWeight: "700", fontSize: 12 }}>Progression</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/leaderboard")}
              style={{ flex: 1, backgroundColor: "rgba(192,132,252,0.1)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(192,132,252,0.25)", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 24 }}>🏆</Text>
              <Text style={{ color: "#c084fc", fontWeight: "700", fontSize: 12 }}>Classement</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </Animated.View>
  );
}
