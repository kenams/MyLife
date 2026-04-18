import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarForm } from "@/components/avatar-form";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

export default function AvatarEditScreen() {
  const avatar     = useGameStore((s) => s.avatar);
  const editAvatar = useGameStore((s) => s.editAvatar);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  if (!avatar) return null;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>✏️ Édition profil</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
            Affine ton image et tes préférences
          </Text>
        </View>

        <View style={{ padding: 20 }}>
          <AvatarForm
            initialAvatar={avatar}
            submitLabel="Enregistrer le profil"
            onSubmit={(nextAvatar) => {
              editAvatar(nextAvatar);
              router.back();
            }}
          />
        </View>
      </ScrollView>
    </Animated.View>
  );
}
