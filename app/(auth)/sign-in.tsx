import { router } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { useGameStore } from "@/stores/game-store";

const L = {
  bg: "#f5f7fa", card: "#ffffff", border: "#e8edf5",
  text: "#1e2a3a", textSoft: "#4a5568", muted: "#94a3b8",
  primary: "#6366f1", primaryBg: "#eef2ff",
  green: "#10b981", greenBg: "#ecfdf5",
  red: "#ef4444", redBg: "#fef2f2",
};

type Tab = "signin" | "signup" | "reset";

function ActionBtn({ label, onPress, disabled, variant = "primary" }: {
  label: string; onPress: () => void; disabled?: boolean; variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={{
        backgroundColor: isPrimary ? L.primary : L.bg,
        borderRadius: 14, padding: 14, alignItems: "center",
        borderWidth: 1.5, borderColor: isPrimary ? L.primary : L.border,
        opacity: disabled ? 0.5 : 1,
        shadowColor: isPrimary ? L.primary : "transparent",
        shadowOpacity: 0.2, shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 }, elevation: isPrimary ? 3 : 0,
      }}>
      <Text style={{ color: isPrimary ? "#fff" : L.textSoft, fontWeight: "800", fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SignInScreen() {
  const signIn          = useGameStore((s) => s.signIn);
  const signUp          = useGameStore((s) => s.signUp);
  const resetPassword   = useGameStore((s) => s.resetPassword);
  const loadTestAccount = useGameStore((s) => s.loadTestAccount);

  const [tab, setTab]           = useState<Tab>("signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [loading, setLoading]   = useState(false);

  function clearMessages() { setError(""); setSuccess(""); }

  async function handleSignIn() {
    clearMessages();
    if (!email) { setError("Email requis."); return; }
    setLoading(true);
    const result = await signIn(email, password || undefined);
    setLoading(false);
    if (!result.ok) { setError(result.error ?? "Connexion impossible."); return; }
    const currentAvatar = useGameStore.getState().avatar;
    router.replace(currentAvatar ? "/(app)/(tabs)/home" : "/(auth)/avatar");
  }

  async function handleSignUp() {
    clearMessages();
    if (!email || !password) { setError("Email et mot de passe requis."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const result = await signUp(email, password);
    setLoading(false);
    if (!result.ok) { setError(result.error ?? "Inscription impossible."); return; }
    setSuccess("Compte créé. Vérifie ton email puis connecte-toi.");
    setTab("signin");
  }

  async function handleReset() {
    clearMessages();
    if (!email) { setError("Email requis."); return; }
    setLoading(true);
    const result = await resetPassword(email);
    setLoading(false);
    if (!result.ok) { setError(result.error ?? "Impossible d'envoyer le lien."); return; }
    setSuccess("Lien envoyé. Vérifie ta boîte mail.");
  }

  function handleLoadTestAccount(preset: "balanced" | "burnout" | "romantic" | "live" = "balanced") {
    clearMessages();
    loadTestAccount(preset);
    router.replace("/(app)/(tabs)/home");
  }

  async function handleDemo() {
    clearMessages();
    await signIn("demo@mylife.app", "");
    router.replace("/(app)/(tabs)/home");
  }

  const inputStyle = {
    backgroundColor: L.card, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 13, color: L.text, fontSize: 14,
    borderWidth: 1.5, borderColor: L.border,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: L.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={{ alignItems: "center", gap: 12, paddingBottom: 10 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40,
            backgroundColor: L.primaryBg, borderWidth: 2.5, borderColor: L.primary + "40",
            alignItems: "center", justifyContent: "center",
            shadowColor: L.primary, shadowOpacity: 0.15, shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
            <Text style={{ fontSize: 38 }}>🌆</Text>
          </View>
          <Text style={{ color: L.text, fontWeight: "900", fontSize: 28, letterSpacing: -0.5 }}>MyLife</Text>
          <Text style={{ color: L.muted, fontSize: 13, textAlign: "center" }}>
            Entre dans ton espace de vie simulé
          </Text>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 4, backgroundColor: L.card,
          borderRadius: 14, padding: 4, borderWidth: 1, borderColor: L.border }}>
          {(["signin", "signup", "reset"] as Tab[]).map((t) => {
            const active = tab === t;
            const label  = t === "signin" ? "Connexion" : t === "signup" ? "Inscription" : "Mot de passe";
            return (
              <Pressable key={t} onPress={() => { setTab(t); clearMessages(); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
                  backgroundColor: active ? L.primaryBg : "transparent" }}>
                <Text style={{ color: active ? L.primary : L.muted, fontWeight: "700", fontSize: 12 }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Formulaire */}
        <View style={{ gap: 12 }}>
          <TextInput
            value={email} onChangeText={setEmail} placeholder="Adresse e-mail"
            placeholderTextColor={L.muted} keyboardType="email-address" autoCapitalize="none"
            style={inputStyle}
          />
          {tab !== "reset" && (
            <TextInput
              value={password} onChangeText={setPassword} placeholder="Mot de passe"
              placeholderTextColor={L.muted} secureTextEntry autoCapitalize="none"
              style={inputStyle}
            />
          )}
          {tab === "signup" && (
            <TextInput
              value={confirm} onChangeText={setConfirm} placeholder="Confirmer le mot de passe"
              placeholderTextColor={L.muted} secureTextEntry autoCapitalize="none"
              style={inputStyle}
            />
          )}

          {error ? (
            <View style={{ backgroundColor: L.redBg, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: "#fca5a5" }}>
              <Text style={{ color: L.red, fontSize: 13 }}>⚠ {error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={{ backgroundColor: L.greenBg, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: "#6ee7b7" }}>
              <Text style={{ color: L.green, fontSize: 13 }}>✓ {success}</Text>
            </View>
          ) : null}

          {tab === "signin" && (
            <ActionBtn label={loading ? "Connexion..." : "Se connecter"} onPress={() => void handleSignIn()} disabled={loading} />
          )}
          {tab === "signup" && (
            <ActionBtn label={loading ? "Création..." : "Créer mon compte"} onPress={() => void handleSignUp()} disabled={loading} />
          )}
          {tab === "reset" && (
            <ActionBtn label={loading ? "Envoi..." : "Envoyer le lien"} onPress={() => void handleReset()} disabled={loading} />
          )}
        </View>

        {/* Démarrage rapide */}
        {tab === "signin" && (
          <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 16,
            gap: 10, borderWidth: 1, borderColor: L.border,
            shadowColor: "rgba(99,102,241,0.08)", shadowOpacity: 1,
            shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
              DÉMARRAGE RAPIDE
            </Text>
            <Text style={{ color: L.textSoft, fontSize: 12 }}>
              Compte local simple, sans e-mail ni validation
            </Text>
            <View style={{ gap: 8 }}>
              <ActionBtn label="Compte simple — Kenan" onPress={() => handleLoadTestAccount("balanced")} />
              <ActionBtn label="🔥 Profil sous pression" onPress={() => handleLoadTestAccount("burnout")} variant="secondary" />
              <ActionBtn label="💕 Profil date & social" onPress={() => handleLoadTestAccount("romantic")} variant="secondary" />
              <ActionBtn label="🌆 Mode test live complet" onPress={() => handleLoadTestAccount("live")} />
              <ActionBtn label="⚡ Mode démo instantané" onPress={() => void handleDemo()} variant="secondary" />
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
