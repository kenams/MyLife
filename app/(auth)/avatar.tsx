import { router } from "expo-router";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

import { AvatarForm } from "@/components/avatar-form";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

export default function AvatarScreen() {
  const completeAvatar = useGameStore((s) => s.completeAvatar);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050b18" }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ alignItems: "center", gap: 8, marginBottom: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.accent + "20", borderWidth: 2, borderColor: colors.accent + "50",
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 32 }}>🧬</Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 24 }}>Crée ton identité</Text>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 18 }}>
            Ton avatar définit ton rythme, ton image et ta façon d'entrer dans le monde.
          </Text>
        </View>

        <AvatarForm
          submitLabel="Entrer dans le quartier"
          onSubmit={(avatar) => {
            completeAvatar(avatar);
            router.replace("/(app)/(tabs)/home");
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
