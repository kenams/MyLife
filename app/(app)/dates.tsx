"use client";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getNpcVisual } from "@/lib/avatar-visual";
import { getDateReadiness, getDateVenueOptions, starterResidents } from "@/lib/game-engine";
import { hapticImpact, hapticSuccess } from "@/lib/safe-haptics";
import { useGameStore } from "@/stores/game-store";
import {
  calcChemistry, getChemistryLabel,
  getTierFromScore, TIER_META,
  GIFTS, calcGiftBonus,
  type GiftId,
} from "@/lib/romance";
import type { DateVenueKind } from "@/lib/types";

const L = {
  bg: "#e8edf5", card: "#f0f4fa", border: "#ccd4e0",
  text: "#1e2a3a", textSoft: "#4a5568", muted: "#8fa3b8",
  primary: "#6366f1", primaryBg: "#eef2ff",
  green: "#10b981", greenBg: "#ecfdf5",
  gold: "#f59e0b", goldBg: "#fffbeb",
  red: "#ef4444", redBg: "#fef2f2",
  pink: "#ec4899", pinkBg: "#fdf2f8",
  purple: "#8b5cf6", purpleBg: "#f5f3ff",
  teal: "#14b8a6", tealBg: "#f0fdfa",
};

const VENUE_EMOJI: Record<string, string> = {
  coffee: "☕", park: "🌿", restaurant: "🍽️", cinema: "🎬",
  nightclub: "🎵", rooftop: "🥂",
};
const VENUE_LABEL: Record<string, string> = {
  coffee: "Café", park: "Parc", restaurant: "Restaurant", cinema: "Cinéma",
  nightclub: "Nightclub", rooftop: "Rooftop",
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  proposed:  { bg: L.goldBg,   color: L.gold,   label: "En attente" },
  accepted:  { bg: L.greenBg,  color: L.green,  label: "Confirmé ✓" },
  declined:  { bg: L.redBg,    color: L.red,    label: "Refusé" },
  completed: { bg: L.purpleBg, color: L.purple, label: "Terminé 🎉" },
};

type TabType = "dates" | "cadeaux";

// ── Jauges chimie / relation ───────────────────────────────────────────────────
function MiniBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: L.muted, fontSize: 9, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color, fontSize: 9, fontWeight: "800" }}>{Math.round(value)}%</Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: L.border, overflow: "hidden" }}>
        <View style={{ height: 5, borderRadius: 3,
          width: `${Math.max(0, Math.min(100, value))}%` as `${number}%`,
          backgroundColor: color }} />
      </View>
    </View>
  );
}

// ── Carte profil enrichie ─────────────────────────────────────────────────────
function ProfileCard({ resident, relationship, chemistry, isSelected, onSelect }: {
  resident: (typeof starterResidents)[0];
  relationship: { score: number; status: string } | undefined;
  chemistry: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const score = relationship?.score ?? 0;
  const tier  = getTierFromScore(score);
  const tierMeta = TIER_META[tier];
  const chemInfo = getChemistryLabel(chemistry);

  return (
    <Pressable onPress={onSelect}
      style={{
        borderRadius: 20, overflow: "hidden",
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? L.pink : L.border,
        backgroundColor: isSelected ? L.pinkBg : L.card,
        shadowColor: isSelected ? L.pink : "transparent",
        shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
      }}>
      <View style={{ height: 90, backgroundColor: isSelected ? L.pink + "14" : L.bg,
        alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <AvatarSprite visual={getNpcVisual(resident.id)} action="idle" size="md" />
      </View>
      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: L.text, fontWeight: "800", fontSize: 15 }}>{resident.name}</Text>
          <View style={{ backgroundColor: tierMeta.color + "20", borderRadius: 8,
            paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: tierMeta.color + "40" }}>
            <Text style={{ color: tierMeta.color, fontSize: 10, fontWeight: "900" }}>
              {tierMeta.emoji} {tierMeta.label}
            </Text>
          </View>
        </View>
        <Text style={{ color: L.muted, fontSize: 11 }}>{resident.role}</Text>

        {/* Barres chimie + relation */}
        <MiniBar value={chemistry} color={chemInfo.color} label={`${chemInfo.emoji} Chimie`} />
        <MiniBar value={score} color={tierMeta.color} label="💕 Relation" />

        {isSelected && (
          <View style={{ marginTop: 4, backgroundColor: L.pink, borderRadius: 10,
            paddingVertical: 6, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>✓ Sélectionné</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── Carte cadeau ──────────────────────────────────────────────────────────────
function GiftCard({ gift, npcInterests, canAfford, tier, onSend }: {
  gift: typeof GIFTS[0];
  npcInterests: string[];
  canAfford: boolean;
  tier: ReturnType<typeof getTierFromScore>;
  onSend: () => void;
}) {
  const bonus    = calcGiftBonus(gift, npcInterests);
  const isMatch  = bonus >= gift.baseBonus;
  const tierMeta = TIER_META[gift.minTier];
  const tiers    = ["inconnu","connaissance","ami","crush","couple","exclusif","fiancailles"];
  const locked   = tiers.indexOf(tier) < tiers.indexOf(gift.minTier);

  return (
    <View style={{
      borderRadius: 18, padding: 14, gap: 10,
      backgroundColor: locked ? L.bg : canAfford ? L.card : L.bg,
      borderWidth: 1,
      borderColor: locked ? L.border : isMatch ? L.pink + "30" : L.border,
      opacity: locked ? 0.45 : canAfford ? 1 : 0.6,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14,
          backgroundColor: (isMatch ? L.pink : L.primary) + "15",
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 22 }}>{gift.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: L.text, fontWeight: "800", fontSize: 14 }}>{gift.name}</Text>
          <Text style={{ color: L.muted, fontSize: 11, marginTop: 1 }}>{gift.desc}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={{ color: L.gold, fontWeight: "900", fontSize: 13 }}>💰 {gift.price} cr</Text>
          <Text style={{ color: isMatch ? L.pink : L.muted, fontSize: 11, fontWeight: "700" }}>
            +{bonus} rel {isMatch ? "💕" : ""}
          </Text>
        </View>
      </View>

      {locked ? (
        <View style={{ backgroundColor: L.border + "50", borderRadius: 10,
          paddingVertical: 8, alignItems: "center" }}>
          <Text style={{ color: L.muted, fontSize: 11 }}>
            🔒 Disponible à partir de {tierMeta.emoji} {tierMeta.label}
          </Text>
        </View>
      ) : (
        <Pressable onPress={onSend} disabled={!canAfford}
          style={{ backgroundColor: canAfford ? L.pink : L.border, borderRadius: 12,
            paddingVertical: 9, alignItems: "center" }}>
          <Text style={{ color: canAfford ? "#fff" : L.muted, fontWeight: "800", fontSize: 13 }}>
            {canAfford ? `Offrir ${gift.emoji}` : "Budget insuffisant"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Screen principal ──────────────────────────────────────────────────────────
export default function DatesScreen() {
  const avatar            = useGameStore((s) => s.avatar);
  const stats             = useGameStore((s) => s.stats);
  const relationships     = useGameStore((s) => s.relationships);
  const datePlans         = useGameStore((s) => s.datePlans);
  const proposeDate       = useGameStore((s) => s.proposeDate);
  const respondDatePlan   = useGameStore((s) => s.respondDatePlan);
  const startDateNarrative = useGameStore((s) => s.startDateNarrative);
  const sendGift          = useGameStore((s) => s.sendGift);

  const residents = starterResidents.filter((r) =>
    r.lookingFor.includes("relation amoureuse") || r.lookingFor.includes("amitie profonde") || r.lookingFor.includes("discussion")
  );

  const [tab, setTab]               = useState<TabType>("dates");
  const [selectedId, setSelectedId] = useState(residents[0]?.id ?? "");
  const [selectedVenue, setSelectedVenue] = useState<string>("coffee");
  const [selectedGiftId, setSelectedGiftId] = useState<GiftId | null>(null);
  const [giftFeedback, setGiftFeedback] = useState<{ text: string; color: string } | null>(null);
  const giftAnim = useRef(new Animated.Value(0)).current;
  const giftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected     = residents.find((r) => r.id === selectedId) ?? residents[0];
  const relationship = relationships.find((r) => r.residentId === selected?.id);
  const score        = relationship?.score ?? 0;
  const tier         = getTierFromScore(score);
  const tierMeta     = TIER_META[tier];
  const chemistry    = calcChemistry(
    { sociability: stats.sociability, attractiveness: stats.attractiveness, mood: stats.mood },
    selected?.reputation ?? 60,
    selected?.interests ?? [],
  );
  const chemInfo     = getChemistryLabel(chemistry);

  const readiness  = selected
    ? getDateReadiness(stats, relationship, selected.id)
    : { allowed: false, note: "—", venueOptions: [] as DateVenueKind[] };

  const tiers = ["inconnu","connaissance","ami","crush","couple","exclusif","fiancailles"] as const;
  const tierIndex = tiers.indexOf(tier);

  // Venues débloquées selon tier
  const allVenues = [
    { id: "coffee",     minTier: 1 },
    { id: "park",       minTier: 2 },
    { id: "cinema",     minTier: 2 },
    { id: "restaurant", minTier: 3 },
    { id: "nightclub",  minTier: 4 },
    { id: "rooftop",    minTier: 4 },
  ];
  const unlockedVenues = allVenues.filter((v) => tierIndex >= v.minTier);

  const activePlans  = datePlans.filter((p) => p.status !== "declined" && p.status !== "completed");
  const pastPlans    = datePlans.filter((p) => p.status === "completed");

  const readyChecks = [
    { ok: stats.hygiene >= 50, label: "Hygiène ≥ 50", icon: "🚿" },
    { ok: stats.mood    >= 45, label: "Bonne humeur", icon: "😊" },
    { ok: stats.energy  >= 35, label: "Énergie ≥ 35", icon: "⚡" },
    { ok: score >= 15,         label: "Lien établi",  icon: "🤝" },
  ];

  function showGiftFeedback(text: string, color: string) {
    if (giftTimer.current) clearTimeout(giftTimer.current);
    setGiftFeedback({ text, color });
    giftAnim.setValue(0);
    Animated.sequence([
      Animated.timing(giftAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(giftAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setGiftFeedback(null));
  }

  function handleSendGift(giftId: GiftId) {
    if (!selected) return;
    hapticImpact("medium");
    const res = sendGift(selected.id, selected.name, giftId, selected.interests ?? []);
    if (res.ok) {
      hapticSuccess();
      showGiftFeedback(`${res.reaction}`, L.pink);
    } else {
      showGiftFeedback(res.error ?? "Erreur", L.red);
    }
  }

  // Milestone progression affichage
  const nextTierIndex = Math.min(tiers.length - 1, tierIndex + 1);
  const nextTier = tiers[nextTierIndex];
  const nextTierMeta = TIER_META[nextTier];
  const nextTierScore = [0, 16, 31, 51, 66, 81, 96][nextTierIndex];
  const progressToNext = tierIndex === tiers.length - 1 ? 100
    : Math.round(((score - [0,16,31,51,66,81,96][tierIndex]) / (nextTierScore - [0,16,31,51,66,81,96][tierIndex])) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>
      {/* ── Header ── */}
      <View style={{ backgroundColor: L.pink, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20, overflow: "hidden" }}>
        <View style={{ position: "absolute", bottom: -40, right: -40, width: 160, height: 160,
          borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)" }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}
            style={{ flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.2)" }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>←</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>Retour</Text>
          </Pressable>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>💘 Romance</Text>
          <View style={{ width: 80 }} />
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {([
            { id: "dates",   label: "💌 Dates",   },
            { id: "cadeaux", label: "🎁 Cadeaux",  },
          ] as const).map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 14, alignItems: "center",
                backgroundColor: tab === t.id ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)" }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 60 }}>

        {/* ── Sélection personnage ── */}
        <View>
          <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
            AVEC QUI ?
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {residents.map((r) => {
              const chem = calcChemistry(
                { sociability: stats.sociability, attractiveness: stats.attractiveness, mood: stats.mood },
                r.reputation ?? 60, r.interests ?? [],
              );
              return (
                <View key={r.id} style={{ width: 185 }}>
                  <ProfileCard
                    resident={r}
                    relationship={relationships.find((rel) => rel.residentId === r.id)}
                    chemistry={chem}
                    isSelected={r.id === selectedId}
                    onSelect={() => setSelectedId(r.id)}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Milestone + Chimie ── */}
        {selected && (
          <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, gap: 14,
            borderWidth: 1, borderColor: L.border }}>
            {/* Tier actuel */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 50, height: 50, borderRadius: 16,
                backgroundColor: tierMeta.color + "18", alignItems: "center", justifyContent: "center",
                borderWidth: 2, borderColor: tierMeta.color + "40" }}>
                <Text style={{ fontSize: 24 }}>{tierMeta.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tierMeta.color, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 }}>
                  NIVEAU ACTUEL
                </Text>
                <Text style={{ color: L.text, fontWeight: "900", fontSize: 17 }}>{tierMeta.label}</Text>
                <Text style={{ color: L.muted, fontSize: 11, marginTop: 1 }}>{tierMeta.unlocksDesc}</Text>
              </View>
              <Text style={{ color: tierMeta.color, fontSize: 22, fontWeight: "900" }}>{score}</Text>
            </View>

            {/* Barre progression vers tier suivant */}
            {tier !== "fiancailles" && (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: L.muted, fontSize: 11 }}>
                    Vers {nextTierMeta.emoji} {nextTierMeta.label}
                  </Text>
                  <Text style={{ color: L.primary, fontSize: 11, fontWeight: "700" }}>
                    {score}/{nextTierScore}
                  </Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: L.border, overflow: "hidden" }}>
                  <View style={{ height: 8, borderRadius: 4,
                    width: `${Math.max(0, Math.min(100, progressToNext))}%` as `${number}%`,
                    backgroundColor: nextTierMeta.color }} />
                </View>
              </View>
            )}

            {/* Chimie */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10,
              backgroundColor: chemInfo.color + "10", borderRadius: 12, padding: 10,
              borderWidth: 1, borderColor: chemInfo.color + "30" }}>
              <Text style={{ fontSize: 20 }}>{chemInfo.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: chemInfo.color, fontWeight: "800", fontSize: 13 }}>
                  {chemInfo.label}
                </Text>
                <Text style={{ color: L.muted, fontSize: 11 }}>
                  Compatibilité avec {selected.name} : {chemistry}%
                </Text>
              </View>
            </View>

            {/* Jalons visuels */}
            <View>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 8 }}>
                PROGRESSION COMPLÈTE
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {tiers.map((t, i) => {
                  const tm = TIER_META[t];
                  const done = i <= tierIndex;
                  return (
                    <View key={t} style={{ alignItems: "center", gap: 3, flex: 1 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14,
                        backgroundColor: done ? tm.color + "25" : L.bg,
                        borderWidth: done ? 2 : 1,
                        borderColor: done ? tm.color : L.border,
                        alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: i === tierIndex ? 14 : 10 }}>{tm.emoji}</Text>
                      </View>
                      {i < tiers.length - 1 && (
                        <View style={{ position: "absolute", left: "50%", top: 13, height: 2, width: "100%",
                          backgroundColor: i < tierIndex ? tm.color : L.border }} />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ── TAB: DATES ── */}
        {tab === "dates" && (
          <>
            {/* Checklist état */}
            <View>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
                TON ÉTAT
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {readyChecks.map((c) => (
                  <View key={c.label} style={{
                    flexDirection: "row", alignItems: "center", gap: 6,
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                    backgroundColor: c.ok ? L.greenBg : L.redBg,
                    borderWidth: 1, borderColor: c.ok ? "#6ee7b7" : "#fca5a5" }}>
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

            {/* Choix du lieu */}
            <View>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
                OÙ ?
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {allVenues.map((v) => {
                  const unlocked = tierIndex >= v.minTier;
                  const active   = v.id === selectedVenue;
                  const reqTier  = TIER_META[tiers[v.minTier]];
                  return (
                    <Pressable key={v.id}
                      onPress={() => unlocked && setSelectedVenue(v.id)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                        backgroundColor: active ? L.pinkBg : unlocked ? L.card : L.bg,
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? L.pink : unlocked ? L.border : L.border,
                        opacity: unlocked ? 1 : 0.5,
                        flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 18 }}>{VENUE_EMOJI[v.id] ?? "📍"}</Text>
                      <View>
                        <Text style={{ color: active ? L.pink : L.text, fontWeight: active ? "800" : "500", fontSize: 13 }}>
                          {VENUE_LABEL[v.id] ?? v.id}
                        </Text>
                        {!unlocked && (
                          <Text style={{ color: L.muted, fontSize: 9 }}>
                            🔒 {reqTier.emoji} {reqTier.label}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Bouton proposer */}
            {selected && (
              <Pressable
                onPress={() => { hapticImpact("medium"); proposeDate(selected.id, selected.name, selectedVenue as DateVenueKind); }}
                disabled={!readiness.allowed}
                style={{
                  backgroundColor: readiness.allowed ? L.pink : L.bg,
                  borderRadius: 18, padding: 18,
                  alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10,
                  opacity: readiness.allowed ? 1 : 0.5,
                  borderWidth: readiness.allowed ? 0 : 1, borderColor: L.border,
                  shadowColor: L.pink, shadowOpacity: readiness.allowed ? 0.25 : 0,
                  shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
                }}>
                <Text style={{ fontSize: 20 }}>💌</Text>
                <Text style={{ color: readiness.allowed ? "#fff" : L.muted, fontWeight: "900", fontSize: 15 }}>
                  Proposer à {selected?.name}
                </Text>
              </Pressable>
            )}

            {/* Plans actifs */}
            {activePlans.length > 0 && (
              <View>
                <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
                  PLANS EN COURS
                </Text>
                <View style={{ gap: 10 }}>
                  {activePlans.map((plan) => {
                    const s = STATUS_STYLE[plan.status] ?? STATUS_STYLE.proposed;
                    return (
                      <View key={plan.id} style={{
                        backgroundColor: s.bg, borderRadius: 18, padding: 16,
                        borderWidth: 1, borderColor: s.color + "40", gap: 10 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View>
                            <Text style={{ color: L.text, fontWeight: "800", fontSize: 15 }}>
                              {VENUE_EMOJI[plan.venueKind] ?? "📍"} {VENUE_LABEL[plan.venueKind] ?? plan.venueLabel}
                            </Text>
                            <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }}>
                              avec {plan.residentName}
                            </Text>
                          </View>
                          <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                            backgroundColor: s.color + "18", borderWidth: 1, borderColor: s.color + "40" }}>
                            <Text style={{ color: s.color, fontWeight: "700", fontSize: 11 }}>{s.label}</Text>
                          </View>
                        </View>
                        {plan.status === "proposed" && (
                          <View style={{ flexDirection: "row", gap: 10 }}>
                            <Pressable onPress={() => { hapticSuccess(); respondDatePlan(plan.id, "accepted"); }}
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
                          <Pressable
                            onPress={() => {
                              hapticSuccess();
                              startDateNarrative(plan.id);
                              router.push("/(app)/date-narrative");
                            }}
                            style={{ backgroundColor: L.pink, borderRadius: 14,
                              paddingVertical: 14, alignItems: "center",
                              flexDirection: "row", justifyContent: "center", gap: 8,
                              shadowColor: L.pink, shadowOpacity: 0.25, shadowRadius: 12 }}>
                            <Text style={{ fontSize: 18 }}>🎭</Text>
                            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                              Vivre le date
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Historique */}
            {pastPlans.length > 0 && (
              <View>
                <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 }}>
                  HISTORIQUE ({pastPlans.length})
                </Text>
                {pastPlans.slice(-4).map((plan) => (
                  <View key={plan.id} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: L.border }}>
                    <Text style={{ fontSize: 18 }}>{VENUE_EMOJI[plan.venueKind] ?? "📍"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: L.text, fontWeight: "600", fontSize: 13 }}>
                        {VENUE_LABEL[plan.venueKind] ?? plan.venueLabel} avec {plan.residentName}
                      </Text>
                    </View>
                    <Text style={{ color: L.purple, fontSize: 13 }}>🎉</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Accès Love Room */}
            {(tier === "couple" || tier === "exclusif" || tier === "fiancailles") && (
              <Pressable
                onPress={() => router.push("/(app)/rooms")}
                style={{ backgroundColor: "#2d1020", borderRadius: 20, padding: 18,
                  borderWidth: 1.5, borderColor: L.pink + "50",
                  flexDirection: "row", alignItems: "center", gap: 14,
                  shadowColor: L.pink, shadowOpacity: 0.15, shadowRadius: 12 }}>
                <Text style={{ fontSize: 32 }}>🏨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: L.pink, fontWeight: "900", fontSize: 14 }}>Love Room débloquée !</Text>
                  <Text style={{ color: "#c4748e", fontSize: 12, marginTop: 2 }}>
                    Crée une room privée intime avec {selected?.name}.
                  </Text>
                </View>
                <Text style={{ color: L.pink, fontSize: 18 }}>→</Text>
              </Pressable>
            )}
          </>
        )}

        {/* ── TAB: CADEAUX ── */}
        {tab === "cadeaux" && selected && (
          <>
            <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 14,
              borderWidth: 1, borderColor: L.pink + "25",
              flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 22 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: L.text, fontWeight: "700", fontSize: 13 }}>
                  Offrir un cadeau à {selected.name}
                </Text>
                <Text style={{ color: L.muted, fontSize: 11, marginTop: 2 }}>
                  Budget : 💰 {Math.round(stats.money)} cr · Centres d'intérêt : {selected.interests?.join(", ")}
                </Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              {GIFTS.map((gift) => (
                <GiftCard
                  key={gift.id}
                  gift={gift}
                  npcInterests={selected.interests ?? []}
                  canAfford={stats.money >= gift.price}
                  tier={tier}
                  onSend={() => handleSendGift(gift.id as GiftId)}
                />
              ))}
            </View>
          </>
        )}

      </ScrollView>

      {/* Toast feedback cadeau */}
      {giftFeedback && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute", bottom: 80, left: 16, right: 16,
            opacity: giftAnim,
            transform: [{ translateY: giftAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}>
          <View style={{ backgroundColor: giftFeedback.color, borderRadius: 18,
            padding: 16, shadowColor: giftFeedback.color, shadowOpacity: 0.3, shadowRadius: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, textAlign: "center" }}>
              {giftFeedback.text}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
