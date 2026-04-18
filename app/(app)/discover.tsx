import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { starterResidents } from "@/lib/game-engine";
import { getCompatibilityBadge, getRelationshipLabel, getResidentAccessibility } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

export default function DiscoverScreen() {
  const avatar        = useGameStore((s) => s.avatar);
  const stats         = useGameStore((s) => s.stats);
  const relationships = useGameStore((s) => s.relationships);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);
  const sendInvitation          = useGameStore((s) => s.sendInvitation);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: 60,
            backgroundColor: colors.accent + "08" }} />
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>🔍 Découvrir</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
            Profils compatibles — {starterResidents.length} résidents
          </Text>
        </View>

        <View style={{ padding: 20, gap: 14 }}>
          {starterResidents.map((resident) => {
            const relationship = relationships.find((r) => r.residentId === resident.id);
            const access       = getResidentAccessibility(resident.id, stats);
            const compat       = getCompatibilityBadge(avatar?.interests ?? [], resident.interests);
            const relLabel     = getRelationshipLabel(relationship);
            const accessColor  = access.level === "accessible" ? "#38c793" : access.level === "receptif" ? "#fbbf24" : colors.muted;
            const rankColor    = resident.socialRank === "elite" ? "#f6b94f" : resident.socialRank === "influent" ? "#c084fc" : colors.accent;

            return (
              <View key={resident.id} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18,
                padding: 16, gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>

                {/* Top */}
                <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26,
                    backgroundColor: accessColor + "20", borderWidth: 2, borderColor: accessColor + "50",
                    alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 24 }}>👤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{resident.name}</Text>
                      <View style={{ backgroundColor: rankColor + "20", borderRadius: 6,
                        paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: rankColor + "40" }}>
                        <Text style={{ color: rankColor, fontSize: 9, fontWeight: "800" }}>{resident.socialRank}</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>{resident.role} · {resident.vibe}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }} numberOfLines={2}>{resident.bio}</Text>
                  </View>
                </View>

                {/* Badges */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>🎯 {compat}</Text>
                  </View>
                  <View style={{ backgroundColor: accessColor + "15", borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: accessColor + "35" }}>
                    <Text style={{ color: accessColor, fontSize: 10, fontWeight: "700" }}>
                      {access.level === "accessible" ? "● Accessible" : access.level === "receptif" ? "◑ Réceptif" : "○ Fermé"}
                    </Text>
                  </View>
                  {relLabel && relLabel !== "nouveau profil" && (
                    <View style={{ backgroundColor: colors.accent + "15", borderRadius: 8,
                      paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.accent + "35" }}>
                      <Text style={{ color: colors.accent, fontSize: 10, fontWeight: "700" }}>{relLabel}</Text>
                    </View>
                  )}
                </View>

                {/* Access hint */}
                <Text style={{ color: colors.muted, fontSize: 11 }}>{access.hint}</Text>

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => { startDirectConversation(resident.id, resident.name); router.push("/(app)/(tabs)/chat"); }}
                    style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 11,
                      alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>💬 Message</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => sendInvitation(resident.id, "coffee-meetup")}
                    style={{ flex: 1, backgroundColor: access.level !== "ferme" ? colors.accent + "20" : "rgba(255,255,255,0.04)",
                      borderRadius: 12, padding: 11, alignItems: "center",
                      borderWidth: 1, borderColor: access.level !== "ferme" ? colors.accent + "50" : "rgba(255,255,255,0.06)" }}>
                    <Text style={{ color: access.level !== "ferme" ? colors.accent : colors.muted,
                      fontWeight: "700", fontSize: 13 }}>📨 Inviter</Text>
                  </Pressable>
                  {resident.lookingFor.includes("relation amoureuse") && (
                    <Pressable onPress={() => router.push("/(app)/dates")}
                      style={{ backgroundColor: "#f472b620", borderRadius: 12, padding: 11,
                        alignItems: "center", borderWidth: 1, borderColor: "#f472b640" }}>
                      <Text style={{ fontSize: 16 }}>💕</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Animated.View>
  );
}
