import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getNpcVisual } from "@/lib/avatar-visual";
import { getDateReadiness, getDateVenueOptions, starterResidents } from "@/lib/game-engine";
import { getDateVenueLabel, getRelationshipLabel } from "@/lib/selectors";
import { useGameStore } from "@/stores/game-store";
import type { DateVenueKind } from "@/lib/types";

const L = {
  bg: "#f5f7fa", card: "#ffffff", border: "#e8edf5",
  text: "#1e2a3a", textSoft: "#4a5568", muted: "#94a3b8",
  primary: "#6366f1", primaryBg: "#eef2ff",
  green: "#10b981", greenBg: "#ecfdf5",
  gold: "#f59e0b", goldBg: "#fffbeb",
  red: "#ef4444", redBg: "#fef2f2",
  pink: "#ec4899", pinkBg: "#fdf2f8",
  purple: "#8b5cf6", purpleBg: "#f5f3ff",
};

const VENUE_EMOJI: Record<DateVenueKind, string> = {
  coffee: "☕", park: "🌿", restaurant: "🍽️", cinema: "🎬"
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  proposed:  { bg: L.goldBg,   color: L.gold,   label: "En attente" },
  accepted:  { bg: L.greenBg,  color: L.green,  label: "Confirmé ✓" },
  declined:  { bg: L.redBg,    color: L.red,    label: "Refusé" },
  completed: { bg: L.purpleBg, color: L.purple, label: "Terminé 🎉" },
};

// ─── Carte profil ─────────────────────────────────────────────────────────────
function ProfileCard({ resident, relationship, isSelected, onSelect }: {
  resident: (typeof starterResidents)[0];
  relationship: { score: number; status: string } | undefined;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const score  = relationship?.score ?? 0;
  const hearts = score > 60 ? "❤️❤️❤️" : score > 35 ? "❤️❤️🤍" : score > 15 ? "❤️🤍🤍" : "🤍🤍🤍";

  return (
    <Pressable
      onPress={onSelect}
      style={{
        borderRadius: 20, overflow: "hidden",
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? L.pink : L.border,
        backgroundColor: isSelected ? L.pinkBg : L.card,
        shadowColor: isSelected ? L.pink : "transparent",
        shadowOpacity: 0.15, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }, elevation: isSelected ? 3 : 1,
      }}
    >
      <View style={{ height: 90,
        backgroundColor: isSelected ? L.pink + "18" : L.bg,
        alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <AvatarSprite visual={getNpcVisual(resident.id)} action="idle" size="md" />
      </View>
      <View style={{ padding: 14, gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: L.text, fontWeight: "800", fontSize: 15 }}>{resident.name}</Text>
          <Text style={{ fontSize: 13 }}>{hearts}</Text>
        </View>
        <Text style={{ color: L.muted, fontSize: 11 }}>{resident.role}</Text>
        <Text style={{ color: L.textSoft, fontSize: 11 }} numberOfLines={2}>{resident.bio}</Text>
        {isSelected && (
          <View style={{ marginTop: 6, backgroundColor: L.pink, borderRadius: 8,
            paddingVertical: 6, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>✓ Sélectionné</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DatesScreen() {
  const avatar            = useGameStore((s) => s.avatar);
  const stats             = useGameStore((s) => s.stats);
  const relationships     = useGameStore((s) => s.relationships);
  const datePlans         = useGameStore((s) => s.datePlans);
  const proposeDate       = useGameStore((s) => s.proposeDate);
  const respondDatePlan   = useGameStore((s) => s.respondDatePlan);
  const completeDatePlan  = useGameStore((s) => s.completeDatePlan);

  const residents = starterResidents.filter((r) =>
    r.lookingFor.includes("relation amoureuse") || r.lookingFor.includes("amitie profonde")
  );

  const [selectedId, setSelectedId]       = useState(residents[0]?.id ?? "");
  const [selectedVenue, setSelectedVenue] = useState<DateVenueKind>("coffee");

  const selected     = residents.find((r) => r.id === selectedId) ?? residents[0];
  const relationship = relationships.find((r) => r.residentId === selected?.id);
  const readiness    = selected
    ? getDateReadiness(stats, relationship, selected.id)
    : { allowed: false, note: "—", venueOptions: [] as DateVenueKind[] };
  const allowedVenues = useMemo(() => getDateVenueOptions(stats), [stats]);
  const activePlans   = datePlans.filter((p) => p.status !== "declined" && p.status !== "completed");
  const pastPlans     = datePlans.filter((p) => p.status === "completed");

  const readyChecks = [
    { ok: stats.hygiene >= 50, label: "Hygiène ≥ 50", icon: "🚿" },
    { ok: stats.mood    >= 45, label: "Bonne humeur", icon: "😊" },
    { ok: stats.energy  >= 35, label: "Énergie ≥ 35", icon: "⚡" },
    { ok: (relationship?.score ?? 0) >= 20, label: "Lien établi", icon: "🤝" },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: L.bg }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 60 }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={{ backgroundColor: L.pink, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24, overflow: "hidden" }}>
        <View style={{ position: "absolute", bottom: -40, right: -40, width: 160, height: 160,
          borderRadius: 80, backgroundColor: "rgba(255,255,255,0.1)" }} />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}
            style={{ flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.2)" }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>←</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>Retour</Text>
          </Pressable>
          <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.2)" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>💘 Rendez-vous</Text>
          </View>
        </View>
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22 }}>Proposer un date</Text>
        <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 }}>
          Choisis une personne et un lieu. Ton état compte.
        </Text>
      </View>

      <View style={{ padding: 20, gap: 24 }}>

        {/* ── Checklist ─────────────────────────────────────────── */}
        <View>
          <Text style={{ color: L.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>
            TON ÉTAT
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {readyChecks.map((c) => (
              <View key={c.label} style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                backgroundColor: c.ok ? L.greenBg : L.redBg,
                borderWidth: 1, borderColor: c.ok ? "#6ee7b7" : "#fca5a5",
              }}>
                <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                <Text style={{ color: c.ok ? L.green : L.red, fontSize: 11, fontWeight: "700" }}>
                  {c.label}
                </Text>
              </View>
            ))}
          </View>
          {!readiness.allowed && (
            <View style={{ marginTop: 10, backgroundColor: L.goldBg, borderRadius: 12,
              padding: 12, borderWidth: 1, borderColor: "#fcd34d" }}>
              <Text style={{ color: L.gold, fontSize: 12, fontWeight: "600" }}>⚠ {readiness.note}</Text>
            </View>
          )}
        </View>

        {/* ── Profils ───────────────────────────────────────────── */}
        <View>
          <Text style={{ color: L.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>
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

        {/* ── Lieu ─────────────────────────────────────────────── */}
        <View>
          <Text style={{ color: L.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>
            OÙ ?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {allowedVenues.map((v) => {
              const active  = v === selectedVenue;
              const blocked = !readiness.venueOptions.includes(v);
              return (
                <Pressable
                  key={v}
                  onPress={() => !blocked && setSelectedVenue(v)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
                    backgroundColor: active ? L.pinkBg : L.card,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? L.pink : blocked ? L.bg : L.border,
                    opacity: blocked ? 0.4 : 1,
                    flexDirection: "row", alignItems: "center", gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{VENUE_EMOJI[v] ?? "📍"}</Text>
                  <Text style={{ color: active ? L.pink : L.text, fontWeight: active ? "800" : "500", fontSize: 13 }}>
                    {getDateVenueLabel(v)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Bouton proposer ───────────────────────────────────── */}
        {selected && (
          <Pressable
            onPress={() => proposeDate(selected.id, selected.name, selectedVenue)}
            disabled={!readiness.allowed}
            style={{
              backgroundColor: readiness.allowed ? L.pink : L.bg,
              borderRadius: 18, padding: 18,
              alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10,
              opacity: readiness.allowed ? 1 : 0.5,
              borderWidth: readiness.allowed ? 0 : 1,
              borderColor: L.border,
              shadowColor: L.pink, shadowOpacity: readiness.allowed ? 0.25 : 0,
              shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
            }}
          >
            <Text style={{ fontSize: 20 }}>💌</Text>
            <Text style={{ color: readiness.allowed ? "#fff" : L.muted, fontWeight: "900", fontSize: 15 }}>
              Proposer à {selected.name}
            </Text>
          </Pressable>
        )}

        {/* ── Plans actifs ──────────────────────────────────────── */}
        {activePlans.length > 0 && (
          <View>
            <Text style={{ color: L.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>
              PLANS EN COURS
            </Text>
            <View style={{ gap: 10 }}>
              {activePlans.map((plan) => {
                const s = STATUS_STYLE[plan.status] ?? STATUS_STYLE.proposed;
                return (
                  <View key={plan.id} style={{
                    backgroundColor: s.bg, borderRadius: 16, padding: 16,
                    borderWidth: 1, borderColor: s.color + "55", gap: 10,
                  }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View>
                        <Text style={{ color: L.text, fontWeight: "800", fontSize: 15 }}>
                          {VENUE_EMOJI[plan.venueLabel as DateVenueKind] ?? "📍"} {plan.venueLabel}
                        </Text>
                        <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }}>
                          avec {plan.residentName}
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                        backgroundColor: s.color + "18", borderWidth: 1, borderColor: s.color + "55" }}>
                        <Text style={{ color: s.color, fontWeight: "700", fontSize: 11 }}>{s.label}</Text>
                      </View>
                    </View>
                    {plan.status === "proposed" && (
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable onPress={() => respondDatePlan(plan.id, "accepted")}
                          style={{ flex: 1, backgroundColor: L.green, borderRadius: 12,
                            paddingVertical: 10, alignItems: "center" }}>
                          <Text style={{ color: "#fff", fontWeight: "800" }}>✓ Confirmer</Text>
                        </Pressable>
                        <Pressable onPress={() => respondDatePlan(plan.id, "declined")}
                          style={{ flex: 1, backgroundColor: L.bg, borderRadius: 12,
                            paddingVertical: 10, alignItems: "center",
                            borderWidth: 1, borderColor: L.border }}>
                          <Text style={{ color: L.muted, fontWeight: "700" }}>✗ Refuser</Text>
                        </Pressable>
                      </View>
                    )}
                    {plan.status === "accepted" && (
                      <Pressable onPress={() => completeDatePlan(plan.id)}
                        style={{ backgroundColor: L.purple, borderRadius: 12,
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

        {/* ── Historique ───────────────────────────────────────── */}
        {pastPlans.length > 0 && (
          <View>
            <Text style={{ color: L.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 }}>
              HISTORIQUE ({pastPlans.length})
            </Text>
            {pastPlans.slice(-3).map((plan) => (
              <View key={plan.id} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                paddingVertical: 10, borderBottomWidth: 1, borderColor: L.border }}>
                <Text style={{ fontSize: 18 }}>{VENUE_EMOJI[plan.venueLabel as DateVenueKind] ?? "📍"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: L.text, fontWeight: "600", fontSize: 13 }}>
                    {plan.venueLabel} avec {plan.residentName}
                  </Text>
                </View>
                <Text style={{ color: L.purple, fontSize: 12 }}>🎉</Text>
              </View>
            ))}
          </View>
        )}

      </View>
    </ScrollView>
  );
}
