import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, Text, TextInput, View,
} from "react-native";

import { supabase } from "@/lib/supabase";
import { useGameStore } from "@/stores/game-store";

const C = {
  void: "#040408", surface: "#10101A", text: "#E8E4DC", dim: "#7A7670",
  border: "rgba(255,255,255,0.08)", gold: "#FFD600", red: "#FF3B3B", green: "#39FF14",
};

type Phase = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordScreen() {
  const updatePassword = useGameStore((s) => s.updatePassword);
  const avatar = useGameStore((s) => s.avatar);

  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Récupère la session de recovery à partir du lien (flow PKCE `?code=`).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setPhase("invalid"); return; }

      const existing = await supabase.auth.getSession();
      if (existing.data.session) { if (!cancelled) setPhase("ready"); return; }

      // `detectSessionInUrl` échange normalement le code automatiquement ;
      // fallback explicite si la session n'est pas encore posée.
      let code: string | null = null;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        code = new URLSearchParams(window.location.search).get("code");
      }
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) setPhase(exErr ? "invalid" : "ready");
        return;
      }

      // Laisse une chance au listener global de poser la session, puis recheck.
      setTimeout(async () => {
        if (cancelled || !supabase) return;
        const again = await supabase.auth.getSession();
        setPhase(again.data.session ? "ready" : "invalid");
      }, 1200);
    })();
    return () => { cancelled = true; };
  }, []);

  async function submit() {
    setError("");
    if (password.length < 8) { setError("8 caractères minimum."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const r = await updatePassword(password);
    setLoading(false);
    if (!r.ok) { setError(r.error ?? "Impossible de changer le mot de passe."); return; }
    setPhase("done");
    setTimeout(() => {
      router.replace(avatar ? "/(app)/(tabs)/map" : "/(auth)/avatar");
    }, 900);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.void }}>
      <KeyboardAvoidingView
        style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ width: "100%", maxWidth: 380 }}>
          <Text style={{ color: C.gold, fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>
            MYLIFE
          </Text>
          <Text style={{ color: C.text, fontSize: 24, fontWeight: "700", marginBottom: 24 }}>
            Nouveau mot de passe
          </Text>

          {phase === "checking" && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={C.gold} />
              <Text style={{ color: C.dim }}>Vérification du lien…</Text>
            </View>
          )}

          {phase === "invalid" && (
            <>
              <Text style={{ color: C.red, marginBottom: 20 }}>
                Ce lien de réinitialisation est invalide ou expiré.
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/sign-in")}
                style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, alignItems: "center" }}
              >
                <Text style={{ color: C.text }}>Redemander un lien</Text>
              </Pressable>
            </>
          )}

          {phase === "done" && (
            <Text style={{ color: C.green, fontSize: 16 }}>
              Mot de passe mis à jour ✓
            </Text>
          )}

          {phase === "ready" && (
            <>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Nouveau mot de passe"
                placeholderTextColor={C.dim}
                secureTextEntry
                autoCapitalize="none"
                style={inputStyle}
              />
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirmer le mot de passe"
                placeholderTextColor={C.dim}
                secureTextEntry
                autoCapitalize="none"
                onSubmitEditing={submit}
                style={inputStyle}
              />
              {error ? <Text style={{ color: C.red, marginBottom: 12 }}>{error}</Text> : null}
              <Pressable
                onPress={submit}
                disabled={loading}
                style={{ backgroundColor: C.gold, borderRadius: 12, padding: 15, alignItems: "center", opacity: loading ? 0.6 : 1 }}
              >
                <Text style={{ color: C.void, fontWeight: "700", letterSpacing: 1 }}>
                  {loading ? "MISE À JOUR…" : "CHANGER LE MOT DE PASSE"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const inputStyle = {
  backgroundColor: C.surface,
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 12,
  padding: 14,
  color: C.text,
  marginBottom: 12,
} as const;
