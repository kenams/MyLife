import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AppShell, Button, Card, Input, Muted, Pill, Title } from "@/components/ui";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

type Tab = "signin" | "signup" | "reset";

export default function SignInScreen() {
  const signIn       = useGameStore((s) => s.signIn);
  const signUp       = useGameStore((s) => s.signUp);
  const resetPassword = useGameStore((s) => s.resetPassword);
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

  const tabStyle = (active: boolean) => ({
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center" as const,
    backgroundColor: active ? colors.accent + "20" : "transparent",
    borderWidth: active ? 1 : 0,
    borderColor: colors.accent + "60"
  });

  return (
    <AppShell>
      <Card accent>
        <Pill>MyLife</Pill>
        <Title>Entre dans ton espace de vie.</Title>
        <Muted>Mode local sans Supabase disponible pour tester sans friction.</Muted>
      </Card>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 4 }}>
        <Pressable style={tabStyle(tab === "signin")} onPress={() => { setTab("signin"); clearMessages(); }}>
          <Text style={{ color: tab === "signin" ? colors.accent : colors.muted, fontWeight: "700", fontSize: 13 }}>
            Connexion
          </Text>
        </Pressable>
        <Pressable style={tabStyle(tab === "signup")} onPress={() => { setTab("signup"); clearMessages(); }}>
          <Text style={{ color: tab === "signup" ? colors.accent : colors.muted, fontWeight: "700", fontSize: 13 }}>
            Inscription
          </Text>
        </Pressable>
        <Pressable style={tabStyle(tab === "reset")} onPress={() => { setTab("reset"); clearMessages(); }}>
          <Text style={{ color: tab === "reset" ? colors.accent : colors.muted, fontWeight: "700", fontSize: 11 }}>
            Mot de passe
          </Text>
        </Pressable>
      </View>

      <Card>
        <Input value={email} onChangeText={setEmail} placeholder="Adresse e-mail" keyboardType="email-address" />

        {tab !== "reset" && (
          <Input value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry />
        )}
        {tab === "signup" && (
          <Input value={confirm} onChangeText={setConfirm} placeholder="Confirmer le mot de passe" secureTextEntry />
        )}

        {error ? (
          <View style={{ backgroundColor: "rgba(255,100,100,0.1)", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "rgba(255,100,100,0.25)" }}>
            <Text style={{ color: "#ff8d8d", fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={{ backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "rgba(56,199,147,0.25)" }}>
            <Text style={{ color: "#38c793", fontSize: 13 }}>{success}</Text>
          </View>
        ) : null}

        {tab === "signin" && (
          <Button label={loading ? "Connexion..." : "Se connecter"} onPress={() => void handleSignIn()} disabled={loading} />
        )}
        {tab === "signup" && (
          <Button label={loading ? "Création..." : "Créer mon compte"} onPress={() => void handleSignUp()} disabled={loading} />
        )}
        {tab === "reset" && (
          <Button label={loading ? "Envoi..." : "Envoyer le lien"} onPress={() => void handleReset()} disabled={loading} />
        )}
      </Card>

      {/* Comptes test — only on signin tab */}
      {tab === "signin" && (
        <Card>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14, marginBottom: 10 }}>
            Démarrage rapide
          </Text>
          <View style={{ gap: 8 }}>
            <Button label="Profil équilibré" onPress={() => handleLoadTestAccount("balanced")} />
            <Button label="Profil sous pression" variant="secondary" onPress={() => handleLoadTestAccount("burnout")} />
            <Button label="Profil date & social" variant="secondary" onPress={() => handleLoadTestAccount("romantic")} />
            <Button label="Mode test live complet" onPress={() => handleLoadTestAccount("live")} />
            <Button label="Mode démo instantané" variant="secondary" onPress={() => void handleDemo()} />
          </View>
        </Card>
      )}
    </AppShell>
  );
}
