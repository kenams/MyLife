import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { starterResidents } from "@/lib/game-engine";
import { getActiveMissions, getMission } from "@/lib/missions";
import { buildSmartNotifications, type SmartNotificationPriority } from "@/lib/smart-notifications";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

const XP_PER_LEVEL = 200;

const smartPriorityColor: Record<SmartNotificationPriority, string> = {
  critical: "#ef4444",
  high: "#f6b94f",
  medium: "#60a5fa",
  low: colors.muted
};

const notificationKindMeta: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  needs: { icon: "pulse", color: "#ef4444", label: "Besoin" },
  reward: { icon: "gift", color: "#38c793", label: "Gain" },
  social: { icon: "people", color: "#60a5fa", label: "Social" },
  work: { icon: "briefcase", color: "#f6b94f", label: "Travail" },
  tip: { icon: "bulb", color: "#8b7cff", label: "Conseil" }
};

function SignalMetric({ label, value, color, icon }: { label: string; value: string; color: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{
      flex: 1,
      minWidth: 92,
      backgroundColor: color + "12",
      borderRadius: 14,
      paddingHorizontal: 11,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: color + "35",
      gap: 6
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Ionicons name={icon as never} size={15} color={color} />
        <Text style={{ color, fontSize: 15, fontWeight: "900" }}>{value}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.textSoft, fontSize: 10, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

function DailyTaskRow({ emoji, label, done, urgency, detail, onPress }: {
  emoji: string; label: string; done: boolean;
  urgency: "ok" | "warn" | "critical"; detail: string; onPress: () => void;
}) {
  const col = done ? "#38c793" : urgency === "critical" ? "#ef4444" : urgency === "warn" ? "#f6b94f" : colors.muted;
  const bg  = done ? "#38c79310" : urgency === "critical" ? "#ef444412" : urgency === "warn" ? "#f6b94f10" : "rgba(255,255,255,0.03)";
  const border = done ? "#38c79330" : urgency === "critical" ? "#ef444435" : urgency === "warn" ? "#f6b94f30" : "rgba(255,255,255,0.06)";

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (urgency === "critical" && !done) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.01, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.99, duration: 700, useNativeDriver: true }),
      ])).start();
    }
  }, [urgency, done]);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <Pressable onPress={onPress} style={{
        backgroundColor: bg, borderRadius: 14, padding: 13,
        borderWidth: 1.5, borderColor: border,
        flexDirection: "row", alignItems: "center", gap: 12,
      }}>
        <View style={{ width: 40, height: 40, borderRadius: 20,
          backgroundColor: col + "20", alignItems: "center", justifyContent: "center",
          borderWidth: 1.5, borderColor: col + "40" }}>
          <Text style={{ fontSize: 20 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: done ? "#38c793" : col, fontWeight: "800", fontSize: 14 }}>{label}</Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>{detail}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {done
            ? <Text style={{ color: "#38c793", fontSize: 18 }}>✓</Text>
            : <View style={{ backgroundColor: col + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                borderWidth: 1, borderColor: col + "40" }}>
                <Text style={{ color: col, fontSize: 10, fontWeight: "800" }}>
                  {urgency === "critical" ? "URGENT" : urgency === "warn" ? "BIENTÔT" : "À FAIRE"}
                </Text>
              </View>
          }
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function QuetesTab() {
  const missionProgresses = useGameStore((s) => s.missionProgresses ?? []);
  const playerLevel       = useGameStore((s) => s.playerLevel ?? 1);
  const playerXp          = useGameStore((s) => s.playerXp ?? 0);
  const claimMission      = useGameStore((s) => s.claimMission);
  const notifications     = useGameStore((s) => s.notifications);
  const markRead          = useGameStore((s) => s.markNotificationRead);
  const markAllRead       = useGameStore((s) => s.markAllNotificationsRead);
  const stats             = useGameStore((s) => s.stats);
  const avatar            = useGameStore((s) => s.avatar);
  const relationships     = useGameStore((s) => s.relationships);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const activeMissions  = getActiveMissions(missionProgresses, playerLevel);
  const claimable       = missionProgresses.filter((p) => p.status === "completed");
  const unreadNotifs    = notifications.filter((n) => !n.read);
  const xpInLevel       = playerXp % XP_PER_LEVEL;
  const xpPct           = (xpInLevel / XP_PER_LEVEL) * 100;
  const smartNotifs     = buildSmartNotifications({ avatar, stats, relationships, residents: starterResidents });
  const topSmartSignal  = smartNotifs[0] ?? null;
  const criticalSmart   = smartNotifs.filter((n) => n.priority === "critical").length;
  const highSmart       = smartNotifs.filter((n) => n.priority === "high").length;

  // Tâches obligatoires quotidiennes
  const hoursSinceEat  = stats.lastMealAt
    ? (Date.now() - new Date(stats.lastMealAt).getTime()) / 3_600_000 : 99;
  const eatDone     = hoursSinceEat < 5;
  const eatUrgency  = eatDone ? "ok" : hoursSinceEat > 7 ? "critical" : hoursSinceEat > 5 ? "warn" : "ok";

  const sleepDone   = stats.energy >= 60;
  const sleepUrgency: "ok" | "warn" | "critical" = sleepDone ? "ok" : stats.energy < 20 ? "critical" : stats.energy < 40 ? "warn" : "ok";

  const hygieneDone   = stats.hygiene >= 50;
  const hygieneUrgency: "ok" | "warn" | "critical" = hygieneDone ? "ok" : stats.hygiene < 20 ? "critical" : "warn";

  const workDone      = stats.discipline >= 50 || stats.money > 200;
  const workUrgency: "ok" | "warn" | "critical"   = workDone ? "ok" : "warn";

  const moodDone      = stats.mood >= 40;
  const moodUrgency: "ok" | "warn" | "critical"   = moodDone ? "ok" : stats.mood < 20 ? "critical" : "warn";

  const dailyTasks = [
    { emoji: "🍽️", label: "Manger", done: eatDone, urgency: eatUrgency,
      detail: eatDone ? `Dernier repas il y a ${Math.round(hoursSinceEat)}h` : hoursSinceEat > 6 ? `Critique — ${Math.round(hoursSinceEat)}h sans manger. Tu perds des crédits !` : `Mange dans les 2 prochaines heures`,
      route: "/(app)/health" },
    { emoji: "😴", label: "Dormir", done: sleepDone, urgency: sleepUrgency,
      detail: sleepDone ? `Énergie : ${stats.energy}/100` : `Énergie critique : ${stats.energy}/100 — réputation en baisse`,
      route: "/(app)/health" },
    { emoji: "🚿", label: "Hygiène", done: hygieneDone, urgency: hygieneUrgency,
      detail: hygieneDone ? `Hygiène : ${stats.hygiene}/100` : `Hygiène basse : ${stats.hygiene}/100 — impact social`,
      route: "/(app)/health" },
    { emoji: "💼", label: "Travailler", done: workDone, urgency: workUrgency,
      detail: workDone ? `Discipline : ${stats.discipline}/100` : `Travaille pour gagner des crédits et discipline`,
      route: "/(app)/work" },
    { emoji: "😊", label: "Humeur", done: moodDone, urgency: moodUrgency,
      detail: moodDone ? `Humeur : ${stats.mood}/100` : `Humeur basse : ${stats.mood}/100 — sors ou socialise`,
      route: "/(app)/(tabs)/world" },
  ] as const;

  const doneTasks   = dailyTasks.filter((t) => t.done).length;
  const criticalCnt = dailyTasks.filter((t) => !t.done && t.urgency === "critical").length;
  const allDone     = doneTasks === dailyTasks.length;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: 60,
            backgroundColor: "#f6b94f08" }} />
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 24 }}>🎯 Quêtes & Tâches</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
            Accomplis tes tâches ou subis les conséquences
          </Text>

          {/* XP bar */}
          <View style={{ marginTop: 12, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "#f6b94f", fontSize: 12, fontWeight: "800" }}>Niveau {playerLevel}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{xpInLevel}/{XP_PER_LEVEL} XP</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <View style={{ height: 6, borderRadius: 3, width: `${xpPct}%`, backgroundColor: "#f6b94f" }} />
            </View>
          </View>

          {/* Daily progress */}
          <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12,
            backgroundColor: allDone ? "#38c79312" : criticalCnt > 0 ? "#ef444412" : "#f6b94f0f",
            borderRadius: 14, padding: 12,
            borderWidth: 1, borderColor: allDone ? "#38c79340" : criticalCnt > 0 ? "#ef444430" : "#f6b94f30" }}>
            <View style={{ width: 44, height: 44, borderRadius: 22,
              backgroundColor: allDone ? "#38c79325" : criticalCnt > 0 ? "#ef444420" : "#f6b94f20",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22 }}>{allDone ? "🏆" : criticalCnt > 0 ? "⚠️" : "📋"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: allDone ? "#38c793" : criticalCnt > 0 ? "#ef4444" : "#f6b94f",
                fontWeight: "900", fontSize: 15 }}>
                {allDone ? "Toutes les tâches complètes !" : `${doneTasks}/${dailyTasks.length} tâches aujourd'hui`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>
                {criticalCnt > 0 ? `${criticalCnt} tâche${criticalCnt > 1 ? "s" : ""} critique${criticalCnt > 1 ? "s" : ""} — pénalités actives` : "Reste actif pour garder tes bonus"}
              </Text>
            </View>
            {/* mini dots */}
            <View style={{ flexDirection: "row", gap: 5 }}>
              {dailyTasks.map((t, i) => (
                <View key={i} style={{ width: 8, height: 8, borderRadius: 4,
                  backgroundColor: t.done ? "#38c793" : t.urgency === "critical" ? "#ef4444" : t.urgency === "warn" ? "#f6b94f" : "rgba(255,255,255,0.15)" }} />
              ))}
            </View>
          </View>
        </View>

        <View style={{ padding: 16, gap: 16 }}>

          {/* Synthese prioritaire */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <SignalMetric label="Critiques" value={`${criticalCnt + criticalSmart}`} color="#ef4444" icon="warning" />
              <SignalMetric label="A traiter" value={`${highSmart + claimable.length}`} color="#f6b94f" icon="flash" />
              <SignalMetric label="Non lues" value={`${unreadNotifs.length}`} color="#60a5fa" icon="notifications" />
            </View>

            {topSmartSignal ? (
              <Pressable
                onPress={() => router.push(topSmartSignal.route as any)}
                style={{
                  backgroundColor: smartPriorityColor[topSmartSignal.priority] + "12",
                  borderRadius: 18,
                  padding: 14,
                  borderWidth: 1.5,
                  borderColor: smartPriorityColor[topSmartSignal.priority] + "42",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: smartPriorityColor[topSmartSignal.priority] + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={topSmartSignal.priority === "critical" ? "alert-circle" : "navigate-circle"} size={24} color={smartPriorityColor[topSmartSignal.priority]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: smartPriorityColor[topSmartSignal.priority], fontSize: 11, fontWeight: "900" }}>PRIORITE MAINTENANT</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 2 }}>{topSmartSignal.title}</Text>
                  <Text numberOfLines={2} style={{ color: colors.textSoft, fontSize: 11, lineHeight: 15, marginTop: 2 }}>{topSmartSignal.body}</Text>
                </View>
                <View style={{ backgroundColor: smartPriorityColor[topSmartSignal.priority], borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 }}>
                  <Text style={{ color: "#07111f", fontSize: 10, fontWeight: "900" }}>{topSmartSignal.actionLabel}</Text>
                </View>
              </Pressable>
            ) : (
              <View style={{ backgroundColor: "#38c79310", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#38c79335", flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Ionicons name="checkmark-circle" size={28} color="#38c793" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#38c793", fontSize: 14, fontWeight: "900" }}>Tout est stable</Text>
                  <Text style={{ color: colors.textSoft, fontSize: 11, marginTop: 2 }}>Aucune urgence intelligente pour le moment.</Text>
                </View>
              </View>
            )}
          </View>

          {/* Notifications intelligentes */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                NOTIFICATIONS INTELLIGENTES
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {smartNotifs.length} signal{smartNotifs.length > 1 ? "s" : ""}
              </Text>
            </View>
            {smartNotifs.slice(0, 3).map((n) => {
              const priorityColor = smartPriorityColor[n.priority];
              return (
                <Pressable
                  key={n.id}
                  onPress={() => router.push(n.route as any)}
                  style={{
                    backgroundColor: priorityColor + "10",
                    borderRadius: 15,
                    padding: 12,
                    borderWidth: 1.5,
                    borderColor: priorityColor + "35",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12
                  }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19,
                    backgroundColor: priorityColor + "20", alignItems: "center", justifyContent: "center",
                    borderWidth: 1, borderColor: priorityColor + "45" }}>
                    <Ionicons name={n.priority === "critical" ? "alert" : n.kind === "social" ? "heart" : "flash"} size={17} color={priorityColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>{n.title}</Text>
                    <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 2 }}>{n.body}</Text>
                  </View>
                  <View style={{ backgroundColor: priorityColor + "18", borderRadius: 9,
                    paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: priorityColor + "35" }}>
                    <Text style={{ color: priorityColor, fontSize: 10, fontWeight: "900" }}>{n.actionLabel}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Tâches obligatoires */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                TÂCHES OBLIGATOIRES
              </Text>
              {criticalCnt > 0 && (
                <View style={{ backgroundColor: "#ef444420", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                  borderWidth: 1, borderColor: "#ef444440" }}>
                  <Text style={{ color: "#ef4444", fontSize: 9, fontWeight: "900" }}>{criticalCnt} CRITIQUE{criticalCnt > 1 ? "S" : ""}</Text>
                </View>
              )}
            </View>
            {dailyTasks.map((task) => (
              <DailyTaskRow
                key={task.label}
                emoji={task.emoji}
                label={task.label}
                done={task.done}
                urgency={task.urgency}
                detail={task.detail}
                onPress={() => router.push(task.route as any)}
              />
            ))}
          </View>

          {/* Missions à réclamer */}
          {claimable.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ color: "#38c793", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                🎁 RÉCOMPENSES À RÉCLAMER ({claimable.length})
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

          {/* Missions actives */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                MISSIONS EN COURS
              </Text>
              <Pressable onPress={() => router.push("/(app)/missions")}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>Tout voir →</Text>
              </Pressable>
            </View>
            {activeMissions.slice(0, 3).map((mission) => {
              const prog = missionProgresses.find((p) => p.missionId === mission.id);
              const reqs = prog?.requirements ?? mission.requirements.map((r) => ({ ...r, current: 0 }));
              const totalCount = reqs.reduce((s, r) => s + r.count, 0);
              const doneCount  = reqs.reduce((s, r) => s + Math.min(r.current, r.count), 0);
              const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
              const catColor = mission.category === "story" ? "#c084fc" : mission.category === "weekly" ? "#f6b94f" : "#38c793";
              return (
                <View key={mission.id} style={{ backgroundColor: catColor + "08", borderRadius: 14, padding: 13,
                  borderWidth: 1, borderColor: catColor + "25", gap: 8 }}>
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

          {/* Alertes */}
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
                const meta = notificationKindMeta[n.kind] ?? notificationKindMeta.tip;
                const kindColor = meta.color;
                return (
                  <View key={n.id} style={{ backgroundColor: kindColor + "0e", borderRadius: 12, padding: 12,
                    borderWidth: 1, borderColor: kindColor + "25", flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: kindColor + "18", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: kindColor + "35" }}>
                      <Ionicons name={meta.icon as never} size={14} color={kindColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>{n.title}</Text>
                      <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 2 }}>{n.body}</Text>
                      <Text style={{ color: kindColor, fontSize: 9, fontWeight: "900", marginTop: 5 }}>{meta.label}</Text>
                    </View>
                    <Pressable onPress={() => markRead(n.id)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="checkmark" size={14} color={colors.textSoft} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Raccourcis */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => router.push("/(app)/missions")}
              style={{ flex: 1, backgroundColor: "rgba(56,199,147,0.08)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(56,199,147,0.2)", alignItems: "center", gap: 5 }}>
              <Text style={{ fontSize: 22 }}>🎯</Text>
              <Text style={{ color: "#38c793", fontWeight: "700", fontSize: 11, textAlign: "center" }}>Missions</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/progression")}
              style={{ flex: 1, backgroundColor: "rgba(246,185,79,0.08)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(246,185,79,0.2)", alignItems: "center", gap: 5 }}>
              <Text style={{ fontSize: 22 }}>⚡</Text>
              <Text style={{ color: "#f6b94f", fontWeight: "700", fontSize: 11, textAlign: "center" }}>Progression</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/leaderboard")}
              style={{ flex: 1, backgroundColor: "rgba(192,132,252,0.08)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(192,132,252,0.2)", alignItems: "center", gap: 5 }}>
              <Text style={{ fontSize: 22 }}>🏆</Text>
              <Text style={{ color: "#c084fc", fontWeight: "700", fontSize: 11, textAlign: "center" }}>Classement</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/housing")}
              style={{ flex: 1, backgroundColor: "rgba(96,165,250,0.08)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(96,165,250,0.2)", alignItems: "center", gap: 5 }}>
              <Text style={{ fontSize: 22 }}>🏠</Text>
              <Text style={{ color: "#60a5fa", fontWeight: "700", fontSize: 11, textAlign: "center" }}>Logement</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </Animated.View>
  );
}
