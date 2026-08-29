"use client";

/**
 * Mode organisateur (§12) — saisie/scan d'un jeton de pass. La validation
 * est 100 % serveur (atomique, anti-replay). Cet écran n'affiche que le
 * verdict : PASS VALIDE / DÉJÀ UTILISÉ / INVALIDE.
 */

import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { scanEventPass } from "@/lib/events";
import { hapticImpact, hapticSuccess } from "@/lib/safe-haptics";

const C = {
  bg: "#080808",
  card: "#111111",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  muted: "#4A4844",
  gold: "#FFD600",
  green: "#39FF14",
  red: "#FF3B3B",
};

const VERDICT: Record<string, { label: string; color: string }> = {
  VALID: { label: "PASS VALIDE", color: C.green },
  ALREADY_USED: { label: "PASS DÉJÀ UTILISÉ", color: C.red },
  EXPIRED: { label: "PASS EXPIRÉ", color: C.red },
  REVOKED: { label: "PASS RÉVOQUÉ", color: C.red },
  INVALID: { label: "PASS INVALIDE", color: C.red },
};

export default function PassScannerScreen() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!token.trim()) return;
    setBusy(true);
    const r = await scanEventPass(token.replace(/\s/g, ""));
    setBusy(false);
    setResult(r);
    if (r === "VALID") hapticSuccess();
    else hapticImpact("heavy");
  }

  const v = result ? VERDICT[result] ?? VERDICT.INVALID : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: 16,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View>
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>ORGANISATEUR</Text>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: "900" }}>Vérifier un pass</Text>
        </View>
      </View>

      <View style={{ padding: 20, gap: 16 }}>
        <TextInput
          placeholder="Colle ou saisis le code du pass"
          placeholderTextColor={C.muted}
          value={token}
          onChangeText={(t) => {
            setToken(t);
            setResult(null);
          }}
          autoCapitalize="none"
          style={{
            backgroundColor: C.card,
            borderRadius: 12,
            padding: 14,
            color: C.text,
            fontSize: 14,
            borderWidth: 1,
            borderColor: C.border,
          }}
        />
        <Pressable
          onPress={check}
          disabled={busy || !token.trim()}
          style={{
            backgroundColor: C.gold,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            opacity: busy || !token.trim() ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "#080808", fontWeight: "900", fontSize: 14 }}>{busy ? "..." : "Vérifier"}</Text>
        </Pressable>

        {v && (
          <View
            style={{
              backgroundColor: v.color + "18",
              borderWidth: 1,
              borderColor: v.color + "66",
              borderRadius: 14,
              padding: 20,
              alignItems: "center",
            }}
          >
            <Text style={{ color: v.color, fontSize: 18, fontWeight: "900" }}>{v.label}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
