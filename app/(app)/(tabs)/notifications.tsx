import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { starterResidents } from "@/lib/game-engine";
import { getActiveMissions, getMission } from "@/lib/missions";
import { buildSmartNotifications, type SmartNotificationPriority } from "@/lib/smart-notifications";
import { useGameStore } from "@/stores/game-store";

// ─── Light theme ──────────────────────────────────────────────────────────────
const L = {
  bg:        "#f5f7fa",
  card:      "#ffffff",
  text:      "#1e2a3a",
  textSoft:  "#4a5568",
  muted:     "#94a3b8",
  border:    "#e8edf5",
  primary:   "#6366f1",
  primaryBg: "#eef2ff",
  green:     "#10b981",
  greenBg:   "#ecfdf5",
  gold:      "#f59e0b",
  goldBg:    "#fffbeb",
  red:       "#ef4444",
  redBg:     "#fef2f2",
  blue:      "#3b82f6",
  blueBg:    "#eff6ff",
  pink:      "#ec4899",
  pinkBg:    "#fdf2f8",
  purple:    "#8b5cf6",
  purpleBg:  "#f5f3ff",
  teal:      "#14b8a6",
  tealBg:    "#f0fdfa",
  orange:    "#f97316",
  orangeBg:  "#fff7ed",
};

const XP_PER_LEVEL = 200;

type FilterKey = "all" | "urgent" | "social" | "work" | "health";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",    label: "Toutes"     },
  { key: "urgent", label: "Urgentes"   },
  { key: "social", label: "Relations"  },
  { key: "work",   label: "Travail"    },
  { key: "health", label: "Santé"      },
];

const PRIORITY_COLOR: Record<SmartNotificationPriority, string> = {
  critical: L.red,
  high:     L.orange,
  medium:   L.blue,
  low:      L.muted,
};
const PRIORITY_BG: Record<SmartNotificationPriority, string> = {
  critical: L.redBg,
  high:     L.orangeBg,
  medium:   L.blueBg,
  low:      L.bg,
};
const PRIORITY_LABEL: Record<SmartNotificationPriority, string> = {
  critical: "URGENT",
  high:     "Important",
  medium:   "Info",
  low:      "Conseil",
};

// ─── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({ emoji, label, done, urgency, detail, onPress }: {
  emoji: string; label: string; done: boolean;
  urgency: "ok" | "warn" | "critical"; detail: string; onPress: () => void;
}) {
  const col = done ? L.green : urgency === "critical" ? L.red : urgency === "warn" ? L.gold : L.muted;
  const bg  = done ? L.greenBg : urgency === "critical" ? L.redBg : urgency === "warn" ? L.goldBg : L.card;
  const border = done ? L.green + "25" : urgency === "critical" ? L.red + "25" : urgency === "warn" ? L.gold + "25" : L.border;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (urgency === "critical" && !done) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.01, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.99, duration: 800, useNativeDriver: true }),
      ])).start();
    }
  }, [urgency, done]);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <Pressable onPress={onPress} style={{
        backgroundColor: bg, borderRadius: 16, padding: 14,
        borderWidth: 1, borderColor: border,
        flexDirection: "row", alignItems: "center", gap: 12,
        shadowColor: col, shadowOpacity: done ? 0 : 0.06,
        shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
      }}>
        <View style={{ width: 44, height: 44, borderRadius: 14,
          backgroundColor: col + "15", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: done ? L.green : L.text, fontWeight: "700", fontSize: 14 }}>{label}</Text>
          <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }}>{detail}</Text>
        </View>
        {done
          ? <View style={{ width: 28, height: 28, borderRadius: 14,
              backgroundColor: L.greenBg, borderWidth: 1, borderColor: L.green + "40",
              alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark" size={14} color={L.green} />
            </View>
          : <View style={{ backgroundColor: col + "15", borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: col + "30" }}>
              <Text style={{ color: col, fontSize: 10, fontWeight: "800" }}>
                {urgency === "critical" ? "URGENT" : urgency === "warn" ? "Bientôt" : "À faire"}
              </Text>
            </View>
        }
      </Pressable>
    </Animated.View>
  );
}

// ─── NotifCard ───────────────────────────────────────────────────────────────
function NotifCard({ title, body, priority, action, route, onAction }: {
  title: string; body: string; priority: SmartNotificationPriority;
  action: string; route: string; onAction?: () => void;
}) {
  const color = PRIORITY_COLOR[priority];
  const bg    = PRIORITY_BG[priority];
  return (
    <Pressable onPress={() => router.push(route as never)}
      style={{ backgroundColor: bg, borderRadius: 16, padding: 14,
        borderWidth: 1, borderColor: color + "20",
        flexDirection: "row", alignItems: "center", gap: 12,
        shadowColor: color, shadowOpacity: 0.05,
        shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: color + "18",
        alignItems: "center", justifyContent: "center" }}>
        <Ionicons
          name={priority === "critical" ? "alert-circle" : priority === "high" ? "flash" : priority === "medium" ? "information-circle" : "bulb"}
          size={20} color={color}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <View style={{ backgroundColor: color + "18", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color, fontSize: 9, fontWeight: "800" }}>{PRIORITY_LABEL[priority]}</Text>
          </View>
        </View>
        <Text style={{ color: L.text, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>{title}</Text>
        <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{body}</Text>
      </View>
      <View style={{ backgroundColor: color, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{action}</Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
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

  const [filter, setFilter] = useState<FilterKey>("all");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, []);

  const activeMissions  = getActiveMissions(missionProgresses, playerLevel);
  const claimable       = missionProgresses.filter((p) => p.status === "completed");
  const unreadNotifs    = notifications.filter((n) => !n.read);
  const xpInLevel       = playerXp % XP_PER_LEVEL;
  const xpPct           = (xpInLevel / XP_PER_LEVEL) * 100;
  const smartNotifs     = buildSmartNotifications({ avatar, stats, relationships, residents: starterResidents });
  const topSignal       = smartNotifs[0] ?? null;
  const criticalCount   = smartNotifs.filter((n) => n.priority === "critical").length;

  // Tâches quotidiennes
  const hoursSinceEat = stats.lastMealAt
    ? (Date.now() - new Date(stats.lastMealAt).getTime()) / 3_600_000 : 99;
  const eatDone      = hoursSinceEat < 5;
  const eatUrgency   = eatDone ? "ok" : hoursSinceEat > 7 ? "critical" : "warn";
  const sleepDone    = stats.energy >= 60;
  const sleepUrgency: "ok" | "warn" | "critical" = sleepDone ? "ok" : stats.energy < 20 ? "critical" : "warn";
  const hygieneDone  = stats.hygiene >= 50;
  const hygieneUrgency: "ok" | "warn" | "critical" = hygieneDone ? "ok" : stats.hygiene < 20 ? "critical" : "warn";
  const workDone     = stats.discipline >= 50 || stats.money > 200;
  const workUrgency: "ok" | "warn" | "critical" = workDone ? "ok" : "warn";
  const moodDone     = stats.mood >= 40;
  const moodUrgency: "ok" | "warn" | "critical" = moodDone ? "ok" : stats.mood < 20 ? "critical" : "warn";

  const dailyTasks = [
    { emoji: "🍽️", label: "Manger",    done: eatDone,     urgency: eatUrgency,
      detail: eatDone ? `Repas il y a ${Math.round(hoursSinceEat)}h` : "Ton personnage a faim.",
      route: "/(app)/health",    kind: "health" },
    { emoji: "😴", label: "Dormir",    done: sleepDone,   urgency: sleepUrgency,
      detail: sleepDone ? `Énergie : ${stats.energy}/100` : "Il faut récupérer.",
      route: "/(app)/health",    kind: "health" },
    { emoji: "🚿", label: "Hygiène",   done: hygieneDone, urgency: hygieneUrgency,
      detail: hygieneDone ? `Hygiène : ${stats.hygiene}/100` : "Prends une douche.",
      route: "/(app)/health",    kind: "health" },
    { emoji: "💼", label: "Travailler", done: workDone,   urgency: workUrgency,
      detail: workDone ? `Discipline : ${stats.discipline}/100` : "Travaille pour progresser.",
      route: "/(app)/work",      kind: "work"   },
    { emoji: "😊", label: "Humeur",    done: moodDone,   urgency: moodUrgency,
      detail: moodDone ? `Humeur : ${stats.mood}/100` : "Sors ou parle à quelqu'un.",
      route: "/(app)/(tabs)/world", kind: "health" },
  ] as const;

  const doneTasks    = dailyTasks.filter((t) => t.done).length;
  const criticalTasks = dailyTasks.filter((t) => !t.done && t.urgency === "critical").length;
  const allDone      = doneTasks === dailyTasks.length;

  // Filtrage des tâches
  const filteredTasks = filter === "all"    ? dailyTasks
    : filter === "urgent" ? dailyTasks.filter((t) => !t.done && (t.urgency === "critical" || t.urgency === "warn"))
    : filter === "work"   ? dailyTasks.filter((t) => t.kind === "work")
    : filter === "health" ? dailyTasks.filter((t) => t.kind === "health")
    : dailyTasks;

  const filteredSmartNotifs = filter === "all"    ? smartNotifs
    : filter === "urgent" ? smartNotifs.filter((n) => n.priority === "critical" || n.priority === "high")
    : filter === "social" ? smartNotifs.filter((n) => n.kind === "social")
    : filter === "work"   ? smartNotifs.filter((n) => n.kind === "work")
    : filter === "health" ? smartNotifs.filter((n) => n.kind === "needs")
    : smartNotifs;

  const totalUnread = unreadNotifs.length + criticalCount;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: L.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── HEADER ── */}
        <View style={{ backgroundColor: "#fff", paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20,
          borderBottomWidth: 1, borderBottomColor: L.border }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <View>
              <Text style={{ color: L.text, fontWeight: "900", fontSize: 26 }}>Notifications</Text>
              <Text style={{ color: L.muted, fontSize: 13, marginTop: 2 }}>
                Tout ce qui se passe dans ta vie
              </Text>
            </View>
            {totalUnread > 0 && (
              <Pressable onPress={markAllRead}
                style={{ backgroundColor: L.primaryBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
                  borderWidth: 1, borderColor: L.primary + "30", flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: L.primary,
                  alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{totalUnread}</Text>
                </View>
                <Text style={{ color: L.primary, fontSize: 12, fontWeight: "700" }}>Tout lire</Text>
              </Pressable>
            )}
          </View>

          {/* XP + progression */}
          <View style={{ backgroundColor: L.primaryBg, borderRadius: 16, padding: 14,
            borderWidth: 1, borderColor: L.primary + "20" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: L.primary,
                  alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>{playerLevel}</Text>
                </View>
                <Text style={{ color: L.primary, fontWeight: "700", fontSize: 13 }}>Niveau {playerLevel}</Text>
              </View>
              <Text style={{ color: L.muted, fontSize: 12 }}>{xpInLevel} / {XP_PER_LEVEL} XP</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: L.primary + "20", overflow: "hidden" }}>
              <View style={{ height: 8, borderRadius: 4, width: `${xpPct}%`, backgroundColor: L.primary }} />
            </View>
          </View>
        </View>

        {/* ── SIGNAL PRIORITAIRE ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          {topSignal ? (
            <Pressable onPress={() => router.push(topSignal.route as never)}
              style={{ backgroundColor: PRIORITY_BG[topSignal.priority], borderRadius: 20, padding: 16,
                borderWidth: 1.5, borderColor: PRIORITY_COLOR[topSignal.priority] + "30",
                flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16,
                shadowColor: PRIORITY_COLOR[topSignal.priority], shadowOpacity: 0.08,
                shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
              <View style={{ width: 50, height: 50, borderRadius: 16,
                backgroundColor: PRIORITY_COLOR[topSignal.priority] + "18",
                alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={topSignal.priority === "critical" ? "alert-circle" : "navigate-circle"}
                  size={26} color={PRIORITY_COLOR[topSignal.priority]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: PRIORITY_COLOR[topSignal.priority], fontSize: 10, fontWeight: "800", marginBottom: 2 }}>
                  PRIORITÉ MAINTENANT
                </Text>
                <Text style={{ color: L.text, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
                  {topSignal.title}
                </Text>
                <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                  {topSignal.body}
                </Text>
              </View>
              <View style={{ backgroundColor: PRIORITY_COLOR[topSignal.priority], borderRadius: 12,
                paddingHorizontal: 12, paddingVertical: 9 }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{topSignal.actionLabel}</Text>
              </View>
            </Pressable>
          ) : (
            <View style={{ backgroundColor: L.greenBg, borderRadius: 18, padding: 16,
              borderWidth: 1, borderColor: L.green + "25", flexDirection: "row", alignItems: "center", gap: 14,
              marginBottom: 16 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: L.green + "18",
                alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="checkmark-circle" size={24} color={L.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: L.green, fontSize: 14, fontWeight: "800" }}>Tout est stable</Text>
                <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }}>
                  Aucune urgence pour le moment. Continue comme ça !
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── FILTRES ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ paddingBottom: 4 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: filter === f.key ? L.primary : L.card,
                borderWidth: 1, borderColor: filter === f.key ? L.primary : L.border }}>
              <Text style={{ color: filter === f.key ? "#fff" : L.textSoft,
                fontSize: 13, fontWeight: "700" }}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ padding: 16, gap: 20 }}>

          {/* ── RÉCLAMATIONS ── */}
          {claimable.length > 0 && (
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Text style={{ color: L.text, fontSize: 15, fontWeight: "800" }}>Récompenses</Text>
                <View style={{ backgroundColor: L.goldBg, borderRadius: 10,
                  paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: L.gold + "30" }}>
                  <Text style={{ color: L.gold, fontSize: 11, fontWeight: "800" }}>{claimable.length}</Text>
                </View>
              </View>
              <View style={{ gap: 8 }}>
                {claimable.map((prog) => {
                  const mission = getMission(prog.missionId);
                  if (!mission) return null;
                  const catColor = mission.category === "story" ? L.purple : mission.category === "weekly" ? L.gold : L.green;
                  const catBg    = mission.category === "story" ? L.purpleBg : mission.category === "weekly" ? L.goldBg : L.greenBg;
                  return (
                    <View key={prog.missionId} style={{ backgroundColor: catBg, borderRadius: 16, padding: 14,
                      borderWidth: 1, borderColor: catColor + "25",
                      flexDirection: "row", alignItems: "center", gap: 12,
                      shadowColor: catColor, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
                      <Text style={{ fontSize: 26 }}>{mission.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: L.text, fontWeight: "700", fontSize: 14 }}>{mission.title}</Text>
                        <Text style={{ color: catColor, fontSize: 12, marginTop: 2 }}>
                          +{mission.xpReward} XP · +{mission.moneyReward} crédits
                        </Text>
                      </View>
                      <Pressable onPress={() => claimMission(prog.missionId)}
                        style={{ backgroundColor: catColor, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}>
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>Réclamer</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── TÂCHES QUOTIDIENNES ── */}
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: L.text, fontSize: 15, fontWeight: "800" }}>Tâches du jour</Text>
                <View style={{ backgroundColor: allDone ? L.greenBg : L.border, borderRadius: 10,
                  paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
                  borderColor: allDone ? L.green + "30" : L.border }}>
                  <Text style={{ color: allDone ? L.green : L.muted, fontSize: 11, fontWeight: "800" }}>
                    {doneTasks}/{dailyTasks.length}
                  </Text>
                </View>
              </View>
              {criticalTasks > 0 && (
                <View style={{ backgroundColor: L.redBg, borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: L.red + "25" }}>
                  <Text style={{ color: L.red, fontSize: 10, fontWeight: "800" }}>
                    {criticalTasks} CRITIQUE{criticalTasks > 1 ? "S" : ""}
                  </Text>
                </View>
              )}
            </View>

            {/* Barre de progression globale */}
            <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 12, marginBottom: 10,
              borderWidth: 1, borderColor: L.border,
              shadowColor: "rgba(0,0,0,0.04)", shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: L.textSoft, fontSize: 12 }}>Progression journalière</Text>
                <Text style={{ color: allDone ? L.green : L.primary, fontSize: 12, fontWeight: "700" }}>
                  {Math.round((doneTasks / dailyTasks.length) * 100)}%
                </Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: L.border, overflow: "hidden" }}>
                <View style={{ height: 8, borderRadius: 4,
                  width: `${(doneTasks / dailyTasks.length) * 100}%`,
                  backgroundColor: allDone ? L.green : L.primary }} />
              </View>
              <View style={{ flexDirection: "row", gap: 5, marginTop: 8 }}>
                {dailyTasks.map((t, i) => (
                  <View key={i} style={{ flex: 1, height: 4, borderRadius: 2,
                    backgroundColor: t.done ? L.green : t.urgency === "critical" ? L.red : t.urgency === "warn" ? L.gold : L.border }} />
                ))}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              {(filteredTasks as typeof dailyTasks[number][]).map((task) => (
                <TaskCard
                  key={task.label}
                  emoji={task.emoji}
                  label={task.label}
                  done={task.done}
                  urgency={task.urgency}
                  detail={task.detail}
                  onPress={() => router.push(task.route as never)}
                />
              ))}
            </View>
          </View>

          {/* ── SIGNAUX INTELLIGENTS ── */}
          {filteredSmartNotifs.length > 0 && (
            <View>
              <Text style={{ color: L.text, fontSize: 15, fontWeight: "800", marginBottom: 10 }}>
                Signaux intelligents
              </Text>
              <View style={{ gap: 8 }}>
                {filteredSmartNotifs.slice(0, 3).map((n) => (
                  <NotifCard
                    key={n.id}
                    title={n.title}
                    body={n.body}
                    priority={n.priority}
                    action={n.actionLabel}
                    route={n.route}
                  />
                ))}
              </View>
            </View>
          )}

          {/* ── MISSIONS EN COURS ── */}
          {activeMissions.length > 0 && (
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ color: L.text, fontSize: 15, fontWeight: "800" }}>Missions actives</Text>
                <Pressable onPress={() => router.push("/(app)/missions" as never)}>
                  <Text style={{ color: L.primary, fontSize: 12, fontWeight: "700" }}>Tout voir →</Text>
                </Pressable>
              </View>
              <View style={{ gap: 8 }}>
                {activeMissions.slice(0, 2).map((mission) => {
                  const prog = missionProgresses.find((p) => p.missionId === mission.id);
                  const reqs = prog?.requirements ?? mission.requirements.map((r) => ({ ...r, current: 0 }));
                  const total = reqs.reduce((s, r) => s + r.count, 0);
                  const done  = reqs.reduce((s, r) => s + Math.min(r.current, r.count), 0);
                  const pct   = total > 0 ? (done / total) * 100 : 0;
                  const catColor = mission.category === "story" ? L.purple : mission.category === "weekly" ? L.gold : L.green;
                  const catBg    = mission.category === "story" ? L.purpleBg : mission.category === "weekly" ? L.goldBg : L.greenBg;
                  return (
                    <View key={mission.id} style={{ backgroundColor: catBg, borderRadius: 16, padding: 14,
                      borderWidth: 1, borderColor: catColor + "20", gap: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ fontSize: 22 }}>{mission.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: L.text, fontWeight: "700", fontSize: 14 }}>{mission.title}</Text>
                          <Text style={{ color: catColor, fontSize: 12 }}>+{mission.xpReward} XP</Text>
                        </View>
                        <Text style={{ color: catColor, fontWeight: "700", fontSize: 13 }}>{done}/{total}</Text>
                      </View>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: catColor + "20", overflow: "hidden" }}>
                        <View style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: catColor }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── ALERTES NON LUES ── */}
          {unreadNotifs.length > 0 && (
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ color: L.text, fontSize: 15, fontWeight: "800" }}>
                  Alertes ({unreadNotifs.length})
                </Text>
                <Pressable onPress={markAllRead}>
                  <Text style={{ color: L.muted, fontSize: 12 }}>Tout lire</Text>
                </Pressable>
              </View>
              <View style={{ gap: 8 }}>
                {unreadNotifs.slice(0, 4).map((n) => {
                  const kindColor = n.kind === "social" ? L.blue : n.kind === "reward" ? L.green : n.kind === "work" ? L.gold : L.red;
                  const kindBg    = n.kind === "social" ? L.blueBg : n.kind === "reward" ? L.greenBg : n.kind === "work" ? L.goldBg : L.redBg;
                  return (
                    <View key={n.id} style={{ backgroundColor: L.card, borderRadius: 16, padding: 12,
                      borderWidth: 1, borderColor: L.border, borderLeftWidth: 3, borderLeftColor: kindColor,
                      flexDirection: "row", gap: 12, alignItems: "flex-start",
                      shadowColor: "rgba(0,0,0,0.04)", shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: kindBg,
                        alignItems: "center", justifyContent: "center" }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: kindColor }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: L.text, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>{n.title}</Text>
                        <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{n.body}</Text>
                      </View>
                      <Pressable onPress={() => markRead(n.id)}
                        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: L.border,
                          alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="checkmark" size={14} color={L.muted} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── RACCOURCIS ── */}
          <View>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
              NAVIGUER
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { emoji: "🎯", label: "Missions",    route: "/(app)/missions",    color: L.green,  bg: L.greenBg  },
                { emoji: "⚡", label: "Progression", route: "/(app)/progression", color: L.primary, bg: L.primaryBg },
                { emoji: "🏆", label: "Classement",  route: "/(app)/leaderboard", color: L.gold,   bg: L.goldBg   },
                { emoji: "🏠", label: "Logement",    route: "/(app)/housing",     color: L.teal,   bg: L.tealBg   },
              ].map((item) => (
                <Pressable key={item.route} onPress={() => router.push(item.route as never)}
                  style={{ flex: 1, minWidth: 80, backgroundColor: item.bg, borderRadius: 16,
                    paddingVertical: 14, alignItems: "center", gap: 5,
                    borderWidth: 1, borderColor: item.color + "25" }}>
                  <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                  <Text style={{ color: item.color, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

        </View>
      </ScrollView>
    </Animated.View>
  );
}
