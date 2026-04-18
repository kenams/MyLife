import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { buildGuidanceEngine, getLifePatternLabel } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";
import type { GuidanceItem } from "@/lib/types";

const URGENCY_COLOR: Record<GuidanceItem["urgency"], string> = {
  high:   "#f87171",
  medium: "#fbbf24",
  low:    colors.muted,
};
const CAT_COLOR: Record<GuidanceItem["category"], string> = {
  energy:     "#60a5fa",
  social:     "#38c793",
  budget:     "#f6b94f",
  discipline: "#a78bfa",
  wellbeing:  "#f472b6",
};
const CAT_EMOJI: Record<GuidanceItem["category"], string> = {
  energy: "⚡", social: "😎", budget: "💰", discipline: "💪", wellbeing: "🌿",
};

export default function TipsScreen() {
  const stats = useGameStore((s) => s.stats);
  const { pattern, items } = buildGuidanceEngine(stats);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const patternColor =
    pattern === "burnout" || pattern === "neglect" || pattern === "recovery_needed" ? "#f87171" :
    pattern === "momentum" ? "#38c793" :
    pattern === "social_drought" || pattern === "grind_mode" ? "#fbbf24" : colors.accent;

  const highItems   = items.filter((i) => i.urgency === "high");
  const otherItems  = items.filter((i) => i.urgency !== "high");

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: 60,
            backgroundColor: patternColor + "08" }} />
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>💡 Guidance</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
            Conseils basés sur ton état réel
          </Text>

          {/* Pattern card */}
          <View style={{ marginTop: 14, backgroundColor: patternColor + "14", borderRadius: 16, padding: 14,
            borderWidth: 1.5, borderColor: patternColor + "40", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: patternColor + "25",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 24 }}>
                {pattern === "momentum" ? "🚀" : pattern === "burnout" ? "😵" : pattern === "social_drought" ? "🏝️" : "📊"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>PATTERN DÉTECTÉ</Text>
              <Text style={{ color: patternColor, fontWeight: "900", fontSize: 17, marginTop: 2 }}>
                {getLifePatternLabel(pattern)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                {items.length} conseil{items.length > 1 ? "s" : ""} · {highItems.length} urgent{highItems.length > 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 20, gap: 16 }}>

          {/* Urgents en premier */}
          {highItems.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ color: "#f87171", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                🚨 URGENTS
              </Text>
              {highItems.map((item) => (
                <GuidanceCard key={item.id} item={item} />
              ))}
            </View>
          )}

          {/* Autres conseils */}
          {otherItems.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                CONSEILS
              </Text>
              {otherItems.map((item) => (
                <GuidanceCard key={item.id} item={item} />
              ))}
            </View>
          )}

          {items.length === 0 && (
            <View style={{ alignItems: "center", padding: 40, gap: 10 }}>
              <Text style={{ fontSize: 40 }}>🏆</Text>
              <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 18 }}>Tu es au top !</Text>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
                Aucun conseil urgent. Continue sur cette lancée.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function GuidanceCard({ item }: { item: GuidanceItem }) {
  const urgCol = URGENCY_COLOR[item.urgency];
  const catCol = CAT_COLOR[item.category];
  const catEmoji = CAT_EMOJI[item.category];

  return (
    <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 14, gap: 10,
      borderWidth: 1, borderColor: urgCol + "20" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: catCol + "20",
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 18 }}>{catEmoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ backgroundColor: catCol + "20", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
              borderWidth: 1, borderColor: catCol + "40" }}>
              <Text style={{ color: catCol, fontSize: 9, fontWeight: "800" }}>{item.category.toUpperCase()}</Text>
            </View>
            <Text style={{ color: urgCol, fontSize: 9, fontWeight: "800" }}>
              {item.urgency === "high" ? "URGENT" : item.urgency === "medium" ? "IMPORTANT" : "UTILE"}
            </Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14, marginTop: 3 }}>{item.title}</Text>
        </View>
      </View>

      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{item.body}</Text>

      <View style={{ backgroundColor: colors.accent + "10", borderRadius: 10, padding: 10,
        borderLeftWidth: 3, borderLeftColor: colors.accent }}>
        <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>
          → {item.action}
        </Text>
      </View>
    </View>
  );
}
