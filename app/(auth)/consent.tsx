import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View, Linking } from "react-native";

const L = {
  bg: "#080808", card: "#111111", cardAlt: "#181818",
  text: "#F5F2E8", textSoft: "#A8A49A", muted: "#4A4844",
  border: "rgba(255,255,255,0.07)",
  primary: "#FFD600", red: "#FF3B3B", green: "#39FF14",
};

export const CONSENT_KEY   = "@mylife_consent_v1";
export const GEOLOC_KEY    = "@mylife_geoloc_consent";

export async function hasConsented(): Promise<boolean> {
  const v = await AsyncStorage.getItem(CONSENT_KEY);
  return v === "true";
}

export async function hasGeolocConsent(): Promise<boolean> {
  const v = await AsyncStorage.getItem(GEOLOC_KEY);
  return v === "true";
}

type CheckItem = {
  id: string;
  required: boolean;
  emoji: string;
  title: string;
  body: string;
};

const ITEMS: CheckItem[] = [
  {
    id: "cgu",
    required: true,
    emoji: "📋",
    title: "CGU et Politique de confidentialité",
    body: "J'ai lu et j'accepte les Conditions Générales d'Utilisation et la Politique de confidentialité de MyLife.",
  },
  {
    id: "age",
    required: true,
    emoji: "🔞",
    title: "Déclaration d'âge (18+)",
    body: "Je déclare sur l'honneur avoir 18 ans ou plus. Je reconnais que toute fausse déclaration entraîne la suppression de mon compte.",
  },
  {
    id: "geoloc",
    required: false,
    emoji: "📍",
    title: "Géolocalisation — optionnelle",
    body: "J'autorise MyLife à accéder à ma position GPS pour apparaître sur la Life Map. Je peux désactiver cette option à tout moment via le mode Ghost.",
  },
  {
    id: "notifs",
    required: false,
    emoji: "🔔",
    title: "Notifications — optionnelles",
    body: "J'accepte de recevoir des notifications push pour les invites, événements et interactions de joueurs proches.",
  },
];

export default function ConsentScreen() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const requiredDone = ITEMS.filter((i) => i.required).every((i) => checked[i.id]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function confirm() {
    if (!requiredDone) return;
    setLoading(true);
    await AsyncStorage.setItem(CONSENT_KEY, "true");
    await AsyncStorage.setItem(GEOLOC_KEY, checked["geoloc"] ? "true" : "false");
    setLoading(false);
    router.replace("/(auth)/sign-in");
  }

  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 }}>

        {/* Header */}
        <Text style={{ color: L.text, fontSize: 26, fontWeight: "900",
          letterSpacing: -0.5, marginBottom: 8 }}>
          Avant de commencer
        </Text>
        <Text style={{ color: L.textSoft, fontSize: 14, lineHeight: 22, marginBottom: 32 }}>
          MyLife respecte ta vie privée. Coche ce que tu acceptes — les 2 premiers sont obligatoires.
        </Text>

        {/* Checkboxes */}
        <View style={{ gap: 12 }}>
          {ITEMS.map((item) => {
            const on = !!checked[item.id];
            return (
              <Pressable key={item.id} onPress={() => toggle(item.id)}
                style={{
                  flexDirection: "row", gap: 14, padding: 18,
                  backgroundColor: on ? L.primary + "0F" : L.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: on ? L.primary + "35" : L.border,
                }}>
                {/* Checkbox */}
                <View style={{
                  width: 24, height: 24, borderRadius: 7,
                  backgroundColor: on ? L.primary : L.cardAlt,
                  borderWidth: 2, borderColor: on ? L.primary : L.muted,
                  alignItems: "center", justifyContent: "center",
                  marginTop: 1, flexShrink: 0,
                }}>
                  {on && <Text style={{ color: "#080808", fontSize: 13, fontWeight: "900" }}>✓</Text>}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
                    <Text style={{ color: on ? L.primary : L.text,
                      fontSize: 14, fontWeight: "800", flex: 1 }}>
                      {item.title}
                    </Text>
                    {item.required && (
                      <View style={{ backgroundColor: L.red + "20", borderRadius: 4,
                        paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: L.red, fontSize: 9, fontWeight: "900" }}>REQUIS</Text>
                      </View>
                    )}
                    {!item.required && (
                      <View style={{ backgroundColor: L.muted + "20", borderRadius: 4,
                        paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: L.muted, fontSize: 9, fontWeight: "700" }}>OPTIONNEL</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: L.textSoft, fontSize: 13, lineHeight: 20 }}>
                    {item.body}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Liens légaux */}
        <View style={{ flexDirection: "row", gap: 20, marginTop: 24, justifyContent: "center" }}>
          <Pressable onPress={() => router.push("/(auth)/legal?doc=cgu" as never)}>
            <Text style={{ color: L.primary, fontSize: 12, fontWeight: "700",
              textDecorationLine: "underline" }}>
              Lire les CGU
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(auth)/legal?doc=privacy" as never)}>
            <Text style={{ color: L.primary, fontSize: 12, fontWeight: "700",
              textDecorationLine: "underline" }}>
              Politique de confidentialité
            </Text>
          </Pressable>
        </View>

        {/* CTA */}
        <Pressable
          onPress={confirm}
          disabled={!requiredDone || loading}
          style={{
            marginTop: 32, backgroundColor: requiredDone ? L.primary : L.card,
            borderRadius: 16, paddingVertical: 18, alignItems: "center",
            borderWidth: 1, borderColor: requiredDone ? L.primary : L.border,
            shadowColor: L.primary, shadowOpacity: requiredDone ? 0.3 : 0, shadowRadius: 12,
          }}>
          <Text style={{ color: requiredDone ? "#080808" : L.muted,
            fontSize: 16, fontWeight: "900" }}>
            {loading ? "Enregistrement..." : "Continuer →"}
          </Text>
        </Pressable>

        {!requiredDone && (
          <Text style={{ color: L.muted, fontSize: 12, textAlign: "center", marginTop: 12 }}>
            Coche les 2 cases obligatoires pour continuer
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
