import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { jobs } from "@/lib/game-engine";
import { getActionTimeScore, useTimeContext } from "@/lib/time-context";
import type { ShiftRecord } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

const L = {
  bg: "#e8edf5", card: "#f0f4fa", border: "#ccd4e0",
  text: "#1e2a3a", textSoft: "#4a5568", muted: "#8fa3b8",
  primary: "#6366f1", primaryBg: "#eef2ff",
  green: "#10b981", greenBg: "#ecfdf5",
  gold: "#f59e0b", goldBg: "#fffbeb",
  red: "#ef4444", redBg: "#fef2f2",
  blue: "#3b82f6", blueBg: "#eff6ff",
};

const JOB_COLORS: Record<string, string> = {
  "office-assistant": "#3b82f6",
  "support-tech":     "#8b5cf6",
  "creator-studio":   "#ec4899",
  "cafe-host":        "#f97316",
  "wellness-guide":   "#10b981",
};

const JOB_EMOJIS: Record<string, string> = {
  "office-assistant": "🖥️",
  "support-tech":     "🔧",
  "creator-studio":   "🎨",
  "cafe-host":        "☕",
  "wellness-guide":   "🌿",
};

const JOB_TIPS: Record<string, string> = {
  "office-assistant": "IRL : une bonne gestion d'agenda double la productivité perçue.",
  "support-tech":     "IRL : documentez chaque solution — 80% des tickets se répètent.",
  "creator-studio":   "IRL : publiez même imparfait. La régularité bat la perfection.",
  "cafe-host":        "IRL : un sourire sincère = +30% pourboire moyen prouvé.",
  "wellness-guide":   "IRL : l'empathie active dans le coaching est la compétence la plus rare.",
};

// ─── Shift progress bar ───────────────────────────────────────────────────────
function ShiftProgressBar({ durationSec, color, onDone }: {
  durationSec: number; color: string; onDone: () => void;
}) {
  const progress    = useRef(new Animated.Value(0)).current;
  const calledDone  = useRef(false);

  useEffect(() => {
    calledDone.current = false;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 100, duration: durationSec * 1000, useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !calledDone.current) {
        calledDone.current = true;
        onDone();
      }
    });
    return () => { progress.stopAnimation(); };
  }, [durationSec]);

  const width = progress.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View style={{ height: 12, borderRadius: 6, backgroundColor: L.border, overflow: "hidden" }}>
      <Animated.View style={{ height: "100%", borderRadius: 6, width, backgroundColor: color }} />
    </View>
  );
}

// ─── Shift history row ────────────────────────────────────────────────────────
function ShiftRow({ record }: { record: ShiftRecord }) {
  const emoji = JOB_EMOJIS[record.jobSlug] ?? "💼";
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: L.border,
    }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: L.text, fontWeight: "700", fontSize: 13 }}>{record.jobName}</Text>
        <Text style={{ color: L.muted, fontSize: 11 }}>
          {new Date(record.completedAt).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
          })}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: L.green, fontWeight: "800", fontSize: 14 }}>+{record.earnedCoins} cr</Text>
        <Text style={{ color: L.gold, fontSize: 11 }}>+{record.earnedXp} XP</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WorkScreen() {
  const avatar            = useGameStore((s) => s.avatar);
  const stats             = useGameStore((s) => s.stats);
  const editAvatar        = useGameStore((s) => s.editAvatar);
  const workSession       = useGameStore((s) => s.workSession);
  const jobXp             = useGameStore((s) => s.jobXp);
  const jobLevel          = useGameStore((s) => s.jobLevel);
  const shiftHistory      = useGameStore((s) => s.shiftHistory);
  const startWorkShift    = useGameStore((s) => s.startWorkShift);
  const completeWorkShift = useGameStore((s) => s.completeWorkShift);
  const cancelWorkShift   = useGameStore((s) => s.cancelWorkShift);

  const currentJobSlug = avatar?.starterJob ?? jobs[0].slug;
  const currentJob     = jobs.find((j) => j.slug === currentJobSlug) ?? jobs[0];
  const jobColor       = JOB_COLORS[currentJobSlug] ?? L.primary;
  const jobEmoji       = JOB_EMOJIS[currentJobSlug] ?? "💼";
  const jobTip         = JOB_TIPS[currentJobSlug] ?? "";

  const [selecting, setSelecting] = useState(false);
  const [leveledUp, setLeveledUp] = useState(false);
  const prevLevel = useRef(jobLevel);

  useEffect(() => {
    if (jobLevel > prevLevel.current) {
      setLeveledUp(true);
      const t = setTimeout(() => setLeveledUp(false), 3500);
      prevLevel.current = jobLevel;
      return () => clearTimeout(t);
    }
    prevLevel.current = jobLevel;
  }, [jobLevel]);

  const timeCtx        = useTimeContext();
  const workTimeScore  = getActionTimeScore("work-shift", timeCtx);
  const isWorkPrime    = workTimeScore.multiplier > 1;
  const isWorkOff      = workTimeScore.multiplier < 1;
  const energyTooLow   = stats.energy < 15;
  const levelBonus     = 1 + (jobLevel - 1) * 0.05;
  const projectedEarnings = Math.round(currentJob.rewardCoins * levelBonus * workTimeScore.multiplier);

  function switchJob(slug: string) {
    if (!avatar) return;
    editAvatar({ ...avatar, starterJob: slug });
    setSelecting(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ── Hero header ─────────────────────────────────────────── */}
        <View style={{ backgroundColor: jobColor, overflow: "hidden",
          paddingHorizontal: 20, paddingTop: 54, paddingBottom: 24 }}>
          <View style={{ position: "absolute", bottom: -40, right: -40, width: 160, height: 160,
            borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)" }} />

          <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>← Retour</Text>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 60, height: 60, borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 30 }}>{jobEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                {isWorkPrime && (
                  <View style={{ backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>⚡ Pic productif +30%</Text>
                  </View>
                )}
                {isWorkOff && (
                  <View style={{ backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "800" }}>⚠️ Hors horaire -25%</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22 }}>{currentJob.name}</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "700", marginTop: 2 }}>
                ~{projectedEarnings} cr / shift · Niveau {jobLevel}
              </Text>
            </View>
          </View>

          {/* XP Bar */}
          <View style={{ marginTop: 16, gap: 5 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700" }}>
                NIVEAU {jobLevel}{jobLevel >= 10 ? " — MAX" : ""}
              </Text>
              <Text style={{ color: "#fbbf24", fontSize: 11, fontWeight: "700" }}>{jobXp}/100 XP</Text>
            </View>
            <View style={{ height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
              <View style={{ height: 7, borderRadius: 4, width: `${jobXp}%`, backgroundColor: "#fbbf24" }} />
            </View>
          </View>

          {/* Stats rapides */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            {[
              { label: "Crédits",    value: `${stats.money} cr`,   color: "#fff", bg: "rgba(255,255,255,0.15)" },
              { label: "Discipline", value: `${stats.discipline}`, color: "#fff", bg: "rgba(255,255,255,0.15)" },
              { label: "Énergie",    value: `${stats.energy}/100`, color: stats.energy < 20 ? "#fca5a5" : "#fff", bg: "rgba(255,255,255,0.15)" },
              { label: "Rép.",       value: `${stats.reputation}`, color: "#fbbf24", bg: "rgba(255,255,255,0.15)" },
            ].map((m) => (
              <View key={m.label} style={{ flex: 1, backgroundColor: m.bg,
                borderRadius: 12, padding: 10, gap: 2 }}>
                <Text style={{ color: m.color, fontWeight: "900", fontSize: 15 }}>{m.value}</Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Contenu ─────────────────────────────────────────────── */}
        <View style={{ padding: 20, gap: 14 }}>

          {/* Level up toast */}
          {leveledUp && (
            <View style={{
              backgroundColor: L.goldBg, borderRadius: 14, padding: 14,
              borderWidth: 1.5, borderColor: "#fcd34d",
              flexDirection: "row", alignItems: "center", gap: 12,
            }}>
              <Text style={{ fontSize: 28 }}>🏆</Text>
              <View>
                <Text style={{ color: L.gold, fontWeight: "900", fontSize: 15 }}>Niveau {jobLevel} atteint !</Text>
                <Text style={{ color: L.textSoft, fontSize: 12 }}>Tes revenus par shift augmentent de 5%.</Text>
              </View>
            </View>
          )}

          {/* Zone shift idle */}
          {workSession.phase === "idle" && (
            <View style={{ gap: 10 }}>
              {isWorkOff && workTimeScore.hint && (
                <View style={{
                  backgroundColor: L.redBg, borderRadius: 12, padding: 12,
                  borderWidth: 1, borderColor: "#fca5a5",
                  flexDirection: "row", alignItems: "center", gap: 10,
                }}>
                  <Text style={{ fontSize: 20 }}>🌙</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: L.red, fontSize: 12, fontWeight: "700" }}>Hors horaire de travail</Text>
                    <Text style={{ color: L.textSoft, fontSize: 11 }}>{workTimeScore.hint} — revenus réduits de 25%.</Text>
                  </View>
                </View>
              )}
              {isWorkPrime && (
                <View style={{
                  backgroundColor: L.greenBg, borderRadius: 12, padding: 10,
                  borderWidth: 1, borderColor: "#6ee7b7",
                  flexDirection: "row", alignItems: "center", gap: 10,
                }}>
                  <Text style={{ fontSize: 18 }}>⚡</Text>
                  <Text style={{ color: L.green, fontSize: 12, fontWeight: "700", flex: 1 }}>
                    Créneau productif — bonus +30% sur les gains
                  </Text>
                </View>
              )}
              {energyTooLow && (
                <View style={{
                  backgroundColor: L.redBg, borderRadius: 12, padding: 12,
                  borderWidth: 1, borderColor: "#fca5a5",
                  flexDirection: "row", alignItems: "center", gap: 10,
                }}>
                  <Text style={{ fontSize: 20 }}>⚡</Text>
                  <Text style={{ color: L.red, fontSize: 13, flex: 1 }}>
                    Énergie trop basse — dors ou mange avant un shift.
                  </Text>
                </View>
              )}
              <Pressable
                disabled={energyTooLow}
                onPress={() => { setSelecting(false); startWorkShift(currentJobSlug); }}
                style={{
                  borderRadius: 16, padding: 18,
                  backgroundColor: energyTooLow ? L.bg : jobColor,
                  borderWidth: energyTooLow ? 1.5 : 0,
                  borderColor: L.border,
                  alignItems: "center", gap: 6,
                  opacity: energyTooLow ? 0.5 : 1,
                  shadowColor: jobColor, shadowOpacity: energyTooLow ? 0 : 0.3,
                  shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
                }}
              >
                <Text style={{ fontSize: 28 }}>▶</Text>
                <Text style={{ color: energyTooLow ? L.muted : "#fff", fontWeight: "800", fontSize: 16 }}>
                  Lancer un shift
                </Text>
                <Text style={{ color: energyTooLow ? L.muted : "rgba(255,255,255,0.8)", fontSize: 12 }}>
                  ~{projectedEarnings} cr · -{currentJob.energyCost} énergie
                </Text>
              </Pressable>
            </View>
          )}

          {/* Shift actif */}
          {workSession.phase === "active" && (
            <View style={{
              backgroundColor: L.card, borderRadius: 20, padding: 20,
              borderWidth: 1.5, borderColor: jobColor + "55", gap: 14,
              shadowColor: jobColor, shadowOpacity: 0.12, shadowRadius: 12,
              shadowOffset: { width: 0, height: 2 }, elevation: 3,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ fontSize: 26 }}>{jobEmoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: jobColor, fontWeight: "800", fontSize: 15 }}>Shift en cours…</Text>
                  <Text style={{ color: L.muted, fontSize: 12 }}>{currentJob.name}</Text>
                </View>
              </View>
              <ShiftProgressBar
                durationSec={workSession.durationSec}
                color={jobColor}
                onDone={() => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); completeWorkShift(); }}
              />
              <View style={{ flexDirection: "row", gap: 20 }}>
                <Text style={{ color: L.green, fontWeight: "700", fontSize: 13 }}>+{workSession.earnedCoins} cr</Text>
                <Text style={{ color: L.gold, fontWeight: "700", fontSize: 13 }}>+{workSession.earnedXp} XP</Text>
                <Text style={{ color: L.blue, fontWeight: "700", fontSize: 13 }}>+{workSession.earnedDiscipline} disc</Text>
              </View>
              <Pressable onPress={cancelWorkShift} style={{ alignItems: "center", paddingVertical: 6 }}>
                <Text style={{ color: L.muted, fontSize: 12 }}>Annuler le shift</Text>
              </Pressable>
            </View>
          )}

          {/* Shift terminé */}
          {workSession.phase === "completed" && (
            <View style={{
              backgroundColor: L.greenBg, borderRadius: 20, padding: 20,
              borderWidth: 1.5, borderColor: "#6ee7b7", gap: 14,
              alignItems: "center",
            }}>
              <Text style={{ fontSize: 36 }}>✅</Text>
              <Text style={{ color: L.green, fontWeight: "900", fontSize: 18 }}>Shift terminé !</Text>
              <View style={{ flexDirection: "row", gap: 24 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: L.green, fontWeight: "900", fontSize: 22 }}>+{workSession.earnedCoins}</Text>
                  <Text style={{ color: L.muted, fontSize: 11 }}>crédits</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: L.gold, fontWeight: "900", fontSize: 22 }}>+{workSession.earnedXp}</Text>
                  <Text style={{ color: L.muted, fontSize: 11 }}>XP</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: L.blue, fontWeight: "900", fontSize: 22 }}>+{workSession.earnedDiscipline}</Text>
                  <Text style={{ color: L.muted, fontSize: 11 }}>discipline</Text>
                </View>
              </View>
              <Text style={{ color: L.textSoft, fontSize: 12, textAlign: "center", fontStyle: "italic" }}>{jobTip}</Text>
              <Pressable onPress={cancelWorkShift}
                style={{ backgroundColor: L.green, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24,
                  alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>Nouveau shift</Text>
              </Pressable>
            </View>
          )}

          {/* Changer de poste */}
          <Pressable
            onPress={() => setSelecting(!selecting)}
            style={{
              flexDirection: "row", justifyContent: "space-between", alignItems: "center",
              padding: 14, borderRadius: 14,
              backgroundColor: L.card, borderWidth: 1, borderColor: L.border,
            }}
          >
            <Text style={{ color: L.textSoft, fontWeight: "700", fontSize: 13 }}>
              {selecting ? "▲ Fermer" : "▼ Changer de poste"}
            </Text>
            <Text style={{ color: L.muted, fontSize: 12 }}>{jobs.length} postes</Text>
          </Pressable>

          {selecting && (
            <View style={{ gap: 8 }}>
              {jobs.map((job) => {
                const isActive = job.slug === currentJobSlug;
                const jc = JOB_COLORS[job.slug] ?? L.primary;
                const je = JOB_EMOJIS[job.slug] ?? "💼";
                return (
                  <TouchableOpacity
                    key={job.slug}
                    onPress={() => switchJob(job.slug)}
                    style={{
                      padding: 14, borderRadius: 14, borderWidth: isActive ? 2 : 1,
                      borderColor: isActive ? jc : L.border,
                      backgroundColor: isActive ? jc + "10" : L.card,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ fontSize: 20 }}>{je}</Text>
                        <View>
                          <Text style={{ color: L.text, fontWeight: "800", fontSize: 14 }}>{job.name}</Text>
                          <Text style={{ color: L.muted, fontSize: 11 }}>
                            +{job.rewardCoins} cr · disc +{job.disciplineReward} · rep +{job.reputationReward}
                          </Text>
                        </View>
                      </View>
                      {isActive && (
                        <View style={{ backgroundColor: jc, borderRadius: 8,
                          paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>actuel</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Historique */}
          {shiftHistory.length > 0 && (
            <View style={{
              backgroundColor: L.card, borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: L.border,
            }}>
              <Text style={{ color: L.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8 }}>
                HISTORIQUE DES SHIFTS
              </Text>
              {shiftHistory.map((r) => <ShiftRow key={r.id} record={r} />)}
            </View>
          )}

          {/* Conseil du poste */}
          <View style={{ backgroundColor: jobColor + "0c", borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: jobColor + "30", gap: 6 }}>
            <Text style={{ color: jobColor, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
              💡 CONSEIL — {currentJob.name.toUpperCase()}
            </Text>
            <Text style={{ color: L.textSoft, fontSize: 13, lineHeight: 19 }}>
              {jobTip}
            </Text>
            <View style={{ marginTop: 4, gap: 4 }}>
              {[
                "La discipline monte et soutient le rang social",
                "Chaque niveau = +5% revenus par shift",
                "Travaille aux heures de pointe pour le bonus",
              ].map((line, i) => (
                <Text key={i} style={{ color: L.muted, fontSize: 11 }}>· {line}</Text>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
