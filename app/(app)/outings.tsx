import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { activities, resolveOutingResult } from "@/lib/game-engine";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";
import type { OutingContext, OutingIntensity } from "@/lib/types";

const OUTINGABLE_SLUGS = [
  "coffee-meetup", "restaurant-date", "cinema-night",
  "group-outing", "party-night", "evening-walk", "solo-cafe",
];

const INTENSITIES: { value: OutingIntensity; label: string; hint: string; emoji: string }[] = [
  { value: "chill",   label: "Chill",   emoji: "😌", hint: "Moins de dépense, moins de fatigue" },
  { value: "normale", label: "Normale", emoji: "😊", hint: "Sortie équilibrée, effets standards" },
  { value: "festive", label: "Festive", emoji: "🎉", hint: "Humeur max mais fatigue et budget élevés" },
];

const CONTEXTS: { value: OutingContext; label: string; hint: string; emoji: string }[] = [
  { value: "solo",       label: "Solo",       emoji: "🧍", hint: "Calme, discipline +, sociabilité -" },
  { value: "amis",       label: "Amis",       emoji: "👥", hint: "Liens consolidés, humeur +, stress -" },
  { value: "romantique", label: "Romantique", emoji: "💕", hint: "Humeur max, stress -, qualité sociale +" },
  { value: "groupe",     label: "Groupe",     emoji: "🎭", hint: "Sociabilité forte, stress +, discipline -" },
];

function ChoiceChip<T extends string>({ options, selected, onSelect }: {
  options: { value: T; label: string; emoji: string; hint: string }[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <TouchableOpacity key={opt.value} onPress={() => onSelect(opt.value)}
            style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20,
              backgroundColor: active ? colors.accent + "20" : "rgba(255,255,255,0.05)",
              borderWidth: active ? 1.5 : 1,
              borderColor: active ? colors.accent + "70" : "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: active ? colors.accent : colors.muted, fontWeight: "700", fontSize: 13 }}>
              {opt.emoji} {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function OutingsScreen() {
  const stats         = useGameStore((s) => s.stats);
  const performOuting = useGameStore((s) => s.performOuting);
  const [selectedSlug, setSelectedSlug] = useState("coffee-meetup");
  const [intensity, setIntensity]       = useState<OutingIntensity>("normale");
  const [context, setContext]           = useState<OutingContext>("amis");
  const [done, setDone]                 = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const outingActivities = activities.filter((a) => OUTINGABLE_SLUGS.includes(a.slug));
  const preview          = resolveOutingResult({ activitySlug: selectedSlug, intensity, context }, stats);

  const qualityColor = preview.socialQualityHint === "haute" ? "#38c793"
    : preview.socialQualityHint === "basse" ? "#f87171" : "#fbbf24";

  function goOuting() {
    performOuting({ activitySlug: selectedSlug, intensity, context });
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: 60,
            backgroundColor: "#f6b94f08" }} />
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>🌃 Sorties</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
            Choisis ta sortie intelligemment
          </Text>
        </View>

        <View style={{ padding: 20, gap: 18 }}>

          {/* Done toast */}
          {done && (
            <View style={{ backgroundColor: "#38c79318", borderRadius: 14, padding: 14,
              borderWidth: 1.5, borderColor: "#38c79340", flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 24 }}>✅</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 15 }}>Sortie effectuée !</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{preview.label}</Text>
              </View>
            </View>
          )}

          {/* Type de sortie */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
              TYPE DE SORTIE
            </Text>
            {outingActivities.map((a) => {
              const active = selectedSlug === a.slug;
              return (
                <TouchableOpacity key={a.slug} onPress={() => setSelectedSlug(a.slug)}
                  style={{ padding: 13, borderRadius: 14, borderWidth: active ? 1.5 : 1,
                    borderColor: active ? colors.accent + "70" : "rgba(255,255,255,0.09)",
                    backgroundColor: active ? colors.accent + "0f" : "rgba(255,255,255,0.03)" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18,
                      backgroundColor: active ? colors.accent + "25" : "rgba(255,255,255,0.07)",
                      alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 18 }}>🎯</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: active ? colors.accent : colors.text, fontWeight: "700", fontSize: 14 }}>
                        {a.name}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>{a.summary}</Text>
                    </View>
                    {active && (
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent,
                        alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#000", fontSize: 10, fontWeight: "900" }}>✓</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Intensité */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>INTENSITÉ</Text>
            <ChoiceChip options={INTENSITIES} selected={intensity} onSelect={setIntensity} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {INTENSITIES.find((i) => i.value === intensity)?.hint}
            </Text>
          </View>

          {/* Contexte */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>CONTEXTE</Text>
            <ChoiceChip options={CONTEXTS} selected={context} onSelect={setContext} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {CONTEXTS.find((c) => c.value === context)?.hint}
            </Text>
          </View>

          {/* Aperçu */}
          <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, padding: 16, gap: 12,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
              APERÇU DE LA SORTIE
            </Text>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{preview.label}</Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { label: `+${preview.moodGain} humeur`, positive: preview.moodGain >= 0 },
                { label: `+${preview.sociabilityGain} social`, positive: preview.sociabilityGain >= 0 },
                { label: `-${preview.energyCost} énergie`, positive: preview.energyCost <= 10 },
                { label: `-${preview.budgetCost} cr`, positive: preview.budgetCost <= 15 },
                { label: `${preview.stressDelta >= 0 ? "+" : ""}${preview.stressDelta} stress`, positive: preview.stressDelta <= 0 },
                { label: `${preview.disciplineDelta >= 0 ? "+" : ""}${preview.disciplineDelta} disc`, positive: preview.disciplineDelta >= 0 },
              ].map((badge) => {
                const col = badge.positive ? "#38c793" : "#f6b94f";
                return (
                  <View key={badge.label} style={{ backgroundColor: col + "15", borderRadius: 8,
                    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: col + "35" }}>
                    <Text style={{ color: col, fontSize: 11, fontWeight: "700" }}>{badge.label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Qualité des rencontres :</Text>
              <Text style={{ color: qualityColor, fontWeight: "800", fontSize: 12 }}>
                {preview.socialQualityHint.toUpperCase()}
              </Text>
            </View>

            <Pressable onPress={goOuting}
              style={{ backgroundColor: colors.accent + "20", borderRadius: 14, padding: 14,
                alignItems: "center", borderWidth: 1.5, borderColor: colors.accent + "55" }}>
              <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 15 }}>
                🌃 Partir — {outingActivities.find((a) => a.slug === selectedSlug)?.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>
                Coût : {preview.budgetCost} cr · -{preview.energyCost} énergie
              </Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </Animated.View>
  );
}
