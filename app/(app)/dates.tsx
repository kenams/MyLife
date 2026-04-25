import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getNpcVisual } from "@/lib/avatar-visual";
import { getDateReadiness, getDateVenueOptions, starterResidents } from "@/lib/game-engine";
import { getDateVenueLabel, getRelationshipLabel } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";
import type { DateVenueKind } from "@/lib/types";

const VENUE_EMOJI: Record<DateVenueKind, string> = {
  coffee:     "☕",
  park:       "🌿",
  restaurant: "🍽️",
  cinema:     "🎬"
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  proposed:  { bg: "#f6b94f22", color: "#f6b94f", label: "En attente" },
  accepted:  { bg: "#38c79322", color: "#38c793", label: "Confirmé ✓" },
  declined:  { bg: "#ff6b6b22", color: "#ff6b6b", label: "Refusé" },
  completed: { bg: "#8b7cff22", color: "#8b7cff", label: "Terminé 🎉" }
};

// ─── Carte profil pour date ───────────────────────────────────────────────────
function ProfileCard({ resident, relationship, isSelected, onSelect }: {
  resident: (typeof starterResidents)[0];
  relationship: { score: number; status: string } | undefined;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const score = relationship?.score ?? 0;
  const hearts = score > 60 ? "❤️❤️❤️" : score > 35 ? "❤️❤️🤍" : score > 15 ? "❤️🤍🤍" : "🤍🤍🤍";

  return (
    <Pressable
      onPress={onSelect}
      style={{
        borderRadius: 20, overflow: "hidden",
        borderWidth: 2,
        borderColor: isSelected ? colors.accent : "rgba(255,255,255,0.08)",
        backgroundColor: isSelected ? colors.accent + "12" : "rgba(255,255,255,0.04)"
      }}
    >
      {/* Avatar NPC */}
      <View style={{ height: 90, backgroundColor: isSelected ? colors.accent + "30" : "rgba(255,255,255,0.06)",
        alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <AvatarSprite visual={getNpcVisual(resident.id)} action="idle" size="md" />
      </View>
      <View style={{ padding: 14, gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{resident.name}</Text>
          <Text style={{ fontSize: 13 }}>{hearts}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{resident.role}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={2}>{resident.bio}</Text>
        {isSelected && (
          <View style={{ marginTop: 6, backgroundColor: colors.accent, borderRadius: 8,
            paddingVertical: 6, alignItems: "center" }}>
            <Text style={{ color: "#07111f", fontWeight: "800", fontSize: 12 }}>✓ Sélectionné</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DatesScreen() {
  const avatar          = useGameStore((s) => s.avatar);
  const stats           = useGameStore((s) => s.stats);
  const relationships   = useGameStore((s) => s.relationships);
  const datePlans       = useGameStore((s) => s.datePlans);
  const proposeDate     = useGameStore((s) => s.proposeDate);
  const respondDatePlan = useGameStore((s) => s.respondDatePlan);
  const completeDatePlan = useGameStore((s) => s.completeDatePlan);

  const residents = starterResidents.filter((r) =>
    r.lookingFor.includes("relation amoureuse") || r.lookingFor.includes("amitie profonde")
  );

  const [selectedId, setSelectedId]     = useState(residents[0]?.id ?? "");
  const [selectedVenue, setSelectedVenue] = useState<DateVenueKind>("coffee");

  const selected     = residents.find((r) => r.id === selectedId) ?? residents[0];
  const relationship = relationships.find((r) => r.residentId === selected?.id);
  const readiness    = selected
    ? getDateReadiness(stats, relationship, selected.id)
    : { allowed: false, note: "—", venueOptions: [] as DateVenueKind[] };
  const allowedVenues = useMemo(() => getDateVenueOptions(stats), [stats]);
  const activePlans = datePlans.filter((p) => p.status !== "declined" && p.status !== "completed");
  const pastPlans   = datePlans.filter((p) => p.status === "completed");

  // Indicateurs d'état
  const readyChecks = [
    { ok: stats.hygiene >= 50, label: "Hygiène ≥ 50", icon: "🚿" },
    { ok: stats.mood    >= 45, label: "Bonne humeur", icon: "😊" },
    { ok: stats.energy  >= 35, label: "Énergie ≥ 35", icon: "⚡" },
    { ok: (relationship?.score ?? 0) >= 20, label: "Lien établi", icon: "🤝" }
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={{ backgroundColor: "#0b1a2d", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 6,
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>←</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Retour</Text>
          </Pressable>
          <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
            backgroundColor: "rgba(255,107,107,0.15)", borderWidth: 1, borderColor: "rgba(255,107,107,0.3)" }}>
            <Text style={{ color: "#ff6b6b", fontWeight: "700", fontSize: 12 }}>💘 Rendez-vous</Text>
          </View>
        </View>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 22 }}>Proposer un date</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
          Choisis une personne et un lieu. Ton état compte.
        </Text>
      </View>

      <View style={{ padding: 20, gap: 24 }}>

        {/* ── CHECKLIST PRÉREQUIS ── */}
        <View>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>
            TON ÉTAT
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {readyChecks.map((c) => (
              <View key={c.label} style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                backgroundColor: c.ok ? "#38c79318" : "#ff6b6b12",
                borderWidth: 1, borderColor: c.ok ? "#38c79340" : "#ff6b6b30"
              }}>
                <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                <Text style={{ color: c.ok ? "#38c793" : "#ff6b6b", fontSize: 11, fontWeight: "700" }}>
                  {c.label}
                </Text>
              </View>
            ))}
          </View>
          {!readiness.allowed && (
            <View style={{ marginTop: 10, backgroundColor: "rgba(246,185,79,0.1)", borderRadius: 12,
              padding: 12, borderWidth: 1, borderColor: "rgba(246,185,79,0.25)" }}>
              <Text style={{ color: "#f6b94f", fontSize: 12, fontWeight: "600" }}>⚠ {readiness.note}</Text>
            </View>
          )}
        </View>

        {/* ── PROFILS ── */}
        <View>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>
            AVEC QUI ?
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {residents.map((r) => (
              <View key={r.id} style={{ width: 170 }}>
                <ProfileCard
                  resident={r}
                  relationship={relationships.find((rel) => rel.residentId === r.id)}
                  isSelected={r.id === selectedId}
                  onSelect={() => setSelectedId(r.id)}
                />
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── LIEU ── */}
        <View>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>
            OÙ ?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {allowedVenues.map((v) => {
              const active   = v === selectedVenue;
              const blocked  = !readiness.venueOptions.includes(v);
              return (
                <Pressable
                  key={v}
                  onPress={() => !blocked && setSelectedVenue(v)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
                    backgroundColor: active ? colors.accent + "22" : "rgba(255,255,255,0.05)",
                    borderWidth: 1.5,
                    borderColor: active ? colors.accent : blocked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)",
                    opacity: blocked ? 0.4 : 1,
                    flexDirection: "row", alignItems: "center", gap: 8
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{VENUE_EMOJI[v] ?? "📍"}</Text>
                  <Text style={{ color: active ? colors.accent : colors.text, fontWeight: active ? "800" : "500", fontSize: 13 }}>
                    {getDateVenueLabel(v)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── BOUTON PROPOSER ── */}
        {selected && (
          <Pressable
            onPress={() => proposeDate(selected.id, selected.name, selectedVenue)}
            disabled={!readiness.allowed}
            style={{
              backgroundColor: readiness.allowed ? "#ff6b6b" : "rgba(255,255,255,0.06)",
              borderRadius: 18, padding: 18,
              alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10,
              opacity: readiness.allowed ? 1 : 0.5
            }}
          >
            <Text style={{ fontSize: 20 }}>💌</Text>
            <Text style={{ color: readiness.allowed ? "#fff" : colors.muted, fontWeight: "900", fontSize: 15 }}>
              Proposer à {selected.name}
            </Text>
          </Pressable>
        )}

        {/* ── PLANS ACTIFS ── */}
        {activePlans.length > 0 && (
          <View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>
              PLANS EN COURS
            </Text>
            <View style={{ gap: 10 }}>
              {activePlans.map((plan) => {
                const s = STATUS_STYLE[plan.status] ?? STATUS_STYLE.proposed;
                return (
                  <View key={plan.id} style={{
                    backgroundColor: s.bg, borderRadius: 16, padding: 16,
                    borderWidth: 1, borderColor: s.color + "40", gap: 10
                  }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View>
                        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                          {VENUE_EMOJI[plan.venueLabel as DateVenueKind] ?? "📍"} {plan.venueLabel}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          avec {plan.residentName}
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                        backgroundColor: s.color + "22", borderWidth: 1, borderColor: s.color }}>
                        <Text style={{ color: s.color, fontWeight: "700", fontSize: 11 }}>{s.label}</Text>
                      </View>
                    </View>
                    {plan.status === "proposed" && (
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable onPress={() => respondDatePlan(plan.id, "accepted")}
                          style={{ flex: 1, backgroundColor: "#38c793", borderRadius: 12,
                            paddingVertical: 10, alignItems: "center" }}>
                          <Text style={{ color: "#07111f", fontWeight: "800" }}>✓ Confirmer</Text>
                        </Pressable>
                        <Pressable onPress={() => respondDatePlan(plan.id, "declined")}
                          style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
                            paddingVertical: 10, alignItems: "center" }}>
                          <Text style={{ color: colors.muted, fontWeight: "700" }}>✗ Refuser</Text>
                        </Pressable>
                      </View>
                    )}
                    {plan.status === "accepted" && (
                      <Pressable onPress={() => completeDatePlan(plan.id)}
                        style={{ backgroundColor: "#8b7cff", borderRadius: 12,
                          paddingVertical: 12, alignItems: "center" }}>
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>🎉 Jouer le date</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── HISTORIQUE ── */}
        {pastPlans.length > 0 && (
          <View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>
              HISTORIQUE ({pastPlans.length})
            </Text>
            {pastPlans.slice(-3).map((plan) => (
              <View key={plan.id} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                paddingVertical: 10, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                <Text style={{ fontSize: 18 }}>{VENUE_EMOJI[plan.venueLabel as DateVenueKind] ?? "📍"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>
                    {plan.venueLabel} avec {plan.residentName}
                  </Text>
                </View>
                <Text style={{ color: "#8b7cff", fontSize: 12 }}>🎉</Text>
              </View>
            ))}
          </View>
        )}

      </View>
    </ScrollView>
  );
}
