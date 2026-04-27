"use client";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { useGameStore } from "@/stores/game-store";
import {
  getScenario, getDateResult, DATE_RESULT_META,
  type DialogueChoice, type DateResult,
} from "@/lib/romance";

const D = {
  bg:       "#0f1117",
  card:     "#1a1d27",
  card2:    "#22263a",
  text:     "#e8edf5",
  textSoft: "#8fa3b8",
  muted:    "#4a5568",
  border:   "#2a3148",
  pink:     "#ec4899",
  pinkBg:   "#2a1120",
  primary:  "#6366f1",
  gold:     "#f59e0b",
  green:    "#10b981",
  red:      "#ef4444",
};

export default function DateNarrativeScreen() {
  const activeDatePlanId = useGameStore((s) => s.activeDatePlanId);
  const datePlans        = useGameStore((s) => s.datePlans);
  const finalizeDate     = useGameStore((s) => s.finalizeDate);

  const plan = datePlans.find((p) => p.id === activeDatePlanId);
  const scenario = getScenario(plan?.venueKind ?? "coffee");

  const [cardIndex, setCardIndex]     = useState(0);
  const [totalDelta, setTotalDelta]   = useState(0);
  const [chosen, setChosen]           = useState<string | null>(null);
  const [reaction, setReaction]       = useState<string | null>(null);
  const [result, setResult]           = useState<DateResult | null>(null);
  const [done, setDone]               = useState(false);

  const fadeCard  = useRef(new Animated.Value(0)).current;
  const slideCard = useRef(new Animated.Value(30)).current;
  const fadeRes   = useRef(new Animated.Value(0)).current;
  const heartAnim = useRef(new Animated.Value(1)).current;

  const currentCard = scenario.cards[cardIndex];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeCard, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(slideCard, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [cardIndex]);

  useEffect(() => {
    if (!result) return;
    Animated.timing(fadeRes, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(heartAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
      Animated.timing(heartAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [result]);

  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: D.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: D.muted, fontSize: 14 }}>Aucun date en cours.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: D.primary, fontWeight: "700" }}>← Retour</Text>
        </Pressable>
      </View>
    );
  }

  function handleChoice(choice: DialogueChoice) {
    if (chosen) return;
    setChosen(choice.id);
    setReaction(choice.reaction);

    Animated.sequence([
      Animated.timing(heartAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
      Animated.timing(heartAnim, { toValue: 1,   duration: 200, useNativeDriver: true }),
    ]).start();

    const newDelta = totalDelta + Math.max(0, choice.delta);

    setTimeout(() => {
      if (cardIndex < scenario.cards.length - 1) {
        setChosen(null);
        setReaction(null);
        fadeCard.setValue(0);
        slideCard.setValue(30);
        setCardIndex((i) => i + 1);
        setTotalDelta(newDelta);
      } else {
        setTotalDelta(newDelta);
        const finalResult = getDateResult(newDelta + Math.max(0, choice.delta));
        setResult(finalResult);
        setDone(true);
      }
    }, 1400);
  }

  function handleFinish() {
    if (!plan) return;
    finalizeDate(plan.id, totalDelta);
    router.replace("/(app)/dates");
  }

  const progress = (cardIndex / scenario.cards.length);
  const resultMeta = result ? DATE_RESULT_META[result] : null;

  // ── Result screen ────────────────────────────────────────────────────────────
  if (done && resultMeta) {
    return (
      <Animated.View style={{ flex: 1, backgroundColor: D.bg, opacity: fadeRes }}>
        <ScrollView contentContainerStyle={{ flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 24 }}>

          <Animated.Text style={{ fontSize: 72, transform: [{ scale: heartAnim }] }}>
            {resultMeta.emoji}
          </Animated.Text>

          <View style={{ alignItems: "center", gap: 8 }}>
            <Text style={{ color: resultMeta.color, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>
              {scenario.title.toUpperCase()} AVEC {plan.residentName.toUpperCase()}
            </Text>
            <Text style={{ color: D.text, fontSize: 26, fontWeight: "900", textAlign: "center" }}>
              {resultMeta.label}
            </Text>
            <Text style={{ color: D.textSoft, fontSize: 14, textAlign: "center", lineHeight: 22, marginTop: 4 }}>
              {resultMeta.desc}
            </Text>
          </View>

          {/* Gains */}
          <View style={{ backgroundColor: D.card, borderRadius: 20, padding: 20, width: "100%",
            borderWidth: 1, borderColor: resultMeta.color + "30", gap: 12 }}>
            <Text style={{ color: D.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }}>GAINS</Text>
            <View style={{ flexDirection: "row", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {resultMeta.relationBonus > 0 && (
                <View style={{ backgroundColor: D.pinkBg, borderRadius: 14, padding: 14, alignItems: "center", gap: 4 }}>
                  <Text style={{ fontSize: 22 }}>💕</Text>
                  <Text style={{ color: D.pink, fontWeight: "900", fontSize: 16 }}>+{resultMeta.relationBonus}</Text>
                  <Text style={{ color: D.muted, fontSize: 10 }}>Relation</Text>
                </View>
              )}
              {resultMeta.relationBonus < 0 && (
                <View style={{ backgroundColor: "#2a1010", borderRadius: 14, padding: 14, alignItems: "center", gap: 4 }}>
                  <Text style={{ fontSize: 22 }}>💔</Text>
                  <Text style={{ color: D.red, fontWeight: "900", fontSize: 16 }}>{resultMeta.relationBonus}</Text>
                  <Text style={{ color: D.muted, fontSize: 10 }}>Relation</Text>
                </View>
              )}
              {resultMeta.moodBonus > 0 && (
                <View style={{ backgroundColor: "#1a2a1a", borderRadius: 14, padding: 14, alignItems: "center", gap: 4 }}>
                  <Text style={{ fontSize: 22 }}>😊</Text>
                  <Text style={{ color: D.green, fontWeight: "900", fontSize: 16 }}>+{resultMeta.moodBonus}</Text>
                  <Text style={{ color: D.muted, fontSize: 10 }}>Humeur</Text>
                </View>
              )}
            </View>
          </View>

          <Pressable onPress={handleFinish}
            style={{ backgroundColor: resultMeta.color, borderRadius: 18,
              paddingVertical: 16, paddingHorizontal: 40, alignSelf: "stretch",
              alignItems: "center", shadowColor: resultMeta.color,
              shadowOpacity: 0.35, shadowRadius: 16 }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Continuer →</Text>
          </Pressable>

        </ScrollView>
      </Animated.View>
    );
  }

  // ── Dialogue screen ──────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>

      {/* Header */}
      <View style={{ paddingTop: 54, paddingHorizontal: 20, paddingBottom: 16,
        backgroundColor: D.pinkBg, borderBottomWidth: 1, borderBottomColor: D.pink + "20" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Pressable onPress={() => { finalizeDate(plan.id, 0); router.replace("/(app)/dates"); }}
            style={{ backgroundColor: "rgba(236,72,153,0.15)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: D.pink, fontSize: 12, fontWeight: "700" }}>← Quitter</Text>
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: D.pink, fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>
              {scenario.emoji} {scenario.title.toUpperCase()}
            </Text>
            <Text style={{ color: D.textSoft, fontSize: 11, marginTop: 2 }}>
              avec {plan.residentName}
            </Text>
          </View>
          <Text style={{ color: D.muted, fontSize: 12 }}>
            {cardIndex + 1}/{scenario.cards.length}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={{ height: 4, borderRadius: 2, backgroundColor: D.border, overflow: "hidden" }}>
          <Animated.View style={{ height: 4, borderRadius: 2,
            width: `${Math.round(progress * 100)}%` as `${number}%`,
            backgroundColor: D.pink }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* Bulle NPC */}
        <Animated.View style={{ opacity: fadeCard, transform: [{ translateY: slideCard }] }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22,
              backgroundColor: D.pink + "25", borderWidth: 2, borderColor: D.pink + "50",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22 }}>💕</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: D.card, borderRadius: 18, borderBottomLeftRadius: 4,
              padding: 16, borderWidth: 1, borderColor: D.pink + "25" }}>
              <Text style={{ color: D.pink, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginBottom: 6 }}>
                {plan.residentName.toUpperCase()}
              </Text>
              <Text style={{ color: D.text, fontSize: 15, lineHeight: 22, fontWeight: "500" }}>
                {currentCard.npcLine}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Réaction après choix */}
        {reaction && (
          <Animated.View style={{ opacity: fadeCard }}>
            <View style={{ backgroundColor: D.card2, borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: D.green + "30",
              flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Text style={{ fontSize: 16 }}>✨</Text>
              <Text style={{ color: D.green, fontSize: 13, fontStyle: "italic", flex: 1, lineHeight: 20 }}>
                {reaction}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Choix */}
        {!chosen && (
          <Animated.View style={{ gap: 10, opacity: fadeCard }}>
            <Text style={{ color: D.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 2 }}>
              TA RÉPONSE
            </Text>
            {currentCard.choices.map((choice, i) => (
              <Pressable
                key={choice.id}
                onPress={() => handleChoice(choice)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? D.primary + "20" : D.card,
                  borderRadius: 16, padding: 16,
                  borderWidth: 1.5,
                  borderColor: pressed ? D.primary : D.border,
                  flexDirection: "row", alignItems: "center", gap: 12,
                })}>
                <View style={{ width: 28, height: 28, borderRadius: 14,
                  backgroundColor: D.primary + "15", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: D.primary, fontSize: 12, fontWeight: "900" }}>{i + 1}</Text>
                </View>
                <Text style={{ color: D.text, fontSize: 14, flex: 1, lineHeight: 21 }}>
                  {choice.text}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* Choix sélectionné (grisé) */}
        {chosen && (
          <View style={{ gap: 10 }}>
            {currentCard.choices.map((choice) => (
              <View
                key={choice.id}
                style={{
                  backgroundColor: choice.id === chosen ? D.primary + "20" : D.card,
                  borderRadius: 16, padding: 16,
                  borderWidth: 1.5,
                  borderColor: choice.id === chosen ? D.primary : D.border,
                  opacity: choice.id === chosen ? 1 : 0.35,
                  flexDirection: "row", alignItems: "center", gap: 12,
                }}>
                <Text style={{ fontSize: 14 }}>
                  {choice.id === chosen ? "✓" : "·"}
                </Text>
                <Text style={{ color: D.text, fontSize: 14, flex: 1 }}>{choice.text}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}
