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
import type { RelationshipRecord } from "@/lib/types";
import { useGameStore, worldLocations } from "@/stores/game-store";

const L = {
  bg: "#f5f7fa", card: "#ffffff", border: "#e8edf5",
  text: "#1e2a3a", textSoft: "#4a5568", muted: "#94a3b8",
  primary: "#6366f1", primaryBg: "#eef2ff",
  green: "#10b981", greenBg: "#ecfdf5",
  gold: "#f59e0b", goldBg: "#fffbeb",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#8b5cf6",
};

const QUALITY_COLOR: Record<NonNullable<RelationshipRecord["quality"]>, string> = {
  inspirante: "#10b981",
  stable:     "#3b82f6",
  neutre:     "#94a3b8",
  fatigante:  "#f59e0b",
  toxique:    "#ef4444",
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
              backgroundColor: passed ? L.green : active ? L.primary : L.border }} />
            <Text style={{ color: active ? L.primary : passed ? L.green : L.muted, fontSize: 8,
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
  const avatar                  = useGameStore((s) => s.avatar);
  const stats                   = useGameStore((s) => s.stats);
  const relationships           = useGameStore((s) => s.relationships);
  const npcs                    = useGameStore((s) => s.npcs);
  const currentLocationSlug     = useGameStore((s) => s.currentLocationSlug);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);
  const sendInvitation          = useGameStore((s) => s.sendInvitation);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const sorted      = [...relationships].sort((a, b) => b.score - a.score);
  const strongLinks = sorted.filter((r) => r.score >= 45).length;
  const activeLinks = sorted.filter((r) => r.score >= 20 && r.score < 45).length;
  const weakLinks   = sorted.filter((r) => r.score < 20).length;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: L.bg }} showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={{ backgroundColor: L.primary, paddingHorizontal: 20,
          paddingTop: 56, paddingBottom: 24, overflow: "hidden" }}>
          <View style={{ position: "absolute", bottom: -40, right: -40, width: 160, height: 160,
            borderRadius: 80, backgroundColor: "rgba(255,255,255,0.1)" }} />

          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 26 }}>💬 Relations</Text>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 3 }}>
            Ton cercle social vivant — {relationships.length} contacts
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            {[
              { val: strongLinks, label: "Liens forts",     color: "#fff"               },
              { val: activeLinks, label: "En progression",  color: "rgba(255,255,255,0.85)" },
              { val: weakLinks,   label: "À activer",       color: "rgba(255,255,255,0.6)" },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 12, padding: 10, alignItems: "center" }}>
                <Text style={{ color: item.color, fontWeight: "900", fontSize: 20 }}>{item.val}</Text>
                <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, marginTop: 2 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Cards ───────────────────────────────────────────────── */}
        <View style={{ padding: 20, gap: 14 }}>
          {sorted.map((rel) => {
            const resident    = starterResidents.find((r) => r.id === rel.residentId);
            if (!resident) return null;
            const access       = getResidentAccessibility(resident.id, stats);
            const qualityColor = QUALITY_COLOR[rel.quality] ?? L.muted;
            const scoreColor   = rel.score >= 65 ? L.green : rel.score >= 40 ? L.primary : rel.score >= 20 ? L.gold : L.red;
            const accessColor  = access.level === "accessible" ? L.green : access.level === "receptif" ? L.gold : L.muted;
            const npcState     = npcs.find((n) => n.id === resident.id);
            const isHere       = npcState?.locationSlug === currentLocationSlug;
            const npcLoc       = npcState ? worldLocations.find((l) => l.slug === npcState.locationSlug) : null;

            return (
              <View key={rel.residentId} style={{
                backgroundColor: L.card, borderRadius: 18,
                padding: 16, gap: 12,
                borderWidth: isHere ? 2 : 1,
                borderColor: isHere ? L.primary : L.border,
                shadowColor: "rgba(99,102,241,0.08)", shadowOpacity: 1,
                shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
              }}>

                {/* Top row */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 25,
                    backgroundColor: qualityColor + "15",
                    borderWidth: 2, borderColor: qualityColor + "40",
                    alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <AvatarSprite visual={getNpcVisual(resident.id)} action={toAvatarAction(npcState?.action)} size="xs" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: L.text, fontWeight: "800", fontSize: 16 }}>{resident.name}</Text>
                      {isHere && (
                        <View style={{ backgroundColor: L.primary, borderRadius: 6,
                          paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>ICI</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: L.muted, fontSize: 12 }}>{resident.role} · {resident.status}</Text>
                    {npcLoc && (
                      <Text style={{ color: L.muted, fontSize: 11, marginTop: 2 }}>📍 {npcLoc.name}</Text>
                    )}
                    <Text style={{ color: getCompatibilityBadge(avatar?.interests ?? [], resident.interests) ? L.primary : L.muted,
                      fontSize: 11, marginTop: 1 }}>
                      {getCompatibilityBadge(avatar?.interests ?? [], resident.interests)}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: qualityColor + "15", borderRadius: 8,
                    paddingHorizontal: 8, paddingVertical: 4,
                    borderWidth: 1, borderColor: qualityColor + "35" }}>
                    <Text style={{ color: qualityColor, fontSize: 10, fontWeight: "800" }}>{rel.quality}</Text>
                  </View>
                </View>

                {/* Progress */}
                <RelationProgress status={rel.status} />

                {/* Score bar */}
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: L.muted, fontSize: 11 }}>Score de lien</Text>
                    <Text style={{ color: scoreColor, fontSize: 11, fontWeight: "700" }}>{rel.score}/100</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: L.border, overflow: "hidden" }}>
                    <View style={{ height: 6, borderRadius: 3, width: `${rel.score}%`, backgroundColor: scoreColor }} />
                  </View>
                </View>

                {/* Access badge */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8,
                  backgroundColor: L.bg, borderRadius: 10, padding: 8,
                  borderWidth: 1, borderColor: L.border }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accessColor }} />
                  <Text style={{ color: accessColor, fontSize: 11, fontWeight: "700", flex: 1 }}>{access.hint}</Text>
                  {rel.isFollowing && (
                    <Text style={{ color: L.primary, fontSize: 11 }}>★ Suivi</Text>
                  )}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => { startDirectConversation(resident.id, resident.name); router.push("/(app)/(tabs)/chat"); }}
                    style={{ flex: 1, backgroundColor: L.bg, borderRadius: 12, padding: 11,
                      alignItems: "center", borderWidth: 1, borderColor: L.border }}>
                    <Text style={{ color: L.text, fontWeight: "700", fontSize: 13 }}>💬 Message</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => sendInvitation(resident.id, "coffee-meetup")}
                    style={{ flex: 1,
                      backgroundColor: access.level !== "ferme" ? L.primaryBg : L.bg,
                      borderRadius: 12, padding: 11, alignItems: "center",
                      borderWidth: 1,
                      borderColor: access.level !== "ferme" ? L.primary + "55" : L.border }}>
                    <Text style={{ color: access.level !== "ferme" ? L.primary : L.muted,
                      fontWeight: "700", fontSize: 13 }}>📨 Inviter</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {sorted.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={{ color: L.text, fontSize: 16, fontWeight: "700" }}>Aucune relation encore</Text>
              <Text style={{ color: L.muted, fontSize: 13, textAlign: "center" }}>
                Va à la ville pour rencontrer des habitants
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );
}
