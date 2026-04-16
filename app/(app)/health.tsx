/**
 * Santé & Sport — Système de séance avec durée, feedback et cooldown
 *
 * - Chaque activité a une durée simulée (3-8s)
 * - Barre de progression animée pendant la séance
 * - Résumé des gains à la fin ("Séance terminée !")
 * - Cooldown entre deux séances du même type (affiché clairement)
 * - Vérification énergie minimum avant de commencer
 */

import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { getActionTimeScore, useTimeContext } from "@/lib/time-context";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

// ─── Définition des activités ────────────────────────────────────────────────

type SportActivity = {
  id:          string;
  label:       string;
  emoji:       string;
  description: string;
  durationSec: number;   // durée simulée de la séance (3-8s)
  cooldownMin: number;   // cooldown en minutes (dans le jeu = minutes réelles)
  minEnergy:   number;   // énergie minimale pour démarrer
  effects: {
    fitness?:    number;
    energy?:     number;
    stress?:     number;
    mood?:       number;
    discipline?: number;
    weight?:     number;
    health?:     number;
    hygiene?:    number;
    hydration?:  number;
  };
  tip: string;           // conseil vraie vie
  color: string;
  action: "gym" | "walk" | "shower" | "hydrate" | "nap" | "team-sport" | "meditate";
};

const ACTIVITIES: SportActivity[] = [
  {
    id: "gym",
    label: "Séance salle",
    emoji: "🏋️",
    description: "Entraînement intensif. Cardio + musculation. Coûte de l'énergie, gagne en forme.",
    durationSec: 6,
    cooldownMin: 30,
    minEnergy: 25,
    effects: { fitness: +12, energy: -20, stress: +5, discipline: +8, mood: +6, weight: -0.2 },
    tip: "IRL : progressive overload — augmente les charges de 2,5% par semaine.",
    color: "#e74c3c",
    action: "gym",
  },
  {
    id: "walk",
    label: "Marcher",
    emoji: "🚶",
    description: "30 minutes de marche active. Léger mais régulier = meilleur résultat long terme.",
    durationSec: 4,
    cooldownMin: 10,
    minEnergy: 10,
    effects: { fitness: +4, energy: -5, stress: -10, mood: +8, health: +3 },
    tip: "IRL : 7000 pas/jour suffisent. Marche après manger = -glucose +15%.",
    color: "#27ae60",
    action: "walk",
  },
  {
    id: "team-sport",
    label: "Sport collectif",
    emoji: "⚽",
    description: "Foot, basket, tennis… Double bénéfice : forme + lien social simultanément.",
    durationSec: 7,
    cooldownMin: 60,
    minEnergy: 30,
    effects: { fitness: +10, energy: -18, stress: -5, mood: +14, discipline: +6 },
    tip: "IRL : 1 sport collectif/semaine = impact mental prouvé supérieur au solo.",
    color: "#3498db",
    action: "team-sport",
  },
  {
    id: "meditate",
    label: "Méditation",
    emoji: "🧘",
    description: "Session de pleine conscience. Réduit le cortisol, améliore la clarté mentale.",
    durationSec: 5,
    cooldownMin: 15,
    minEnergy: 5,
    effects: { stress: -18, mood: +10, discipline: +4, energy: +5 },
    tip: "IRL : 10 min cohérence cardiaque (app RespiRelax) = effet mesurable après 7 jours.",
    color: "#9b59b6",
    action: "meditate",
  },
  {
    id: "shower",
    label: "Douche",
    emoji: "🚿",
    description: "Hygiène et fraîcheur. Impact direct sur humeur et réputation.",
    durationSec: 3,
    cooldownMin: 8,
    minEnergy: 0,
    effects: { hygiene: +40, mood: +6, stress: -5, energy: +4 },
    tip: "IRL : douche froide 30s en fin = éveille, dopamine, meilleure récupération musculaire.",
    color: "#00bcd4",
    action: "shower",
  },
  {
    id: "hydrate",
    label: "Boire de l'eau",
    emoji: "💧",
    description: "Hydratation essentielle. -1% hydratation = -10% performance cognitive.",
    durationSec: 1,
    cooldownMin: 3,
    minEnergy: 0,
    effects: { hydration: +25, energy: +4, stress: -3 },
    tip: "IRL : 2L/jour minimum. Ajoute 500ml par 30 min de sport.",
    color: "#3498db",
    action: "hydrate",
  },
  {
    id: "nap",
    label: "Sieste",
    emoji: "😴",
    description: "20 min de récupération rapide. Recharge sans plonger dans le sommeil profond.",
    durationSec: 4,
    cooldownMin: 120,
    minEnergy: 0,
    effects: { energy: +22, stress: -8, mood: +5, discipline: -2 },
    tip: "IRL : sieste de 20 min (pas plus) entre 13h-15h = pic de vigilance +34% l'après-midi.",
    color: "#f39c12",
    action: "nap",
  },
];

// ─── Cooldown tracker (en mémoire locale, par session) ───────────────────────
type CooldownState = Record<string, number>; // activityId → timestamp dernière séance

// ─── Barre de progression séance ─────────────────────────────────────────────
function SessionProgress({
  activity,
  onComplete,
}: {
  activity: SportActivity;
  onComplete: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: activity.durationSec * 1000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onComplete();
    });

    const interval = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= activity.durationSec) {
          clearInterval(interval);
          return activity.durationSec;
        }
        return e + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const remaining = activity.durationSec - elapsed;
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={{
      backgroundColor: activity.color + "18",
      borderRadius: 16,
      borderWidth: 1, borderColor: activity.color + "55",
      padding: 20, gap: 14,
    }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          width: 48, height: 48, borderRadius: 12,
          backgroundColor: activity.color + "33",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 26 }}>{activity.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
            {activity.label} en cours…
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Encore {remaining}s
          </Text>
        </View>
        {/* Pulsation */}
        <PulseIndicator color={activity.color} />
      </View>

      {/* Barre progression */}
      <View>
        <View style={{
          height: 10, borderRadius: 5,
          backgroundColor: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}>
          <Animated.View style={{
            width: barWidth,
            height: "100%",
            backgroundColor: activity.color,
            borderRadius: 5,
          }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 10 }}>Début</Text>
          <Text style={{ color: activity.color, fontSize: 10, fontWeight: "700" }}>
            {Math.round((elapsed / activity.durationSec) * 100)}%
          </Text>
          <Text style={{ color: colors.muted, fontSize: 10 }}>Fin</Text>
        </View>
      </View>

      {/* Effets en attente */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {Object.entries(activity.effects).map(([key, val]) => {
          const positive = (val ?? 0) > 0;
          return (
            <View key={key} style={{
              backgroundColor: positive ? "rgba(56,199,147,0.1)" : "rgba(243,156,18,0.1)",
              borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
              borderWidth: 1,
              borderColor: positive ? "rgba(56,199,147,0.2)" : "rgba(243,156,18,0.2)",
            }}>
              <Text style={{
                color: positive ? "#38c793" : "#f39c12",
                fontSize: 11, fontWeight: "700",
              }}>
                {(val ?? 0) > 0 ? "+" : ""}{val} {key}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PulseIndicator({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: color,
      transform: [{ scale }],
      opacity: 0.9,
    }} />
  );
}

// ─── Résumé de fin de séance ──────────────────────────────────────────────────
function SessionSummary({
  activity,
  onClose,
}: {
  activity: SportActivity;
  onClose: () => void;
}) {
  const bounceAnim = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.spring(bounceAnim, {
      toValue: 1, tension: 120, friction: 8, useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        backgroundColor: "#0d1c2e",
        borderRadius: 20,
        borderWidth: 1, borderColor: activity.color + "55",
        padding: 20, gap: 14,
        transform: [{ scale: bounceAnim }],
      }}
    >
      {/* Check mark */}
      <View style={{ alignItems: "center", gap: 6 }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: activity.color + "22",
          borderWidth: 2, borderColor: activity.color,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 28 }}>✓</Text>
        </View>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
          {activity.label} terminée !
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {activity.durationSec}s de session validée
        </Text>
      </View>

      {/* Gains obtenus */}
      <View style={{
        backgroundColor: "rgba(56,199,147,0.08)", borderRadius: 12,
        borderWidth: 1, borderColor: "rgba(56,199,147,0.2)",
        padding: 12, gap: 6,
      }}>
        <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 12, marginBottom: 4 }}>
          GAINS OBTENUS
        </Text>
        {Object.entries(activity.effects).map(([key, val]) => {
          const positive = (val ?? 0) > 0;
          const arrow    = positive ? "↑" : "↓";
          const col      = positive ? "#38c793" : "#f39c12";
          return (
            <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: col, fontSize: 14, width: 16 }}>{arrow}</Text>
              <Text style={{ color: colors.text, fontSize: 13, flex: 1, fontWeight: "600" }}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
              <Text style={{ color: col, fontSize: 13, fontWeight: "800" }}>
                {(val ?? 0) > 0 ? "+" : ""}{val}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Conseil vraie vie */}
      <View style={{
        backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10,
        padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
      }}>
        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", marginBottom: 3 }}>
          💡 DANS TA VRAIE VIE
        </Text>
        <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>
          {activity.tip}
        </Text>
      </View>

      <Pressable
        onPress={onClose}
        style={{
          backgroundColor: activity.color,
          borderRadius: 12, paddingVertical: 13, alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>OK, continuer</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Carte activité ───────────────────────────────────────────────────────────
function ActivityCard({
  activity,
  cooldownLeft,
  energyTooLow,
  onStart,
}: {
  activity: SportActivity;
  cooldownLeft: number;  // secondes restantes
  energyTooLow: boolean;
  onStart: () => void;
}) {
  const locked    = cooldownLeft > 0 || energyTooLow;
  const mainEffect = Object.entries(activity.effects).reduce((best, [key, val]) =>
    Math.abs(val ?? 0) > Math.abs(best[1] ?? 0) ? [key, val] as [string, number] : best
  , ["", 0] as [string, number]);

  const cooldownLabel = cooldownLeft > 0
    ? cooldownLeft >= 60
      ? `Disponible dans ${Math.ceil(cooldownLeft / 60)}m`
      : `Disponible dans ${cooldownLeft}s`
    : null;

  return (
    <Pressable
      onPress={locked ? undefined : onStart}
      style={{
        backgroundColor: locked ? "rgba(255,255,255,0.03)" : activity.color + "18",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: locked ? "rgba(255,255,255,0.07)" : activity.color + "55",
        padding: 14,
        opacity: locked ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {/* Icône */}
        <View style={{
          width: 44, height: 44, borderRadius: 10,
          backgroundColor: locked ? "rgba(255,255,255,0.06)" : activity.color + "33",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 22 }}>{activity.emoji}</Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: locked ? colors.muted : colors.text, fontWeight: "800", fontSize: 14 }}>
            {activity.label}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
            {activity.description}
          </Text>
        </View>

        {/* Bouton / état */}
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {!locked ? (
            <View style={{
              backgroundColor: activity.color,
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
            }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>
                ▶ Lancer
              </Text>
            </View>
          ) : cooldownLeft > 0 ? (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 5,
            }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>
                ⏳ {cooldownLabel}
              </Text>
            </View>
          ) : (
            <View style={{
              backgroundColor: "rgba(243,156,18,0.15)", borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 5,
              borderWidth: 1, borderColor: "rgba(243,156,18,0.3)",
            }}>
              <Text style={{ color: "#f39c12", fontSize: 10, fontWeight: "700" }}>
                ⚡ Énergie insuffisante
              </Text>
            </View>
          )}

          {/* Effet principal */}
          {!locked && mainEffect[0] && (
            <Text style={{ color: activity.color, fontSize: 10, fontWeight: "700" }}>
              {(mainEffect[1] ?? 0) > 0 ? "+" : ""}{mainEffect[1]} {mainEffect[0]}
            </Text>
          )}
        </View>
      </View>

      {/* Durée + énergie min */}
      {!locked && (
        <View style={{
          flexDirection: "row", gap: 10, marginTop: 8, paddingTop: 8,
          borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)",
        }}>
          <Text style={{ color: colors.muted, fontSize: 10 }}>
            ⏱ Durée : ~{activity.durationSec}s
          </Text>
          <Text style={{ color: colors.muted, fontSize: 10 }}>
            ⚡ Min requis : {activity.minEnergy} énergie
          </Text>
          <Text style={{ color: colors.muted, fontSize: 10 }}>
            🔁 Cooldown : {activity.cooldownMin}m
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Screen principal ──────────────────────────────────────────────────────────
type SessionState =
  | { phase: "idle" }
  | { phase: "running"; activity: SportActivity }
  | { phase: "done";    activity: SportActivity };

export default function HealthScreen() {
  const stats         = useGameStore((s) => s.stats);
  const performAction = useGameStore((s) => s.performAction);

  // Contexte temps réel
  const timeCtx = useTimeContext();
  const gymTimeScore = getActionTimeScore("gym", timeCtx);
  const walkTimeScore = getActionTimeScore("walk", timeCtx);

  const [session, setSession] = useState<SessionState>({ phase: "idle" });
  const [cooldowns, setCooldowns] = useState<CooldownState>({});
  const [tick, setTick] = useState(0);

  // Tick pour mettre à jour les cooldowns toutes les secondes
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function getCooldownLeft(activityId: string, cooldownMin: number): number {
    const last = cooldowns[activityId];
    if (!last) return 0;
    const elapsed = (Date.now() - last) / 1000;
    const total   = cooldownMin * 60;
    return Math.max(0, Math.ceil(total - elapsed));
  }

  function startSession(activity: SportActivity) {
    setSession({ phase: "running", activity });
  }

  function completeSession(activity: SportActivity) {
    // Appliquer l'action dans le store
    performAction(activity.action);
    // Enregistrer le cooldown
    setCooldowns((prev) => ({ ...prev, [activity.id]: Date.now() }));
    // Passer à l'écran résumé
    setSession({ phase: "done", activity });
  }

  function closeSession() {
    setSession({ phase: "idle" });
  }

  // Stats à afficher
  const statBars = [
    { label: "Santé",       value: stats.health,     color: "#38c793" },
    { label: "Forme",       value: stats.fitness,    color: "#e74c3c" },
    { label: "Énergie",     value: stats.energy,     color: "#3498db" },
    { label: "Hygiène",     value: stats.hygiene,    color: "#00bcd4" },
    { label: "Hydratation", value: stats.hydration,  color: "#3498db" },
    { label: "Discipline",  value: stats.discipline, color: "#f39c12" },
    { label: "Stress",      value: 100 - stats.stress, color: stats.stress > 65 ? "#e74c3c" : "#38c793" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
        backgroundColor: "rgba(7,17,31,0.97)",
        borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.06)",
        flexDirection: "row", alignItems: "center", gap: 10,
      }}>
        <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>💪 Santé & Sport</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Énergie : {stats.energy}/100 · Forme : {stats.fitness}/100
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/(app)/studies")}
          style={{
            backgroundColor: "rgba(231,76,60,0.15)", borderRadius: 10,
            paddingHorizontal: 10, paddingVertical: 6,
            borderWidth: 1, borderColor: "rgba(231,76,60,0.3)",
          }}
        >
          <Text style={{ color: "#e74c3c", fontSize: 11, fontWeight: "700" }}>🏋️ Coach</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>

        {/* ── Session en cours ── */}
        {session.phase === "running" && (
          <SessionProgress
            activity={session.activity}
            onComplete={() => completeSession(session.activity)}
          />
        )}

        {/* ── Résumé fin de séance ── */}
        {session.phase === "done" && (
          <SessionSummary
            activity={session.activity}
            onClose={closeSession}
          />
        )}

        {/* ── Stats corporelles ── */}
        {session.phase === "idle" && (
          <View style={{
            backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
            padding: 14, gap: 8,
          }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, marginBottom: 4 }}>
              BILAN CORPOREL
            </Text>
            {statBars.map((s) => (
              <View key={s.label} style={{ gap: 3 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{s.label}</Text>
                  <Text style={{ color: s.color, fontSize: 11, fontWeight: "700" }}>{Math.round(s.value)}/100</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <View style={{ width: `${Math.min(100, s.value)}%`, height: "100%", backgroundColor: s.color, borderRadius: 3 }} />
                </View>
              </View>
            ))}
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              Poids : {stats.weight} kg
            </Text>
          </View>
        )}

        {/* ── Alerte énergie basse ── */}
        {stats.energy < 20 && session.phase === "idle" && (
          <View style={{
            backgroundColor: "rgba(243,156,18,0.12)", borderRadius: 12,
            borderWidth: 1, borderColor: "rgba(243,156,18,0.35)",
            padding: 12, flexDirection: "row", alignItems: "center", gap: 10,
          }}>
            <Text style={{ fontSize: 20 }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#f39c12", fontWeight: "800", fontSize: 13 }}>Énergie critique</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Trop fatigué pour un effort intense. Dors ou fais une sieste d'abord.
              </Text>
            </View>
          </View>
        )}

        {/* ── Liste des activités ── */}
        {session.phase === "idle" && (
          <View style={{ gap: 10 }}>
            {/* Badge créneau sport */}
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              backgroundColor: timeCtx.gymPrime ? "rgba(56,199,147,0.08)" : "rgba(255,255,255,0.03)",
              borderRadius: 12, padding: 10,
              borderWidth: 1,
              borderColor: timeCtx.gymPrime ? "rgba(56,199,147,0.2)" : "rgba(255,255,255,0.06)",
            }}>
              <Text style={{ fontSize: 18 }}>{timeCtx.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: timeCtx.gymPrime ? "#38c793" : colors.muted, fontWeight: "700", fontSize: 12 }}>
                  {timeCtx.gymPrime
                    ? `Créneau sport idéal — ${timeCtx.label}`
                    : `${timeCtx.label} · ${timeCtx.hour.toString().padStart(2, "0")}h${timeCtx.minutes.toString().padStart(2, "0")}`
                  }
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {timeCtx.gymPrime
                    ? "Le sport avant 9h ou après 17h maximise les gains de forme."
                    : "Créneau optimal : 6h-9h ou 17h-21h pour le sport intensif."
                  }
                </Text>
              </View>
              {timeCtx.gymPrime && (
                <View style={{ backgroundColor: "#38c79322", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: "#38c793", fontSize: 10, fontWeight: "800" }}>+30%</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
              ACTIVITÉS DISPONIBLES
            </Text>
            {ACTIVITIES.map((activity) => {
              const cooldownLeft = getCooldownLeft(activity.id, activity.cooldownMin);
              const energyTooLow = stats.energy < activity.minEnergy;
              return (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  cooldownLeft={cooldownLeft}
                  energyTooLow={energyTooLow}
                  onStart={() => startSession(activity)}
                />
              );
            })}
          </View>
        )}

        {/* ── Comment ça marche ── */}
        {session.phase === "idle" && (
          <View style={{
            backgroundColor: "rgba(56,199,147,0.07)", borderRadius: 14,
            borderWidth: 1, borderColor: "rgba(56,199,147,0.2)",
            padding: 14, gap: 6,
          }}>
            <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 13 }}>
              ℹ️ Comment ça marche
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>
              {`• Appuie sur ▶ Lancer pour démarrer une séance\n• Attends la fin de la barre de progression\n• Tes stats changent à la validation finale\n• Chaque activité a un cooldown avant de pouvoir recommencer\n• L'énergie minimum est requise pour les efforts intenses`}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
