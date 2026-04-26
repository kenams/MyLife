import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";

import { VillageMap } from "@/components/village-map";
import { buildCityIntel } from "@/lib/city-intelligence";
import { buildMapEvents, eventByLocation } from "@/lib/map-events";
import { useGameStore, worldLocations } from "@/stores/game-store";

// ─── Thème ────────────────────────────────────────────────────────────────────

const L = {
  bg:         "#e8edf5",
  card:       "#f0f4fa",
  border:     "#ccd4e0",
  text:       "#1e2a3a",
  textSoft:   "#4a5568",
  muted:      "#8fa3b8",
  primary:    "#6366f1",
  primaryBg:  "#eef2ff",
  green:      "#10b981",
  greenBg:    "#ecfdf5",
  gold:       "#f59e0b",
  goldBg:     "#fffbeb",
  red:        "#ef4444",
  redBg:      "#fef2f2",
  blue:       "#3b82f6",
  blueBg:     "#eff6ff",
  orange:     "#f97316",
  orangeBg:   "#fff7ed",
};

// Couleurs par catégorie de lieu
const KIND_STYLE: Record<string, { emoji: string; color: string; bg: string }> = {
  home:     { emoji: "🏠", color: "#d97706", bg: "#fef3c7" },
  food:     { emoji: "🍽️", color: "#f97316", bg: "#fff7ed" },
  social:   { emoji: "💬", color: "#10b981", bg: "#ecfdf5" },
  work:     { emoji: "💼", color: "#3b82f6", bg: "#eff6ff" },
  wellness: { emoji: "🌿", color: "#8b5cf6", bg: "#f5f3ff" },
  public:   { emoji: "🌳", color: "#059669", bg: "#d1fae5" },
};

const ACTION_EMOJI: Record<string, string> = {
  sleeping: "😴", eating: "🍽️", chatting: "💬",
  exercising: "💪", walking: "🚶", working: "💼",
  idle: "💭", waving: "👋",
};

const NEIGHBORHOODS: Array<{ label: string; slugs: string[]; color: string }> = [
  { label: "🏡 Residences", color: "#d97706",
    slugs: ["home", "residence-populaire", "residence-confort", "residence-luxe"] },
  { label: "🌿 Parc & Santé", color: "#059669",
    slugs: ["park", "gym", "spa"] },
  { label: "🍽️ Alimentation", color: "#f97316",
    slugs: ["market", "restaurant"] },
  { label: "💼 Travail", color: "#3b82f6",
    slugs: ["office", "startup", "library"] },
  { label: "💬 Social & Sorties", color: "#8b5cf6",
    slugs: ["cafe", "cinema", "nightclub", "rooftop-bar"] },
];

// ─── Composants utilitaires ───────────────────────────────────────────────────

function MoneyBadge({ amount }: { amount: number }) {
  const color = amount >= 200 ? L.gold : amount >= 80 ? L.green : L.red;
  const bg    = amount >= 200 ? L.goldBg : amount >= 80 ? L.greenBg : L.redBg;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: bg, borderRadius: 8,
      paddingHorizontal: 7, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10 }}>💰</Text>
      <Text style={{ color, fontSize: 10, fontWeight: "800" }}>{amount}</Text>
    </View>
  );
}

function NpcPill({ name, action, money }: { name: string; action: string; money: number }) {
  const emoji = ACTION_EMOJI[action] ?? "•";
  const moneyColor = money >= 200 ? L.gold : money >= 80 ? L.green : L.red;
  const moneyBg    = money >= 200 ? L.goldBg : money >= 80 ? L.greenBg : L.redBg;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: L.bg, borderRadius: 10, borderWidth: 1, borderColor: L.border,
      paddingHorizontal: 8, paddingVertical: 6, marginBottom: 4 }}>
      <Text style={{ fontSize: 14 }}>{emoji}</Text>
      <Text style={{ color: L.text, fontSize: 12, fontWeight: "700", flex: 1 }}>{name}</Text>
      <Text style={{ color: L.muted, fontSize: 10 }}>{action}</Text>
      <View style={{ backgroundColor: moneyBg, borderRadius: 6,
        paddingHorizontal: 5, paddingVertical: 2 }}>
        <Text style={{ color: moneyColor, fontSize: 10, fontWeight: "800" }}>💰{money}</Text>
      </View>
    </View>
  );
}

function LocationCard({
  slug, isHere, npcCount, eventEmoji, eventSeverity, onPress
}: {
  slug: string; isHere: boolean; npcCount: number;
  eventEmoji?: string; eventSeverity?: string; onPress: () => void;
}) {
  const loc = worldLocations.find((l) => l.slug === slug);
  if (!loc) return null;
  const style = KIND_STYLE[loc.kind] ?? KIND_STYLE.public;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1, minWidth: 140, margin: 5,
        borderRadius: 16, borderWidth: isHere ? 2 : 1,
        borderColor: isHere ? L.primary : L.border,
        backgroundColor: isHere ? L.primaryBg : L.card,
        padding: 12, gap: 8,
        shadowColor: "rgba(99,102,241,0.10)",
        shadowOpacity: 1, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: isHere ? 4 : 2,
      }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ width: 38, height: 38, borderRadius: 12,
          backgroundColor: style.bg, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20 }}>{style.emoji}</Text>
        </View>
        <View style={{ gap: 4, alignItems: "flex-end" }}>
          {isHere && (
            <View style={{ backgroundColor: L.primary, borderRadius: 7,
              paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>ICI</Text>
            </View>
          )}
          {eventEmoji && (
            <View style={{
              backgroundColor: eventSeverity === "high" ? L.redBg : L.goldBg,
              borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: eventSeverity === "high" ? L.red : L.gold, fontSize: 10, fontWeight: "900" }}>
                {eventEmoji}
              </Text>
            </View>
          )}
          {npcCount > 0 && (
            <View style={{ backgroundColor: L.bg, borderRadius: 7,
              paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: L.border }}>
              <Text style={{ color: L.muted, fontSize: 9, fontWeight: "800" }}>
                {npcCount} bot{npcCount > 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View>
        <Text numberOfLines={1} style={{ color: isHere ? L.primary : L.text,
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
  slug, currentSlug, npcs, event, onTravel, onClose,
}: {
  slug: string; currentSlug: string;
  npcs: import("@/lib/types").NpcState[];
  event?: ReturnType<typeof buildMapEvents>[number];
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
      backgroundColor: L.card,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      borderWidth: 1, borderColor: L.border,
      padding: 20, paddingBottom: 36, gap: 16,
      shadowColor: "rgba(0,0,0,0.12)",
      shadowOpacity: 1, shadowRadius: 24,
      shadowOffset: { width: 0, height: -4 },
    }}>
      <View style={{ width: 40, height: 4, borderRadius: 2,
        backgroundColor: L.border, alignSelf: "center", marginBottom: 4 }} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16,
          backgroundColor: style.bg, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 28 }}>{style.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: L.text, fontSize: 18, fontWeight: "900" }}>{loc.name}</Text>
          <Text style={{ color: style.color, fontSize: 12, fontWeight: "700",
            textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>
            {loc.kind} · {loc.costHint}
          </Text>
        </View>
        {locNpcs.length > 0 && <MoneyBadge amount={totalMoney} />}
      </View>

      <Text style={{ color: L.textSoft, fontSize: 13, lineHeight: 19 }}>{loc.summary}</Text>

      {event && (
        <View style={{
          borderRadius: 14, padding: 12,
          backgroundColor: event.severity === "high" ? L.redBg : L.goldBg,
          borderWidth: 1,
          borderColor: event.severity === "high" ? "#fca5a5" : "#fcd34d",
          flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 20 }}>{event.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: event.severity === "high" ? L.red : L.gold, fontSize: 12, fontWeight: "900" }}>
              {event.title}
            </Text>
            <Text style={{ color: L.textSoft, fontSize: 11, lineHeight: 16, marginTop: 2 }}>
              {event.body}
            </Text>
          </View>
        </View>
      )}

      {locNpcs.length > 0 ? (
        <View>
          <Text style={{ color: L.muted, fontSize: 11, fontWeight: "800",
            textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            {locNpcs.length} habitant{locNpcs.length > 1 ? "s" : ""} ici
          </Text>
          {locNpcs.map((npc) => (
            <NpcPill key={npc.id} name={npc.name} action={npc.action} money={npc.money} />
          ))}
        </View>
      ) : (
        <View style={{ backgroundColor: L.bg, borderRadius: 12, borderWidth: 1,
          borderColor: L.border, padding: 16, alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 22 }}>🏙️</Text>
          <Text style={{ color: L.muted, fontSize: 12, fontWeight: "600" }}>Aucun habitant ici pour l'instant</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Pressable onPress={onClose}
          style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5,
            borderColor: L.border, alignItems: "center",
            justifyContent: "center", backgroundColor: L.bg }}>
          <Text style={{ color: L.textSoft, fontSize: 14, fontWeight: "700" }}>Fermer</Text>
        </Pressable>
        {isHere ? (
          <Pressable
            onPress={() => { onClose(); router.push("/(app)/(tabs)/home"); }}
            style={{ flex: 2, height: 48, borderRadius: 14,
              backgroundColor: L.primary, alignItems: "center",
              justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>Agir ici →</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => { onTravel(slug); onClose(); }}
            style={{ flex: 2, height: 48, borderRadius: 14,
              backgroundColor: style.color, alignItems: "center",
              justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>Aller ici</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function WorldScreen() {
  const stats               = useGameStore((s) => s.stats);
  const currentLocationSlug = useGameStore((s) => s.currentLocationSlug);
  const travelTo            = useGameStore((s) => s.travelTo);
  const npcs                = useGameStore((s) => s.npcs);
  const tickNpcs            = useGameStore((s) => s.tickNpcs);
  const relationships       = useGameStore((s) => s.relationships);
  const housingTier         = useGameStore((s) => s.housingTier);
  const playerLevel         = useGameStore((s) => s.playerLevel);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [travelingTo, setTravelingTo]   = useState<string | null>(null);
  const travelAnim = useRef(new Animated.Value(0)).current;

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
  const mapEvents = buildMapEvents(stats, 4);
  const mapEventsByLocation = eventByLocation(mapEvents);

  const currentLoc       = worldLocations.find((l) => l.slug === currentLocationSlug);
  const currentLocStyle  = KIND_STYLE[currentLoc?.kind ?? "public"] ?? KIND_STYLE.public;
  const currentNpcs      = npcsByLoc[currentLocationSlug] ?? [];
  const activeNeighborhood = NEIGHBORHOODS.find((n) => n.slugs.includes(currentLocationSlug));

  const handleTravel = (slug: string) => {
    if (slug === currentLocationSlug) return;
    setTravelingTo(slug);
    travelAnim.setValue(0);
    Animated.timing(travelAnim, { toValue: 1, duration: 750, useNativeDriver: false }).start(() => {
      travelTo(slug);
      setTravelingTo(null);
      travelAnim.setValue(0);
    });
  };

  const moneyColor = stats.money >= 200 ? L.gold : stats.money >= 80 ? L.green : L.red;
  const moneyBg    = stats.money >= 200 ? L.goldBg : stats.money >= 80 ? L.greenBg : L.redBg;
  const intelColor = cityIntel.urgency === "critical" ? L.red
    : cityIntel.urgency === "high" ? L.gold : L.primary;

  const primaryEvent = mapEvents[0];
  const suggestedSlugs = [
    cityIntel.locationSlug,
    primaryEvent?.locationSlug,
    currentLocationSlug,
    ...mapEvents.map((e) => e.locationSlug),
    "market", "park", "office", "cafe", "gym", "home",
  ].filter((slug): slug is string =>
    Boolean(slug) && worldLocations.some((l) => l.slug === slug)
  );
  const quickSlugs = Array.from(new Set(suggestedSlugs)).slice(0, 8);

  const travelingLoc   = travelingTo ? worldLocations.find((l) => l.slug === travelingTo) : null;
  const travelBarWidth = travelAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>

      {/* ── Overlay animation voyage ─────────────────────────── */}
      {travelingTo && travelingLoc && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(99,102,241,0.92)",
          zIndex: 100, alignItems: "center", justifyContent: "center", gap: 20,
        }}>
          <View style={{ width: 72, height: 72, borderRadius: 24,
            backgroundColor: "rgba(255,255,255,0.2)",
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 36 }}>{(KIND_STYLE[travelingLoc.kind] ?? KIND_STYLE.public).emoji}</Text>
          </View>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }}>EN ROUTE</Text>
            <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "900" }}>{travelingLoc.name}</Text>
          </View>
          <View style={{ width: 200, height: 5, borderRadius: 3,
            backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
            <Animated.View style={{ height: 5, borderRadius: 3,
              width: travelBarWidth, backgroundColor: "#ffffff" }} />
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120, alignItems: "center" }}
        showsVerticalScrollIndicator={false}>

        <View style={{ height: 0 }} />

        {/* ── Carte ville ────────────────────────────────────── */}
        <VillageMap
          currentSlug={currentLocationSlug}
          events={mapEvents}
          onLocationPress={(slug) => setSelectedSlug(slug)}
        />

        {/* ── Barre info joueur ──────────────────────────────── */}
        <View style={{ width: "100%", maxWidth: 1180, flexDirection: "row", alignItems: "center", gap: 10,
          marginTop: 10, paddingHorizontal: 12,
          backgroundColor: L.card, borderRadius: 16,
          borderWidth: 1, borderColor: L.border, padding: 12,
          shadowColor: "rgba(99,102,241,0.08)", shadowOpacity: 1, shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12,
            backgroundColor: currentLocStyle.bg,
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 24 }}>{currentLocStyle.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800",
              textTransform: "uppercase", letterSpacing: 0.6 }}>
              {activeNeighborhood?.label ?? "Ville"}
            </Text>
            <Text style={{ color: L.primary, fontSize: 15, fontWeight: "900", marginTop: 1 }}>
              {currentLoc?.name ?? currentLocationSlug}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View style={{ alignItems: "center", backgroundColor: moneyBg,
              borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 }}>
              <Text style={{ color: moneyColor, fontSize: 14, fontWeight: "900" }}>💰 {Math.round(stats.money)}</Text>
            </View>
            <View style={{ alignItems: "center", backgroundColor: L.primaryBg,
              borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 }}>
              <Text style={{ color: L.primary, fontSize: 13, fontWeight: "800" }}>⭐ {playerLevel}</Text>
            </View>
          </View>
        </View>

        {/* ── City Intel ────────────────────────────────────── */}
        {cityIntel && cityIntel.locationSlug !== currentLocationSlug && (
          <Pressable
            onPress={() => setSelectedSlug(cityIntel.locationSlug)}
            style={{ width: "100%", maxWidth: 1180, marginTop: 10, marginBottom: 4,
              borderRadius: 14, padding: 12,
              backgroundColor: intelColor === L.red ? L.redBg : intelColor === L.gold ? L.goldBg : L.primaryBg,
              borderWidth: 1, borderColor: intelColor + "55",
              flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 22 }}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: intelColor, fontSize: 11, fontWeight: "900",
                textTransform: "uppercase", letterSpacing: 0.5 }}>{cityIntel.title}</Text>
              <Text numberOfLines={1} style={{ color: L.textSoft, fontSize: 12,
                marginTop: 2, lineHeight: 17 }}>{cityIntel.body}</Text>
            </View>
            <Text style={{ color: intelColor, fontSize: 18 }}>→</Text>
          </Pressable>
        )}

        {/* ── Événements ───────────────────────────────────── */}
        {mapEvents.length > 0 && (
          <View style={{ width: "100%", maxWidth: 1180, marginTop: 10, gap: 8 }}>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "900",
              textTransform: "uppercase", letterSpacing: 0.8 }}>
              Signaux de vie
            </Text>
            {mapEvents.slice(0, 1).map((event) => {
              const loc = worldLocations.find((l) => l.slug === event.locationSlug);
              const color   = event.severity === "high" ? L.red : event.severity === "medium" ? L.gold : L.blue;
              const bgColor = event.severity === "high" ? L.redBg : event.severity === "medium" ? L.goldBg : L.blueBg;
              return (
                <Pressable
                  key={event.id}
                  onPress={() => setSelectedSlug(event.locationSlug)}
                  style={{ borderRadius: 14, padding: 12,
                    backgroundColor: bgColor,
                    borderWidth: 1, borderColor: color + "55",
                    flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 11,
                    backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 18 }}>{event.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color, fontSize: 12, fontWeight: "900" }}>{event.title}</Text>
                    <Text numberOfLines={1} style={{ color: L.textSoft, fontSize: 11, marginTop: 2 }}>
                      {loc?.name ?? event.locationSlug} · {event.body}
                    </Text>
                  </View>
                  <Text style={{ color, fontSize: 16 }}>→</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Lieux utiles ─────────────────────────────────── */}
        <View style={{ width: "100%", maxWidth: 1180, marginTop: 14, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: L.text, fontSize: 14, fontWeight: "900" }}>Lieux utiles</Text>
            <Text style={{ color: L.muted, fontSize: 11 }}>Touchez la map ou un lieu</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
            {quickSlugs.map((slug) => (
              <View key={slug} style={{ width: 190 }}>
                <LocationCard
                  slug={slug}
                  isHere={slug === currentLocationSlug}
                  npcCount={npcsByLoc[slug]?.length ?? 0}
                  eventEmoji={mapEventsByLocation[slug]?.emoji}
                  eventSeverity={mapEventsByLocation[slug]?.severity}
                  onPress={() => setSelectedSlug(slug)}
                />
              </View>
            ))}
          </ScrollView>

          {/* ── Quartiers ────────────────────────────────────── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
            {NEIGHBORHOODS.map((neighborhood) => {
              const firstSlug = neighborhood.slugs.find((slug) => worldLocations.some((l) => l.slug === slug));
              if (!firstSlug) return null;
              const active = neighborhood.slugs.includes(currentLocationSlug);
              const totalNpcsHere = neighborhood.slugs.reduce(
                (sum, slug) => sum + (npcsByLoc[slug]?.length ?? 0), 0
              );
              return (
                <Pressable
                  key={neighborhood.label}
                  onPress={() => setSelectedSlug(firstSlug)}
                  style={{
                    minWidth: 140, borderRadius: 999,
                    paddingHorizontal: 12, paddingVertical: 10,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? neighborhood.color : L.border,
                    backgroundColor: active ? neighborhood.color + "18" : L.card,
                    flexDirection: "row", alignItems: "center",
                    justifyContent: "space-between", gap: 8,
                  }}>
                  <Text numberOfLines={1} style={{ color: active ? neighborhood.color : L.textSoft, fontSize: 12, fontWeight: "900" }}>
                    {neighborhood.label}
                  </Text>
                  {totalNpcsHere > 0 && (
                    <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800" }}>
                      {totalNpcsHere}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Vie en ville ─────────────────────────────────── */}
        <View style={{ width: "100%", maxWidth: 1180, marginTop: 12,
          borderRadius: 16, backgroundColor: L.card,
          borderWidth: 1, borderColor: L.border, padding: 12,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
          shadowColor: "rgba(99,102,241,0.06)", shadowOpacity: 1, shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: L.text, fontSize: 13, fontWeight: "900" }}>Vie en ville</Text>
            <Text numberOfLines={1} style={{ color: L.muted, fontSize: 11, marginTop: 2 }}>
              {currentNpcs.length > 0
                ? `${currentNpcs.length} habitant${currentNpcs.length > 1 ? "s" : ""} ici`
                : `${npcs.length} habitants bougent en arrière-plan`}
            </Text>
          </View>
          {currentNpcs.slice(0, 2).map((npc) => (
            <Pressable
              key={npc.id}
              onPress={() => setSelectedSlug(npc.locationSlug)}
              style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7,
                backgroundColor: L.primaryBg, borderWidth: 1, borderColor: L.border }}>
              <Text numberOfLines={1} style={{ color: L.primary, fontSize: 11, fontWeight: "800" }}>
                {ACTION_EMOJI[npc.action] ?? "•"} {npc.name}
              </Text>
            </Pressable>
          ))}
        </View>

      </ScrollView>

      {/* ── Panel détail (Modal) ──────────────────────────── */}
      <Modal
        visible={selectedSlug !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSlug(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}
          onPress={() => setSelectedSlug(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {selectedSlug && (
              <LocationPanel
                slug={selectedSlug}
                currentSlug={currentLocationSlug}
                npcs={npcs}
                event={mapEventsByLocation[selectedSlug]}
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
