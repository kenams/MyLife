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
import { useGameStore } from "@/stores/game-store";

const L = {
  bg: "#f5f7fa", card: "#ffffff", border: "#e8edf5",
  text: "#1e2a3a", textSoft: "#4a5568", muted: "#94a3b8",
  primary: "#6366f1", primaryBg: "#eef2ff",
  green: "#10b981", greenBg: "#ecfdf5",
  gold: "#f59e0b", goldBg: "#fffbeb",
  red: "#ef4444", redBg: "#fef2f2",
  blue: "#3b82f6", blueBg: "#eff6ff",
};

type SportActivity = {
  id:          string;
  label:       string;
  emoji:       string;
  description: string;
  durationSec: number;
  cooldownMin: number;
  minEnergy:   number;
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
  tip: string;
  color: string;
  action: "gym" | "walk" | "shower" | "hydrate" | "nap" | "team-sport" | "meditate";
};

const ACTIVITIES: SportActivity[] = [
  {
    id: "gym", label: "Séance salle", emoji: "🏋️",
    description: "Entraînement intensif. Cardio + musculation. Coûte de l'énergie, gagne en forme.",
    durationSec: 6, cooldownMin: 30, minEnergy: 25,
    effects: { fitness: +12, energy: -20, stress: +5, discipline: +8, mood: +6, weight: -0.2 },
    tip: "IRL : progressive overload — augmente les charges de 2,5% par semaine.",
    color: "#ef4444", action: "gym",
  },
  {
    id: "walk", label: "Marcher", emoji: "🚶",
    description: "30 minutes de marche active. Léger mais régulier = meilleur résultat long terme.",
    durationSec: 4, cooldownMin: 10, minEnergy: 10,
    effects: { fitness: +4, energy: -5, stress: -10, mood: +8, health: +3 },
    tip: "IRL : 7000 pas/jour suffisent. Marche après manger = -glucose +15%.",
    color: "#10b981", action: "walk",
  },
  {
    id: "team-sport", label: "Sport collectif", emoji: "⚽",
    description: "Foot, basket, tennis… Double bénéfice : forme + lien social simultanément.",
    durationSec: 7, cooldownMin: 60, minEnergy: 30,
    effects: { fitness: +10, energy: -18, stress: -5, mood: +14, discipline: +6 },
    tip: "IRL : 1 sport collectif/semaine = impact mental prouvé supérieur au solo.",
    color: "#3b82f6", action: "team-sport",
  },
  {
    id: "meditate", label: "Méditation", emoji: "🧘",
    description: "Session de pleine conscience. Réduit le cortisol, améliore la clarté mentale.",
    durationSec: 5, cooldownMin: 15, minEnergy: 5,
    effects: { stress: -18, mood: +10, discipline: +4, energy: +5 },
    tip: "IRL : 10 min cohérence cardiaque (app RespiRelax) = effet mesurable après 7 jours.",
    color: "#8b5cf6", action: "meditate",
  },
  {
    id: "shower", label: "Douche", emoji: "🚿",
    description: "Hygiène et fraîcheur. Impact direct sur humeur et réputation.",
    durationSec: 3, cooldownMin: 8, minEnergy: 0,
    effects: { hygiene: +40, mood: +6, stress: -5, energy: +4 },
    tip: "IRL : douche froide 30s en fin = éveille, dopamine, meilleure récupération musculaire.",
    color: "#06b6d4", action: "shower",
  },
  {
    id: "hydrate", label: "Boire de l'eau", emoji: "💧",
    description: "Hydratation essentielle. -1% hydratation = -10% performance cognitive.",
    durationSec: 1, cooldownMin: 3, minEnergy: 0,
    effects: { hydration: +25, energy: +4, stress: -3 },
    tip: "IRL : 2L/jour minimum. Ajoute 500ml par 30 min de sport.",
    color: "#3b82f6", action: "hydrate",
  },
  {
    id: "nap", label: "Sieste", emoji: "😴",
    description: "20 min de récupération rapide. Recharge sans plonger dans le sommeil profond.",
    durationSec: 4, cooldownMin: 120, minEnergy: 0,
    effects: { energy: +22, stress: -8, mood: +5, discipline: -2 },
    tip: "IRL : sieste de 20 min (pas plus) entre 13h-15h = pic de vigilance +34% l'après-midi.",
    color: "#f59e0b", action: "nap",
  },
];

type CooldownState = Record<string, number>;

// ─── Pulsation ────────────────────────────────────────────────────────────────
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
      backgroundColor: color, transform: [{ scale }], opacity: 0.9,
    }} />
  );
}

// ─── Session en cours ─────────────────────────────────────────────────────────
function SessionProgress({ activity, onComplete }: {
  activity: SportActivity; onComplete: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1, duration: activity.durationSec * 1000, useNativeDriver: false,
    }).start(({ finished }) => { if (finished) onComplete(); });

    const interval = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= activity.durationSec) { clearInterval(interval); return activity.durationSec; }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = activity.durationSec - elapsed;
  const barWidth  = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={{
      backgroundColor: activity.color + "12",
      borderRadius: 16, borderWidth: 1, borderColor: activity.color + "40",
      padding: 20, gap: 14,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 12,
          backgroundColor: activity.color + "22",
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 26 }}>{activity.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: L.text, fontWeight: "800", fontSize: 16 }}>
            {activity.label} en cours…
          </Text>
          <Text style={{ color: L.muted, fontSize: 12 }}>Encore {remaining}s</Text>
        </View>
        <PulseIndicator color={activity.color} />
      </View>

      <View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: L.border, overflow: "hidden" }}>
          <Animated.View style={{ width: barWidth, height: "100%",
            backgroundColor: activity.color, borderRadius: 5 }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ color: L.muted, fontSize: 10 }}>Début</Text>
          <Text style={{ color: activity.color, fontSize: 10, fontWeight: "700" }}>
            {Math.round((elapsed / activity.durationSec) * 100)}%
          </Text>
          <Text style={{ color: L.muted, fontSize: 10 }}>Fin</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {Object.entries(activity.effects).map(([key, val]) => {
          const positive = (val ?? 0) > 0;
          return (
            <View key={key} style={{
              backgroundColor: positive ? L.greenBg : L.goldBg,
              borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
              borderWidth: 1, borderColor: positive ? "#6ee7b7" : "#fcd34d",
            }}>
              <Text style={{ color: positive ? L.green : L.gold, fontSize: 11, fontWeight: "700" }}>
                {(val ?? 0) > 0 ? "+" : ""}{val} {key}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Résumé fin de séance ─────────────────────────────────────────────────────
function SessionSummary({ activity, onClose }: {
  activity: SportActivity; onClose: () => void;
}) {
  const bounceAnim = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.spring(bounceAnim, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{
      backgroundColor: L.card, borderRadius: 20,
      borderWidth: 1, borderColor: activity.color + "40",
      padding: 20, gap: 14,
      transform: [{ scale: bounceAnim }],
      shadowColor: activity.color, shadowOpacity: 0.12,
      shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    }}>
      <View style={{ alignItems: "center", gap: 6 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28,
          backgroundColor: activity.color + "18",
          borderWidth: 2, borderColor: activity.color,
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 28 }}>✓</Text>
        </View>
        <Text style={{ color: L.text, fontWeight: "800", fontSize: 18 }}>{activity.label} terminée !</Text>
        <Text style={{ color: L.muted, fontSize: 12 }}>{activity.durationSec}s de session validée</Text>
      </View>

      <View style={{ backgroundColor: L.greenBg, borderRadius: 12,
        borderWidth: 1, borderColor: "#6ee7b7", padding: 12, gap: 6 }}>
        <Text style={{ color: L.green, fontWeight: "800", fontSize: 12, marginBottom: 4 }}>GAINS OBTENUS</Text>
        {Object.entries(activity.effects).map(([key, val]) => {
          const positive = (val ?? 0) > 0;
          const col = positive ? L.green : L.gold;
          return (
            <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: col, fontSize: 14, width: 16 }}>{positive ? "↑" : "↓"}</Text>
              <Text style={{ color: L.text, fontSize: 13, flex: 1, fontWeight: "600" }}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
              <Text style={{ color: col, fontSize: 13, fontWeight: "800" }}>
                {(val ?? 0) > 0 ? "+" : ""}{val}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ backgroundColor: L.primaryBg, borderRadius: 10,
        padding: 10, borderWidth: 1, borderColor: "#c7d2fe" }}>
        <Text style={{ color: L.primary, fontSize: 10, fontWeight: "700", marginBottom: 3 }}>
          💡 DANS TA VRAIE VIE
        </Text>
        <Text style={{ color: L.textSoft, fontSize: 12, lineHeight: 18 }}>{activity.tip}</Text>
      </View>

      <Pressable onPress={onClose}
        style={{ backgroundColor: activity.color, borderRadius: 12, paddingVertical: 13, alignItems: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>OK, continuer</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Carte activité ───────────────────────────────────────────────────────────
function ActivityCard({ activity, cooldownLeft, energyTooLow, onStart }: {
  activity: SportActivity; cooldownLeft: number; energyTooLow: boolean; onStart: () => void;
}) {
  const locked = cooldownLeft > 0 || energyTooLow;
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
        backgroundColor: locked ? L.bg : L.card,
        borderRadius: 14, borderWidth: locked ? 1 : 1.5,
        borderColor: locked ? L.border : activity.color + "55",
        padding: 14, opacity: locked ? 0.65 : 1,
        shadowColor: locked ? "transparent" : activity.color,
        shadowOpacity: 0.10, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }, elevation: locked ? 0 : 2,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 10,
          backgroundColor: locked ? L.border : activity.color + "18",
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 22 }}>{activity.emoji}</Text>
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: locked ? L.muted : L.text, fontWeight: "800", fontSize: 14 }}>
            {activity.label}
          </Text>
          <Text style={{ color: L.muted, fontSize: 11 }} numberOfLines={1}>
            {activity.description}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {!locked ? (
            <View style={{ backgroundColor: activity.color,
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>▶ Lancer</Text>
            </View>
          ) : cooldownLeft > 0 ? (
            <View style={{ backgroundColor: L.bg, borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: L.border }}>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "700" }}>⏳ {cooldownLabel}</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: L.goldBg, borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 5,
              borderWidth: 1, borderColor: "#fcd34d" }}>
              <Text style={{ color: L.gold, fontSize: 10, fontWeight: "700" }}>⚡ Énergie insuffisante</Text>
            </View>
          )}
          {!locked && mainEffect[0] && (
            <Text style={{ color: activity.color, fontSize: 10, fontWeight: "700" }}>
              {(mainEffect[1] ?? 0) > 0 ? "+" : ""}{mainEffect[1]} {mainEffect[0]}
            </Text>
          )}
        </View>
      </View>

      {!locked && (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8, paddingTop: 8,
          borderTopWidth: 1, borderColor: L.border }}>
          <Text style={{ color: L.muted, fontSize: 10 }}>⏱ ~{activity.durationSec}s</Text>
          <Text style={{ color: L.muted, fontSize: 10 }}>⚡ Min : {activity.minEnergy}</Text>
          <Text style={{ color: L.muted, fontSize: 10 }}>🔁 Cooldown : {activity.cooldownMin}m</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Screen principal ─────────────────────────────────────────────────────────
type SessionState =
  | { phase: "idle" }
  | { phase: "running"; activity: SportActivity }
  | { phase: "done";    activity: SportActivity };

export default function HealthScreen() {
  const stats         = useGameStore((s) => s.stats);
  const performAction = useGameStore((s) => s.performAction);
  const timeCtx       = useTimeContext();

  const [session, setSession]     = useState<SessionState>({ phase: "idle" });
  const [cooldowns, setCooldowns] = useState<CooldownState>({});
  const [, setTick]               = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function getCooldownLeft(activityId: string, cooldownMin: number): number {
    const last = cooldowns[activityId];
    if (!last) return 0;
    const elapsed = (Date.now() - last) / 1000;
    return Math.max(0, Math.ceil(cooldownMin * 60 - elapsed));
  }

  function completeSession(activity: SportActivity) {
    performAction(activity.action);
    setCooldowns((prev) => ({ ...prev, [activity.id]: Date.now() }));
    setSession({ phase: "done", activity });
  }

  const healthColor  = stats.health  > 65 ? L.green : stats.health  > 35 ? L.gold : L.red;
  const fitnessColor = stats.fitness > 65 ? L.red   : stats.fitness > 35 ? L.gold : L.muted;
  const stressColor  = stats.stress  > 65 ? L.red   : stats.stress  > 40 ? L.gold : L.green;

  const statBars = [
    { label: "Santé",       value: stats.health,        color: healthColor  },
    { label: "Forme",       value: stats.fitness,       color: fitnessColor },
    { label: "Énergie",     value: stats.energy,        color: stats.energy < 20 ? L.red : L.blue },
    { label: "Hygiène",     value: stats.hygiene,       color: "#06b6d4"    },
    { label: "Hydratation", value: stats.hydration,     color: L.blue       },
    { label: "Discipline",  value: stats.discipline,    color: L.gold       },
    { label: "Anti-Stress", value: 100 - stats.stress,  color: stressColor  },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: healthColor, overflow: "hidden",
        paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20 }}>
        <View style={{ position: "absolute", bottom: -40, right: -40, width: 160, height: 160,
          borderRadius: 80, backgroundColor: "rgba(255,255,255,0.1)" }} />

        <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>← Retour</Text>
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <View style={{ width: 56, height: 56, borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.2)",
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 28 }}>💪</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22 }}>Santé & Sport</Text>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
              {timeCtx.gymPrime ? "⚡ Créneau sport idéal — " : ""}{timeCtx.label}
            </Text>
          </View>
          <Pressable onPress={() => router.push("/(app)/studies" as never)}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12,
              paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>🏋️ Coach</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { label: "Santé",    value: stats.health              },
            { label: "Forme",    value: stats.fitness             },
            { label: "Énergie",  value: stats.energy              },
            { label: "Anti-Stress", value: 100 - stats.stress     },
          ].map((s) => {
            const pct = Math.min(100, Math.max(0, s.value));
            return (
              <View key={s.label} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 12, padding: 10, gap: 5 }}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>{Math.round(pct)}</Text>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
                  <View style={{ height: 4, borderRadius: 2, width: `${pct}%`, backgroundColor: "#fff" }} />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: "700" }}>{s.label.toUpperCase()}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>

        {session.phase === "running" && (
          <SessionProgress activity={session.activity}
            onComplete={() => completeSession(session.activity)} />
        )}

        {session.phase === "done" && (
          <SessionSummary activity={session.activity} onClose={() => setSession({ phase: "idle" })} />
        )}

        {/* Bilan corporel */}
        {session.phase === "idle" && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: L.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>
              BILAN CORPOREL
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {statBars.map((s) => {
                const pct     = Math.min(100, Math.max(0, s.value));
                const urgent  = pct < 25;
                const col     = urgent ? L.red : pct < 45 ? L.gold : s.color;
                return (
                  <View key={s.label} style={{ flex: 1, minWidth: 100,
                    backgroundColor: col + "10", borderRadius: 14, padding: 12, gap: 7,
                    borderWidth: 1, borderColor: col + (urgent ? "55" : "30") }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: col, fontSize: 17, fontWeight: "900" }}>{Math.round(pct)}</Text>
                      {urgent && <Text style={{ fontSize: 12 }}>⚠️</Text>}
                    </View>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: L.border, overflow: "hidden" }}>
                      <View style={{ height: 5, borderRadius: 3, width: `${pct}%`, backgroundColor: col }} />
                    </View>
                    <Text style={{ color: L.muted, fontSize: 10, fontWeight: "700" }}>{s.label.toUpperCase()}</Text>
                  </View>
                );
              })}
            </View>
            <View style={{ backgroundColor: L.card, borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: L.border,
              flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 20 }}>⚖️</Text>
              <Text style={{ color: L.muted, fontSize: 12 }}>
                Poids : <Text style={{ color: L.text, fontWeight: "700" }}>{stats.weight} kg</Text>
              </Text>
              <Text style={{ color: L.muted, fontSize: 12, marginLeft: 12 }}>
                Hydrat. : <Text style={{ color: L.blue, fontWeight: "700" }}>{stats.hydration}/100</Text>
              </Text>
            </View>
          </View>
        )}

        {/* Alerte énergie */}
        {stats.energy < 20 && session.phase === "idle" && (
          <View style={{
            backgroundColor: L.goldBg, borderRadius: 12,
            borderWidth: 1, borderColor: "#fcd34d",
            padding: 12, flexDirection: "row", alignItems: "center", gap: 10,
          }}>
            <Text style={{ fontSize: 20 }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: L.gold, fontWeight: "800", fontSize: 13 }}>Énergie critique</Text>
              <Text style={{ color: L.textSoft, fontSize: 11 }}>
                Trop fatigué pour un effort intense. Dors ou fais une sieste d'abord.
              </Text>
            </View>
          </View>
        )}

        {/* Liste activités */}
        {session.phase === "idle" && (
          <View style={{ gap: 10 }}>
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              backgroundColor: timeCtx.gymPrime ? L.greenBg : L.card,
              borderRadius: 12, padding: 10,
              borderWidth: 1, borderColor: timeCtx.gymPrime ? "#6ee7b7" : L.border,
            }}>
              <Text style={{ fontSize: 18 }}>{timeCtx.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: timeCtx.gymPrime ? L.green : L.textSoft, fontWeight: "700", fontSize: 12 }}>
                  {timeCtx.gymPrime
                    ? `Créneau sport idéal — ${timeCtx.label}`
                    : `${timeCtx.label} · ${timeCtx.hour.toString().padStart(2, "0")}h${timeCtx.minutes.toString().padStart(2, "0")}`
                  }
                </Text>
                <Text style={{ color: L.muted, fontSize: 11 }}>
                  {timeCtx.gymPrime
                    ? "Le sport avant 9h ou après 17h maximise les gains de forme."
                    : "Créneau optimal : 6h-9h ou 17h-21h pour le sport intensif."
                  }
                </Text>
              </View>
              {timeCtx.gymPrime && (
                <View style={{ backgroundColor: L.green, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>+30%</Text>
                </View>
              )}
            </View>

            <Text style={{ color: L.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
              ACTIVITÉS DISPONIBLES
            </Text>
            {ACTIVITIES.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                cooldownLeft={getCooldownLeft(activity.id, activity.cooldownMin)}
                energyTooLow={stats.energy < activity.minEnergy}
                onStart={() => setSession({ phase: "running", activity })}
              />
            ))}
          </View>
        )}

        {/* Comment ça marche */}
        {session.phase === "idle" && (
          <View style={{
            backgroundColor: L.primaryBg, borderRadius: 14,
            borderWidth: 1, borderColor: "#c7d2fe",
            padding: 14, gap: 6,
          }}>
            <Text style={{ color: L.primary, fontWeight: "800", fontSize: 13 }}>ℹ️ Comment ça marche</Text>
            <Text style={{ color: L.textSoft, fontSize: 12, lineHeight: 19 }}>
              {`• Appuie sur ▶ Lancer pour démarrer une séance\n• Attends la fin de la barre de progression\n• Tes stats changent à la validation finale\n• Chaque activité a un cooldown avant de pouvoir recommencer\n• L'énergie minimum est requise pour les efforts intenses`}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
