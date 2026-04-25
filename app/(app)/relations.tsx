import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import type { AvatarAction } from "@/lib/avatar-visual";
import { getNpcVisual } from "@/lib/avatar-visual";

const VALID_ACTIONS = new Set<AvatarAction>(["idle","walking","working","eating","sleeping","chatting","exercising","waving"]);
function toAvatarAction(a?: string): AvatarAction {
  return VALID_ACTIONS.has(a as AvatarAction) ? (a as AvatarAction) : "idle";
}
import { starterResidents } from "@/lib/game-engine";
import { getCompatibilityBadge, getResidentAccessibility } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import type { RelationshipRecord } from "@/lib/types";
import { useGameStore, worldLocations } from "@/stores/game-store";

const QUALITY_COLOR: Record<NonNullable<RelationshipRecord["quality"]>, string> = {
  inspirante: "#38c793",
  stable:     "#60a5fa",
  neutre:     colors.muted,
  fatigante:  "#fbbf24",
  toxique:    "#f87171",
};

const STATUS_STEPS = ["contact", "ami", "cercle-proche", "crush", "relation"] as const;
const STATUS_LABELS: Record<string, string> = {
  contact: "Contact", ami: "Ami", "cercle-proche": "Cercle", crush: "Crush", relation: "Relation",
};

function RelationProgress({ status }: { status: RelationshipRecord["status"] }) {
  const currentIdx = STATUS_STEPS.indexOf(status as typeof STATUS_STEPS[number]);
  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
      {STATUS_STEPS.map((step, i) => {
        const active = i === currentIdx;
        const passed = i < currentIdx;
        return (
          <View key={step} style={{ alignItems: "center", gap: 3, flex: 1 }}>
            <View style={{ width: active ? 10 : 7, height: active ? 10 : 7, borderRadius: 5,
              backgroundColor: passed ? "#38c793" : active ? colors.accent : "rgba(255,255,255,0.12)" }} />
            <Text style={{ color: active ? colors.accent : passed ? "#38c793" : colors.muted, fontSize: 8,
              fontWeight: active ? "800" : "400" }}>
              {STATUS_LABELS[step]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function RelationsScreen() {
  const avatar               = useGameStore((s) => s.avatar);
  const stats                = useGameStore((s) => s.stats);
  const relationships        = useGameStore((s) => s.relationships);
  const npcs                 = useGameStore((s) => s.npcs);
  const currentLocationSlug  = useGameStore((s) => s.currentLocationSlug);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);
  const sendInvitation          = useGameStore((s) => s.sendInvitation);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const sorted     = [...relationships].sort((a, b) => b.score - a.score);
  const strongLinks = sorted.filter((r) => r.score >= 45).length;
  const activeLinks = sorted.filter((r) => r.score >= 20 && r.score < 45).length;
  const weakLinks   = sorted.filter((r) => r.score < 20).length;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: 60,
            backgroundColor: "#38c79308" }} />
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>💬 Relations</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
            Ton cercle social vivant — {relationships.length} contacts
          </Text>

          {/* Stats row */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            {[
              { val: strongLinks, label: "Liens forts", color: "#38c793" },
              { val: activeLinks, label: "En progression", color: colors.accent },
              { val: weakLinks,   label: "À activer",    color: colors.muted },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, backgroundColor: item.color + "12", borderRadius: 12,
                padding: 10, alignItems: "center", borderWidth: 1, borderColor: item.color + "30" }}>
                <Text style={{ color: item.color, fontWeight: "900", fontSize: 20 }}>{item.val}</Text>
                <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Cards */}
        <View style={{ padding: 20, gap: 14 }}>
          {sorted.map((rel) => {
            const resident = starterResidents.find((r) => r.id === rel.residentId);
            if (!resident) return null;
            const access       = getResidentAccessibility(resident.id, stats);
            const qualityColor = QUALITY_COLOR[rel.quality] ?? colors.muted;
            const scoreColor   = rel.score >= 65 ? "#38c793" : rel.score >= 40 ? colors.accent : rel.score >= 20 ? "#fbbf24" : "#f87171";
            const accessColor  = access.level === "accessible" ? "#38c793" : access.level === "receptif" ? "#fbbf24" : colors.muted;
            const npcState     = npcs.find((n) => n.id === resident.id);
            const isHere       = npcState?.locationSlug === currentLocationSlug;
            const npcLoc       = npcState ? worldLocations.find((l) => l.slug === npcState.locationSlug) : null;

            return (
              <View key={rel.residentId} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18,
                padding: 16, gap: 12, borderWidth: 1,
                borderColor: isHere ? colors.accent + "40" : "rgba(255,255,255,0.08)" }}>

                {/* Top row */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 25,
                    backgroundColor: qualityColor + "20", borderWidth: 2, borderColor: qualityColor + "50",
                    alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <AvatarSprite visual={getNpcVisual(resident.id)} action={toAvatarAction(npcState?.action)} size="xs" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{resident.name}</Text>
                      {isHere && (
                        <View style={{ backgroundColor: colors.accent, borderRadius: 6,
                          paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: "#07111f", fontSize: 9, fontWeight: "900" }}>ICI</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{resident.role} · {resident.status}</Text>
                    {npcLoc && (
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                        📍 {npcLoc.name}
                      </Text>
                    )}
                    <Text style={{ color: getCompatibilityBadge(avatar?.interests ?? [], resident.interests) ? colors.accent : colors.muted,
                      fontSize: 11, marginTop: 1 }}>
                      {getCompatibilityBadge(avatar?.interests ?? [], resident.interests)}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: qualityColor + "20", borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: qualityColor + "40" }}>
                    <Text style={{ color: qualityColor, fontSize: 10, fontWeight: "800" }}>{rel.quality}</Text>
                  </View>
                </View>

                {/* Progress */}
                <RelationProgress status={rel.status} />

                {/* Score bar */}
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>Score de lien</Text>
                    <Text style={{ color: scoreColor, fontSize: 11, fontWeight: "700" }}>{rel.score}/100</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    <View style={{ height: 6, borderRadius: 3, width: `${rel.score}%`, backgroundColor: scoreColor }} />
                  </View>
                </View>

                {/* Access badge */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8,
                  backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accessColor }} />
                  <Text style={{ color: accessColor, fontSize: 11, fontWeight: "700", flex: 1 }}>{access.hint}</Text>
                  {rel.isFollowing && (
                    <Text style={{ color: colors.accent, fontSize: 11 }}>★ Suivi</Text>
                  )}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable onPress={() => { startDirectConversation(resident.id, resident.name); router.push("/(app)/(tabs)/chat"); }}
                    style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 11,
                      alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>💬 Message</Text>
                  </Pressable>
                  <Pressable onPress={() => sendInvitation(resident.id, "coffee-meetup")}
                    style={{ flex: 1, backgroundColor: access.level !== "ferme" ? colors.accent + "20" : "rgba(255,255,255,0.04)",
                      borderRadius: 12, padding: 11, alignItems: "center",
                      borderWidth: 1, borderColor: access.level !== "ferme" ? colors.accent + "50" : "rgba(255,255,255,0.06)" }}>
                    <Text style={{ color: access.level !== "ferme" ? colors.accent : colors.muted,
                      fontWeight: "700", fontSize: 13 }}>📨 Inviter</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Animated.View>
  );
}
