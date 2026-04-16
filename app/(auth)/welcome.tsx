import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/lib/theme";

const { width: W } = Dimensions.get("window");

const SLIDES = [
  {
    id: "intro",
    emoji: "🌆",
    title: "Bienvenue dans MyLife",
    subtitle: "La simulation de vie qui change la donne",
    body: "Un monde vivant, des vrais gens,\nta vie gamifiée en temps réel.",
    color: "#8b7cff",
    bg: "#0b0d1a",
  },
  {
    id: "stats",
    emoji: "⚡",
    title: "Tes stats sont réelles",
    subtitle: "Corps · Esprit · Social",
    body: "Faim, énergie, humeur, stress...\nTout évolue selon tes actions et l'heure réelle.",
    color: "#60a5fa",
    bg: "#07111f",
  },
  {
    id: "world",
    emoji: "🗺️",
    title: "Un village vivant",
    subtitle: "NPCs · Lieux · Ambiances nocturnes",
    body: "Café, gym, cinéma, club...\nLe monde change selon l'heure et la météo.",
    color: "#38c793",
    bg: "#07110f",
  },
  {
    id: "missions",
    emoji: "🎯",
    title: "Missions & Progression",
    subtitle: "XP · Niveaux · Talents",
    body: "Accomplis des quêtes, monte de niveau,\ndébloques des talents uniques.",
    color: "#f6b94f",
    bg: "#151005",
  },
  {
    id: "social",
    emoji: "👥",
    title: "Joue avec de vraies personnes",
    subtitle: "Rooms · Chat · Dates",
    body: "Rencontre des joueurs en live,\norganise des sorties, construis des relations.",
    color: "#c084fc",
    bg: "#130b1a",
  },
  {
    id: "start",
    emoji: "🚀",
    title: "Prêt à commencer ?",
    subtitle: "Ton aventure commence maintenant",
    body: "Crée ton avatar, définis ton style de vie,\net plonge dans MyLife.",
    color: "#ff6b6b",
    bg: "#150707",
  },
];

function Dot({ active, color }: { active: boolean; color: string }) {
  const scaleAnim = useRef(new Animated.Value(active ? 1 : 0.6)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: active ? 1 : 0.6, useNativeDriver: true, speed: 30 }).start();
  }, [active]);
  return (
    <Animated.View style={{
      width: active ? 20 : 6, height: 6, borderRadius: 3,
      backgroundColor: active ? color : "rgba(255,255,255,0.2)",
      transform: [{ scaleY: scaleAnim }],
    }} />
  );
}

function SlideView({ slide, index, currentIndex }: { slide: typeof SLIDES[0]; index: number; currentIndex: number }) {
  const translateX = useRef(new Animated.Value((index - currentIndex) * W)).current;
  const opacity    = useRef(new Animated.Value(index === currentIndex ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: (index - currentIndex) * W, duration: 380,
        easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: index === currentIndex ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [currentIndex]);

  return (
    <Animated.View style={{
      position: "absolute", width: W, paddingHorizontal: 28,
      alignItems: "center", gap: 16,
      transform: [{ translateX }], opacity,
    }}>
      <View style={{ width: 100, height: 100, borderRadius: 50,
        backgroundColor: slide.color + "20", borderWidth: 2.5, borderColor: slide.color + "60",
        alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 50 }}>{slide.emoji}</Text>
      </View>

      <View style={{ alignItems: "center", gap: 6 }}>
        <Text style={{ color: slide.color, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 }}>
          {slide.subtitle.toUpperCase()}
        </Text>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28, textAlign: "center", lineHeight: 34 }}>
          {slide.title}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, textAlign: "center", lineHeight: 22, marginTop: 4 }}>
          {slide.body}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];
  const bgAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bgAnim, { toValue: current, duration: 400, useNativeDriver: false }).start();
  }, [current]);

  function next() {
    if (current < SLIDES.length - 1) setCurrent((c) => c + 1);
    else router.push("/(auth)/sign-in");
  }

  function skip() {
    router.push("/(auth)/sign-in");
  }

  const isLast = current === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: slide.bg }}>
      {/* Animated background glow */}
      <View style={{
        position: "absolute", top: -100, left: W / 2 - 150, width: 300, height: 300,
        borderRadius: 150, backgroundColor: slide.color + "15",
      }} />

      {/* Skip */}
      <Pressable onPress={skip} style={{ position: "absolute", top: 52, right: 24, zIndex: 10 }}>
        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: "600" }}>Passer</Text>
      </Pressable>

      {/* Slides */}
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        {SLIDES.map((s, i) => (
          <SlideView key={s.id} slide={s} index={i} currentIndex={current} />
        ))}
      </View>

      {/* Bottom */}
      <View style={{ paddingHorizontal: 28, paddingBottom: 56, gap: 24, alignItems: "center" }}>

        {/* Dots */}
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {SLIDES.map((s, i) => (
            <Pressable key={s.id} onPress={() => setCurrent(i)}>
              <Dot active={i === current} color={slide.color} />
            </Pressable>
          ))}
        </View>

        {/* CTA */}
        <Pressable onPress={next} style={{
          width: "100%", paddingVertical: 18, borderRadius: 18,
          backgroundColor: slide.color,
          alignItems: "center",
          shadowColor: slide.color, shadowOpacity: 0.5, shadowRadius: 16,
        }}>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 17 }}>
            {isLast ? "🚀 Créer mon avatar" : "Suivant →"}
          </Text>
        </Pressable>

        {/* Sign in link */}
        <Pressable onPress={() => router.push("/(auth)/sign-in")}>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            Déjà un compte ? <Text style={{ color: slide.color, fontWeight: "700" }}>Se connecter</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
