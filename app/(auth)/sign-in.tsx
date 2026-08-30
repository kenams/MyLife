import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Easing, KeyboardAvoidingView, Platform, Pressable, SafeAreaView,
  ScrollView, Text, TextInput, View,
} from "react-native";
import { useGameStore } from "@/stores/game-store";
import { ACTIVE_CITY } from "@/lib/city-config";

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  void:    "#040408",
  deep:    "#08080F",
  glass:   "#0C0C14",
  surface: "#10101A",
  text:    "#E8E4DC",
  dim:     "#7A7670",
  ghost:   "#2A2830",
  border:  "rgba(255,255,255,0.05)",
  // Néons
  gold:    "#FFD600",
  goldDim: "#3D3200",
  green:   "#39FF14",
  purple:  "#BF5FFF",
  red:     "#FF3B3B",
  blue:    "#00B4FF",
  teal:    "#00FFD1",
  pink:    "#FF2D78",
};

// ── Scanline d'entrée (sweep vertical unique) ──────────────────────────────────
function ScanLine() {
  const y   = useRef(new Animated.Value(-5)).current;
  const op  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(y, {
          toValue: 110, duration: 1200,
          easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
        }),
      ]),
      Animated.timing(op, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", left: 0, right: 0,
        height: 2,
        top: `0%` as `${number}%`,
        transform: [{ translateY: y.interpolate({ inputRange: [0, 110], outputRange: ["0%" as unknown as number, "110%" as unknown as number] }) }],
        opacity: op,
        zIndex: 99,
        backgroundColor: C.gold,
        shadowColor: C.gold,
        shadowOpacity: 1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

// ── Particules ascendantes ────────────────────────────────────────────────────
function Spark({ x, size, delay, color }: { x: number; size: number; delay: number; color: string }) {
  const y  = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(y,  { toValue: -160, duration: 5000, easing: Easing.linear, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(op, { toValue: 0.8, duration: 500, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(y,  { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      position: "absolute",
      bottom: 0,
      left: `${x}%` as `${number}%`,
      width: size, height: size * (Math.random() * 3 + 1),
      borderRadius: 1,
      backgroundColor: color,
      opacity: op,
      transform: [{ translateY: y }],
    }} />
  );
}

const SPARKS = [
  { x: 5,  size: 1.5, delay: 0,    color: C.gold  },
  { x: 18, size: 1,   delay: 800,  color: C.green },
  { x: 30, size: 2,   delay: 300,  color: C.gold  },
  { x: 43, size: 1,   delay: 1500, color: C.purple},
  { x: 55, size: 1.5, delay: 600,  color: C.gold  },
  { x: 68, size: 1,   delay: 1100, color: C.green },
  { x: 77, size: 2,   delay: 200,  color: C.gold  },
  { x: 88, size: 1.5, delay: 900,  color: C.blue  },
  { x: 12, size: 1,   delay: 1700, color: C.green },
  { x: 95, size: 1,   delay: 400,  color: C.gold  },
];

// ── Titre lettre par lettre ───────────────────────────────────────────────────
const TITLE_LETTERS = [
  { char: "M", color: C.text,  delay: 300  },
  { char: "Y", color: C.text,  delay: 420  },
  { char: "·", color: C.ghost, delay: 520  },
  { char: "L", color: C.gold,  delay: 600  },
  { char: "I", color: C.gold,  delay: 700  },
  { char: "F", color: C.gold,  delay: 800  },
  { char: "E", color: C.gold,  delay: 900  },
];

function TitleLetter({ char, color, delay }: { char: string; color: string; delay: number }) {
  const y  = useRef(new Animated.Value(-50)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(y,  { toValue: 0, tension: 160, friction: 12, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  return (
    <Animated.Text style={{
      color, opacity: op, transform: [{ translateY: y }],
      fontSize: 52, fontWeight: "900", letterSpacing: -1,
      textShadowColor: color === C.gold ? C.gold : "transparent",
      textShadowRadius: color === C.gold ? 12 : 0,
      textShadowOffset: { width: 0, height: 0 },
    }}>
      {char}
    </Animated.Text>
  );
}

// ── Quote NPC ─────────────────────────────────────────────────────────────────
const QUOTES = [
  { text: "Capitole ce soir ?", name: "Jok'air ✓",    emoji: "🎤", color: C.purple },
  { text: "Café ouvert là ?",   name: "Yasmine.SD",   emoji: "🌸", color: C.teal   },
  { text: "Viens au stade 🏆",  name: "Bilal.Coach",  emoji: "⚽", color: C.green  },
  { text: "La ville dort jamais", name: "Céline.Night", emoji: "🎭", color: C.blue   },
  { text: "Son envoyé à 3h",    name: "Moussa.Beat",  emoji: "🎧", color: C.gold   },
];
function NpcQuote() {
  const [idx, setIdx] = useState(0);
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setInterval(() => {
      Animated.sequence([
        Animated.timing(op, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
      setIdx(i => (i + 1) % QUOTES.length);
    }, 3800);
    return () => clearInterval(t);
  }, []);
  const q = QUOTES[idx];
  return (
    <Animated.View style={{ opacity: op, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: q.color + "20",
        borderWidth: 1, borderColor: q.color + "40",
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: 14 }}>{q.emoji}</Text>
      </View>
      <View>
        <Text style={{ color: q.color, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>
          {q.name.toUpperCase()}
        </Text>
        <Text style={{ color: C.dim, fontSize: 12 }}>"{q.text}"</Text>
      </View>
    </Animated.View>
  );
}

// ── Live counter (léger flicker organique) ───────────────────────────────────
function LiveCount({ base }: { base: number }) {
  const [n, setN] = useState(base);
  useEffect(() => {
    const t = setInterval(() => {
      setN(v => Math.max(base - 4, Math.min(base + 6, v + (Math.random() > 0.5 ? 1 : -1))));
    }, 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <Text style={{ color: C.ghost, fontSize: 8, fontWeight: "700" }}>
      {n} ACTIFS
    </Text>
  );
}

// ── NPC Strip (character select) ──────────────────────────────────────────────
const NPC_STRIP = [
  { emoji: "🎤", name: "Jok'air",  status: "vibe",   color: C.purple, level: 99 },
  { emoji: "🌸", name: "Yasmine",  status: "libre",  color: C.teal,   level: 8  },
  { emoji: "⚽", name: "Bilal",    status: "libre",  color: C.green,  level: 15 },
  { emoji: "🎭", name: "Céline",   status: "ghost",  color: C.blue,   level: 12 },
  { emoji: "🎧", name: "Moussa",   status: "libre",  color: C.gold,   level: 4  },
  { emoji: "🖼️", name: "Inès",    status: "vibe",   color: C.pink,   level: 11 },
];

function NpcChip({ emoji, name, color, level, idx }: {
  emoji: string; name: string; color: string; level: number; idx: number;
}) {
  const op = useRef(new Animated.Value(0)).current;
  const x  = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(1400 + idx * 100),
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(x,  { toValue: 0, tension: 200, friction: 20, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: op, transform: [{ translateX: x }] }}>
      <View style={{
        alignItems: "center", gap: 6, width: 60,
      }}>
        <View style={{
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: color + "18",
          borderWidth: 2, borderColor: color + "50",
          alignItems: "center", justifyContent: "center",
          shadowColor: color, shadowOpacity: 0.4, shadowRadius: 8,
        }}>
          <Text style={{ fontSize: 24 }}>{emoji}</Text>
        </View>
        <Text style={{ color: C.dim, fontSize: 9, fontWeight: "700", textAlign: "center" }}>
          {name}
        </Text>
        <View style={{
          backgroundColor: color + "20", borderRadius: 4,
          paddingHorizontal: 5, paddingVertical: 2,
          borderWidth: 1, borderColor: color + "30",
        }}>
          <Text style={{ color, fontSize: 8, fontWeight: "900" }}>Niv.{level}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────
function FieldInput({ value, onChange, placeholder, secure, icon, keyboard, autoComplete, textContentType, returnKeyType, onSubmitEditing }: {
  value: string; onChange: (t: string) => void; placeholder: string;
  secure?: boolean; icon: string; keyboard?: "email-address" | "default";
  autoComplete?: "email" | "username" | "password" | "password-new" | "off";
  textContentType?: "emailAddress" | "username" | "password" | "newPassword" | "none";
  returnKeyType?: "next" | "go" | "done";
  onSubmitEditing?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const accent = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(accent, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [focused]);
  const leftBorder = accent.interpolate({ inputRange: [0, 1], outputRange: ["#2A2830", C.gold] });
  const bgAnim     = accent.interpolate({ inputRange: [0, 1], outputRange: [C.glass, "#14120A"] });
  return (
    <Animated.View style={{
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      backgroundColor: bgAnim,
      flexDirection: "row", alignItems: "center",
      overflow: "hidden",
    }}>
      {/* Left accent bar */}
      <Animated.View style={{ width: 3, alignSelf: "stretch", backgroundColor: leftBorder }} />
      <Text style={{ fontSize: 15, marginLeft: 14, marginRight: 10, opacity: focused ? 1 : 0.4 }}>{icon}</Text>
      <TextInput
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={C.ghost}
        secureTextEntry={secure} autoCapitalize="none" autoCorrect={false}
        keyboardType={keyboard}
        autoComplete={autoComplete}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={returnKeyType === "go" || returnKeyType === "done"}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          flex: 1, color: C.text,
          // ≥ 16px sur le web : empêche le zoom automatique de Safari iOS au focus.
          fontSize: Platform.OS === "web" ? 16 : 15,
          paddingVertical: 16, paddingRight: 16,
          fontWeight: "600",
          ...(Platform.OS === "web" ? { outlineWidth: 0 } as object : {}),
        }}
      />
    </Animated.View>
  );
}

// ── CTA Button ───────────────────────────────────────────────────────────────
function EnterBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.5, duration: 1500, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0.15, duration: 1500, useNativeDriver: false }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      transform: [{ scale }],
      shadowColor: C.gold, shadowOpacity: glow as unknown as number, shadowRadius: 24,
    }}>
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
        onPress={onPress}
        disabled={disabled}
        style={{
          backgroundColor: disabled ? C.ghost : C.gold,
          borderRadius: 14, paddingVertical: 18,
          alignItems: "center", justifyContent: "center",
          opacity: disabled ? 0.5 : 1,
          flexDirection: "row", gap: 10,
        }}
      >
        {!disabled && <Text style={{ fontSize: 16 }}>🌆</Text>}
        <Text style={{
          color: disabled ? C.dim : "#080808",
          fontWeight: "900", fontSize: 16, letterSpacing: 1.5,
        }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Access Card ──────────────────────────────────────────────────────────────
function AccessCard({ emoji, title, sub, color, onPress, idx }: {
  emoji: string; title: string; sub: string; color: string; onPress: () => void; idx: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const op    = useRef(new Animated.Value(0)).current;
  const y     = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(100 + idx * 80),
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(y,  { toValue: 0, tension: 180, friction: 18, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: op, transform: [{ translateY: y }, { scale }] }}>
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
        onPress={onPress}
        style={{
          backgroundColor: C.surface,
          borderRadius: 14, padding: 14,
          borderWidth: 1, borderColor: color + "20",
          flexDirection: "row", alignItems: "center", gap: 12,
        }}
      >
        <View style={{
          width: 46, height: 46, borderRadius: 23,
          backgroundColor: color + "12",
          borderWidth: 1.5, borderColor: color + "35",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 21 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 13, fontWeight: "800" }}>{title}</Text>
          <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{sub}</Text>
        </View>
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: color + "15",
          borderWidth: 1, borderColor: color + "30",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ color, fontSize: 12, fontWeight: "900" }}>→</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
type Tab = "signin" | "signup" | "reset";

export default function SignInScreen() {
  const signIn          = useGameStore(s => s.signIn);
  const signUp          = useGameStore(s => s.signUp);
  const resetPassword   = useGameStore(s => s.resetPassword);
  const loadTestAccount = useGameStore(s => s.loadTestAccount);

  const [tab,      setTab]      = useState<Tab>("signin");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [loading,  setLoading]  = useState(false);

  // Staggered global fade-in
  const mainOp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mainOp, { toValue: 1, duration: 800, delay: 100, useNativeDriver: true }).start();
  }, []);

  function clear() { setError(""); setSuccess(""); }

  async function handleSignIn() {
    clear();
    if (!email) { setError("Pseudo requis."); return; }
    setLoading(true);
    const r = await signIn(email, password || undefined);
    setLoading(false);
    if (!r.ok) { setError(r.error ?? "Connexion impossible."); return; }
    router.replace(useGameStore.getState().avatar ? "/(app)/(tabs)/map" : "/(auth)/avatar");
  }

  async function handleSignUp() {
    clear();
    if (!email || !password) { setError("Email et mot de passe requis."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const r = await signUp(email, password);
    setLoading(false);
    if (!r.ok) { setError(r.error ?? "Inscription impossible."); return; }
    setSuccess("Compte créé ✓  Vérifie ton email.");
    setTab("signin");
  }

  async function handleReset() {
    clear();
    if (!email) { setError("Email requis."); return; }
    setLoading(true);
    const r = await resetPassword(email);
    setLoading(false);
    if (!r.ok) { setError(r.error ?? "Impossible d'envoyer le lien."); return; }
    setSuccess("Lien envoyé ✓  Vérifie ta boîte mail.");
  }

  function enter(preset: "balanced" | "burnout" | "romantic" | "live" = "balanced") {
    clear(); loadTestAccount(preset);
    router.replace("/(app)/(tabs)/map");
  }
  async function quickTest() {
    clear(); setLoading(true);
    const r = await signIn("test@mylife.app", "test1234");
    setLoading(false);
    if (!r.ok) { setError(r.error ?? "Compte test indisponible."); return; }
    router.replace("/(app)/(tabs)/map");
  }

  const ctaLabel: Record<Tab, string> = {
    signin: loading ? "CONNEXION..." : "ENTRER DANS LA VILLE",
    signup: loading ? "CRÉATION..." : "CRÉER MON COMPTE",
    reset:  loading ? "ENVOI..." : "ENVOYER LE LIEN",
  };
  function ctaAction() {
    if (tab === "signin") void handleSignIn();
    else if (tab === "signup") void handleSignUp();
    else void handleReset();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.void }}>

      {/* ── Décor fond ── */}
      <View style={{ position: "absolute", inset: 0, overflow: "hidden" }} pointerEvents="none">
        {/* Ghost text — initiale de la ville active */}
        <Text style={{
          position: "absolute", bottom: -20, right: -40,
          fontSize: 180, fontWeight: "900",
          color: "transparent",
          letterSpacing: -8,
          // Simulated outline text via text-shadow (web)
          ...(Platform.OS === "web" ? {
            WebkitTextStroke: "1px rgba(255,214,0,0.04)",
          } as object : { color: "rgba(255,214,0,0.03)" }),
        }} selectable={false}>
          {ACTIVE_CITY.name.slice(0, 2).toUpperCase()}
        </Text>
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={{
            position: "absolute",
            left: `${i * 25}%` as `${number}%`,
            top: 0, bottom: 0, width: 1,
            backgroundColor: "rgba(255,255,255,0.012)",
          }} />
        ))}
        {/* Glow spot top */}
        <View style={{
          position: "absolute", top: -80, left: "30%",
          width: 300, height: 300, borderRadius: 150,
          backgroundColor: C.gold + "04",
        }} />
        {/* Sparks */}
        {SPARKS.map((s, i) => <Spark key={i} {...s} />)}
      </View>

      {/* ── Scanline ── */}
      <ScanLine />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: 44, paddingBottom: 80, maxWidth: 520, width: "100%", alignSelf: "center" }}
      >
        {/* ── HEADER BADGE ── */}
        <Animated.View style={{ opacity: mainOp, paddingHorizontal: 24, marginBottom: 8, marginTop: 8 }}>
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 8,
            alignSelf: "flex-start",
          }}>
            <View style={{
              backgroundColor: C.goldDim, borderRadius: 6,
              paddingHorizontal: 8, paddingVertical: 4,
              borderWidth: 1, borderColor: C.gold + "25",
              flexDirection: "row", alignItems: "center", gap: 5,
            }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green,
                shadowColor: C.green, shadowOpacity: 1, shadowRadius: 4 }} />
              <Text style={{ color: C.gold, fontSize: 8, fontWeight: "900", letterSpacing: 2 }}>
                {ACTIVE_CITY.displayName.toUpperCase()}
              </Text>
            </View>
            <LiveCount base={21} />
          </View>
        </Animated.View>

        {/* ── TITRE ANIMÉ ── */}
        <View style={{ paddingHorizontal: 24, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 0 }}>
            {TITLE_LETTERS.map((l, i) => <TitleLetter key={i} {...l} />)}
          </View>
          <Animated.View style={{ opacity: mainOp, marginTop: 4, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ color: C.dim, fontSize: 11, letterSpacing: 4, fontWeight: "700" }}>
              {ACTIVE_CITY.name.toUpperCase()} · VRAI · VIVANT
            </Text>
          </Animated.View>
        </View>

        {/* ── NPC STRIP ── */}
        <Animated.View style={{ opacity: mainOp, marginBottom: 28 }}>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}
          >
            {NPC_STRIP.map((n, i) => (
              <NpcChip key={i} {...n} idx={i} />
            ))}
            <Animated.View style={{ opacity: mainOp, width: 60, alignItems: "center", gap: 6, justifyContent: "center" }}>
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                borderWidth: 2, borderColor: C.ghost, borderStyle: "dashed",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ color: C.ghost, fontSize: 22 }}>+</Text>
              </View>
              <Text style={{ color: C.ghost, fontSize: 9, fontWeight: "700" }}>Toi</Text>
            </Animated.View>
          </ScrollView>
        </Animated.View>

        {/* ── NPC QUOTE ── */}
        <Animated.View style={{ opacity: mainOp, paddingHorizontal: 24, marginBottom: 24 }}>
          <NpcQuote />
        </Animated.View>

        {/* ── FORM CARD ── */}
        <Animated.View style={{ opacity: mainOp, marginHorizontal: 24, marginBottom: 16 }}>
          <View style={{
            backgroundColor: C.glass,
            borderRadius: 20,
            borderWidth: 1, borderColor: C.border,
            overflow: "hidden",
          }}>
            {/* Top color stripe */}
            <View style={{ height: 3, backgroundColor: C.gold, opacity: 0.7 }} />

            <View style={{ padding: 20, gap: 0 }}>
              {/* Tabs */}
              <View style={{ flexDirection: "row", gap: 2, marginBottom: 18 }}>
                {(["signin", "signup", "reset"] as Tab[]).map(t => {
                  const active = tab === t;
                  const labels: Record<Tab, string> = { signin: "CONNEXION", signup: "INSCRIPTION", reset: "OUBLI" };
                  return (
                    <Pressable
                      key={t}
                      onPress={() => { setTab(t); clear(); }}
                      style={{
                        flex: 1, paddingVertical: 10, alignItems: "center",
                        borderBottomWidth: active ? 2 : 1,
                        borderBottomColor: active ? C.gold : C.border,
                      }}
                    >
                      <Text style={{
                        color: active ? C.gold : C.ghost,
                        fontSize: 9, fontWeight: "900", letterSpacing: 1,
                      }}>
                        {labels[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Fields */}
              <View style={{ gap: 10, marginBottom: 14 }}>
                {tab === "signin" ? (
                  <FieldInput
                    value={email} onChange={setEmail}
                    placeholder="@TonPseudo ou email" icon="🏷️"
                    autoComplete="username" textContentType="username"
                    returnKeyType="next"
                  />
                ) : (
                  <FieldInput
                    value={email} onChange={setEmail}
                    placeholder="ton@email.com" icon="✉️" keyboard="email-address"
                    autoComplete="email" textContentType="emailAddress"
                    returnKeyType={tab === "reset" ? "go" : "next"}
                    onSubmitEditing={tab === "reset" ? ctaAction : undefined}
                  />
                )}
                {tab !== "reset" && (
                  <FieldInput
                    value={password} onChange={setPassword}
                    placeholder="Mot de passe" icon="🔑" secure
                    autoComplete={tab === "signup" ? "password-new" : "password"}
                    textContentType={tab === "signup" ? "newPassword" : "password"}
                    returnKeyType={tab === "signin" ? "go" : "next"}
                    onSubmitEditing={tab === "signin" ? ctaAction : undefined}
                  />
                )}
                {tab === "signup" && (
                  <FieldInput
                    value={confirm} onChange={setConfirm}
                    placeholder="Confirme" icon="🔒" secure
                    autoComplete="password-new" textContentType="newPassword"
                    returnKeyType="go" onSubmitEditing={ctaAction}
                  />
                )}
              </View>

              {/* Messages */}
              {!!error && (
                <View style={{
                  backgroundColor: C.red + "12", borderRadius: 10, padding: 11,
                  borderWidth: 1, borderColor: C.red + "25",
                  flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12,
                }}>
                  <Text style={{ fontSize: 12 }}>⚠</Text>
                  <Text style={{ color: C.red, fontSize: 12, flex: 1 }}>{error}</Text>
                </View>
              )}
              {!!success && (
                <View style={{
                  backgroundColor: C.green + "10", borderRadius: 10, padding: 11,
                  borderWidth: 1, borderColor: C.green + "25",
                  flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12,
                }}>
                  <Text style={{ fontSize: 12 }}>✓</Text>
                  <Text style={{ color: C.green, fontSize: 12, flex: 1 }}>{success}</Text>
                </View>
              )}

              {/* CTA */}
              <EnterBtn label={ctaLabel[tab]} onPress={ctaAction} disabled={loading} />
            </View>
          </View>
        </Animated.View>

        {/* Raccourcis locaux : absents des builds et previews de production. */}
        {__DEV__ && tab === "signin" && (
          <Animated.View style={{ opacity: mainOp, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Text style={{ color: C.ghost, fontSize: 9, fontWeight: "900", letterSpacing: 2 }}>
                OUTILS LOCAUX
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>
            <View style={{ gap: 8 }}>
              <AccessCard idx={0} emoji="🧢" color={C.gold}
                title="[DEV] Profil test — local, pas Supabase" sub="Équilibré · Niv.8"
                onPress={() => enter("balanced")} />
              <AccessCard idx={1} emoji="🔥" color={C.red}
                title="[DEV] Mode pression" sub="Stats critiques · survie"
                onPress={() => enter("burnout")} />
              <AccessCard idx={2} emoji="💕" color={C.purple}
                title="[DEV] Mode social" sub="Relations · dates · réseau"
                onPress={() => enter("romantic")} />
              <AccessCard idx={3} emoji="🌆" color={C.teal}
                title="[DEV] Test live Supabase" sub="Tous modules · données réelles"
                onPress={() => enter("live")} />
              <AccessCard idx={4} emoji="⚡" color={C.gold}
                title="[DEV] Connexion rapide" sub="test@mylife.app"
                onPress={() => void quickTest()} />
            </View>
          </Animated.View>
        )}

        {/* ── Footer ── */}
        <View style={{ alignItems: "center", marginTop: 36, gap: 6 }}>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {["🟡", "🟢", "🔵", "🟣", "🔴"].map((c, i) => (
              <Text key={i} style={{ fontSize: 8, opacity: 0.3 }}>{c}</Text>
            ))}
          </View>
          <Text style={{ color: C.ghost, fontSize: 9, letterSpacing: 3, fontWeight: "700" }}>
            MYLIFE · {ACTIVE_CITY.name.toUpperCase()} · 2026
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
