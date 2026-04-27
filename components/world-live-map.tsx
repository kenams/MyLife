import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Platform, Pressable, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { AvatarSprite } from "@/components/avatar-sprite";
import type { AvatarVisual } from "@/lib/avatar-visual";
import type { MapEvent } from "@/lib/map-events";
import type { NpcState, RelationshipRecord } from "@/lib/types";
import { worldLocations } from "@/stores/game-store";

const SCREEN = Dimensions.get("window");
const IS_WIDE = SCREEN.width >= 900;
const MAP_W = Math.max(330, Math.min(SCREEN.width - (IS_WIDE ? 64 : 16), IS_WIDE ? 1180 : 680));
const MAP_H = IS_WIDE
  ? Math.min(720, Math.max(560, MAP_W * 0.56))
  : Math.min(Math.max(560, SCREEN.height * 0.68), 690);
const MANUAL_ZOOM_MIN = 1;
const MANUAL_ZOOM_MAX = 4.0;
const MANUAL_ZOOM_STEP = 0.12;

export type WorldCity = {
  id: string;
  name: string;
  continent: string;
  x: number;
  y: number;
  accent: string;
  defaultSlug: string;
};

type DistrictPoint = {
  slug: string;
  x: number;
  y: number;
};

type DateRoute = {
  id: string;
  npcName: string;
  cityId: string;
  fromSlug: string;
  venueSlug: string;
  status: "moving" | "confirmed";
};

type Props = {
  currentSlug: string;
  avatarName: string;
  avatarVisual?: AvatarVisual | null;
  npcs: NpcState[];
  relationships: RelationshipRecord[];
  events?: MapEvent[];
  currentCityId: string;
  focusedCityId?: string | null;
  selectedNpcId?: string | null;
  dateRoute?: DateRoute | null;
  darkMode?: boolean;
  onCityPress: (cityId: string) => void;
  onBackToWorld: () => void;
  onLocationPress: (slug: string, label: string) => void;
  onPersonPress: (npcId: string) => void;
  onZoomToDistrict: (cityId: string, slug: string) => void;
};

export const WORLD_CITIES: WorldCity[] = [
  { id: "neo-newyork", name: "Neo NewYork", continent: "Amerique Nord", x: 22, y: 38, accent: "#2563EB", defaultSlug: "nightclub" },
  { id: "neo-mexico", name: "Neo Mexico", continent: "Amerique Nord", x: 18, y: 51, accent: "#0EA5E9", defaultSlug: "residence-confort" },
  { id: "neo-rio", name: "Neo Rio", continent: "Amerique Sud", x: 33, y: 55, accent: "#06B6D4", defaultSlug: "market" },
  { id: "neo-london", name: "Neo London", continent: "Europe", x: 44, y: 27, accent: "#3B82F6", defaultSlug: "library" },
  { id: "neo-paris", name: "Neo Paris", continent: "Europe", x: 49, y: 31, accent: "#0A65C7", defaultSlug: "home" },
  { id: "neo-bamako", name: "Neo Bamako", continent: "Afrique", x: 42, y: 52, accent: "#14B8A6", defaultSlug: "park" },
  { id: "neo-cairo", name: "Neo Cairo", continent: "Afrique", x: 61, y: 44, accent: "#0284C7", defaultSlug: "restaurant" },
  { id: "neo-dubai", name: "Neo Dubai", continent: "Moyen-Orient", x: 67, y: 49, accent: "#0891B2", defaultSlug: "gym" },
  { id: "neo-tokyo", name: "Neo Tokyo", continent: "Asie", x: 74, y: 32, accent: "#0757C7", defaultSlug: "residence-luxe" },
  { id: "neo-seoul", name: "Neo Seoul", continent: "Asie", x: 83, y: 42, accent: "#1D4ED8", defaultSlug: "cinema" },
  { id: "neo-singapore", name: "Neo Singapore", continent: "Asie", x: 78, y: 55, accent: "#0E7490", defaultSlug: "rooftop-bar" },
  { id: "neo-sydney", name: "Neo Sydney", continent: "Oceanie", x: 86, y: 76, accent: "#0369A1", defaultSlug: "spa" },
];

const DISTRICT_POINTS: DistrictPoint[] = [
  { slug: "home", x: 26, y: 28 },
  { slug: "library", x: 43, y: 20 },
  { slug: "office", x: 55, y: 26 },
  { slug: "startup", x: 66, y: 24 },
  { slug: "cafe", x: 40, y: 45 },
  { slug: "park", x: 25, y: 48 },
  { slug: "market", x: 56, y: 47 },
  { slug: "gym", x: 71, y: 49 },
  { slug: "restaurant", x: 39, y: 66 },
  { slug: "cinema", x: 55, y: 68 },
  { slug: "nightclub", x: 69, y: 68 },
  { slug: "spa", x: 81, y: 66 },
  { slug: "residence-populaire", x: 24, y: 81 },
  { slug: "residence-confort", x: 44, y: 83 },
  { slug: "residence-luxe", x: 64, y: 82 },
  { slug: "rooftop-bar", x: 82, y: 82 },
];

const KIND_STYLE: Record<string, { color: string; fill: string; short: string }> = {
  home: { color: "#F59E0B", fill: "rgba(245,158,11,0.18)", short: "H" },
  food: { color: "#F97316", fill: "rgba(249,115,22,0.18)", short: "F" },
  social: { color: "#14B8A6", fill: "rgba(20,184,166,0.18)", short: "S" },
  work: { color: "#60A5FA", fill: "rgba(96,165,250,0.18)", short: "W" },
  wellness: { color: "#A78BFA", fill: "rgba(167,139,250,0.18)", short: "M" },
  public: { color: "#34D399", fill: "rgba(52,211,153,0.18)", short: "P" },
};

const ACTION_LABEL: Record<string, string> = {
  sleeping: "repos",
  eating: "mange",
  chatting: "social",
  exercising: "sport",
  walking: "marche",
  working: "travail",
  idle: "pause",
  waving: "salut",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashText(text: string) {
  return text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function cityById(cityId: string | null | undefined): WorldCity {
  return WORLD_CITIES.find((city) => city.id === cityId) ?? WORLD_CITIES[4];
}

export function cityForNpc(npc: Pick<NpcState, "id">): WorldCity {
  const hash = hashText(npc.id);
  return WORLD_CITIES[hash % WORLD_CITIES.length];
}

function districtPointForSlug(slug: string): DistrictPoint {
  return DISTRICT_POINTS.find((point) => point.slug === slug) ?? DISTRICT_POINTS[0];
}

function locationForSlug(slug: string) {
  return worldLocations.find((location) => location.slug === slug);
}

function worldMarkerForNpc(npc: NpcState) {
  const city = cityForNpc(npc);
  const hash = hashText(npc.id);
  const jitterX = ((hash % 17) - 8) * 0.42 + ((npc.posX % 9) - 4) * 0.18;
  const jitterY = (((hash >> 2) % 15) - 7) * 0.42 + ((npc.posY % 9) - 4) * 0.18;
  return {
    x: clamp(city.x + jitterX, 5, 95),
    y: clamp(city.y + jitterY, 10, 86),
  };
}

function districtMarkerForNpc(npc: NpcState) {
  const point = districtPointForSlug(npc.locationSlug);
  const hash = hashText(npc.id);
  const jitterX = ((hash % 17) - 8) * 0.38 + ((npc.posX % 9) - 4) * 0.14;
  const jitterY = (((hash >> 2) % 15) - 7) * 0.38 + ((npc.posY % 9) - 4) * 0.14;
  return {
    x: clamp(point.x + jitterX, 7, 93),
    y: clamp(point.y + jitterY, 10, 88),
  };
}

function lensMarker(point: { x: number; y: number }) {
  return {
    x: 6 + point.x * 0.88,
    y: 18 + point.y * 0.60,
  };
}

function eventColor(event?: MapEvent) {
  if (!event) return "transparent";
  if (event.severity === "high") return "#FB7185";
  if (event.severity === "medium") return "#F59E0B";
  return "#38BDF8";
}

function Initials({ label, color }: { label: string; color: string }) {
  return (
    <View style={{
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: color,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.72)",
    }}>
      <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>
        {label.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

function LocationMarker({
  point,
  current,
  event,
  onPress,
}: {
  point: DistrictPoint;
  current: boolean;
  event?: MapEvent;
  onPress: () => void;
}) {
  const location = locationForSlug(point.slug);
  if (!location) return null;
  const style = KIND_STYLE[location.kind] ?? KIND_STYLE.public;
  const color = eventColor(event);

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: [{ translateX: -17 }, { translateY: -17 }],
        alignItems: "center",
        zIndex: current ? 20 : 10,
      }}>
      <View style={{
        width: current ? 42 : 34,
        height: current ? 42 : 34,
        borderRadius: current ? 21 : 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: current ? "#FFFFFF" : "rgba(255,255,255,0.88)",
        borderWidth: current ? 3 : 2,
        borderColor: current ? "#34D399" : style.color,
        shadowColor: style.color,
        shadowOpacity: 0.55,
        shadowRadius: 10,
        elevation: 8,
      }}>
        <View style={{
          width: current ? 24 : 18,
          height: current ? 24 : 18,
          borderRadius: current ? 12 : 9,
          backgroundColor: style.color,
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Text style={{ color: "#FFFFFF", fontSize: current ? 10 : 8, fontWeight: "900" }}>
            {style.short}
          </Text>
        </View>
        {event && (
          <View style={{
            position: "absolute",
            right: -5,
            top: -5,
            width: 13,
            height: 13,
            borderRadius: 7,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }} />
        )}
      </View>
      {(current || event) && (
        <View style={{
          marginTop: 4,
          maxWidth: 92,
          borderRadius: 8,
          paddingHorizontal: 7,
          paddingVertical: 3,
          backgroundColor: "rgba(9,15,28,0.82)",
          borderWidth: 1,
          borderColor: current ? "rgba(52,211,153,0.45)" : "rgba(255,255,255,0.12)",
        }}>
          <Text numberOfLines={1} style={{ color: "#F8FAFC", fontSize: 9, fontWeight: "800" }}>
            {current ? "Vous" : location.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function CityMarker({
  city,
  focused,
  current,
  liveCount,
  onPress,
}: {
  city: WorldCity;
  focused: boolean;
  current: boolean;
  liveCount: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: `${city.x}%`,
        top: `${city.y}%`,
        transform: [{ translateX: -20 }, { translateY: -20 }],
        alignItems: "center",
        zIndex: focused ? 28 : current ? 24 : 18,
      }}>
      <View style={{
        width: focused ? 54 : current ? 46 : 38,
        height: focused ? 54 : current ? 46 : 38,
        borderRadius: focused ? 27 : current ? 23 : 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: focused ? 4 : current ? 3 : 2,
        borderColor: focused ? "#FBBF24" : current ? "#34D399" : city.accent,
        shadowColor: city.accent,
        shadowOpacity: focused ? 0.55 : 0.32,
        shadowRadius: focused ? 18 : 10,
        elevation: focused ? 12 : 8,
      }}>
        <View style={{
          width: focused ? 32 : current ? 27 : 22,
          height: focused ? 32 : current ? 27 : 22,
          borderRadius: focused ? 16 : current ? 14 : 11,
          backgroundColor: city.accent,
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Text style={{ color: "#FFFFFF", fontSize: focused ? 12 : 9, fontWeight: "900" }}>
            {liveCount}
          </Text>
        </View>
      </View>
      {(focused || current) && (
        <View style={{
          marginTop: 5,
          borderRadius: 9,
          paddingHorizontal: 8,
          paddingVertical: 4,
          backgroundColor: "rgba(255,255,255,0.95)",
          borderWidth: 1,
          borderColor: "rgba(37,99,235,0.16)",
          shadowColor: "#0F172A",
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }}>
          <Text numberOfLines={1} style={{ color: "#0F172A", fontSize: 10, fontWeight: "900" }}>
            {city.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function PersonMarker({
  npc,
  selected,
  relationshipScore,
  marker,
  onPress,
}: {
  npc: NpcState;
  selected: boolean;
  relationshipScore: number;
  marker: { x: number; y: number };
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0.7)).current;
  const entry = useRef(new Animated.Value(1)).current;
  const activeColor = relationshipScore >= 60 ? "#34D399" : relationshipScore >= 30 ? "#FBBF24" : "#60A5FA";

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.7, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    entry.setValue(0);
    Animated.timing(entry, {
      toValue: 1,
      duration: selected ? 180 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entry, marker.x, marker.y, selected]);

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: `${marker.x}%`,
        top: `${marker.y}%`,
        transform: [{ translateX: -18 }, { translateY: -18 }],
        alignItems: "center",
        zIndex: selected ? 40 : 30,
      }}>
      <Animated.View style={{
        alignItems: "center",
        opacity: entry,
        transform: [{ scale: entry.interpolate({ inputRange: [0, 1], outputRange: [0.74, 1] }) }],
      }}>
        <Animated.View style={{
          position: "absolute",
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: activeColor,
          opacity: npc.presenceOnline ? pulse.interpolate({ inputRange: [0.7, 1], outputRange: [0.12, 0.28] }) : 0.05,
          transform: [{ scale: pulse }],
        }} />
        <View style={{
          width: selected ? 42 : 36,
          height: selected ? 42 : 36,
          borderRadius: selected ? 21 : 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? "#FFFFFF" : "rgba(255,255,255,0.92)",
          borderWidth: selected ? 3 : 2,
          borderColor: selected ? "#FBBF24" : activeColor,
          shadowColor: activeColor,
          shadowOpacity: 0.5,
          shadowRadius: 10,
          elevation: 8,
        }}>
          <Initials label={npc.name} color={activeColor} />
          <View style={{
            position: "absolute",
            right: 1,
            bottom: 1,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: npc.presenceOnline ? "#22C55E" : "#94A3B8",
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }} />
        </View>
        {selected && (
          <View style={{
            marginTop: 4,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
            backgroundColor: "rgba(9,15,28,0.88)",
            borderWidth: 1,
            borderColor: "rgba(251,191,36,0.4)",
          }}>
            <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "900" }}>
              {npc.name}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function RouteLayer({ route }: { route: DateRoute }) {
  const progress = useRef(new Animated.Value(route.status === "confirmed" ? 1 : 0)).current;
  const city = cityById(route.cityId);
  const startDistrict = districtPointForSlug(route.fromSlug);
  const endDistrict = districtPointForSlug(route.venueSlug);
  const start = {
    x: clamp(city.x + (startDistrict.x - 50) * 0.18, 5, 95),
    y: clamp(city.y + (startDistrict.y - 50) * 0.16, 10, 88),
  };
  const end = {
    x: clamp(city.x + (endDistrict.x - 50) * 0.18, 5, 95),
    y: clamp(city.y + (endDistrict.y - 50) * 0.16, 10, 88),
  };
  const startX = start.x * 10;
  const startY = start.y * 6.2;
  const endX = end.x * 10;
  const endY = end.y * 6.2;
  const dx = ((end.x - start.x) / 100) * MAP_W;
  const dy = ((end.y - start.y) / 100) * MAP_H;

  useEffect(() => {
    progress.setValue(route.status === "confirmed" ? 1 : 0);
    if (route.status === "moving") {
      Animated.timing(progress, { toValue: 1, duration: 1500, useNativeDriver: true }).start();
    }
  }, [progress, route.id, route.status]);

  return (
    <>
      <Svg pointerEvents="none" width={MAP_W} height={MAP_H} viewBox="0 0 1000 620" style={{ position: "absolute", left: 0, top: 0, zIndex: 12 }}>
        <Line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#FBBF24" strokeWidth={4} strokeDasharray="10 10" opacity={0.9} />
        <Circle cx={endX} cy={endY} r={12} fill="#FBBF24" opacity={0.2} />
        <Circle cx={endX} cy={endY} r={5} fill="#FBBF24" />
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: `${start.x}%`,
          top: `${start.y}%`,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: "#FFFFFF",
          borderWidth: 3,
          borderColor: "#FBBF24",
          zIndex: 42,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-7, dx - 7] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-7, dy - 7] }) },
          ],
        }}
      />
    </>
  );
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={{
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: "rgba(255,255,255,0.94)",
      borderWidth: 1,
      borderColor: "rgba(37,99,235,0.16)",
      minWidth: 72,
      shadowColor: "#0F172A",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    }}>
      <Text style={{ color: "#64748B", fontSize: 9, fontWeight: "800", textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: 14, fontWeight: "900", marginTop: 2 }}>{value}</Text>
    </View>
  );
}

export function WorldLiveMap({
  currentSlug,
  avatarName,
  avatarVisual,
  npcs,
  relationships,
  events = [],
  currentCityId,
  focusedCityId,
  selectedNpcId,
  dateRoute,
  darkMode = false,
  onCityPress,
  onBackToWorld,
  onLocationPress,
  onPersonPress,
  onZoomToDistrict,
}: Props) {
  const onlineNpcs = useMemo(
    () => npcs.filter((npc) => npc.presenceOnline).sort((a, b) => b.reputation - a.reputation),
    [npcs]
  );
  const visibleNpcs = onlineNpcs.length > 0 ? onlineNpcs : npcs.slice(0, 8);
  const currentCity = cityById(currentCityId);
  const focusedCity = focusedCityId ? cityById(focusedCityId) : null;
  const selectedNpc = selectedNpcId ? npcs.find((npc) => npc.id === selectedNpcId) : null;
  const selectedNpcCity = selectedNpc ? cityForNpc(selectedNpc) : null;
  const activeCity = focusedCity ?? selectedNpcCity ?? null;
  const focusedCityNpcs = activeCity
    ? visibleNpcs.filter((npc) => cityForNpc(npc).id === activeCity.id)
    : [];
  const eventsByLocation = useMemo(() => {
    return events.reduce<Record<string, MapEvent>>((acc, event) => {
      const existing = acc[event.locationSlug];
      if (!existing || event.severity === "high") acc[event.locationSlug] = event;
      return acc;
    }, {});
  }, [events]);
  const currentLocation = locationForSlug(currentSlug);
  const liveAround = activeCity
    ? focusedCityNpcs.filter((npc) => npc.locationSlug === currentSlug).length
    : visibleNpcs.filter((npc) => cityForNpc(npc).id === currentCity.id).length;
  const zoomSlug = selectedNpc?.locationSlug ?? activeCity?.defaultSlug ?? currentSlug;
  const zoomCity = selectedNpcCity ?? activeCity ?? currentCity;
  const zoomLocation = locationForSlug(zoomSlug);
  const cityLiveCounts = useMemo(() => {
    return visibleNpcs.reduce<Record<string, number>>((acc, npc) => {
      const city = cityForNpc(npc);
      acc[city.id] = (acc[city.id] ?? 0) + 1;
      return acc;
    }, {});
  }, [visibleNpcs]);
  const cityZoomAnim = useRef(new Animated.Value(activeCity ? 1 : 0)).current;
  const cameraX = useRef(new Animated.Value(0)).current;
  const cameraY = useRef(new Animated.Value(0)).current;
  const cameraScale = useRef(new Animated.Value(activeCity ? 1.12 : 1)).current;
  const mapRef = useRef<View | null>(null);
  const [manualZoom, setManualZoom] = useState(1);
  const shownNpcs = activeCity ? focusedCityNpcs : visibleNpcs;
  const playerMarker = activeCity?.id === currentCity.id
    ? lensMarker(districtPointForSlug(currentSlug))
    : { x: currentCity.x, y: currentCity.y };
  const targetCameraX = activeCity
    ? clamp((50 - activeCity.x) * MAP_W * 0.0052, -MAP_W * 0.22, MAP_W * 0.22)
    : 0;
  const targetCameraY = activeCity
    ? clamp((45 - activeCity.y) * MAP_H * 0.0048, -MAP_H * 0.18, MAP_H * 0.18)
    : 0;
  const targetCameraScale = (activeCity ? 1.12 : 1) * manualZoom;
  const manualZoomPct = Math.round(manualZoom * 100);
  const playerAccessibilityLabel = avatarName?.trim() ? `Vous - ${avatarName.trim()}` : "Vous";

  const adjustManualZoom = (delta: number) => {
    setManualZoom((value) => clamp(Math.round((value + delta) * 100) / 100, MANUAL_ZOOM_MIN, MANUAL_ZOOM_MAX));
  };

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const isInsideMap = (event: WheelEvent) => {
      const node = mapRef.current as unknown as HTMLElement | null;
      if (!node?.getBoundingClientRect) return false;
      const rect = node.getBoundingClientRect();
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    };

    const updateZoom = (delta: number) => {
      setManualZoom((value) => clamp(Math.round((value + delta) * 100) / 100, MANUAL_ZOOM_MIN, MANUAL_ZOOM_MAX));
    };

    const onWheel = (event: WheelEvent) => {
      if (!isInsideMap(event)) return;
      event.preventDefault();
      updateZoom(event.deltaY < 0 ? MANUAL_ZOOM_STEP : -MANUAL_ZOOM_STEP);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;
      if (event.key === "ArrowUp" || event.key === "ArrowRight") {
        event.preventDefault();
        updateZoom(MANUAL_ZOOM_STEP);
      }
      if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        event.preventDefault();
        updateZoom(-MANUAL_ZOOM_STEP);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cameraX, {
        toValue: targetCameraX,
        duration: activeCity ? 420 : 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cameraY, {
        toValue: targetCameraY,
        duration: activeCity ? 420 : 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cameraScale, {
        toValue: targetCameraScale,
        duration: activeCity ? 420 : 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cityZoomAnim, {
        toValue: activeCity ? 1 : 0,
        duration: activeCity ? 280 : 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeCity?.id, cameraScale, cameraX, cameraY, cityZoomAnim, targetCameraScale, targetCameraX, targetCameraY]);

  return (
    <View ref={mapRef} style={{
      width: MAP_W,
      height: MAP_H,
      borderRadius: 26,
      overflow: "hidden",
      alignSelf: "center",
      backgroundColor: darkMode ? "#020b18" : "#FFFFFF",
      borderWidth: darkMode ? 0 : 1,
      borderColor: darkMode ? "transparent" : "rgba(37,99,235,0.14)",
      shadowColor: darkMode ? "#3b82f6" : "#0F172A",
      shadowOpacity: darkMode ? 0.3 : 0.14,
      shadowRadius: 24,
      elevation: 12,
    }}>
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: MAP_W,
          height: MAP_H,
          zIndex: 5,
          transform: [
            { translateX: cameraX },
            { translateY: cameraY },
            { scale: cameraScale },
          ],
        }}>
        <Svg width={MAP_W} height={MAP_H} viewBox="0 0 1000 620">
          <Defs>
            <LinearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0"   stopColor={darkMode ? "#010c1e" : "#c8e6fa"} />
              <Stop offset="1"   stopColor={darkMode ? "#020f28" : "#a0d0f5"} />
            </LinearGradient>
            <LinearGradient id="land" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0"   stopColor={darkMode ? "#0d2b1a" : "#4a9e5c"} />
              <Stop offset="1"   stopColor={darkMode ? "#0a2215" : "#3a8a4c"} />
            </LinearGradient>
          </Defs>

          {/* Fond océan */}
          <Rect x={0} y={0} width={1000} height={620} fill="url(#ocean)" />

          {/* Grille de latitude/longitude subtile */}
          {darkMode && [100,200,300,400,500,600,700,800,900].map((lx) => (
            <Line key={`gl${lx}`} x1={lx} y1={0} x2={lx} y2={620} stroke="rgba(59,130,246,0.06)" strokeWidth={0.8} />
          ))}
          {darkMode && [100,200,300,400,500].map((ly) => (
            <Line key={`gly${ly}`} x1={0} y1={ly} x2={1000} y2={ly} stroke="rgba(59,130,246,0.06)" strokeWidth={0.8} />
          ))}

          {/* Continents — fill adaptatif */}
          <G fill="url(#land)" stroke={darkMode ? "#1a4a2a" : "#3a7a3a"} strokeWidth={0.8}>
            {/* Amérique du Nord */}
            <Path d="M72 80 C82 60 110 55 145 62 C175 68 195 58 220 65 C248 73 262 60 290 66 C315 72 330 88 320 108 C310 128 290 125 275 140 C260 155 268 172 260 190 C252 208 230 205 218 220 C204 238 218 255 210 272 C200 292 172 285 162 265 C150 242 135 230 112 228 C88 226 68 208 72 186 C76 162 50 148 58 126 C64 110 68 94 72 80 Z" />
            {/* Amérique Centrale */}
            <Path d="M162 265 C175 278 192 290 198 310 C204 330 188 345 195 365 C200 382 220 385 218 405 C215 420 198 410 188 395 C176 378 178 360 165 342 C152 324 155 298 162 265 Z" />
            {/* Amérique du Sud */}
            <Path d="M176 322 C208 332 238 352 250 382 C262 415 238 445 242 480 C248 520 285 545 270 580 C258 600 228 565 215 538 C200 508 192 482 172 462 C152 442 155 412 138 390 C122 368 138 340 176 322 Z" />
            {/* Groenland */}
            <Path d="M317 28 C355 8 420 10 462 35 C438 72 388 88 338 82 C302 78 290 52 317 28 Z" />
            {/* Islande */}
            <Path d="M398 68 C420 54 454 58 472 76 C460 98 422 102 400 88 C388 82 386 74 398 68 Z" />
            {/* Europe */}
            <Path d="M448 115 C472 90 526 85 560 105 C586 120 592 148 575 168 C558 188 530 180 514 198 C498 216 510 240 492 258 C472 278 445 268 434 242 C422 215 418 168 448 115 Z" />
            {/* Scandinavie */}
            <Path d="M478 68 C498 50 522 52 538 68 C522 88 502 92 480 82 Z" />
            {/* Péninsule ibérique */}
            <Path d="M440 182 C458 168 478 172 488 188 C476 208 454 212 438 198 Z" />
            {/* Italie approx */}
            <Path d="M498 195 C508 188 520 192 524 205 C515 215 502 214 498 195 Z" />
            {/* Afrique */}
            <Path d="M452 215 C480 190 545 182 590 205 C620 220 632 255 612 278 C592 300 558 288 540 308 C518 330 530 368 508 390 C484 414 450 402 436 372 C422 342 420 295 452 215 Z" />
            {/* Corne Afrique */}
            <Path d="M610 315 C642 340 658 385 648 428 C635 472 606 508 585 548 C565 580 540 558 546 518 C552 478 525 458 524 420 C522 378 556 338 610 315 Z" />
            {/* Afrique du Sud approx */}
            <Path d="M470 422 C502 440 525 468 520 500 C514 534 488 548 462 530 C436 512 430 480 448 452 Z" />
            {/* Russie/Asie Nord */}
            <Path d="M542 68 C596 42 696 38 792 58 C852 72 918 95 950 140 C975 175 950 212 896 208 C848 205 820 228 780 245 C738 264 700 242 658 240 C612 238 582 210 595 175 C602 152 582 128 542 68 Z" />
            {/* Péninsule arabique */}
            <Path d="M665 230 C690 218 720 225 738 250 C748 268 738 292 718 298 C698 304 678 285 665 260 Z" />
            {/* Inde */}
            <Path d="M680 248 C705 268 718 308 705 348 C692 388 658 410 635 390 C612 368 618 328 630 295 C640 268 658 238 680 248 Z" />
            {/* Asie du Sud-Est */}
            <Path d="M742 255 C775 235 838 235 878 260 C905 278 910 312 882 328 C856 344 822 325 798 344 C775 362 784 398 758 414 C732 430 705 410 698 380 C692 352 710 282 742 255 Z" />
            {/* Japon approx */}
            <Path d="M876 155 C892 140 916 145 928 162 C912 175 890 172 876 155 Z" />
            <Path d="M900 185 C918 175 946 182 958 200 C940 212 914 208 900 185 Z" />
            {/* Corée */}
            <Path d="M838 195 C856 185 872 190 878 208 C862 220 842 218 838 195 Z" />
            {/* Taiwan */}
            <Path d="M880 230 C890 222 905 226 908 238 C898 245 882 244 880 230 Z" />
            {/* Indonésie approx */}
            <Path d="M726 348 C740 362 735 392 720 412 C702 395 704 360 726 348 Z" />
            <Path d="M758 368 C778 358 810 368 818 390 C798 402 768 398 758 368 Z" />
            {/* Australie */}
            <Path d="M830 415 C878 388 948 408 975 455 C953 496 875 510 818 482 C780 466 788 436 830 415 Z" />
            {/* Nouvelle Zélande approx */}
            <Path d="M948 495 C960 478 980 482 985 500 C972 516 952 514 948 495 Z" />
          </G>

          {/* Points lumineux des villes */}
          {WORLD_CITIES.map((city) => (
            <G key={`city-glow-${city.id}`}>
              <Circle cx={city.x * 10} cy={city.y * 6.2} r={activeCity?.id === city.id ? 28 : 14}
                fill={city.accent} opacity={activeCity?.id === city.id ? 0.25 : 0.12} />
              <Circle cx={city.x * 10} cy={city.y * 6.2} r={4.4}
                fill={darkMode ? "#60a5fa" : "#FFFFFF"} opacity={0.92} />
            </G>
          ))}

          <SvgText x={36} y={610} fill={darkMode ? "rgba(59,130,246,0.35)" : "rgba(37,99,235,0.28)"} fontSize={11} fontWeight="700">
            MyLife World Live
          </SvgText>
        </Svg>

        {dateRoute && <RouteLayer route={dateRoute} />}

        {WORLD_CITIES.map((city) => (
          <CityMarker
            key={city.id}
            city={city}
            focused={activeCity?.id === city.id}
            current={currentCity.id === city.id}
            liveCount={cityLiveCounts[city.id] ?? 0}
            onPress={() => onCityPress(city.id)}
          />
        ))}
      </Animated.View>

      {activeCity && (
        <Animated.View style={{
          position: "absolute",
          left: "6%",
          right: "6%",
          top: "18%",
          bottom: "22%",
          borderRadius: 24,
          backgroundColor: "rgba(255,255,255,0.88)",
          borderWidth: 1.5,
          borderColor: `${activeCity.accent}55`,
          shadowColor: activeCity.accent,
          shadowOpacity: 0.18,
          shadowRadius: 24,
          elevation: 10,
          overflow: "hidden",
          zIndex: 26,
          opacity: cityZoomAnim,
          transform: [{
            scale: cityZoomAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
          }],
        }}>
          <View style={{
            position: "absolute",
            left: 14,
            top: 12,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: "rgba(255,255,255,0.94)",
            borderWidth: 1,
            borderColor: "rgba(37,99,235,0.12)",
            zIndex: 30,
          }}>
            <Text style={{ color: activeCity.accent, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>
              Zoom ville
            </Text>
            <Text style={{ color: "#0F172A", fontSize: 16, fontWeight: "900" }}>{activeCity.name}</Text>
          </View>
          <View style={{
            position: "absolute",
            left: "14%",
            right: "14%",
            top: "26%",
            height: 18,
            borderRadius: 9,
            backgroundColor: "rgba(100,116,139,0.18)",
          }} />
          <View style={{
            position: "absolute",
            left: "18%",
            right: "12%",
            bottom: "22%",
            height: 16,
            borderRadius: 8,
            backgroundColor: "rgba(100,116,139,0.16)",
          }} />
          <View style={{
            position: "absolute",
            left: "50%",
            top: "20%",
            bottom: "16%",
            width: 16,
            marginLeft: -8,
            borderRadius: 8,
            backgroundColor: "rgba(100,116,139,0.14)",
          }} />
          {DISTRICT_POINTS.map((point) => (
            <LocationMarker
              key={`district-${point.slug}`}
              point={point}
              current={currentCity.id === activeCity.id && currentSlug === point.slug}
              event={eventsByLocation[point.slug]}
              onPress={() => onLocationPress(point.slug, locationForSlug(point.slug)?.name ?? point.slug)}
            />
          ))}
        </Animated.View>
      )}

      <View
        pointerEvents="none"
        accessibilityLabel={playerAccessibilityLabel}
        style={{
          position: "absolute",
          left: `${playerMarker.x}%`,
          top: `${playerMarker.y}%`,
          transform: [{ translateX: -30 }, { translateY: -64 }],
          alignItems: "center",
          zIndex: activeCity?.id === currentCity.id ? 44 : 36,
        }}>
        <View style={{
          position: "absolute",
          top: 13,
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: "rgba(34,197,94,0.18)",
          borderWidth: 1,
          borderColor: "rgba(34,197,94,0.36)",
        }} />
        <View style={{
          width: 52,
          height: 56,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "flex-start",
          overflow: "hidden",
          backgroundColor: "#FFFFFF",
          borderWidth: 3,
          borderColor: "#22C55E",
          shadowColor: "#16A34A",
          shadowOpacity: 0.35,
          shadowRadius: 14,
          elevation: 10,
        }}>
          {avatarVisual ? (
            <View style={{ marginTop: 2, transform: [{ scale: 0.86 }] }}>
              <AvatarSprite visual={avatarVisual} action="waving" size="xs" />
            </View>
          ) : (
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              marginTop: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#22C55E",
            }}>
              <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>VOUS</Text>
            </View>
          )}
          <View style={{
            position: "absolute",
            right: 4,
            bottom: 4,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: "#22C55E",
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }} />
        </View>
        <View style={{
          marginTop: 4,
          borderRadius: 999,
          paddingHorizontal: 9,
          paddingVertical: 4,
          backgroundColor: "rgba(255,255,255,0.94)",
          borderWidth: 1,
          borderColor: "rgba(52,211,153,0.42)",
          shadowColor: "#0F172A",
          shadowOpacity: 0.10,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <Text numberOfLines={1} style={{ color: "#059669", fontSize: 9, fontWeight: "900" }}>
            Vous
          </Text>
        </View>
      </View>

      {shownNpcs.map((npc) => {
        const rel = relationships.find((item) => item.residentId === npc.id);
        return (
          <PersonMarker
            key={npc.id}
            npc={npc}
            selected={selectedNpcId === npc.id}
            relationshipScore={rel?.score ?? 0}
            marker={activeCity ? lensMarker(districtMarkerForNpc(npc)) : worldMarkerForNpc(npc)}
            onPress={() => onPersonPress(npc.id)}
          />
        );
      })}

      <View style={{
        position: "absolute",
        top: 12,
        left: 12,
        right: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        zIndex: 50,
      }}>
        <View style={{
          flex: 1,
          borderRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: 11,
          backgroundColor: darkMode ? "rgba(2,11,24,0.92)" : "rgba(255,255,255,0.94)",
          borderWidth: 1,
          borderColor: darkMode ? "rgba(59,130,246,0.25)" : "rgba(37,99,235,0.16)",
          shadowColor: darkMode ? "#3b82f6" : "#0F172A",
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 3,
        }}>
          <Text style={{ color: darkMode ? "#e2e8f0" : "#0F172A", fontSize: 17, fontWeight: "900" }}>
            {activeCity ? activeCity.name : "🌍 Carte Sociale"}
          </Text>
          <Text numberOfLines={1} style={{ color: darkMode ? "#60a5fa" : "#2563EB", fontSize: 11, marginTop: 2, fontWeight: "700" }}>
            {activeCity ? `${focusedCityNpcs.length} profils · quartier disponible` : `${currentLocation?.name ?? currentSlug} · ${currentCity.name}`}
          </Text>
        </View>
        <StatPill label="Live" value={onlineNpcs.length} color="#34D399" />
        <StatPill label="Ici" value={liveAround} color="#FBBF24" />
      </View>

      {activeCity && (
        <Pressable
          onPress={onBackToWorld}
          style={{
            position: "absolute",
            top: 88,
            left: 12,
            height: 36,
            borderRadius: 12,
            paddingHorizontal: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: darkMode ? "rgba(30,41,59,0.95)" : "rgba(15,23,42,0.88)",
            borderWidth: darkMode ? 1 : 0,
            borderColor: "rgba(59,130,246,0.3)",
            zIndex: 55,
          }}>
          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>← Monde</Text>
        </Pressable>
      )}

      <View style={{
        position: "absolute",
        top: 88,
        right: 12,
        borderRadius: 14,
        padding: 8,
        backgroundColor: darkMode ? "rgba(2,11,24,0.95)" : "rgba(255,255,255,0.95)",
        borderWidth: 1,
        borderColor: darkMode ? "rgba(59,130,246,0.25)" : "rgba(37,99,235,0.18)",
        shadowColor: darkMode ? "#3b82f6" : "#0F172A",
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 5,
        zIndex: 56,
        gap: 7,
        minWidth: 138,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View>
            <Text style={{ color: darkMode ? "#64748b" : "#64748B", fontSize: 9, fontWeight: "900", textTransform: "uppercase" }}>
              Zoom
            </Text>
            <Text style={{ color: darkMode ? "#60a5fa" : "#0A65C7", fontSize: 15, fontWeight: "900" }}>
              {manualZoomPct}%
            </Text>
          </View>
          <Pressable
            onPress={() => setManualZoom(1)}
            style={{
              height: 28,
              borderRadius: 10,
              paddingHorizontal: 9,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: manualZoom > 1 ? (darkMode ? "#1e40af" : "#0F172A") : "rgba(100,116,139,0.14)",
            }}>
            <Text style={{ color: manualZoom > 1 ? "#FFFFFF" : (darkMode ? "#64748b" : "#64748B"), fontSize: 10, fontWeight: "900" }}>
              1×
            </Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable
            onPress={() => adjustManualZoom(-MANUAL_ZOOM_STEP)}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: darkMode ? "rgba(59,130,246,0.12)" : "rgba(37,99,235,0.10)",
              borderWidth: 1,
              borderColor: darkMode ? "rgba(59,130,246,0.25)" : "rgba(37,99,235,0.16)",
            }}>
            <Text style={{ color: darkMode ? "#60a5fa" : "#2563EB", fontSize: 20, fontWeight: "900" }}>−</Text>
          </Pressable>
          <Pressable
            onPress={() => adjustManualZoom(MANUAL_ZOOM_STEP)}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: darkMode ? "#1d4ed8" : "#0A65C7",
            }}>
            <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900" }}>+</Text>
          </Pressable>
        </View>
        <Text numberOfLines={1} style={{ color: darkMode ? "#475569" : "#64748B", fontSize: 9, fontWeight: "700" }}>
          Molette · 1× → 4×
        </Text>
      </View>

      <View style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: activeCity ? 128 : 118,
        flexDirection: "row",
        gap: 8,
        zIndex: 54,
      }}>
        {[
          { label: "Monde", active: !activeCity },
          { label: activeCity?.name ?? "Ville", active: Boolean(activeCity) },
          { label: "Quartier", active: false },
        ].map((step) => (
          <View key={step.label} style={{
            flex: 1,
            borderRadius: 999,
            paddingVertical: 7,
            alignItems: "center",
            backgroundColor: step.active ? "#0A65C7" : "rgba(255,255,255,0.88)",
            borderWidth: 1,
            borderColor: step.active ? "#0A65C7" : "rgba(37,99,235,0.16)",
          }}>
            <Text numberOfLines={1} style={{
              color: step.active ? "#FFFFFF" : "#2563EB",
              fontSize: 10,
              fontWeight: "900",
            }}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        borderRadius: 18,
        padding: 12,
        backgroundColor: "rgba(255,255,255,0.94)",
        borderWidth: 1,
        borderColor: dateRoute ? "rgba(251,191,36,0.50)" : "rgba(37,99,235,0.16)",
        shadowColor: "#0F172A",
        shadowOpacity: 0.10,
        shadowRadius: 14,
        elevation: 6,
        zIndex: 50,
      }}>
        {dateRoute ? (
          <View style={{ gap: 4 }}>
            <Text style={{ color: "#FBBF24", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>
              RDV {dateRoute.status === "moving" ? "en approche" : "confirme"}
            </Text>
            <Text numberOfLines={1} style={{ color: "#0F172A", fontSize: 14, fontWeight: "900" }}>
              {dateRoute.npcName} - {locationForSlug(dateRoute.venueSlug)?.name ?? dateRoute.venueSlug}
            </Text>
          </View>
        ) : selectedNpc ? (
          <View style={{ gap: 4 }}>
            <Text style={{ color: "#0F172A", fontSize: 14, fontWeight: "900" }}>{selectedNpc.name}</Text>
            <Text numberOfLines={1} style={{ color: "#64748B", fontSize: 11 }}>
              {ACTION_LABEL[selectedNpc.action] ?? selectedNpc.action} - {locationForSlug(selectedNpc.locationSlug)?.name ?? selectedNpc.locationSlug}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 4 }}>
            <Text style={{ color: "#0F172A", fontSize: 14, fontWeight: "900" }}>Carte sociale active</Text>
            <Text numberOfLines={1} style={{ color: "#64748B", fontSize: 11 }}>
              {activeCity ? `${focusedCityNpcs.length} profils dans ${activeCity.name}` : `${visibleNpcs.length} profils visibles sur le monde`}
            </Text>
          </View>
        )}
        <Pressable
          onPress={() => {
            if (activeCity) onZoomToDistrict(zoomCity.id, zoomSlug);
            else onCityPress(zoomCity.id);
          }}
          style={{
            marginTop: 10,
            height: 42,
            borderRadius: 13,
            backgroundColor: "#0A65C7",
            alignItems: "center",
            justifyContent: "center",
          }}>
          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>
            {activeCity ? `Entrer dans le quartier - ${zoomLocation?.name ?? zoomSlug}` : `Zoom ${zoomCity.name}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
