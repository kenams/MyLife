/**
 * Travail — Système de shifts avec timer, XP, niveaux et historique
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Button, NavBack, Pill } from "@/components/ui";
import { jobs } from "@/lib/game-engine";
import { colors } from "@/lib/theme";
import type { ShiftRecord } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

const JOB_COLORS: Record<string, string> = {
  "office-assistant": "#60a5fa",
  "support-tech":     "#a78bfa",
  "creator-studio":   "#f472b6",
  "cafe-host":        "#fb923c",
  "wellness-guide":   "#34d399",
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

// ─── XP Bar ───────────────────────────────────────────────────────────────────
function XpBar({ xp, level }: { xp: number; level: number }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
          NIVEAU {level}{level >= 10 ? " — MAX" : ""}
        </Text>
        <Text style={{ color: "#fbbf24", fontSize: 11, fontWeight: "700" }}>{xp}/100 XP</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)" }}>
        <View style={{ height: 8, borderRadius: 4, width: `${xp}%`, backgroundColor: "#fbbf24" }} />
      </View>
      {level < 10 && (
        <Text style={{ color: colors.muted, fontSize: 10 }}>
          +5% revenus par niveau · prochaine hausse à {100 - xp} XP
        </Text>
      )}
    </View>
  );
}

// ─── Shift progress bar ───────────────────────────────────────────────────────
function ShiftProgressBar({ durationSec, color, onDone }: {
  durationSec: number;
  color: string;
  onDone: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const calledDone = useRef(false);

  useEffect(() => {
    calledDone.current = false;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 100,
      duration: durationSec * 1000,
      useNativeDriver: false,
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
    <View style={{ height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <Animated.View style={{ height: "100%", borderRadius: 7, width, backgroundColor: color }} />
    </View>
  );
}

// ─── Shift history row ────────────────────────────────────────────────────────
function ShiftRow({ record }: { record: ShiftRecord }) {
  const emoji = JOB_EMOJIS[record.jobSlug] ?? "💼";
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)"
    }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{record.jobName}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          {new Date(record.completedAt).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
          })}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 14 }}>+{record.earnedCoins} cr</Text>
        <Text style={{ color: "#fbbf24", fontSize: 11 }}>+{record.earnedXp} XP</Text>
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
  const jobColor       = JOB_COLORS[currentJobSlug] ?? colors.accent;
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

  const energyTooLow    = stats.energy < 15;
  const levelBonus      = 1 + (jobLevel - 1) * 0.05;
  const projectedEarnings = Math.round(currentJob.rewardCoins * levelBonus);

  function switchJob(slug: string) {
    if (!avatar) return;
    editAvatar({ ...avatar, starterJob: slug });
    setSelecting(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <NavBack fallback="/(app)/(tabs)/home" />

        {/* ── Header job ── */}
        <View style={{
          backgroundColor: jobColor + "14", borderRadius: 20, padding: 20,
          borderWidth: 1.5, borderColor: jobColor + "40", gap: 12, marginBottom: 14,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 16,
              backgroundColor: jobColor + "25",
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ fontSize: 28 }}>{jobEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ alignSelf: "flex-start", marginBottom: 4 }}><Pill tone="accent">Travail</Pill></View>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{currentJob.name}</Text>
              <Text style={{ color: jobColor, fontSize: 13, fontWeight: "700" }}>
                ~{projectedEarnings} cr / shift · Niveau {jobLevel}
              </Text>
            </View>
          </View>
          <XpBar xp={jobXp} level={jobLevel} />
        </View>

        {/* ── Level up toast ── */}
        {leveledUp && (
          <View style={{
            backgroundColor: "#fbbf2422", borderRadius: 14, padding: 14,
            borderWidth: 1.5, borderColor: "#fbbf2460",
            flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14,
          }}>
            <Text style={{ fontSize: 28 }}>🏆</Text>
            <View>
              <Text style={{ color: "#fbbf24", fontWeight: "900", fontSize: 15 }}>Niveau {jobLevel} atteint !</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Tes revenus par shift augmentent de 5%.</Text>
            </View>
          </View>
        )}

        {/* ── Stats rapides ── */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Crédits", value: `${stats.money}`, color: "#38c793" },
            { label: "Discipline", value: `${stats.discipline}%`, color: "#60a5fa" },
            { label: "Énergie", value: `${stats.energy}%`, color: stats.energy < 20 ? "#f87171" : "#a78bfa" },
          ].map((m) => (
            <View key={m.label} style={{
              flex: 1, backgroundColor: "rgba(255,255,255,0.04)",
              borderRadius: 14, padding: 12, gap: 2,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              <Text style={{ color: m.color, fontWeight: "900", fontSize: 18 }}>{m.value}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Zone shift ── */}
        {workSession.phase === "idle" && (
          <View style={{ marginBottom: 14 }}>
            {energyTooLow && (
              <View style={{
                backgroundColor: "rgba(248,113,113,0.1)", borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: "rgba(248,113,113,0.3)",
                flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10,
              }}>
                <Text style={{ fontSize: 20 }}>⚡</Text>
                <Text style={{ color: "#f87171", fontSize: 13, flex: 1 }}>
                  Énergie trop basse — dors ou mange avant un shift.
                </Text>
              </View>
            )}
            <Pressable
              disabled={energyTooLow}
              onPress={() => { setSelecting(false); startWorkShift(currentJobSlug); }}
              style={{
                borderRadius: 16, padding: 18,
                backgroundColor: energyTooLow ? "rgba(255,255,255,0.03)" : jobColor + "20",
                borderWidth: 1.5, borderColor: energyTooLow ? "rgba(255,255,255,0.07)" : jobColor + "55",
                alignItems: "center", gap: 6,
                opacity: energyTooLow ? 0.5 : 1,
              }}
            >
              <Text style={{ fontSize: 28 }}>▶</Text>
              <Text style={{ color: energyTooLow ? colors.muted : jobColor, fontWeight: "800", fontSize: 16 }}>
                Lancer un shift
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                ~{projectedEarnings} cr · -{currentJob.energyCost} énergie
              </Text>
            </Pressable>
          </View>
        )}

        {workSession.phase === "active" && (
          <View style={{
            backgroundColor: jobColor + "12", borderRadius: 20, padding: 20,
            borderWidth: 1.5, borderColor: jobColor + "40", gap: 14, marginBottom: 14,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 26 }}>{jobEmoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: jobColor, fontWeight: "800", fontSize: 15 }}>Shift en cours…</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{currentJob.name}</Text>
              </View>
            </View>
            <ShiftProgressBar
              durationSec={workSession.durationSec}
              color={jobColor}
              onDone={completeWorkShift}
            />
            <View style={{ flexDirection: "row", gap: 20 }}>
              <Text style={{ color: "#38c793", fontWeight: "700", fontSize: 13 }}>+{workSession.earnedCoins} cr</Text>
              <Text style={{ color: "#fbbf24", fontWeight: "700", fontSize: 13 }}>+{workSession.earnedXp} XP</Text>
              <Text style={{ color: "#60a5fa", fontWeight: "700", fontSize: 13 }}>+{workSession.earnedDiscipline} disc</Text>
            </View>
            <Pressable onPress={cancelWorkShift} style={{ alignItems: "center", paddingVertical: 6 }}>
              <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Annuler le shift</Text>
            </Pressable>
          </View>
        )}

        {workSession.phase === "completed" && (
          <View style={{
            backgroundColor: "#38c79322", borderRadius: 20, padding: 20,
            borderWidth: 1.5, borderColor: "#38c79355", gap: 14,
            alignItems: "center", marginBottom: 14,
          }}>
            <Text style={{ fontSize: 36 }}>✅</Text>
            <Text style={{ color: "#38c793", fontWeight: "900", fontSize: 18 }}>Shift terminé !</Text>
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#38c793", fontWeight: "900", fontSize: 22 }}>+{workSession.earnedCoins}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>crédits</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#fbbf24", fontWeight: "900", fontSize: 22 }}>+{workSession.earnedXp}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>XP</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#60a5fa", fontWeight: "900", fontSize: 22 }}>+{workSession.earnedDiscipline}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>discipline</Text>
              </View>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", fontStyle: "italic" }}>{jobTip}</Text>
            <Button label="Nouveau shift" onPress={cancelWorkShift} />
          </View>
        )}

        {/* ── Changer de poste ── */}
        <Pressable
          onPress={() => setSelecting(!selecting)}
          style={{
            flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            padding: 14, borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            marginBottom: selecting ? 10 : 14,
          }}
        >
          <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>
            {selecting ? "▲ Fermer" : "▼ Changer de poste"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{jobs.length} postes</Text>
        </Pressable>

        {selecting && (
          <View style={{ gap: 8, marginBottom: 14 }}>
            {jobs.map((job) => {
              const isActive = job.slug === currentJobSlug;
              const jc = JOB_COLORS[job.slug] ?? colors.accent;
              const je = JOB_EMOJIS[job.slug] ?? "💼";
              return (
                <TouchableOpacity
                  key={job.slug}
                  onPress={() => switchJob(job.slug)}
                  style={{
                    padding: 14, borderRadius: 14, borderWidth: 1.5,
                    borderColor: isActive ? jc : "rgba(255,255,255,0.1)",
                    backgroundColor: isActive ? jc + "14" : "rgba(255,255,255,0.03)",
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={{ fontSize: 20 }}>{je}</Text>
                      <View>
                        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{job.name}</Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>
                          +{job.rewardCoins} cr · disc +{job.disciplineReward} · rep +{job.reputationReward}
                        </Text>
                      </View>
                    </View>
                    {isActive && <Pill>actuel</Pill>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Historique ── */}
        {shiftHistory.length > 0 && (
          <View style={{
            backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 14,
          }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8 }}>
              HISTORIQUE DES SHIFTS
            </Text>
            {shiftHistory.map((r) => <ShiftRow key={r.id} record={r} />)}
          </View>
        )}

        {/* ── Impact ── */}
        <View style={{
          backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
        }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8 }}>
            IMPACT DU TRAVAIL
          </Text>
          {[
            "La discipline monte et soutient le rang social",
            "Chaque niveau augmente les revenus de 5%",
            "Le momentum actif booste les crédits par shift",
            "Un stress élevé réduit le rendement net",
            "La réputation progresse avec chaque shift réalisé",
          ].map((line, i) => (
            <Text key={i} style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>· {line}</Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
