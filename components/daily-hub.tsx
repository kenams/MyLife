"use client";

/**
 * Daily Hub — le cœur de la boucle quotidienne (Phase A).
 * Regroupe en un seul bloc en haut de l'accueil : la série, les tâches du jour,
 * et la récompense de fin de journée. Lit uniquement le store (source de vérité
 * locale) — pas d'appel réseau.
 */

import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useGameStore } from "@/stores/game-store";
import { nextStreakMilestone } from "@/lib/game-engine";
import { hapticSuccess } from "@/lib/safe-haptics";

const C = {
  card: "#111111",
  cardAlt: "#181818",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  muted: "#4A4844",
  border: "rgba(255,255,255,0.07)",
  primary: "#FFD600",
  green: "#39FF14",
  greenBg: "#091A03",
};

function isSameDay(iso: string | null | undefined, ref: Date) {
  return !!iso && new Date(iso).toDateString() === ref.toDateString();
}

export function DailyHub() {
  const streak = useGameStore((s) => s.stats.streak);
  const dailyGoals = useGameStore((s) => s.dailyGoals);
  const lastRewardAt = useGameStore((s) => s.lastRewardAt);
  const claimDailyReward = useGameStore((s) => s.claimDailyReward);

  const done = dailyGoals.filter((g) => g.completed).length;
  const total = dailyGoals.length || 1;
  const allDone = done >= total;
  const claimedToday = isSameDay(lastRewardAt, new Date());
  const milestone = useMemo(() => nextStreakMilestone(streak), [streak]);
  const canClaim = allDone && !claimedToday;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 12,
        backgroundColor: C.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.border,
        overflow: "hidden",
      }}
    >
      {/* Série */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 17 }}>🔥</Text>
          <View>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>
              Série de {streak} jour{streak > 1 ? "s" : ""}
            </Text>
            {milestone && (
              <Text style={{ color: C.textSoft, fontSize: 11, marginTop: 1 }}>
                Palier J{milestone.day} · {milestone.label}
              </Text>
            )}
          </View>
        </View>
        {milestone && (
          <View
            style={{
              backgroundColor: C.primary + "18",
              borderRadius: 8,
              paddingHorizontal: 9,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: C.primary, fontSize: 11, fontWeight: "900" }}>
              J-{Math.max(0, milestone.day - streak)}
            </Text>
          </View>
        )}
      </View>

      {/* Tâches du jour */}
      <View style={{ paddingHorizontal: 16, paddingTop: 13, paddingBottom: 6 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              color: C.muted,
              fontSize: 10,
              fontWeight: "900",
              letterSpacing: 2,
            }}
          >
            TA JOURNÉE
          </Text>
          <Text
            style={{
              color: allDone ? C.green : C.textSoft,
              fontSize: 12,
              fontWeight: "900",
            }}
          >
            {done}/{total}
          </Text>
        </View>

        {/* Barre de progression */}
        <View
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: C.cardAlt,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: `${(done / total) * 100}%`,
              height: "100%",
              backgroundColor: allDone ? C.green : C.primary,
              borderRadius: 3,
            }}
          />
        </View>

        {dailyGoals.map((g) => (
          <View
            key={g.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 6,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                borderWidth: 1.5,
                borderColor: g.completed ? C.green : C.muted,
                backgroundColor: g.completed ? C.greenBg : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {g.completed && (
                <Text style={{ color: C.green, fontSize: 11, fontWeight: "900" }}>✓</Text>
              )}
            </View>
            <Text
              style={{
                color: g.completed ? C.textSoft : C.text,
                fontSize: 13.5,
                fontWeight: "600",
                textDecorationLine: g.completed ? "line-through" : "none",
                flex: 1,
              }}
            >
              {g.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Récompense de fin de journée */}
      <Pressable
        onPress={() => {
          if (!canClaim) return;
          hapticSuccess();
          claimDailyReward();
        }}
        disabled={!canClaim}
        style={{
          margin: 12,
          marginTop: 8,
          borderRadius: 11,
          paddingVertical: 13,
          alignItems: "center",
          backgroundColor: canClaim ? C.primary : C.cardAlt,
          opacity: canClaim ? 1 : 0.75,
        }}
      >
        <Text
          style={{
            color: canClaim ? "#080808" : C.textSoft,
            fontWeight: "900",
            fontSize: 13.5,
          }}
        >
          {claimedToday
            ? "Récompense du jour récupérée ✓"
            : allDone
              ? "Récupérer ma récompense du jour"
              : `Termine tes ${total} tâches pour débloquer`}
        </Text>
      </Pressable>
    </View>
  );
}
