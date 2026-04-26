import { router } from "expo-router";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

import { AvatarForm } from "@/components/avatar-form";
import { useGameStore } from "@/stores/game-store";

export default function AvatarScreen() {
  const completeAvatar = useGameStore((s) => s.completeAvatar);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#e8edf5" }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40 }} showsVerticalScrollIndicator={false}>

        <View style={{ alignItems: "center", gap: 8, marginBottom: 24 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36,
            backgroundColor: "#eef2ff", borderWidth: 2.5, borderColor: "#c7d2fe",
            alignItems: "center", justifyContent: "center",
            shadowColor: "#6366f1", shadowOpacity: 0.15, shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
            <Text style={{ fontSize: 34 }}>🧬</Text>
          </View>
          <Text style={{ color: "#1e2a3a", fontWeight: "900", fontSize: 24 }}>Crée ton identité</Text>
          <Text style={{ color: "#8fa3b8", fontSize: 13, textAlign: "center", lineHeight: 18 }}>
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
