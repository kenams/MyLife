import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useGameStore } from "@/stores/game-store";

async function devBypass(
  loadTestAccount: (p: "balanced") => void,
  completeTutorial: () => void,
) {
  await AsyncStorage.setItem("@mylife_age_verified", "true");
  await AsyncStorage.setItem("@mylife_consent_v1", "true");
  loadTestAccount("balanced");
  completeTutorial();
  router.replace("/(app)/(tabs)/home");
}

const L = {
  bg: "#080808", card: "#111111", cardAlt: "#181818",
  text: "#F5F2E8", textSoft: "#A8A49A", muted: "#4A4844",
  border: "rgba(255,255,255,0.07)",
  primary: "#FFD600", red: "#FF3B3B", green: "#39FF14",
};

const AGE_VERIFIED_KEY = "@mylife_age_verified";

export async function isAgeVerified(): Promise<boolean> {
  const v = await AsyncStorage.getItem(AGE_VERIFIED_KEY);
  return v === "true";
}

export async function setAgeVerified() {
  await AsyncStorage.setItem(AGE_VERIFIED_KEY, "true");
}

export default function AgeCheckScreen() {
  const [day,   setDay]   = useState("");
  const [month, setMonth] = useState("");
  const [year,  setYear]  = useState("");
  const [error, setError] = useState("");
  const loadTestAccount  = useGameStore(s => s.loadTestAccount);
  const completeTutorial = useGameStore(s => s.completeTutorial);

  function validate() {
    setError("");
    const d = parseInt(day,   10);
    const m = parseInt(month, 10);
    const y = parseInt(year,  10);

    if (!d || !m || !y || day.length < 1 || month.length < 1 || year.length !== 4) {
      setError("Date invalide.");
      return;
    }
    if (d < 1 || d > 31 || m < 1 || m > 12) {
      setError("Date invalide.");
      return;
    }

    const birth = new Date(y, m - 1, d);
    const now   = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;

    if (isNaN(age) || age < 0 || age > 120) {
      setError("Date invalide.");
      return;
    }

    if (age < 18) {
      setError("MyLife est réservée aux 18 ans et plus.");
      return;
    }

    setAgeVerified().then(() => {
      router.replace("/(auth)/consent");
    });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ flex: 1, backgroundColor: L.bg, justifyContent: "center",
          paddingHorizontal: 28, paddingVertical: 60 }}>

          {/* Icon */}
          <View style={{ alignItems: "center", marginBottom: 36 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: L.card,
              borderWidth: 1, borderColor: L.border, alignItems: "center", justifyContent: "center",
              marginBottom: 20 }}>
              <Text style={{ fontSize: 36 }}>🔞</Text>
            </View>
            <Text style={{ color: L.text, fontSize: 26, fontWeight: "900", textAlign: "center",
              letterSpacing: -0.5 }}>
              Âge requis : 18 ans
            </Text>
            <Text style={{ color: L.textSoft, fontSize: 14, textAlign: "center",
              marginTop: 10, lineHeight: 22 }}>
              MyLife contient des fonctionnalités réservées{"\n"}aux adultes. Confirme ta date de naissance.
            </Text>
          </View>

          {/* Date inputs */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: L.muted, fontSize: 11, fontWeight: "700",
                letterSpacing: 1, marginBottom: 8 }}>JOUR</Text>
              <TextInput
                value={day}
                onChangeText={(t) => { if (/^\d{0,2}$/.test(t)) setDay(t); }}
                placeholder="JJ"
                placeholderTextColor={L.muted}
                keyboardType="number-pad"
                maxLength={2}
                style={{
                  backgroundColor: L.card, borderRadius: 14, padding: 16,
                  color: L.text, fontSize: 22, fontWeight: "900", textAlign: "center",
                  borderWidth: 1, borderColor: day ? L.primary + "40" : L.border,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: L.muted, fontSize: 11, fontWeight: "700",
                letterSpacing: 1, marginBottom: 8 }}>MOIS</Text>
              <TextInput
                value={month}
                onChangeText={(t) => { if (/^\d{0,2}$/.test(t)) setMonth(t); }}
                placeholder="MM"
                placeholderTextColor={L.muted}
                keyboardType="number-pad"
                maxLength={2}
                style={{
                  backgroundColor: L.card, borderRadius: 14, padding: 16,
                  color: L.text, fontSize: 22, fontWeight: "900", textAlign: "center",
                  borderWidth: 1, borderColor: month ? L.primary + "40" : L.border,
                }}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={{ color: L.muted, fontSize: 11, fontWeight: "700",
                letterSpacing: 1, marginBottom: 8 }}>ANNÉE</Text>
              <TextInput
                value={year}
                onChangeText={(t) => { if (/^\d{0,4}$/.test(t)) setYear(t); }}
                placeholder="AAAA"
                placeholderTextColor={L.muted}
                keyboardType="number-pad"
                maxLength={4}
                style={{
                  backgroundColor: L.card, borderRadius: 14, padding: 16,
                  color: L.text, fontSize: 22, fontWeight: "900", textAlign: "center",
                  borderWidth: 1, borderColor: year.length === 4 ? L.primary + "40" : L.border,
                }}
              />
            </View>
          </View>

          {/* Erreur */}
          {error !== "" && (
            <View style={{ backgroundColor: L.red + "15", borderRadius: 12, padding: 14,
              borderWidth: 1, borderColor: L.red + "30", marginBottom: 16 }}>
              <Text style={{ color: L.red, fontSize: 13, fontWeight: "700", textAlign: "center" }}>
                {error}
              </Text>
            </View>
          )}

          {/* CTA */}
          <Pressable onPress={validate}
            style={{ backgroundColor: L.primary, borderRadius: 16, paddingVertical: 18,
              alignItems: "center", marginTop: 8,
              shadowColor: L.primary, shadowOpacity: 0.3, shadowRadius: 12 }}>
            <Text style={{ color: "#080808", fontSize: 16, fontWeight: "900" }}>
              Confirmer mon âge
            </Text>
          </Pressable>

          <Text style={{ color: L.muted, fontSize: 12, textAlign: "center", marginTop: 20,
            lineHeight: 18 }}>
            Cette vérification est requise par la loi.{"\n"}
            Ta date de naissance n'est pas stockée sur nos serveurs.
          </Text>

          {/* ── CONNEXION RAPIDE (dev uniquement) ── */}
          {__DEV__ && <Pressable
            onPress={() => void devBypass(loadTestAccount, completeTutorial)}
            style={{
              marginTop: 24, backgroundColor: "#FFD600" + "18",
              borderRadius: 14, paddingVertical: 14,
              alignItems: "center", borderWidth: 1,
              borderColor: "#FFD600" + "40",
            }}
          >
            <Text style={{ color: "#FFD600", fontSize: 13, fontWeight: "900", letterSpacing: 1 }}>
              ⚡ CONNEXION RAPIDE
            </Text>
            <Text style={{ color: "#A8A49A", fontSize: 11, marginTop: 3 }}>
              Compte test · accès direct
            </Text>
          </Pressable>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
