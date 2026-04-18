import { router } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

type Tab = "signin" | "signup" | "reset";

function ActionBtn({ label, onPress, disabled, variant = "primary" }: {
  label: string; onPress: () => void; disabled?: boolean; variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={{ backgroundColor: isPrimary ? colors.accent + "20" : "rgba(255,255,255,0.06)",
        borderRadius: 14, padding: 14, alignItems: "center",
        borderWidth: 1.5, borderColor: isPrimary ? colors.accent + "60" : "rgba(255,255,255,0.1)",
        opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: isPrimary ? colors.accent : colors.muted, fontWeight: "800", fontSize: 14 }}>
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050b18" }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={{ alignItems: "center", gap: 10, paddingBottom: 10 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36,
            backgroundColor: colors.accent + "20", borderWidth: 2, borderColor: colors.accent + "50",
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 36 }}>🌆</Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28, letterSpacing: -0.5 }}>MyLife</Text>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
            Entre dans ton espace de vie simulé
          </Text>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 6, backgroundColor: "rgba(255,255,255,0.05)",
          borderRadius: 14, padding: 4 }}>
          {(["signin", "signup", "reset"] as Tab[]).map((t) => {
            const active = tab === t;
            const label = t === "signin" ? "Connexion" : t === "signup" ? "Inscription" : "Mot de passe";
            return (
              <Pressable key={t} onPress={() => { setTab(t); clearMessages(); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                  backgroundColor: active ? colors.accent + "20" : "transparent",
                  borderWidth: active ? 1 : 0, borderColor: colors.accent + "60" }}>
                <Text style={{ color: active ? colors.accent : colors.muted, fontWeight: "700", fontSize: 12 }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Form */}
        <View style={{ gap: 12 }}>
          <TextInput
            value={email} onChangeText={setEmail} placeholder="Adresse e-mail"
            placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 16,
              paddingVertical: 13, color: colors.text, fontSize: 14, borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)" }}
          />
          {tab !== "reset" && (
            <TextInput
              value={password} onChangeText={setPassword} placeholder="Mot de passe"
              placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 16,
                paddingVertical: 13, color: colors.text, fontSize: 14, borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)" }}
            />
          )}
          {tab === "signup" && (
            <TextInput
              value={confirm} onChangeText={setConfirm} placeholder="Confirmer le mot de passe"
              placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 16,
                paddingVertical: 13, color: colors.text, fontSize: 14, borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)" }}
            />
          )}

          {error ? (
            <View style={{ backgroundColor: "rgba(255,100,100,0.1)", borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: "rgba(255,100,100,0.25)" }}>
              <Text style={{ color: "#ff8d8d", fontSize: 13 }}>⚠ {error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={{ backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: "rgba(56,199,147,0.25)" }}>
              <Text style={{ color: "#38c793", fontSize: 13 }}>✓ {success}</Text>
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
          <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, padding: 16,
            gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
              DÉMARRAGE RAPIDE
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Test sans compte — données locales</Text>
            <View style={{ gap: 8 }}>
              <ActionBtn label="🌟 Profil équilibré" onPress={() => handleLoadTestAccount("balanced")} />
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
