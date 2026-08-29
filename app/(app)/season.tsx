"use client";

import { Pressable, ScrollView, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SeasonHub } from "@/components/season-hub";
import { SeasonRecapCard } from "@/components/season-recap-card";

const T = {
  bg: "#080808",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  border: "rgba(255,255,255,0.07)",
};

export default function SeasonScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
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
          borderBottomColor: T.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={T.text} />
        </Pressable>
        <View>
          <Text style={{ color: T.textSoft, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>
            SAISON 1
          </Text>
          <Text style={{ color: T.text, fontSize: 19, fontWeight: "900" }}>Toulouse s'éveille</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <SeasonRecapCard />
        <SeasonHub />
      </ScrollView>
    </View>
  );
}
