"use client";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useGameStore } from "@/stores/game-store";

const C = {
  bg:     "#0A0A12", border: "rgba(255,255,255,0.1)",
  text:   "#F0EDE5", soft:   "#9A968E", muted: "#4A4848",
  gold:   "#FFD600", green:  "#39FF14",
  purple: "#BF5FFF", blue:   "#00B4FF",
};

const STEPS = [
  {
    emoji: "🗺️", title: "La Map de Toulouse",
    body: "Retrouve des joueurs réels dans ta ville. Active ta localisation pour apparaître sur la map live.",
    accent: C.blue,
  },
  {
    emoji: "⚡", title: "Actions & XP",
    body: "Chaque action de ta vie réelle te rapporte de l'XP et des BL. Mange, dors, socialise — progresse.",
    accent: C.green,
  },
  {
    emoji: "👥", title: "Crews & Territoires",
    body: "Rejoins ou fonde un crew. Revendiquez des zones de Toulouse et défendez-les contre les autres crews.",
    accent: C.purple,
  },
  {
    emoji: "🏆", title: "Flash Events",
    body: "Des événements surgissent en temps réel dans Toulouse. Sois le premier à participer pour des récompenses rares.",
    accent: C.gold,
  },
];

export function OnboardingTour() {
  const tutorialDone    = useGameStore((s) => s.tutorialDone);
  const completeTutorial = useGameStore((s) => s.completeTutorial);
  const [step, setStep] = useState(0);
  const fadeAnim        = useRef(new Animated.Value(0)).current;
  const slideAnim       = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!tutorialDone) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, []);

  function goNext() {
    if (step < STEPS.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 20, duration: 0, useNativeDriver: true }),
      ]).start(() => {
        setStep((p) => p + 1);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      });
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        completeTutorial();
      });
    }
  }

  if (tutorialDone) return null;

  const current = STEPS[step];

  return (
    <Animated.View style={{
      position: "absolute", inset: 0, zIndex: 100,
      backgroundColor: "rgba(4,4,10,0.94)",
      alignItems: "center", justifyContent: "center",
      opacity: fadeAnim,
    }}>
      <Animated.View style={{
        width: "88%", maxWidth: 360,
        backgroundColor: C.bg, borderRadius: 24,
        padding: 32, alignItems: "center",
        borderWidth: 1, borderColor: current.accent + "35",
        shadowColor: current.accent, shadowOpacity: 0.3, shadowRadius: 30,
        transform: [{ translateY: slideAnim }],
      }}>
        {/* Step dots */}
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <View key={i} style={{
              width: i === step ? 20 : 6, height: 6, borderRadius: 3,
              backgroundColor: i === step ? current.accent : C.muted,
            }} />
          ))}
        </View>

        <Text style={{ fontSize: 52, marginBottom: 20 }}>{current.emoji}</Text>

        <Text style={{ color: current.accent, fontSize: 20, fontWeight: "900",
          textAlign: "center", letterSpacing: -0.5, marginBottom: 12 }}>
          {current.title}
        </Text>

        <Text style={{ color: C.soft, fontSize: 14, textAlign: "center",
          lineHeight: 22, marginBottom: 32 }}>
          {current.body}
        </Text>

        <Pressable onPress={goNext} style={{
          backgroundColor: current.accent + "20", borderRadius: 14,
          paddingVertical: 14, paddingHorizontal: 40,
          borderWidth: 1.5, borderColor: current.accent + "60",
          alignItems: "center", width: "100%",
        }}>
          <Text style={{ color: current.accent, fontSize: 15, fontWeight: "900", letterSpacing: 0.5 }}>
            {step < STEPS.length - 1 ? "Suivant →" : "C'est parti ⚡"}
          </Text>
        </Pressable>

        {step > 0 && (
          <Pressable onPress={() => completeTutorial()} style={{ marginTop: 16 }}>
            <Text style={{ color: C.muted, fontSize: 12 }}>Passer l'intro</Text>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}
