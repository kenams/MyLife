import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, Text, View } from "react-native";

const { width: W } = Dimensions.get("window");

const SLIDES = [
  {
    id: "intro",
    emoji: "🏙️",
    title: "Bienvenue dans MyLife",
    subtitle: "Simulation de vie",
    body: "Prends soin de ton personnage.\nChaque jour compte.",
    color: "#6366f1",
    bg: "#eef2ff",
  },
  {
    id: "needs",
    emoji: "⚡",
    title: "Surveille tes besoins",
    subtitle: "Faim · Énergie · Moral",
    body: "Mange, dors, reste propre.\nSinon ta vie se dégrade.",
    color: "#3b82f6",
    bg: "#eff6ff",
  },
  {
    id: "world",
    emoji: "🗺️",
    title: "Utilise la ville",
    subtitle: "Lieux utiles",
    body: "Marché, parc, travail, café.\nChaque lieu sert ton quotidien.",
    color: "#10b981",
    bg: "#ecfdf5",
  },
  {
    id: "missions",
    emoji: "🎯",
    title: "Reviens progresser",
    subtitle: "Missions · XP · Relations",
    body: "Garde ta vie stable.\nDébloque de meilleurs choix.",
    color: "#f59e0b",
    bg: "#fffbeb",
  },
  {
    id: "start",
    emoji: "🧑",
    title: "Crée ton avatar",
    subtitle: "Première étape",
    body: "Choisis ton style.\nPuis commence ta vie.",
    color: "#ec4899",
    bg: "#fdf2f8",
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
      backgroundColor: active ? color : color + "33",
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
      <View style={{ width: 110, height: 110, borderRadius: 55,
        backgroundColor: slide.color + "18",
        borderWidth: 3, borderColor: slide.color + "40",
        alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 52 }}>{slide.emoji}</Text>
      </View>

      <View style={{ alignItems: "center", gap: 6 }}>
        <Text style={{ color: slide.color, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 }}>
          {slide.subtitle.toUpperCase()}
        </Text>
        <Text style={{ color: "#1e2a3a", fontWeight: "900", fontSize: 28, textAlign: "center", lineHeight: 34 }}>
          {slide.title}
        </Text>
        <Text style={{ color: "#4a5568", fontSize: 15, textAlign: "center", lineHeight: 22, marginTop: 4 }}>
          {slide.body}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  function next() {
    if (current < SLIDES.length - 1) setCurrent((c) => c + 1);
    else router.push("/(auth)/sign-in");
  }

  return (
    <View style={{ flex: 1, backgroundColor: slide.bg }}>
      {/* Glow de fond */}
      <View style={{
        position: "absolute", top: -60, left: W / 2 - 150, width: 300, height: 300,
        borderRadius: 150, backgroundColor: slide.color + "10",
      }} />

      {/* Passer */}
      <Pressable onPress={() => router.push("/(auth)/sign-in")}
        style={{ position: "absolute", top: 52, right: 24, zIndex: 10 }}>
        <Text style={{ color: slide.color + "88", fontSize: 14, fontWeight: "600" }}>Passer</Text>
      </Pressable>

      {/* Slides */}
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        {SLIDES.map((s, i) => (
          <SlideView key={s.id} slide={s} index={i} currentIndex={current} />
        ))}
      </View>

      {/* Bas */}
      <View style={{ paddingHorizontal: 28, paddingBottom: 56, gap: 20, alignItems: "center" }}>
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
          shadowColor: slide.color, shadowOpacity: 0.3, shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 }, elevation: 6,
        }}>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 17 }}>
            {isLast ? "🚀 Créer mon avatar" : "Suivant →"}
          </Text>
        </Pressable>

        {/* Sign in */}
        <Pressable onPress={() => router.push("/(auth)/sign-in")}>
          <Text style={{ color: "#8fa3b8", fontSize: 13 }}>
            Déjà un compte ?{" "}
            <Text style={{ color: slide.color, fontWeight: "700" }}>Se connecter</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
