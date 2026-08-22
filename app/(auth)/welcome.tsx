import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, Text, View } from "react-native";

const { width: W, height: H } = Dimensions.get("window");

const SLIDES = [
  {
    id:       "intro",
    icon:     "🏙️",
    tag:      "TOULOUSE DEVIENT UN JEU",
    title:    "Ta vraie vie,\nta progression",
    body:     "Vois ce qui se passe près de toi.\nSors, rencontre, gagne de la réputation.",
    accent:   "#FFD600",
    glow:     "rgba(255,214,0,0.18)",
    dim:      "#1A1500",
  },
  {
    id:       "needs",
    icon:     "⚡",
    tag:      "TON PROFIL ÉVOLUE",
    title:    "Social, forme,\nstyle, influence",
    body:     "Chaque action utile fait monter ton niveau, tes BL et ta réputation.",
    accent:   "#FF6B00",
    glow:     "rgba(255,107,0,0.18)",
    dim:      "#1A0D00",
  },
  {
    id:       "world",
    icon:     "🗺️",
    tag:      "LIFE MAP TOULOUSE",
    title:    "Une carte vivante,\njamais intrusive",
    body:     "Tu apparais seulement si tu l'actives.\nLes autres voient une zone, pas ta position exacte.",
    accent:   "#00B4FF",
    glow:     "rgba(0,180,255,0.18)",
    dim:      "#001A2A",
  },
  {
    id:       "social",
    icon:     "👥",
    tag:      "RENCONTRES CONSENTIES",
    title:    "Salut, feeling,\nactivité publique",
    body:     "Le chat s'ouvre quand l'échange est accepté.\nLes crews construisent la ville ensemble.",
    accent:   "#BF5FFF",
    glow:     "rgba(191,95,255,0.18)",
    dim:      "#18082A",
  },
  {
    id:       "start",
    icon:     "🧢",
    tag:      "PREMIÈRE MISSION",
    title:    "Choisis ton quartier,\npuis joue",
    body:     "Après l'inscription, une mission simple te donne ta première action.",
    accent:   "#39FF14",
    glow:     "rgba(57,255,20,0.18)",
    dim:      "#091A03",
  },
];

function Dot({ active, color }: { active: boolean; color: string }) {
  const w = useRef(new Animated.Value(active ? 24 : 6)).current;
  useEffect(() => {
    Animated.spring(w, { toValue: active ? 24 : 6, useNativeDriver: false, speed: 40 }).start();
  }, [active]);
  return (
    <Animated.View style={{
      width: w, height: 4, borderRadius: 2,
      backgroundColor: active ? color : "rgba(255,255,255,0.15)",
    }} />
  );
}

function SlideView({ slide, index, currentIndex }: { slide: typeof SLIDES[0]; index: number; currentIndex: number }) {
  const tx  = useRef(new Animated.Value((index - currentIndex) * W)).current;
  const op  = useRef(new Animated.Value(index === currentIndex ? 1 : 0)).current;
  const scl = useRef(new Animated.Value(index === currentIndex ? 1 : 0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(tx,  { toValue: (index - currentIndex) * W, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(op,  { toValue: index === currentIndex ? 1 : 0, duration: 260, useNativeDriver: true }),
      Animated.spring(scl, { toValue: index === currentIndex ? 1 : 0.92, speed: 30, useNativeDriver: true }),
    ]).start();
  }, [currentIndex]);

  return (
    <Animated.View style={{
      position: "absolute", width: W, paddingHorizontal: 32,
      alignItems: "flex-start",
      transform: [{ translateX: tx }, { scale: scl }], opacity: op,
    }}>
      {/* Icon block */}
      <View style={{
        width: 88, height: 88, borderRadius: 24,
        backgroundColor: slide.dim,
        borderWidth: 1.5, borderColor: slide.accent + "40",
        alignItems: "center", justifyContent: "center",
        marginBottom: 28,
        shadowColor: slide.accent, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
      }}>
        <Text style={{ fontSize: 44 }}>{slide.icon}</Text>
      </View>

      {/* Tag */}
      <View style={{
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
        backgroundColor: slide.accent + "15",
        borderWidth: 1, borderColor: slide.accent + "30",
        marginBottom: 14,
      }}>
        <Text style={{ color: slide.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>
          {slide.tag}
        </Text>
      </View>

      {/* Title */}
      <Text style={{
        color: "#F5F2E8",
        fontSize: 40,
        fontWeight: "900",
        lineHeight: 46,
        letterSpacing: -0.5,
        marginBottom: 16,
      }}>
        {slide.title}
      </Text>

      {/* Body */}
      <Text style={{ color: "#7A776E", fontSize: 16, lineHeight: 24, fontWeight: "500" }}>
        {slide.body}
      </Text>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const [current, setCurrent] = useState(0);
  const slide  = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const bgAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(bgAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start(() => bgAnim.setValue(0));
  }, [current]);

  function next() {
    if (current < SLIDES.length - 1) setCurrent((c) => c + 1);
    else router.push("/(auth)/sign-in");
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#080808" }}>

      {/* Ambient glow top-left */}
      <View style={{
        position: "absolute", top: -80, left: -60, width: 280, height: 280,
        borderRadius: 140, backgroundColor: slide.glow,
      }} />
      {/* Grain texture overlay via dots */}
      <View style={{
        position: "absolute", bottom: H * 0.3, right: -40, width: 200, height: 200,
        borderRadius: 100, backgroundColor: slide.accent + "08",
      }} />

      {/* Numéro slide — coin haut droit */}
      <View style={{ position: "absolute", top: 54, right: 24, zIndex: 10,
        flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ color: slide.accent, fontWeight: "900", fontSize: 15 }}>
          {String(current + 1).padStart(2, "0")}
        </Text>
        <Text style={{ color: "#2A2A28", fontWeight: "700", fontSize: 15 }}>
          / {String(SLIDES.length).padStart(2, "0")}
        </Text>
      </View>

      {/* Skip */}
      <Pressable onPress={() => router.push("/(auth)/sign-in")}
        style={{ position: "absolute", top: 54, left: 24, zIndex: 10 }}>
        <Text style={{ color: "#3A3835", fontSize: 13, fontWeight: "700", letterSpacing: 0.5 }}>PASSER</Text>
      </Pressable>

      {/* Slides */}
      <View style={{ flex: 1, justifyContent: "center", paddingTop: 40 }}>
        {SLIDES.map((s, i) => (
          <SlideView key={s.id} slide={s} index={i} currentIndex={current} />
        ))}
      </View>

      {/* Bottom */}
      <View style={{ paddingHorizontal: 28, paddingBottom: 52, gap: 24 }}>
        {/* Dots */}
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {SLIDES.map((s, i) => (
            <Pressable key={s.id} onPress={() => setCurrent(i)}>
              <Dot active={i === current} color={slide.accent} />
            </Pressable>
          ))}
        </View>

        {/* CTA */}
        <Pressable onPress={next} style={{
          width: "100%", paddingVertical: 20, borderRadius: 16,
          backgroundColor: slide.accent,
          alignItems: "center",
          shadowColor: slide.accent, shadowOpacity: 0.4, shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
        }}>
          <Text style={{ color: "#080808", fontWeight: "900", fontSize: 16, letterSpacing: 0.5 }}>
            {isLast ? "CRÉER MON PERSO →" : "SUIVANT →"}
          </Text>
        </Pressable>

        {/* Sign in */}
        <Pressable onPress={() => router.push("/(auth)/sign-in")}
          style={{ alignItems: "center" }}>
          <Text style={{ color: "#3A3835", fontSize: 13, fontWeight: "600" }}>
            Déjà dans le game ?{" "}
            <Text style={{ color: slide.accent, fontWeight: "800" }}>Connexion</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
