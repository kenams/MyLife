import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { VillageMap } from "@/components/village-map";
import { WorldLiveMap, cityById, cityForNpc } from "@/components/world-live-map";
import { IsoCityMap } from "@/components/iso-city-map";
import { getAvatarVisual } from "@/lib/avatar-visual";
import { buildCityIntel } from "@/lib/city-intelligence";
import { buildMapEvents, eventByLocation } from "@/lib/map-events";
import type { NpcState, RelationshipRecord } from "@/lib/types";
import { useGameStore, worldLocations } from "@/stores/game-store";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  void:    "#04040A",
  deep:    "#08080F",
  glass:   "#0C0C16",
  surface: "#101018",
  card:    "#12121C",
  border:  "rgba(255,255,255,0.06)",
  text:    "#E8E4DC",
  soft:    "#9A968E",
  muted:   "#4A4848",
  // Neons
  gold:    "#FFD600",
  goldDim: "#1A1400",
  green:   "#39FF14",
  purple:  "#BF5FFF",
  blue:    "#00B4FF",
  red:     "#FF3B3B",
  teal:    "#00FFD1",
  orange:  "#FF8C00",
};

const KIND = {
  home:     { emoji: "🏠", color: C.gold,   dim: "#1A1400" },
  food:     { emoji: "🍽️", color: C.orange, dim: "#1A0C00" },
  social:   { emoji: "💬", color: C.teal,   dim: "#001A14" },
  work:     { emoji: "💼", color: C.blue,   dim: "#00101A" },
  wellness: { emoji: "🌿", color: C.purple, dim: "#10081A" },
  public:   { emoji: "🌳", color: C.green,  dim: "#081A02" },
};

const ACTION_EMOJI: Record<string, string> = {
  sleeping: "😴", eating: "🍽️", chatting: "💬",
  exercising: "💪", walking: "🚶", working: "💼",
  idle: "💭", waving: "👋",
};

const NEIGHBORHOODS = [
  { label: "🏡 Résidences", color: C.gold,   slugs: ["home","residence-populaire","residence-confort","residence-luxe"] },
  { label: "🌿 Bien-être",  color: C.green,  slugs: ["park","gym","spa"] },
  { label: "🍽️ Manger",    color: C.orange, slugs: ["market","restaurant"] },
  { label: "💼 Travail",    color: C.blue,   slugs: ["office","startup","library"] },
  { label: "💬 Social",     color: C.purple, slugs: ["cafe","cinema","nightclub","rooftop-bar"] },
];

const DATE_VENUES = [
  { slug: "cafe",       label: "Café",       color: C.teal   },
  { slug: "park",       label: "Parc",       color: C.green  },
  { slug: "restaurant", label: "Restaurant", color: C.orange },
  { slug: "cinema",     label: "Cinéma",     color: C.blue   },
];

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function Pulse({ color = C.green, size = 7 }: { color?: string; size?: number }) {
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(s, { toValue: 1.8, duration: 900, useNativeDriver: true }),
      Animated.timing(s, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={{ width: size + 4, height: size + 4, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute", width: size + 4, height: size + 4, borderRadius: (size + 4) / 2,
        backgroundColor: color, opacity: 0.25, transform: [{ scale: s }],
      }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

// ── Location Card ─────────────────────────────────────────────────────────────
function LocationCard({ slug, isHere, npcCount, eventEmoji, eventSeverity, onPress }: {
  slug: string; isHere: boolean; npcCount: number;
  eventEmoji?: string; eventSeverity?: string; onPress: () => void;
}) {
  const loc = worldLocations.find((l) => l.slug === slug);
  if (!loc) return null;
  const k = KIND[loc.kind as keyof typeof KIND] ?? KIND.public;
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
        onPress={onPress}
        style={{
          width: 160, borderRadius: 16,
          backgroundColor: isHere ? k.dim : C.card,
          borderWidth: isHere ? 1.5 : 1,
          borderColor: isHere ? k.color : C.border,
          padding: 12, gap: 10,
          shadowColor: isHere ? k.color : "transparent",
          shadowOpacity: 0.2, shadowRadius: 12,
        }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: k.dim, alignItems: "center", justifyContent: "center",
            borderWidth: 1, borderColor: k.color + "30",
          }}>
            <Text style={{ fontSize: 20 }}>{k.emoji}</Text>
          </View>
          <View style={{ gap: 4, alignItems: "flex-end" }}>
            {isHere && (
              <View style={{ backgroundColor: k.color, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: "#080808", fontSize: 8, fontWeight: "900" }}>ICI</Text>
              </View>
            )}
            {eventEmoji && (
              <View style={{
                backgroundColor: eventSeverity === "high" ? C.red + "20" : C.gold + "20",
                borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
                borderWidth: 1, borderColor: eventSeverity === "high" ? C.red + "40" : C.gold + "40",
              }}>
                <Text style={{ fontSize: 10 }}>{eventEmoji}</Text>
              </View>
            )}
            {npcCount > 0 && (
              <View style={{ backgroundColor: C.glass, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 }}>
                <Text style={{ color: C.muted, fontSize: 8, fontWeight: "800" }}>{npcCount} NPC</Text>
              </View>
            )}
          </View>
        </View>
        <View>
          <Text numberOfLines={1} style={{ color: isHere ? k.color : C.text, fontSize: 13, fontWeight: "800" }}>
            {loc.name}
          </Text>
          <Text numberOfLines={1} style={{ color: k.color + "90", fontSize: 9, fontWeight: "700",
            textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>
            {loc.costHint}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── NPC Pill ──────────────────────────────────────────────────────────────────
function NpcPill({ name, action, money }: { name: string; action: string; money: number }) {
  const emoji = ACTION_EMOJI[action] ?? "•";
  const mc = money >= 200 ? C.gold : money >= 80 ? C.green : C.red;
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: C.glass, borderRadius: 10,
      borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 10, paddingVertical: 8, marginBottom: 5,
    }}>
      <Text style={{ fontSize: 14 }}>{emoji}</Text>
      <Text style={{ color: C.text, fontSize: 12, fontWeight: "700", flex: 1 }}>{name}</Text>
      <Text style={{ color: C.muted, fontSize: 10 }}>{action}</Text>
      <View style={{ backgroundColor: mc + "18", borderRadius: 6,
        paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: mc + "30" }}>
        <Text style={{ color: mc, fontSize: 10, fontWeight: "900" }}>💰{money}</Text>
      </View>
    </View>
  );
}

// ── Location Panel (bottom sheet) ─────────────────────────────────────────────
function LocationPanel({ slug, currentSlug, npcs, event, onTravel, onClose }: {
  slug: string; currentSlug: string; npcs: NpcState[];
  event?: ReturnType<typeof buildMapEvents>[number];
  onTravel: (slug: string) => void; onClose: () => void;
}) {
  const loc = worldLocations.find((l) => l.slug === slug);
  if (!loc) return null;
  const k = KIND[loc.kind as keyof typeof KIND] ?? KIND.public;
  const isHere  = slug === currentSlug;
  const locNpcs = npcs.filter((n) => n.locationSlug === slug);

  return (
    <View style={{
      backgroundColor: C.deep,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      borderWidth: 1, borderColor: C.border,
      borderBottomWidth: 0,
      padding: 20, paddingBottom: 40, gap: 16,
    }}>
      <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: C.muted, alignSelf: "center", marginBottom: 4 }} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: k.dim, borderWidth: 1.5, borderColor: k.color + "40",
          alignItems: "center", justifyContent: "center",
          shadowColor: k.color, shadowOpacity: 0.3, shadowRadius: 10,
        }}>
          <Text style={{ fontSize: 28 }}>{k.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>{loc.name}</Text>
          <Text style={{ color: k.color, fontSize: 11, fontWeight: "700",
            textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>
            {loc.kind} · {loc.costHint}
          </Text>
        </View>
        {locNpcs.length > 0 && (
          <View style={{ backgroundColor: C.glass, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
            borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.gold, fontSize: 12, fontWeight: "900" }}>{locNpcs.length} ici</Text>
          </View>
        )}
      </View>

      <Text style={{ color: C.soft, fontSize: 13, lineHeight: 20 }}>{loc.summary}</Text>

      {event && (
        <View style={{
          borderRadius: 14, padding: 12,
          backgroundColor: event.severity === "high" ? C.red + "12" : C.gold + "12",
          borderWidth: 1, borderColor: event.severity === "high" ? C.red + "30" : C.gold + "30",
          flexDirection: "row", alignItems: "center", gap: 10,
        }}>
          <Text style={{ fontSize: 20 }}>{event.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: event.severity === "high" ? C.red : C.gold, fontSize: 12, fontWeight: "900" }}>
              {event.title}
            </Text>
            <Text style={{ color: C.soft, fontSize: 11, marginTop: 2 }}>{event.body}</Text>
          </View>
        </View>
      )}

      {locNpcs.length > 0 ? (
        <View>
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900",
            textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            {locNpcs.length} habitant{locNpcs.length > 1 ? "s" : ""}
          </Text>
          {locNpcs.map((n) => <NpcPill key={n.id} name={n.name} action={n.action} money={n.money} />)}
        </View>
      ) : (
        <View style={{ backgroundColor: C.glass, borderRadius: 12, padding: 16,
          alignItems: "center", gap: 6, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 22 }}>🏙️</Text>
          <Text style={{ color: C.muted, fontSize: 12, fontWeight: "600" }}>Aucun habitant ici</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Pressable onPress={onClose}
          style={{ flex: 1, height: 50, borderRadius: 14,
            borderWidth: 1, borderColor: C.border,
            alignItems: "center", justifyContent: "center", backgroundColor: C.glass }}>
          <Text style={{ color: C.soft, fontSize: 14, fontWeight: "700" }}>Fermer</Text>
        </Pressable>
        {isHere ? (
          <Pressable
            onPress={() => { onClose(); router.push("/(app)/(tabs)/home"); }}
            style={{ flex: 2, height: 50, borderRadius: 14,
              backgroundColor: k.color, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#080808", fontSize: 14, fontWeight: "900" }}>Agir ici →</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => { onTravel(slug); onClose(); }}
            style={{ flex: 2, height: 50, borderRadius: 14,
              backgroundColor: k.dim, borderWidth: 1.5, borderColor: k.color,
              alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: k.color, fontSize: 14, fontWeight: "900" }}>→ Aller ici</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Person Panel ──────────────────────────────────────────────────────────────
function PersonPanel({ npc, relationship, npcRelation, onStartDate, onZoomDistrict, onClose, onInteract }: {
  npc: NpcState; relationship?: RelationshipRecord;
  npcRelation?: import("@/lib/types").NpcRelation;
  onStartDate: (v: string) => void; onZoomDistrict: () => void;
  onClose: () => void; onInteract?: () => void;
}) {
  const loc = worldLocations.find((item) => item.slug === npc.locationSlug);
  const score = relationship?.score ?? 0;
  const scoreColor = score >= 65 ? C.green : score >= 35 ? C.gold : C.blue;
  const relationLevel = npcRelation?.level ?? "inconnu";
  const relationScore = npcRelation?.score ?? 0;
  const RCOLOR: Record<string, string> = {
    inconnu: C.muted, contact: C.blue, ami: C.green, confiant: C.gold, complice: "#FF2D78",
  };
  const rc = RCOLOR[relationLevel];

  return (
    <View style={{
      backgroundColor: C.deep,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      borderWidth: 1, borderColor: C.border, borderBottomWidth: 0,
      padding: 20, paddingBottom: 40, gap: 14,
    }}>
      <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: C.muted, alignSelf: "center", marginBottom: 4 }} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{
          width: 58, height: 58, borderRadius: 18,
          backgroundColor: scoreColor + "14", borderWidth: 2, borderColor: scoreColor,
          alignItems: "center", justifyContent: "center",
          shadowColor: scoreColor, shadowOpacity: 0.4, shadowRadius: 10,
        }}>
          <Text style={{ color: scoreColor, fontSize: 20, fontWeight: "900" }}>
            {npc.name.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: "900" }}>{npc.name}</Text>
          <Text style={{ color: C.soft, fontSize: 12, marginTop: 2 }}>
            {npc.presenceOnline ? "● En ligne" : "Récent"} · {loc?.name ?? npc.locationSlug}
          </Text>
        </View>
        <View style={{ backgroundColor: scoreColor + "14", borderRadius: 12,
          paddingHorizontal: 10, paddingVertical: 7,
          borderWidth: 1, borderColor: scoreColor + "40", alignItems: "center" }}>
          <Text style={{ color: scoreColor, fontSize: 14, fontWeight: "900" }}>{score}</Text>
          <Text style={{ color: C.muted, fontSize: 8, fontWeight: "800" }}>LIEN</Text>
        </View>
      </View>

      {/* Relation bar */}
      <View style={{ backgroundColor: C.glass, borderRadius: 14, padding: 12,
        borderWidth: 1, borderColor: C.border, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: C.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 }}>RELATION NPC</Text>
          <View style={{ backgroundColor: rc + "20", borderRadius: 6,
            paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: rc + "30" }}>
            <Text style={{ color: rc, fontSize: 9, fontWeight: "900" }}>{relationLevel.toUpperCase()}</Text>
          </View>
        </View>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: C.muted + "30", overflow: "hidden" }}>
          <View style={{ height: 5, borderRadius: 3, width: `${relationScore}%` as `${number}%`,
            backgroundColor: rc,
            shadowColor: rc, shadowOpacity: 0.6, shadowRadius: 4 }} />
        </View>
        <Text style={{ color: C.muted, fontSize: 11 }}>
          {npcRelation?.totalInteractions ?? 0} interaction(s) · {relationScore}/100
        </Text>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          { label: "Humeur",  value: npc.mood,   color: C.green  },
          { label: "Energie", value: npc.energy, color: C.gold   },
          { label: "Niveau",  value: npc.level,  color: C.purple },
        ].map((item) => (
          <View key={item.label} style={{ flex: 1, backgroundColor: C.glass, borderRadius: 12,
            borderWidth: 1, borderColor: C.border, padding: 10, alignItems: "center" }}>
            <Text style={{ color: C.muted, fontSize: 8, fontWeight: "900",
              textTransform: "uppercase", letterSpacing: 0.8 }}>{item.label}</Text>
            <Text style={{ color: item.color, fontSize: 18, fontWeight: "900", marginTop: 4 }}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* RDV */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: C.soft, fontSize: 11, fontWeight: "900",
          textTransform: "uppercase", letterSpacing: 1 }}>Simuler un RDV</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DATE_VENUES.map((v) => (
            <Pressable key={v.slug} onPress={() => onStartDate(v.slug)}
              style={{ flexGrow: 1, minWidth: 130, height: 42, borderRadius: 12,
                backgroundColor: v.color + "20", borderWidth: 1, borderColor: v.color + "40",
                alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: v.color, fontSize: 13, fontWeight: "800" }}>{v.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {onInteract && (
          <Pressable onPress={onInteract}
            style={{ flex: 1, height: 44, borderRadius: 12,
              backgroundColor: rc + "18", borderWidth: 1, borderColor: rc + "35",
              alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: rc, fontSize: 13, fontWeight: "800" }}>💬 Interagir +5</Text>
          </Pressable>
        )}
        <Pressable onPress={onClose}
          style={{ flex: 1, height: 44, borderRadius: 12,
            backgroundColor: C.glass, borderWidth: 1, borderColor: C.border,
            alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.soft, fontSize: 13, fontWeight: "700" }}>Fermer</Text>
        </Pressable>
      </View>

      <Pressable onPress={onZoomDistrict}
        style={{ height: 48, borderRadius: 14, backgroundColor: C.purple + "20",
          borderWidth: 1, borderColor: C.purple + "40",
          alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.purple, fontSize: 14, fontWeight: "900" }}>Voir le quartier →</Text>
      </Pressable>
    </View>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SimulatedDateRoute = {
  id: string; npcName: string; cityId: string;
  fromSlug: string; venueSlug: string; status: "moving" | "confirmed";
};

// ── Screen ────────────────────────────────────────────────────────────────────
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
  const worldEvent          = useGameStore((s) => s.worldEvent);
  const worldEventJoined    = useGameStore((s) => s.worldEventJoined ?? false);
  const joinWorldEvent      = useGameStore((s) => s.joinWorldEvent);
  const npcRelations        = useGameStore((s) => s.npcRelations ?? []);
  const updateNpcRelation   = useGameStore((s) => s.updateNpcRelation);

  const [selectedSlug,    setSelectedSlug]    = useState<string | null>(null);
  const [selectedNpcId,   setSelectedNpcId]   = useState<string | null>(null);
  const [currentCityId,   setCurrentCityId]   = useState("neo-paris");
  const [focusedCityId,   setFocusedCityId]   = useState<string | null>(null);
  const [districtSlug,    setDistrictSlug]    = useState<string | null>(null);
  const [districtCityId,  setDistrictCityId]  = useState("neo-paris");
  const [dateRoute,       setDateRoute]       = useState<SimulatedDateRoute | null>(null);
  const [travelingTo,     setTravelingTo]     = useState<string | null>(null);
  const [mapMode,         setMapMode]         = useState<"world" | "iso" | "district">("iso");

  const travelAnim  = useRef(new Animated.Value(0)).current;
  const dateTimers  = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const headerAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    return () => { dateTimers.current.forEach(clearTimeout); dateTimers.current = []; };
  }, []);

  useFocusEffect(useCallback(() => {
    tickNpcs();
    const id = setInterval(() => tickNpcs(), 30_000);
    return () => clearInterval(id);
  }, [tickNpcs]));

  const npcsByLoc = npcs.reduce<Record<string, NpcState[]>>((acc, n) => {
    if (!acc[n.locationSlug]) acc[n.locationSlug] = [];
    acc[n.locationSlug].push(n);
    return acc;
  }, {});

  const cityIntel         = buildCityIntel({ stats, currentLocationSlug, npcs, livePlayers: [], relationships, housingTier });
  const mapEvents         = buildMapEvents(stats, 4);
  const mapEventsByLoc    = eventByLocation(mapEvents);

  const currentLoc        = worldLocations.find((l) => l.slug === currentLocationSlug);
  const currentK          = KIND[currentLoc?.kind as keyof typeof KIND] ?? KIND.public;
  const currentNpcs       = npcsByLoc[currentLocationSlug] ?? [];
  const activeNeighborhood = NEIGHBORHOODS.find((n) => n.slugs.includes(currentLocationSlug));
  const selectedNpc       = selectedNpcId ? npcs.find((n) => n.id === selectedNpcId) : null;
  const selectedNpcCity   = selectedNpc ? cityForNpc(selectedNpc) : null;
  const selectedRelationship = selectedNpc
    ? relationships.find((r) => r.residentId === selectedNpc.id) : undefined;

  const primaryEvent    = mapEvents[0];
  const suggestedSlugs  = [
    cityIntel.locationSlug, primaryEvent?.locationSlug, currentLocationSlug,
    ...mapEvents.map((e) => e.locationSlug), "market","park","office","cafe","gym","home",
  ].filter((s): s is string => Boolean(s) && worldLocations.some((l) => l.slug === s));
  const quickSlugs = Array.from(new Set(suggestedSlugs)).slice(0, 8);

  const intelColor = cityIntel.urgency === "critical" ? C.red
    : cityIntel.urgency === "high" ? C.gold : C.blue;
  const moneyColor = stats.money >= 200 ? C.gold : stats.money >= 80 ? C.green : C.red;
  const travelBarW = travelAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const districtLoc  = districtSlug ? worldLocations.find((l) => l.slug === districtSlug) : null;
  const districtCity = cityById(districtCityId);
  const travelingLoc = travelingTo ? worldLocations.find((l) => l.slug === travelingTo) : null;

  const handleTravel = (slug: string) => {
    if (slug === currentLocationSlug) return;
    const targetCityId = districtSlug ? districtCityId : focusedCityId ?? currentCityId;
    setTravelingTo(slug);
    travelAnim.setValue(0);
    Animated.timing(travelAnim, { toValue: 1, duration: 750, useNativeDriver: false }).start(() => {
      travelTo(slug);
      setCurrentCityId(targetCityId);
      setTravelingTo(null);
      travelAnim.setValue(0);
    });
  };

  const handleStartDate = (npc: NpcState, venueSlug: string) => {
    const id   = `date-route-${Date.now()}-${npc.id}`;
    const city = cityForNpc(npc);
    dateTimers.current.forEach(clearTimeout); dateTimers.current = [];
    setSelectedSlug(null); setSelectedNpcId(npc.id); setFocusedCityId(city.id);
    setDateRoute({ id, npcName: npc.name, cityId: city.id, fromSlug: npc.locationSlug, venueSlug, status: "moving" });
    dateTimers.current = [
      setTimeout(() => {
        travelTo(venueSlug, { cost: 6, energyCost: 4, modeLabel: "RDV" });
        setCurrentCityId(city.id);
        setDateRoute((cur) => cur?.id === id ? { ...cur, status: "confirmed" } : cur);
      }, 1550),
      setTimeout(() => setDateRoute((cur) => cur?.id === id ? null : cur), 6500),
    ];
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.void }}>

      {/* ── OVERLAY VOYAGE ──────────────────────────────────────────────────── */}
      {travelingTo && travelingLoc && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(4,4,10,0.96)", zIndex: 100,
          alignItems: "center", justifyContent: "center", gap: 28,
        }}>
          {/* Scanline */}
          <View style={{
            position: "absolute", left: 0, right: 0, height: 1,
            backgroundColor: C.gold, opacity: 0.2, top: "40%",
          }} />
          <Text style={{ fontSize: 10, letterSpacing: 6, color: C.muted, fontWeight: "800" }}>
            EN ROUTE
          </Text>
          <View style={{
            width: 80, height: 80, borderRadius: 24,
            backgroundColor: (KIND[travelingLoc.kind as keyof typeof KIND] ?? KIND.public).dim,
            borderWidth: 1.5, borderColor: (KIND[travelingLoc.kind as keyof typeof KIND] ?? KIND.public).color + "50",
            alignItems: "center", justifyContent: "center",
            shadowColor: (KIND[travelingLoc.kind as keyof typeof KIND] ?? KIND.public).color,
            shadowOpacity: 0.5, shadowRadius: 20,
          }}>
            <Text style={{ fontSize: 38 }}>
              {(KIND[travelingLoc.kind as keyof typeof KIND] ?? KIND.public).emoji}
            </Text>
          </View>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>{travelingLoc.name}</Text>
          <View style={{ width: 220, height: 3, borderRadius: 2,
            backgroundColor: C.muted + "30", overflow: "hidden" }}>
            <Animated.View style={{ height: 3, borderRadius: 2,
              width: travelBarW, backgroundColor: C.gold,
              shadowColor: C.gold, shadowOpacity: 0.8, shadowRadius: 8 }} />
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 54, paddingBottom: 120 }}>

        {/* ── HEADER JOUEUR ──────────────────────────────────────────────────── */}
        <Animated.View style={{ opacity: headerAnim, paddingHorizontal: 16, marginBottom: 16 }}>
          <View style={{
            backgroundColor: C.glass,
            borderRadius: 20, borderWidth: 1, borderColor: currentK.color + "25",
            padding: 14, gap: 12,
            shadowColor: currentK.color, shadowOpacity: 0.12, shadowRadius: 20,
          }}>
            {/* Top row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {/* Location icon with neon ring */}
              <View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
                <View style={{ position: "absolute", width: 52, height: 52, borderRadius: 15,
                  borderWidth: 1.5, borderColor: currentK.color,
                  shadowColor: currentK.color, shadowOpacity: 0.6, shadowRadius: 12 }} />
                <View style={{ width: 46, height: 46, borderRadius: 13,
                  backgroundColor: currentK.dim, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 26 }}>{currentK.emoji}</Text>
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 8, fontWeight: "900",
                  textTransform: "uppercase", letterSpacing: 2.5, marginBottom: 3 }}>
                  📍 {activeNeighborhood?.label ?? "Paris"}
                </Text>
                <Text style={{ color: currentK.color, fontSize: 16, fontWeight: "900" }}>
                  {currentLoc?.name ?? currentLocationSlug}
                </Text>
              </View>

              {/* Badges */}
              <View style={{ gap: 5 }}>
                <View style={{ backgroundColor: moneyColor + "18", borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 5,
                  borderWidth: 1, borderColor: moneyColor + "35",
                  alignItems: "center" }}>
                  <Text style={{ color: moneyColor, fontSize: 12, fontWeight: "900" }}>
                    💰 {Math.round(stats.money)}
                  </Text>
                </View>
                <View style={{ backgroundColor: C.purple + "18", borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 5,
                  borderWidth: 1, borderColor: C.purple + "35",
                  alignItems: "center" }}>
                  <Text style={{ color: C.purple, fontSize: 11, fontWeight: "800" }}>⭐ NIV {playerLevel}</Text>
                </View>
              </View>
            </View>

            {/* Mini energy bar */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: C.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1.5 }}>PÊCHE</Text>
              <View style={{ flex: 1, height: 4, borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                <View style={{ height: 4, borderRadius: 2,
                  width: `${Math.max(0, Math.min(100, stats.energy))}%` as `${number}%`,
                  backgroundColor: stats.energy < 30 ? C.red : stats.energy < 55 ? C.gold : C.green,
                  shadowColor: C.green, shadowOpacity: 0.6, shadowRadius: 6 }} />
              </View>
              <Text style={{ color: C.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1.5 }}>THUNES</Text>
              <View style={{ flex: 1, height: 4, borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                <View style={{ height: 4, borderRadius: 2,
                  width: `${Math.max(0, Math.min(100, (stats.money / 500) * 100))}%` as `${number}%`,
                  backgroundColor: moneyColor,
                  shadowColor: moneyColor, shadowOpacity: 0.6, shadowRadius: 6 }} />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── TOGGLE VUE ─────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <View style={{
            flexDirection: "row", backgroundColor: C.glass,
            borderRadius: 14, borderWidth: 1, borderColor: C.border,
            padding: 4, gap: 2,
          }}>
            {[
              { id: "iso",      label: "🏙️ ISO" },
              { id: "world",    label: "🌍 Monde" },
              { id: "district", label: "🗺️ Quartier" },
            ].map((mode) => {
              const active = mapMode === mode.id || (mode.id === "district" && districtSlug !== null);
              return (
                <Pressable key={mode.id} onPress={() => {
                  if (mode.id === "iso") { setMapMode("iso"); setDistrictSlug(null); }
                  else if (mode.id === "world") { setMapMode("world"); setDistrictSlug(null); }
                  else { setMapMode("district"); if (!districtSlug) setDistrictSlug(currentLocationSlug); }
                }}
                  style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center",
                    backgroundColor: active ? C.gold : "transparent",
                    shadowColor: active ? C.gold : "transparent",
                    shadowOpacity: active ? 0.4 : 0, shadowRadius: 12 }}>
                  <Text style={{ color: active ? "#080808" : C.soft, fontSize: 11,
                    fontWeight: "900", letterSpacing: 0.3 }}>
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── CARTE ──────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <View style={{
            borderRadius: 20, overflow: "hidden",
            borderWidth: 1, borderColor: C.border,
            shadowColor: C.gold, shadowOpacity: 0.06, shadowRadius: 20,
          }}>
            {(mapMode === "iso" && !districtSlug) && (
              <IsoCityMap currentSlug={currentLocationSlug} npcs={npcs}
                onTravel={handleTravel}
                onDistrictPress={(slug) => setSelectedSlug(slug)} />
            )}

            {(mapMode === "world" && !districtSlug) && (
              <WorldLiveMap
                currentSlug={currentLocationSlug}
                avatarName={avatar?.displayName ?? "Vous"}
                avatarVisual={avatar ? getAvatarVisual(avatar) : null}
                npcs={npcs} relationships={relationships} events={mapEvents}
                currentCityId={currentCityId} focusedCityId={focusedCityId}
                selectedNpcId={selectedNpcId} dateRoute={dateRoute}
                onCityPress={(cityId) => { setSelectedNpcId(null); setSelectedSlug(null); setFocusedCityId(cityId); }}
                onBackToWorld={() => { setFocusedCityId(null); setSelectedNpcId(null); }}
                onLocationPress={(slug) => { setSelectedNpcId(null); setSelectedSlug(slug); }}
                onPersonPress={(npcId) => {
                  setSelectedSlug(null); setSelectedNpcId(npcId);
                  const npc = npcs.find((n) => n.id === npcId);
                  if (npc) setFocusedCityId(cityForNpc(npc).id);
                }}
                onZoomToDistrict={(cityId, slug) => {
                  setSelectedSlug(null); setFocusedCityId(cityId);
                  setDistrictCityId(cityId); setDistrictSlug(slug); setMapMode("district");
                }}
              />
            )}

            {(mapMode === "district" || districtSlug) && (
              <View>
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 10,
                  padding: 12, backgroundColor: C.glass, borderBottomWidth: 1, borderBottomColor: C.border,
                }}>
                  <Pressable onPress={() => { setDistrictSlug(null); setMapMode("iso"); }}
                    style={{ height: 34, borderRadius: 10, paddingHorizontal: 12,
                      alignItems: "center", justifyContent: "center",
                      backgroundColor: C.goldDim, borderWidth: 1, borderColor: C.gold + "40" }}>
                    <Text style={{ color: C.gold, fontSize: 11, fontWeight: "900" }}>← Iso</Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.muted, fontSize: 8, fontWeight: "900",
                      textTransform: "uppercase", letterSpacing: 1.5 }}>QUARTIER</Text>
                    <Text numberOfLines={1} style={{ color: C.text, fontSize: 13, fontWeight: "900" }}>
                      {districtCity.name} — {districtLoc?.name ?? districtSlug ?? currentLocationSlug}
                    </Text>
                  </View>
                </View>
                <VillageMap
                  currentSlug={districtSlug ?? currentLocationSlug}
                  cityName={districtCity.name} events={mapEvents}
                  onLocationPress={(slug) => { setDistrictSlug(slug); setSelectedSlug(slug); }}
                />
              </View>
            )}
          </View>
        </View>

        {/* ── CITY INTEL ─────────────────────────────────────────────────────── */}
        {cityIntel && cityIntel.locationSlug !== currentLocationSlug && (
          <Pressable onPress={() => setSelectedSlug(cityIntel.locationSlug)}
            style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 12,
              backgroundColor: intelColor + "10",
              borderWidth: 1, borderColor: intelColor + "30",
              flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10,
              backgroundColor: intelColor + "15", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16 }}>💡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: intelColor, fontSize: 10, fontWeight: "900",
                textTransform: "uppercase", letterSpacing: 1 }}>{cityIntel.title}</Text>
              <Text numberOfLines={1} style={{ color: C.soft, fontSize: 12, marginTop: 1 }}>
                {cityIntel.body}
              </Text>
            </View>
            <Text style={{ color: intelColor, fontSize: 16 }}>→</Text>
          </Pressable>
        )}

        {/* ── ÉVÉNEMENT MONDIAL ──────────────────────────────────────────────── */}
        {worldEvent && (
          <Pressable onPress={() => !worldEventJoined && joinWorldEvent()}
            style={{ marginHorizontal: 16, marginBottom: 12,
              backgroundColor: worldEventJoined ? C.glass : C.green + "08",
              borderRadius: 18, padding: 14,
              borderWidth: 1, borderColor: worldEventJoined ? C.border : C.green + "30",
              flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{
              width: 48, height: 48, borderRadius: 15,
              backgroundColor: C.green + "14",
              borderWidth: 1, borderColor: C.green + "30",
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ fontSize: 24 }}>{worldEvent.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: worldEventJoined ? C.muted : C.green,
                fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 2 }}>
                🌍 {worldEvent.city.name.toUpperCase()} · ÉVÉNEMENT MONDIAL
              </Text>
              <Text numberOfLines={1} style={{ color: C.text, fontSize: 14, fontWeight: "800" }}>
                {worldEvent.title}
              </Text>
              <Text style={{ color: C.gold, fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                +{worldEvent.xpReward} XP · +{worldEvent.moneyReward} cr · +{worldEvent.moodBonus} humeur
              </Text>
            </View>
            {worldEventJoined ? (
              <View style={{ backgroundColor: C.green + "18", borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 6,
                borderWidth: 1, borderColor: C.green + "30" }}>
                <Text style={{ color: C.green, fontWeight: "800", fontSize: 11 }}>✓ Rejoint</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: C.green, borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: "#040408", fontWeight: "900", fontSize: 11 }}>Rejoindre</Text>
              </View>
            )}
          </Pressable>
        )}

        {/* ── ÉVÉNEMENTS ─────────────────────────────────────────────────────── */}
        {mapEvents.length > 0 && mapEvents[0] && (
          <Pressable onPress={() => setSelectedSlug(mapEvents[0].locationSlug)}
            style={{ marginHorizontal: 16, marginBottom: 12,
              borderRadius: 14, padding: 12,
              backgroundColor: mapEvents[0].severity === "high" ? C.red + "10" : C.gold + "10",
              borderWidth: 1, borderColor: (mapEvents[0].severity === "high" ? C.red : C.gold) + "30",
              flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10,
              backgroundColor: (mapEvents[0].severity === "high" ? C.red : C.gold) + "18",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18 }}>{mapEvents[0].emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: mapEvents[0].severity === "high" ? C.red : C.gold,
                fontSize: 11, fontWeight: "900" }}>{mapEvents[0].title}</Text>
              <Text numberOfLines={1} style={{ color: C.soft, fontSize: 11, marginTop: 2 }}>
                {worldLocations.find((l) => l.slug === mapEvents[0].locationSlug)?.name} · {mapEvents[0].body}
              </Text>
            </View>
            <Text style={{ color: mapEvents[0].severity === "high" ? C.red : C.gold, fontSize: 16 }}>→</Text>
          </Pressable>
        )}

        {/* ── LIEUX RAPIDES ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: "900", letterSpacing: -0.3 }}>
                Lieux utiles
              </Text>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green,
                shadowColor: C.green, shadowOpacity: 0.8, shadowRadius: 6 }} />
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable onPress={() => router.push("/(app)/world-social" as never)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4,
                  backgroundColor: C.blue + "10", borderRadius: 10,
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderWidth: 1, borderColor: C.blue + "30" }}>
                <Text style={{ fontSize: 11 }}>🌍</Text>
                <Text style={{ color: C.blue, fontSize: 11, fontWeight: "800" }}>Carte</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/world-live" as never)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4,
                  backgroundColor: C.purple + "10", borderRadius: 10,
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderWidth: 1, borderColor: C.purple + "30" }}>
                <Text style={{ fontSize: 11 }}>🏙️</Text>
                <Text style={{ color: C.purple, fontSize: 11, fontWeight: "800" }}>Néon</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
            {quickSlugs.map((slug) => (
              <LocationCard key={slug} slug={slug}
                isHere={slug === currentLocationSlug}
                npcCount={npcsByLoc[slug]?.length ?? 0}
                eventEmoji={mapEventsByLoc[slug]?.emoji}
                eventSeverity={mapEventsByLoc[slug]?.severity}
                onPress={() => setSelectedSlug(slug)} />
            ))}
          </ScrollView>

          {/* Quartiers filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
            {NEIGHBORHOODS.map((n) => {
              const first  = n.slugs.find((s) => worldLocations.some((l) => l.slug === s));
              if (!first) return null;
              const active = n.slugs.includes(currentLocationSlug);
              const total  = n.slugs.reduce((sum, s) => sum + (npcsByLoc[s]?.length ?? 0), 0);
              return (
                <Pressable key={n.label} onPress={() => setSelectedSlug(first)}
                  style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
                    borderWidth: active ? 1.5 : 1,
                    borderColor: active ? n.color : C.border,
                    backgroundColor: active ? n.color + "18" : C.glass,
                    flexDirection: "row", alignItems: "center", gap: 6,
                    shadowColor: active ? n.color : "transparent",
                    shadowOpacity: active ? 0.35 : 0, shadowRadius: 10 }}>
                  <Text numberOfLines={1} style={{
                    color: active ? n.color : C.soft, fontSize: 12, fontWeight: "800" }}>
                    {n.label}
                  </Text>
                  {total > 0 && (
                    <View style={{ backgroundColor: n.color + "25", borderRadius: 8,
                      paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: n.color, fontSize: 9, fontWeight: "900" }}>{total}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Vie en ville */}
          <View style={{
            backgroundColor: C.glass, borderRadius: 16,
            borderWidth: 1, borderColor: C.green + "20", padding: 14,
            overflow: "hidden",
            shadowColor: C.green, shadowOpacity: 0.06, shadowRadius: 16,
          }}>
            {/* Top accent line */}
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5,
              backgroundColor: C.green, opacity: 0.35 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <Pulse color={C.green} size={9} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: "900" }}>Vie en ville</Text>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                  {currentNpcs.length > 0
                    ? `${currentNpcs.length} habitant${currentNpcs.length > 1 ? "s" : ""} ici avec toi`
                    : `${npcs.length} habitants en mouvement`}
                </Text>
              </View>
              <View style={{ backgroundColor: C.green + "15", borderRadius: 8,
                paddingHorizontal: 8, paddingVertical: 4,
                borderWidth: 1, borderColor: C.green + "30" }}>
                <Text style={{ color: C.green, fontSize: 10, fontWeight: "900" }}>LIVE</Text>
              </View>
            </View>
            {currentNpcs.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {currentNpcs.slice(0, 3).map((n) => (
                  <Pressable key={n.id} onPress={() => setSelectedSlug(n.locationSlug)}
                    style={{ borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
                      backgroundColor: C.blue + "14", borderWidth: 1, borderColor: C.blue + "30",
                      flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 11 }}>{ACTION_EMOJI[n.action] ?? "•"}</Text>
                    <Text numberOfLines={1} style={{ color: C.blue, fontSize: 11, fontWeight: "800" }}>
                      {n.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

      </ScrollView>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
      <Modal visible={selectedSlug !== null} transparent animationType="slide"
        onRequestClose={() => setSelectedSlug(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(4,4,10,0.7)", justifyContent: "flex-end" }}
          onPress={() => setSelectedSlug(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {selectedSlug && (
              <LocationPanel slug={selectedSlug} currentSlug={currentLocationSlug}
                npcs={npcs} event={mapEventsByLoc[selectedSlug]}
                onTravel={handleTravel} onClose={() => setSelectedSlug(null)} />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={selectedNpc !== null} transparent animationType="slide"
        onRequestClose={() => setSelectedNpcId(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(4,4,10,0.7)", justifyContent: "flex-end" }}
          onPress={() => setSelectedNpcId(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {selectedNpc && (
              <PersonPanel npc={selectedNpc} relationship={selectedRelationship}
                npcRelation={npcRelations.find((r) => r.npcId === selectedNpc.id)}
                onStartDate={(v) => { handleStartDate(selectedNpc, v); setSelectedNpcId(null); }}
                onZoomDistrict={() => {
                  const city = selectedNpcCity ?? cityForNpc(selectedNpc);
                  setFocusedCityId(city.id); setDistrictCityId(city.id);
                  setDistrictSlug(selectedNpc.locationSlug); setSelectedNpcId(null);
                }}
                onInteract={() => { updateNpcRelation(selectedNpc.id, 5, selectedNpc.name); setSelectedNpcId(null); }}
                onClose={() => setSelectedNpcId(null)} />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
