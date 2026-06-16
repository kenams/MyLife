import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { PARIS_QUARTIERS_LIST } from "@/lib/live-chat";

const L = {
  bg: "#080808", card: "#111111", cardAlt: "#181818",
  text: "#F5F2E8", soft: "#A8A49A", muted: "#4A4844",
  border: "rgba(255,255,255,0.07)", primary: "#FFD600",
};

export default function QuartiersScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>
      <View style={{ paddingTop: 54, paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: L.border,
        flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: L.card,
            alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: L.text, fontSize: 16 }}>←</Text>
        </Pressable>
        <View>
          <Text style={{ color: L.text, fontSize: 18, fontWeight: "900" }}>Quartiers Paris</Text>
          <Text style={{ color: L.muted, fontSize: 12 }}>Chats live · effacés dans 24h</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}
        showsVerticalScrollIndicator={false}>
        {PARIS_QUARTIERS_LIST.map((q) => (
          <Pressable key={q.id}
            onPress={() => router.push(`/(app)/live-chat?quartier=${q.id}` as never)}
            style={{ flexDirection: "row", alignItems: "center", gap: 14,
              backgroundColor: L.card, borderRadius: 14, padding: 16,
              borderWidth: 1, borderColor: L.border }}>
            <View style={{ width: 44, height: 44, borderRadius: 22,
              backgroundColor: L.cardAlt, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22 }}>{q.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: L.text, fontSize: 15, fontWeight: "800" }}>{q.id}</Text>
              <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }}>{q.desc}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4,
                backgroundColor: q.id === "Global" || q.id === "Saint-Denis" ? "#39FF14" : L.muted }} />
              <Text style={{ color: L.muted, fontSize: 10 }}>→</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
