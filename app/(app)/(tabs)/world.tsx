import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";

import { VillageMap } from "@/components/village-map";
import { buildCityIntel } from "@/lib/city-intelligence";
import { useGameStore, worldLocations } from "@/stores/game-store";

// ─── Constantes ───────────────────────────────────────────────────────────────

const BG = "#070d19";
const CARD_BG = "#0e1623";
const CARD_BORDER = "rgba(255,255,255,0.07)";
const TEXT = "#f0f4f8";
const TEXT_SOFT = "rgba(240,244,248,0.60)";
const TEXT_MUTED = "rgba(240,244,248,0.35)";
const ACCENT = "#38c793";

// Couleurs par catégorie de lieu
const KIND_STYLE: Record<string, { emoji: string; color: string; bg: string }> = {
  home:    { emoji: "🏠", color: "#d7a86e", bg: "rgba(215,168,110,0.12)" },
  food:    { emoji: "🍽️", color: "#f97316", bg: "rgba(249,115,22,0.12)"  },
  social:  { emoji: "💬", color: "#38c793", bg: "rgba(56,199,147,0.12)"  },
  work:    { emoji: "💼", color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  wellness:{ emoji: "🌿", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  public:  { emoji: "🌳", color: "#86efac", bg: "rgba(134,239,172,0.11)" },
};

const ACTION_EMOJI: Record<string, string> = {
  sleeping: "😴", eating: "🍽️", chatting: "💬",
  exercising: "💪", walking: "🚶", working: "💼",
  idle: "💭", waving: "👋",
};

// Organisation par quartier
const NEIGHBORHOODS: Array<{
  label: string;
  slugs: string[];
  color: string;
}> = [
  { label: "🏡 Residences", color: "#d7a86e",
    slugs: ["home", "residence-populaire", "residence-confort", "residence-luxe"] },
  { label: "🌿 Parc & Santé", color: "#86efac",
    slugs: ["park", "gym", "spa"] },
  { label: "🍽️ Alimentation", color: "#f97316",
    slugs: ["market", "restaurant"] },
  { label: "💼 Travail", color: "#60a5fa",
    slugs: ["office", "startup", "library"] },
  { label: "💬 Social & Sorties", color: "#a78bfa",
    slugs: ["cafe", "cinema", "nightclub", "rooftop-bar"] },
];

// ─── Composants utilitaires ───────────────────────────────────────────────────

function MoneyBadge({ amount }: { amount: number }) {
  const color = amount >= 200 ? "#f6b94f" : amount >= 80 ? "#86efac" : "#f87171";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(0,0,0,0.28)", borderRadius: 8,
      paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ fontSize: 10 }}>💰</Text>
      <Text style={{ color, fontSize: 10, fontWeight: "800" }}>{amount}</Text>
    </View>
  );
}

function NpcPill({ name, action, money }: { name: string; action: string; money: number }) {
  const emoji = ACTION_EMOJI[action] ?? "•";
  const moneyColor = money >= 200 ? "#f6b94f" : money >= 80 ? "#86efac" : "#f87171";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 5, marginBottom: 4 }}>
      <Text style={{ fontSize: 14 }}>{emoji}</Text>
      <Text style={{ color: TEXT, fontSize: 12, fontWeight: "700", flex: 1 }}>{name}</Text>
      <Text style={{ color: TEXT_MUTED, fontSize: 10 }}>{action}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2,
        backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 6,
        paddingHorizontal: 5, paddingVertical: 2 }}>
        <Text style={{ color: moneyColor, fontSize: 10, fontWeight: "800" }}>💰{money}</Text>
      </View>
    </View>
  );
}

function LocationCard({
  slug,
  isHere,
  npcCount,
  onPress
}: {
  slug: string;
  isHere: boolean;
  npcCount: number;
  onPress: () => void;
}) {
  const loc = worldLocations.find((l) => l.slug === slug);
  if (!loc) return null;
  const style = KIND_STYLE[loc.kind] ?? KIND_STYLE.public;
  const borderColor = isHere ? ACCENT : CARD_BORDER;
  const bgColor = isHere ? "rgba(56,199,147,0.08)" : CARD_BG;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1, minWidth: 140, margin: 5,
        borderRadius: 16, borderWidth: isHere ? 1.5 : 1,
        borderColor, backgroundColor: bgColor,
        padding: 12, gap: 8,
      }}>
      {/* Icône + badges */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ width: 38, height: 38, borderRadius: 12,
          backgroundColor: style.bg,
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20 }}>{style.emoji}</Text>
        </View>
        <View style={{ gap: 4, alignItems: "flex-end" }}>
          {isHere && (
            <View style={{ backgroundColor: ACCENT, borderRadius: 7,
              paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ color: "#07111f", fontSize: 9, fontWeight: "900" }}>ICI</Text>
            </View>
          )}
          {npcCount > 0 && (
            <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 7,
              paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: TEXT_SOFT, fontSize: 9, fontWeight: "800" }}>
                {npcCount} bot{npcCount > 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Nom */}
      <View>
        <Text numberOfLines={1} style={{ color: isHere ? ACCENT : TEXT,
          fontSize: 13, fontWeight: "800" }}>{loc.name}</Text>
        <Text numberOfLines={1} style={{ color: style.color, fontSize: 10,
          fontWeight: "700", marginTop: 1, textTransform: "uppercase",
          letterSpacing: 0.5 }}>{loc.costHint}</Text>
      </View>
    </Pressable>
  );
}

// ─── Panel de détail lieu (bottom sheet) ──────────────────────────────────────

function LocationPanel({
  slug,
  currentSlug,
  npcs,
  onTravel,
  onClose,
}: {
  slug: string;
  currentSlug: string;
  npcs: import("@/lib/types").NpcState[];
  onTravel: (slug: string) => void;
  onClose: () => void;
}) {
  const loc = worldLocations.find((l) => l.slug === slug);
  if (!loc) return null;
  const style = KIND_STYLE[loc.kind] ?? KIND_STYLE.public;
  const isHere = slug === currentSlug;
  const locNpcs = npcs.filter((n) => n.locationSlug === slug);
  const totalMoney = locNpcs.reduce((sum, n) => sum + n.money, 0);

  return (
    <View style={{
      backgroundColor: "#111827", borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
      padding: 20, paddingBottom: 36, gap: 16,
    }}>
      {/* Drag handle */}
      <View style={{ width: 40, height: 4, borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 4 }} />

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16,
          backgroundColor: style.bg, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 28 }}>{style.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: TEXT, fontSize: 18, fontWeight: "900" }}>{loc.name}</Text>
          <Text style={{ color: style.color, fontSize: 12, fontWeight: "700",
            textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>
            {loc.kind} · {loc.costHint}
          </Text>
        </View>
        {locNpcs.length > 0 && (
          <MoneyBadge amount={totalMoney} />
        )}
      </View>

      {/* Description */}
      <Text style={{ color: TEXT_SOFT, fontSize: 13, lineHeight: 19 }}>{loc.summary}</Text>

      {/* NPCs présents */}
      {locNpcs.length > 0 ? (
        <View>
          <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: "800",
            textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            {locNpcs.length} habitant{locNpcs.length > 1 ? "s" : ""} ici
          </Text>
          {locNpcs.map((npc) => (
            <NpcPill key={npc.id} name={npc.name} action={npc.action} money={npc.money} />
          ))}
        </View>
      ) : (
        <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12,
          padding: 12, alignItems: "center" }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 12 }}>Aucun habitant ici pour l'instant</Text>
        </View>
      )}

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Pressable onPress={onClose}
          style={{ flex: 1, height: 46, borderRadius: 14, borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)", alignItems: "center",
            justifyContent: "center", backgroundColor: "rgba(255,255,255,0.04)" }}>
          <Text style={{ color: TEXT_SOFT, fontSize: 14, fontWeight: "700" }}>Fermer</Text>
        </Pressable>
        {isHere ? (
          <Pressable
            onPress={() => { onClose(); router.push("/(app)/(tabs)/home"); }}
            style={{ flex: 2, height: 46, borderRadius: 14,
              backgroundColor: ACCENT, alignItems: "center",
              justifyContent: "center" }}>
            <Text style={{ color: "#07111f", fontSize: 14, fontWeight: "900" }}>Agir ici →</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => { onTravel(slug); onClose(); }}
            style={{ flex: 2, height: 46, borderRadius: 14,
              backgroundColor: style.color, alignItems: "center",
              justifyContent: "center" }}>
            <Text style={{ color: "#07111f", fontSize: 14, fontWeight: "900" }}>Aller ici</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function WorldScreen() {
  const avatar              = useGameStore((s) => s.avatar);
  const stats               = useGameStore((s) => s.stats);
  const currentLocationSlug = useGameStore((s) => s.currentLocationSlug);
  const travelTo            = useGameStore((s) => s.travelTo);
  const npcs                = useGameStore((s) => s.npcs);
  const tickNpcs            = useGameStore((s) => s.tickNpcs);
  const relationships       = useGameStore((s) => s.relationships);
  const housingTier         = useGameStore((s) => s.housingTier);
  const playerLevel         = useGameStore((s) => s.playerLevel);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // NPC tick toutes les 30s quand l'écran est actif
  useFocusEffect(
    useCallback(() => {
      tickNpcs();
      const id = setInterval(() => tickNpcs(), 30_000);
      return () => clearInterval(id);
    }, [tickNpcs])
  );

  const npcsByLoc = npcs.reduce<Record<string, import("@/lib/types").NpcState[]>>((acc, n) => {
    if (!acc[n.locationSlug]) acc[n.locationSlug] = [];
    acc[n.locationSlug].push(n);
    return acc;
  }, {});

  const cityIntel = buildCityIntel({
    stats, currentLocationSlug, npcs,
    livePlayers: [], relationships, housingTier
  });

  const currentLoc = worldLocations.find((l) => l.slug === currentLocationSlug);
  const currentLocStyle = KIND_STYLE[currentLoc?.kind ?? "public"] ?? KIND_STYLE.public;

  const handleTravel = (slug: string) => {
    if (slug === currentLocationSlug) return;
    travelTo(slug);
  };

  // Stats en temps réel pour le header
  const moneyColor = stats.money >= 200 ? "#f6b94f" : stats.money >= 80 ? "#86efac" : "#f87171";

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}>

        {/* ── Safe area top ─────────────────────────────────── */}
        <View style={{ height: 52 }} />

        {/* ── Carte ville interactive ────────────────────────── */}
        <VillageMap
          currentSlug={currentLocationSlug}
          onLocationPress={(slug) => setSelectedSlug(slug)}
        />

        {/* ── Barre info joueur ──────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10,
          marginHorizontal: 12, marginTop: 10,
          backgroundColor: "rgba(14,22,35,0.95)", borderRadius: 16,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12,
            backgroundColor: currentLocStyle.bg,
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 24 }}>{currentLocStyle.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: TEXT_MUTED, fontSize: 10, fontWeight: "800",
              textTransform: "uppercase", letterSpacing: 0.6 }}>Vous êtes ici</Text>
            <Text style={{ color: ACCENT, fontSize: 15, fontWeight: "900", marginTop: 1 }}>
              {currentLoc?.name ?? currentLocationSlug}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View style={{ alignItems: "center", backgroundColor: "rgba(246,185,79,0.10)",
              borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 }}>
              <Text style={{ color: moneyColor, fontSize: 14, fontWeight: "900" }}>💰 {Math.round(stats.money)}</Text>
            </View>
            <View style={{ alignItems: "center", backgroundColor: "rgba(96,165,250,0.10)",
              borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 }}>
              <Text style={{ color: "#60a5fa", fontSize: 13, fontWeight: "800" }}>⭐ {playerLevel}</Text>
            </View>
          </View>
        </View>

        {/* ── City Intel ────────────────────────────────────────── */}
        {cityIntel && cityIntel.locationSlug !== currentLocationSlug && (
          <Pressable
            onPress={() => setSelectedSlug(cityIntel.locationSlug)}
            style={{ marginHorizontal: 16, marginBottom: 4,
              borderRadius: 14, padding: 12,
              backgroundColor: "rgba(246,185,79,0.08)",
              borderWidth: 1, borderColor: "rgba(246,185,79,0.20)",
              flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 22 }}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#f6b94f", fontSize: 11, fontWeight: "900",
                textTransform: "uppercase", letterSpacing: 0.5 }}>Conseil ville</Text>
              <Text numberOfLines={2} style={{ color: TEXT_SOFT, fontSize: 12,
                marginTop: 2, lineHeight: 17 }}>{cityIntel.body}</Text>
            </View>
            <Text style={{ color: "#f6b94f", fontSize: 18 }}>→</Text>
          </Pressable>
        )}

        {/* ── Quartiers ────────────────────────────────────────── */}
        {NEIGHBORHOODS.map((neighborhood) => {
          const validSlugs = neighborhood.slugs.filter(
            (slug) => worldLocations.some((l) => l.slug === slug)
          );
          if (validSlugs.length === 0) return null;

          const totalNpcsHere = validSlugs.reduce(
            (sum, slug) => sum + (npcsByLoc[slug]?.length ?? 0), 0
          );

          return (
            <View key={neighborhood.label} style={{ marginTop: 18, paddingHorizontal: 11 }}>
              {/* Titre quartier */}
              <View style={{ flexDirection: "row", alignItems: "center",
                gap: 8, marginBottom: 4, paddingHorizontal: 5 }}>
                <Text style={{ color: neighborhood.color, fontSize: 14, fontWeight: "900" }}>
                  {neighborhood.label}
                </Text>
                {totalNpcsHere > 0 && (
                  <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8,
                    paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 10, fontWeight: "700" }}>
                      {totalNpcsHere} bots
                    </Text>
                  </View>
                )}
              </View>

              {/* Grille 2 colonnes */}
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {validSlugs.map((slug) => (
                  <LocationCard
                    key={slug}
                    slug={slug}
                    isHere={slug === currentLocationSlug}
                    npcCount={npcsByLoc[slug]?.length ?? 0}
                    onPress={() => setSelectedSlug(slug)}
                  />
                ))}
              </View>
            </View>
          );
        })}

        {/* ── Statistiques bots ────────────────────────────────── */}
        <View style={{ marginHorizontal: 16, marginTop: 24,
          borderRadius: 16, backgroundColor: CARD_BG,
          borderWidth: 1, borderColor: CARD_BORDER, padding: 16 }}>
          <Text style={{ color: TEXT, fontSize: 14, fontWeight: "900", marginBottom: 12 }}>
            🤖 Activité des bots
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {npcs.map((npc) => {
              const emoji = ACTION_EMOJI[npc.action] ?? "•";
              const moneyC = npc.money >= 200 ? "#f6b94f" : npc.money >= 80 ? "#86efac" : "#f87171";
              const locName = worldLocations.find((l) => l.slug === npc.locationSlug)?.name ?? npc.locationSlug;
              return (
                <View key={npc.id}
                  style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12,
                    padding: 10, gap: 4, minWidth: 120, flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{emoji}</Text>
                    <Text style={{ color: TEXT, fontSize: 12, fontWeight: "800", flex: 1 }}>
                      {npc.name}
                    </Text>
                    <Text style={{ color: "#60a5fa", fontSize: 10, fontWeight: "700" }}>
                      Nv{npc.level}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={{ color: TEXT_MUTED, fontSize: 10 }}>
                    📍 {locName}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between",
                    alignItems: "center" }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 9 }}>
                      😊{npc.mood} ⚡{npc.energy}
                    </Text>
                    <Text style={{ color: moneyC, fontSize: 11, fontWeight: "900" }}>
                      💰{npc.money}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Lien avatar ──────────────────────────────────────── */}
        {avatar && (
          <Pressable
            onPress={() => router.push("/(app)/profile")}
            style={{ marginHorizontal: 16, marginTop: 16,
              borderRadius: 14, padding: 14,
              backgroundColor: "rgba(167,139,250,0.08)",
              borderWidth: 1, borderColor: "rgba(167,139,250,0.20)",
              flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 26 }}>
              {avatar.gender === "Femme" ? "👩" : "🧑"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: TEXT, fontSize: 14, fontWeight: "800" }}>
                {avatar.displayName}
              </Text>
              <Text style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 2 }}>
                Voir profil & apparence
              </Text>
            </View>
            <Text style={{ color: "#a78bfa", fontSize: 18 }}>→</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ── Panel détail (Modal bottom sheet) ────────────────── */}
      <Modal
        visible={selectedSlug !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSlug(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
          onPress={() => setSelectedSlug(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {selectedSlug && (
              <LocationPanel
                slug={selectedSlug}
                currentSlug={currentLocationSlug}
                npcs={npcs}
                onTravel={handleTravel}
                onClose={() => setSelectedSlug(null)}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
