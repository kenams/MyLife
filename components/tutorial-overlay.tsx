import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

type Step = {
  emoji: string;
  title: string;
  body: string;
  hint: string;
  color: string;
};

const STEPS: Step[] = [
  {
    emoji: "👋",
    title: "Bienvenue dans MyLife !",
    body: "Tu viens de créer ton avatar. Ici, ta vie est un jeu — chaque action impacte tes stats en temps réel.",
    hint: "Les cercles colorés en haut = ton état de vie actuel",
    color: "#8b7cff",
  },
  {
    emoji: "⚡",
    title: "Agis pour progresser",
    body: "Chaque bouton d'action (Dormir, Manger, Travailler…) modifie tes stats immédiatement. L'heure réelle influence les résultats.",
    hint: "Les actions en surbrillance = recommandées maintenant",
    color: "#f6b94f",
  },
  {
    emoji: "🏙️",
    title: "Explore la ville",
    body: "L'onglet Ville te place sur la carte. Déplace-toi dans les lieux, rencontre les résidents, organise des sorties.",
    hint: "Onglet Ville → bâtiments interactifs + NPCs en live",
    color: "#38c793",
  },
  {
    emoji: "💬",
    title: "Chat & Relations",
    body: "L'onglet Chat regroupe tes conversations avec les résidents et les rooms de groupe. Plus tu interagis, plus les liens progressent.",
    hint: "Swipe dans Discover pour matcher avec des profils",
    color: "#60a5fa",
  },
  {
    emoji: "🎯",
    title: "Objectifs quotidiens",
    body: "L'onglet Objectifs contient tes missions du jour et tes notifications. Complète-les pour gagner XP et progresser de niveau.",
    hint: "Les missions se renouvellent chaque jour à minuit",
    color: "#f472b6",
  },
  {
    emoji: "🚀",
    title: "C'est parti !",
    body: "Tu as tout ce qu'il faut. Lance ta première action, explore la ville et construis ta vie.\n\nCoach ARIA est là si tu as des questions.",
    hint: "Bonne chance — et joue régulièrement pour voir évoluer ta vie 🎮",
    color: colors.accent,
  },
];

export function TutorialOverlay() {
  const completeTutorial = useGameStore((s) => s.completeTutorial);
  const [step, setStep] = useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(bgAnim,    { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    fadeAnim.setValue(0.6);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [step]);

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  function next() {
    if (isLast) {
      Animated.timing(bgAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => completeTutorial());
    } else {
      setStep((s) => s + 1);
    }
  }

  function skip() {
    completeTutorial();
  }

  return (
    <Animated.View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(4,8,16,0.88)",
      zIndex: 999,
      opacity: bgAnim,
      justifyContent: "flex-end",
    }}>
      {/* Skip */}
      <Pressable onPress={skip} style={{ position: "absolute", top: 56, right: 20 }}>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: "600" }}>Passer</Text>
      </Pressable>

      {/* Progress dots */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 20 }}>
        {STEPS.map((_, i) => (
          <View key={i} style={{
            width: i === step ? 20 : 7, height: 7, borderRadius: 4,
            backgroundColor: i === step ? current.color : i < step ? current.color + "60" : "rgba(255,255,255,0.15)",
          }} />
        ))}
      </View>

      {/* Card */}
      <Animated.View style={{
        margin: 16, marginBottom: 36,
        backgroundColor: "#0a1020",
        borderRadius: 24, padding: 24,
        borderWidth: 1, borderColor: current.color + "40",
        shadowColor: current.color, shadowOpacity: 0.2, shadowRadius: 20,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}>
        {/* Icon */}
        <View style={{ width: 64, height: 64, borderRadius: 20,
          backgroundColor: current.color + "20", borderWidth: 2, borderColor: current.color + "50",
          alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 32 }}>{current.emoji}</Text>
        </View>

        {/* Step counter */}
        <Text style={{ color: current.color, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 }}>
          ÉTAPE {step + 1} / {STEPS.length}
        </Text>

        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20, marginBottom: 10, lineHeight: 26 }}>
          {current.title}
        </Text>
        <Text style={{ color: colors.textSoft, fontSize: 14, lineHeight: 21, marginBottom: 16 }}>
          {current.body}
        </Text>

        {/* Hint */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12,
          backgroundColor: current.color + "12", borderRadius: 12, borderWidth: 1, borderColor: current.color + "30",
          marginBottom: 20 }}>
          <Ionicons name="bulb-outline" size={15} color={current.color} />
          <Text style={{ color: current.color, fontSize: 12, flex: 1, fontWeight: "600" }}>{current.hint}</Text>
        </View>

        {/* CTA */}
        <Pressable onPress={next} style={{
          backgroundColor: current.color,
          borderRadius: 16, padding: 16,
          alignItems: "center",
          shadowColor: current.color, shadowOpacity: 0.4, shadowRadius: 12,
        }}>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
            {isLast ? "C'est parti ! 🚀" : "Suivant →"}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
