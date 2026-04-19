import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import type { AvatarAction } from "@/lib/avatar-visual";
import { ACTION_COLORS, ACTION_LABELS, getAvatarVisual, getNpcVisual } from "@/lib/avatar-visual";
import { buildCityIntel, type CityIntelUrgency } from "@/lib/city-intelligence";
import { cityName } from "@/lib/game-data";
import { LOCATION_COORDS, tickAllNpcs } from "@/lib/npc-brain";
import { getNpcStatusLine, getNpcMoodEmoji } from "@/lib/npc-ai";
import { getResidentialDistrictForLocation, RESIDENTIAL_DISTRICTS } from "@/lib/residential-districts";
import { colors } from "@/lib/theme";
import type { LifeActionId, NpcState, WorldPresenceMember } from "@/lib/types";
import { useGameStore, worldLocations } from "@/stores/game-store";
import { useLocationChat } from "@/hooks/use-location-chat";
import { useWorldPresence } from "@/hooks/use-world-presence";

// ─── Dimensions de la carte 2D ────────────────────────────────────────────────
const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const IS_WIDE = SCREEN_W >= 1360;
// Carte principale + chat lateral : la map garde une largeur reelle et lisible.
const WORLD_CHAT_W = IS_WIDE ? Math.min(440, Math.max(390, Math.round(SCREEN_W * 0.23))) : SCREEN_W;
const WORLD_CHAT_H = IS_WIDE ? SCREEN_H : Math.min(340, Math.max(280, Math.round(SCREEN_H * 0.36)));
const MAP_W = IS_WIDE ? Math.max(780, SCREEN_W - WORLD_CHAT_W) : SCREEN_W;
const MAP_H = IS_WIDE ? SCREEN_H : Math.max(420, SCREEN_H - WORLD_CHAT_H);
const MAP_BASE_W = 380;
const MAP_BASE_H = 460;
const MAP_SX = MAP_W / MAP_BASE_W;
const MAP_SY = MAP_H / MAP_BASE_H;

type TravelModeId = "walk" | "bus" | "car";

type TravelPlan = {
  mode: TravelModeId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  cost: number;
  energyCost: number;
  durationMs: number;
  durationLabel: string;
  available: boolean;
  reason: string;
};

type TravelNotice = {
  from: string;
  to: string;
  at: number;
  mode: TravelModeId;
  modeLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  cost: number;
  durationLabel: string;
  durationMs: number;
};

type ArrivalNotice = {
  locationSlug: string;
  locationName: string;
  at: number;
};

type RoomEntryNotice = {
  code: string;
  locationSlug: string;
  locationName: string;
  roomName: string;
  at: number;
  durationMs: number;
};

const WORLD_WIZZ_TOKEN = "[[WIZZ]]";
const WORLD_CHAT_SHORTCUTS = [
  "Bonjour, je suis la.",
  "Ca va ici ?",
  "Qui veut discuter ?",
  "On se retrouve dans cette room ?"
];

const ROOM_ENTRY_DURATION_MS = 10_000;
const LOCATION_ROOM_CODES: Record<string, string> = {
  home: "HOME",
  "residence-populaire": "HOME",
  "residence-confort": "HOME",
  "residence-luxe": "HOME",
  cafe: "LIVE",
  gym: "GYM",
  cinema: "CINE",
  office: "WORK",
  park: "PARK",
  market: "SHOP",
  restaurant: "FOOD"
};

const LOCATION_TILES: Record<string, { x: number; y: number; w: number; h: number; color: string; icon: string }> = {
  "home":       { x: 16,  y: 42,  w: 114, h: 94, color: "#2478d4", icon: "home"       },
  "residence-populaire": { x: 18,  y: 390, w: 88,  h: 58, color: "#8a4f3d", icon: "business" },
  "residence-confort":   { x: 150, y: 86,  w: 78,  h: 72, color: "#4f7c9d", icon: "business" },
  "residence-luxe":      { x: 286, y: 390, w: 78,  h: 58, color: "#b98b3d", icon: "diamond"  },
  "market":     { x: 18,  y: 286, w: 104, h: 82, color: "#2f9e62", icon: "cart"       },
  "cafe":       { x: 262, y: 66,  w: 86,  h: 78, color: "#d97328", icon: "cafe"       },
  "office":     { x: 146, y: 166, w: 94,  h: 104, color: "#2d7ec2", icon: "briefcase"  },
  "park":       { x: 18,  y: 164, w: 96,  h: 88, color: "#15936e", icon: "leaf"       },
  "gym":        { x: 282, y: 300, w: 88,  h: 90, color: "#c23c32", icon: "fitness"    },
  "restaurant": { x: 188, y: 328, w: 92,  h: 86, color: "#8140aa", icon: "restaurant" },
  "cinema":     { x: 294, y: 202, w: 76,  h: 84, color: "#33465e", icon: "film"       }
};

const DISTRICT_ZONES = [
  { key: "north-west", x: 0,   y: 0,   w: 126, h: 132, color: "#a9c99a", border: "#6f9f68", label: "Vieux Centre", sub: "depart", tone: "green" },
  { key: "mid-class",  x: 132, y: 0,   w: 88,  h: 132, color: "#9fc8d5", border: "#5e9cb4", label: "Confort", sub: "moyen", tone: "blue" },
  { key: "green",      x: 0,   y: 164, w: 126, h: 106, color: "#86c982", border: "#3b9959", label: "Parc Nord", sub: "social", tone: "green" },
  { key: "business",   x: 264, y: 164, w: 116, h: 120, color: "#bccdb5", border: "#6f8c89", label: "Business", sub: "travail", tone: "blue" },
  { key: "market",     x: 0,   y: 304, w: 150, h: 156, color: "#83bd74", border: "#478f50", label: "Marches", sub: "budget", tone: "green" },
  { key: "social",     x: 144, y: 304, w: 136, h: 156, color: "#aea5c8", border: "#7a67a8", label: "Soirees", sub: "dates", tone: "purple" },
  { key: "popular",    x: 0,   y: 360, w: 118, h: 100, color: "#b98975", border: "#d86d57", label: "Populaire", sub: "modeste", tone: "warm" },
  { key: "office",     x: 132, y: 72,  w: 106, h: 92,  color: "#89b8d8", border: "#609bd0", label: "Bureaux", sub: "carriere", tone: "blue" },
  { key: "elite",      x: 270, y: 374, w: 110, h: 86,  color: "#d8ba66", border: "#f6b94f", label: "Baie Elite", sub: "riche", tone: "gold" }
] as const;

function pctToMap(posX: number, posY: number) {
  return { x: (posX / 100) * MAP_W, y: (posY / 100) * MAP_H };
}

function scaleTile(tile: (typeof LOCATION_TILES)[string]) {
  return {
    x: tile.x * MAP_SX,
    y: tile.y * MAP_SY,
    w: tile.w * MAP_SX,
    h: tile.h * MAP_SY
  };
}

function tileCenter(slug: string) {
  const tile = LOCATION_TILES[slug];
  if (!tile) return null;
  const box = scaleTile(tile);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function routeDistance(fromSlug: string, toSlug: string) {
  const from = tileCenter(fromSlug);
  const to = tileCenter(toSlug);
  if (!from || !to) return 0;
  return Math.round(Math.abs(to.x - from.x) + Math.abs(to.y - from.y));
}

function hasDrivingPermit(playerLevel: number, reputation: number, housingTier: string) {
  return playerLevel >= 4 || reputation >= 55 || ["loft", "penthouse", "villa", "manoir"].includes(housingTier);
}

function buildTravelPlans(fromSlug: string, toSlug: string, money: number, playerLevel: number, reputation: number, housingTier: string): TravelPlan[] {
  const distance = routeDistance(fromSlug, toSlug);
  const permit = hasDrivingPermit(playerLevel, reputation, housingTier);
  const busCost = Math.max(2, Math.round(distance / 155));
  const carCost = Math.max(8, Math.round(distance / 82));
  const walkMinutes = Math.max(8, Math.round(distance / 8));
  const busMinutes = Math.max(5, Math.round(distance / 15) + 3);
  const carMinutes = Math.max(3, Math.round(distance / 23) + 2);

  return [
    {
      mode: "walk",
      label: "A pied",
      icon: "walk",
      color: "#38c793",
      cost: 0,
      energyCost: distance > 230 ? 4 : 2,
      durationMs: Math.min(2400, Math.max(950, distance * 5)),
      durationLabel: `${walkMinutes} min`,
      available: true,
      reason: "gratuit"
    },
    {
      mode: "bus",
      label: "Bus",
      icon: "bus",
      color: "#60a5fa",
      cost: busCost,
      energyCost: 1,
      durationMs: Math.min(1900, Math.max(800, distance * 3.4)),
      durationLabel: `${busMinutes} min`,
      available: money >= busCost,
      reason: money >= busCost ? `-${busCost} cr` : `${busCost} cr requis`
    },
    {
      mode: "car",
      label: "Voiture",
      icon: "car-sport",
      color: "#f6b94f",
      cost: carCost,
      energyCost: 1,
      durationMs: Math.min(1500, Math.max(650, distance * 2.4)),
      durationLabel: `${carMinutes} min`,
      available: permit && money >= carCost,
      reason: !permit ? "permis requis" : money >= carCost ? `-${carCost} cr` : `${carCost} cr requis`
    }
  ];
}

function preferredTravelPlan(plans: TravelPlan[], distance: number, toSlug: string) {
  const car = plans.find((plan) => plan.mode === "car" && plan.available);
  const bus = plans.find((plan) => plan.mode === "bus" && plan.available);
  const walk = plans.find((plan) => plan.mode === "walk") ?? plans[0];

  if (toSlug === "gym") return car ?? bus ?? walk;
  if (car && distance > 230) return car;
  if (bus && distance > 160) return bus;
  return walk;
}

function RouteGuide({ fromSlug, toSlug, color = "#f6b94f" }: { fromSlug: string; toSlug: string; color?: string }) {
  if (fromSlug === toSlug) return null;
  const from = tileCenter(fromSlug);
  const to = tileCenter(toSlug);
  if (!from || !to) return null;

  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const horizontalWidth = Math.max(8, Math.abs(to.x - from.x));
  const verticalHeight = Math.max(8, Math.abs(to.y - from.y));
  const cornerX = to.x;
  const cornerY = from.y;

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      <View style={{ position: "absolute", left: x, top: from.y - 3, width: horizontalWidth, height: 6, borderRadius: 6, backgroundColor: "#07111f", opacity: 0.82 }} />
      <View style={{ position: "absolute", left: cornerX - 3, top: y, width: 6, height: verticalHeight, borderRadius: 6, backgroundColor: "#07111f", opacity: 0.82 }} />
      <View style={{ position: "absolute", left: x, top: from.y - 2, width: horizontalWidth, height: 4, borderRadius: 4, backgroundColor: color, opacity: 0.9 }} />
      <View style={{ position: "absolute", left: cornerX - 2, top: y, width: 4, height: verticalHeight, borderRadius: 4, backgroundColor: color, opacity: 0.9 }} />
      <View style={{ position: "absolute", left: from.x - 6, top: from.y - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent, borderWidth: 2, borderColor: "#07111f" }} />
      <View style={{ position: "absolute", left: cornerX - 8, top: cornerY - 8, width: 16, height: 16, borderRadius: 8, backgroundColor: "#07111f", borderWidth: 2, borderColor: color }} />
      <View style={{ position: "absolute", left: to.x - 8, top: to.y - 8, width: 16, height: 16, borderRadius: 8, backgroundColor: color, borderWidth: 2, borderColor: "#07111f" }} />
    </View>
  );
}

function LiveTravelMarker({ notice }: { notice: TravelNotice }) {
  const from = tileCenter(notice.from);
  const to = tileCenter(notice.to);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: notice.durationMs,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [notice.at, notice.durationMs, progress]);

  if (!from || !to) return null;

  const corner = { x: to.x, y: from.y };
  const left = progress.interpolate({ inputRange: [0, 0.58, 1], outputRange: [from.x - 14, corner.x - 14, to.x - 14] });
  const top = progress.interpolate({ inputRange: [0, 0.58, 1], outputRange: [from.y - 14, corner.y - 14, to.y - 14] });

  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute",
      left,
      top,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: notice.color,
      borderWidth: 2,
      borderColor: "#07111f",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: notice.color,
      shadowOpacity: 0.65,
      shadowRadius: 8,
      elevation: 8
    }}>
      <Ionicons name={notice.icon as never} size={15} color="#07111f" />
    </Animated.View>
  );
}

function TravelProgressBar({ notice, color = notice.color }: { notice: TravelNotice; color?: string }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: notice.durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [notice.at, notice.durationMs, progress]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={{ height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
      <Animated.View style={{ width, height: 5, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

function RoomEntryOverlay({ notice }: { notice: RoomEntryNotice }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: notice.durationMs,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [notice.at, notice.durationMs, progress]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View pointerEvents="none" style={{
      position: "absolute",
      left: 18,
      right: 18,
      top: IS_WIDE ? 170 : 154,
      borderRadius: 20,
      padding: 14,
      backgroundColor: "rgba(5,10,18,0.94)",
      borderWidth: 1,
      borderColor: "rgba(56,199,147,0.55)",
      shadowColor: "#38c793",
      shadowOpacity: 0.38,
      shadowRadius: 18,
      elevation: 16,
      gap: 10
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: "rgba(56,199,147,0.18)", borderWidth: 1, borderColor: "rgba(56,199,147,0.45)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="enter" size={23} color="#8ee0bd" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#8ee0bd", fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>ENTREE ROOM</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#ffffff", fontSize: 17, fontWeight: "900", marginTop: 2 }}>
            {notice.roomName}
          </Text>
          <Text numberOfLines={1} style={{ color: "rgba(226,232,240,0.74)", fontSize: 11, marginTop: 2 }}>
            Accès à {notice.locationName} · préparation du chat live
          </Text>
        </View>
        <Text style={{ color: "#f6b94f", fontSize: 12, fontWeight: "900" }}>10s</Text>
      </View>
      <View style={{ height: 7, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.10)" }}>
        <Animated.View style={{ width, height: 7, borderRadius: 999, backgroundColor: "#38c793" }} />
      </View>
      <Text style={{ color: "rgba(226,232,240,0.72)", fontSize: 11, fontWeight: "700" }}>
        Tu arrives dans la room, les membres et le chat vont s'ouvrir automatiquement.
      </Text>
    </View>
  );
}

function RoomEntryTargetPulse({ notice }: { notice: RoomEntryNotice }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const tile = LOCATION_TILES[notice.locationSlug];

  useEffect(() => {
    pulse.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.cubic), useNativeDriver: false })
      ])
    ).start();
  }, [notice.at, pulse]);

  if (!tile) return null;

  const box = scaleTile(tile);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 0.35] });

  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute",
      left: box.x - 10,
      top: box.y - 10,
      width: box.w + 20,
      height: box.h + 20,
      borderRadius: 22,
      borderWidth: 3,
      borderColor: "#38c793",
      backgroundColor: "rgba(56,199,147,0.10)",
      opacity,
      transform: [{ scale }],
      zIndex: 32
    }}>
      <View style={{
        position: "absolute",
        top: -30,
        alignSelf: "center",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: "#38c793",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.5)"
      }}>
        <Text style={{ color: "#07111f", fontSize: 10, fontWeight: "900" }}>ENTREE EN COURS</Text>
      </View>
    </Animated.View>
  );
}

function TransitStop({ x, y, icon, label, color }: { x: number; y: number; icon: string; label: string; color: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x * MAP_SX, top: y * MAP_SY, alignItems: "center", gap: 2 }}>
      <View style={{ width: 23, height: 23, borderRadius: 8, backgroundColor: "#07111f", borderWidth: 1, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon as never} size={13} color={color} />
      </View>
      <Text style={{ color, fontSize: 8, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 2 }}>{label}</Text>
    </View>
  );
}

function LocationDetail({ slug, w, h }: { slug: string; w: number; h: number }) {
  if (slug === "park") {
    return (
      <>
        <View style={{ position:"absolute", left:8, top:12, width:16, height:16, borderRadius:8, backgroundColor:"#2ca65a" }} />
        <View style={{ position:"absolute", right:8, bottom:14, width:18, height:18, borderRadius:9, backgroundColor:"#38c793" }} />
        <View style={{ position:"absolute", left:"38%", top:"34%", width:22, height:22, borderRadius:11, backgroundColor:"rgba(88,178,255,0.50)", borderWidth:1, borderColor:"rgba(255,255,255,0.35)" }} />
      </>
    );
  }

  if (slug.includes("residence")) {
    return (
      <>
        <View style={{ position:"absolute", left:10, top:14, width:w * 0.42, height:7, borderRadius:4, backgroundColor:"rgba(255,255,255,0.38)" }} />
        <View style={{ position:"absolute", right:10, top:12, width:18, height:18, borderRadius:9, backgroundColor: slug === "residence-luxe" ? "#fff0a8" : "rgba(255,255,255,0.22)", borderWidth:1, borderColor:"rgba(255,255,255,0.32)" }} />
        <View style={{ position:"absolute", left:w * 0.42, bottom:8, width:16, height:22, borderRadius:5, backgroundColor:"rgba(6,16,28,0.46)", borderWidth:1, borderColor:"rgba(255,255,255,0.18)" }} />
      </>
    );
  }

  if (slug === "market") {
    return (
      <>
        <View style={{ position:"absolute", left:9, right:9, top:18, height:9, borderRadius:5, backgroundColor:"#fff5c2" }} />
        <View style={{ position:"absolute", left:12, right:12, bottom:16, height:7, borderRadius:4, backgroundColor:"rgba(7,17,31,0.28)" }} />
      </>
    );
  }

  if (slug === "cafe") {
    return (
      <>
        <View style={{ position:"absolute", left:12, right:12, top:20, height:8, borderRadius:6, backgroundColor:"#ffe0a3" }} />
        <View style={{ position:"absolute", right:12, bottom:16, width:18, height:18, borderRadius:9, backgroundColor:"rgba(255,255,255,0.18)", borderWidth:2, borderColor:"#f6d38b" }} />
      </>
    );
  }

  if (slug === "office") {
    return (
      <>
        <View style={{ position:"absolute", left:10, right:10, top:16, height:1.5, backgroundColor:"rgba(255,255,255,0.45)" }} />
        <View style={{ position:"absolute", left:10, right:10, top:h * 0.48, height:1.5, backgroundColor:"rgba(255,255,255,0.35)" }} />
        <View style={{ position:"absolute", right:12, bottom:12, width:18, height:22, borderRadius:3, backgroundColor:"rgba(10,25,43,0.45)" }} />
      </>
    );
  }

  if (slug === "gym") {
    return (
      <>
        <View style={{ position:"absolute", left:12, right:12, top:18, height:10, borderRadius:6, backgroundColor:"rgba(255,255,255,0.22)" }} />
        <View style={{ position:"absolute", left:18, bottom:22, width:w - 36, height:14, borderRadius:7, backgroundColor:"rgba(7,17,31,0.30)" }} />
      </>
    );
  }

  if (slug === "restaurant") {
    return (
      <>
        <View style={{ position:"absolute", left:10, right:10, top:16, height:9, borderRadius:5, backgroundColor:"#f6b94f" }} />
        <View style={{ position:"absolute", left:14, bottom:16, width:18, height:18, borderRadius:9, backgroundColor:"rgba(255,255,255,0.20)" }} />
      </>
    );
  }

  if (slug === "cinema") {
    return (
      <>
        <View style={{ position:"absolute", left:9, right:9, top:18, height:10, borderRadius:3, backgroundColor:"rgba(255,255,255,0.82)" }} />
        <View style={{ position:"absolute", left:14, top:34, width:w - 28, height:4, borderRadius:2, backgroundColor:"#f6b94f" }} />
      </>
    );
  }

  return (
    <>
      <View style={{ position:"absolute", left:12, right:12, top:16, height:8, borderRadius:5, backgroundColor:"rgba(255,255,255,0.24)" }} />
      <View style={{ position:"absolute", right:12, bottom:12, width:16, height:22, borderRadius:4, backgroundColor:"rgba(7,17,31,0.36)" }} />
    </>
  );
}

function RoadLine({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <View
      style={{
        position: "absolute",
        left: x * MAP_SX,
        top: y * MAP_SY,
        width: w * MAP_SX,
        height: h * MAP_SY,
        borderRadius: Math.max(1, h * MAP_SY) / 2,
        backgroundColor: "rgba(255,255,255,0.78)"
      }}
    />
  );
}

function CityTree({ x, y, size = 12 }: { x: number; y: number; size?: number }) {
  const s = size * MAP_SX;
  return (
    <View style={{ position: "absolute", left: x * MAP_SX, top: y * MAP_SY, width: s, height: s, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: s * 0.9, height: s * 0.34, bottom: -1, borderRadius: s * 0.2, backgroundColor: "rgba(0,0,0,0.16)" }} />
      <View style={{ position: "absolute", width: s * 0.28, height: s * 0.58, bottom: 0, borderRadius: 2, backgroundColor: "#6b3f21" }} />
      <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: "#1d7c42", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }} />
      <View style={{ position: "absolute", top: s * 0.12, width: s * 0.58, height: s * 0.58, borderRadius: s * 0.29, backgroundColor: "#31a35d" }} />
    </View>
  );
}

function MovingCar({ y, color, dir = 1, delay = 0, speed = 9000 }: { y: number; color: string; dir?: 1 | -1; delay?: number; speed?: number }) {
  const carX = useRef(new Animated.Value(dir === 1 ? -44 : MAP_W + 44)).current;

  useEffect(() => {
    let active = true;
    function drive() {
      if (!active) return;
      carX.setValue(dir === 1 ? -44 : MAP_W + 44);
      Animated.timing(carX, {
        toValue: dir === 1 ? MAP_W + 44 : -44,
        duration: speed,
        easing: Easing.linear,
        useNativeDriver: false
      }).start(() => {
        if (active) setTimeout(drive, 900 + Math.random() * 2600);
      });
    }
    const t = setTimeout(drive, delay);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [dir, speed, delay]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: carX,
        top: y * MAP_SY,
        width: 28,
        height: 15,
        borderRadius: 5,
        backgroundColor: color,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.34)",
        shadowColor: color,
        shadowOpacity: 0.45,
        shadowRadius: 5,
        elevation: 5,
        transform: [{ scaleX: dir }]
      }}
    >
      <View style={{ position: "absolute", right: 4, top: 3, width: 9, height: 8, borderRadius: 2, backgroundColor: "rgba(214,240,255,0.72)" }} />
      <View style={{ position: "absolute", left: 2, top: 3, width: 3, height: 3, borderRadius: 2, backgroundColor: "#fff7b0" }} />
      <View style={{ position: "absolute", left: 2, bottom: 3, width: 3, height: 3, borderRadius: 2, backgroundColor: "#fff7b0" }} />
    </Animated.View>
  );
}

function Cloud({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const w = 42 * MAP_SX * scale;
  const h = 18 * MAP_SY * scale;
  return (
    <View style={{ position: "absolute", left: x * MAP_SX, top: y * MAP_SY, width: w, height: h, opacity: 0.18 }}>
      <View style={{ position: "absolute", left: 0, top: h * 0.34, width: w * 0.48, height: h * 0.58, borderRadius: h, backgroundColor: "#ffffff" }} />
      <View style={{ position: "absolute", left: w * 0.22, top: 0, width: w * 0.44, height: h, borderRadius: h, backgroundColor: "#ffffff" }} />
      <View style={{ position: "absolute", right: 0, top: h * 0.22, width: w * 0.48, height: h * 0.7, borderRadius: h, backgroundColor: "#ffffff" }} />
    </View>
  );
}

function Birds({ x, y }: { x: number; y: number }) {
  return (
    <View style={{ position: "absolute", left: x * MAP_SX, top: y * MAP_SY, flexDirection: "row", gap: 6, opacity: 0.48 }}>
      {[0, 1, 2].map((item) => (
        <Text key={item} style={{ color: "#d8edf8", fontSize: 11, fontWeight: "900" }}>⌁</Text>
      ))}
    </View>
  );
}

function CityLight({ x, y, color = "#f6b94f", delay = 0 }: { x: number; y: number; color?: string; delay?: number }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.45, duration: 900, useNativeDriver: true })
        ])
      );
      loop.start();
    }, delay);
    return () => {
      clearTimeout(timer);
      loop?.stop();
    };
  }, [delay, pulse]);

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x * MAP_SX, top: y * MAP_SY, width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: 18, height: 18, borderRadius: 9, backgroundColor: color, opacity: pulse, transform: [{ scale: 1.2 }] }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, borderWidth: 1, borderColor: "rgba(7,17,31,0.72)" }} />
    </View>
  );
}

function HarborBoat({ x, y, color = "#f8fafc", dir = 1, delay = 0, distance = 42, speed = 12500 }: { x: number; y: number; color?: string; dir?: 1 | -1; delay?: number; distance?: number; speed?: number }) {
  const move = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    function sail() {
      if (!active) return;
      move.setValue(0);
      Animated.timing(move, {
        toValue: 1,
        duration: speed,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false
      }).start(() => {
        if (active) setTimeout(sail, 1200);
      });
    }
    const timer = setTimeout(sail, delay);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [delay, move, speed]);

  const left = move.interpolate({
    inputRange: [0, 1],
    outputRange: [x * MAP_SX, (x + distance * dir) * MAP_SX]
  });

  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", left, top: y * MAP_SY, width: 28 * MAP_SX, height: 12 * MAP_SY, transform: [{ rotate: dir === 1 ? "4deg" : "-4deg" }] }}>
      <View style={{ position: "absolute", left: 2, right: 2, top: 4, height: 7 * MAP_SY, borderRadius: 8, backgroundColor: "#d7b16f", opacity: 0.85 }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: 1, height: 8 * MAP_SY, borderRadius: 8, backgroundColor: color, borderWidth: 1, borderColor: "rgba(7,17,31,0.25)" }} />
      <View style={{ position: "absolute", left: 10 * MAP_SX, top: -3, width: 8 * MAP_SX, height: 8 * MAP_SY, borderRadius: 3, backgroundColor: "#60a5fa" }} />
    </Animated.View>
  );
}

function CitySign({ x, y, label, color = "#67d8ff" }: { x: number; y: number; label: string; color?: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x * MAP_SX, top: y * MAP_SY, backgroundColor: "rgba(7,17,31,0.82)", borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: color + "66" }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color, fontSize: 8, fontWeight: "900" }}>{label}</Text>
    </View>
  );
}

function DecoBuilding({
  x, y, w, h, color, label, windows = true
}: {
  x: number; y: number; w: number; h: number; color: string; label?: string; windows?: boolean;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: x * MAP_SX,
        top: y * MAP_SY,
        width: w * MAP_SX,
        height: h * MAP_SY,
        borderRadius: 7,
        backgroundColor: color,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        shadowColor: "#000",
        shadowOpacity: 0.24,
        shadowRadius: 4,
        elevation: 2,
        overflow: "hidden"
      }}
    >
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: Math.max(5, w * MAP_SX * 0.16), backgroundColor: "rgba(255,255,255,0.10)" }} />
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: Math.max(5, w * MAP_SX * 0.18), backgroundColor: "rgba(0,0,0,0.16)" }} />
      <View style={{ position: "absolute", left: 4, right: 4, top: 4, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.20)" }} />
      {windows && [0, 1, 2].map((row) => (
        <View key={row} style={{ position: "absolute", left: 8, right: 8, top: 18 + row * 14, flexDirection: "row", justifyContent: "space-between" }}>
          {[0, 1, 2].map((col) => (
            <View key={col} style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: (row + col) % 2 ? "rgba(214,240,255,0.36)" : "rgba(255,226,135,0.62)" }} />
          ))}
        </View>
      ))}
      {label && (
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ position: "absolute", left: 4, right: 4, bottom: 5, color: "#fff", fontSize: 9, fontWeight: "900", textAlign: "center" }}>
          {label}
        </Text>
      )}
    </View>
  );
}

function UrbanBlock({ x, y, w, h, color = "#526b82", label }: { x: number; y: number; w: number; h: number; color?: string; label?: string }) {
  const rows = h > 42 ? 3 : 2;
  return (
    <View pointerEvents="none" style={{
      position: "absolute",
      left: x * MAP_SX,
      top: y * MAP_SY,
      width: w * MAP_SX,
      height: h * MAP_SY,
      borderRadius: 8,
      backgroundColor: "rgba(7,17,31,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      overflow: "hidden"
    }}>
      <View style={{ position: "absolute", left: 4, top: 4, width: w * MAP_SX * 0.42, bottom: 4, borderRadius: 6, backgroundColor: color }} />
      <View style={{ position: "absolute", right: 4, top: 8, width: w * MAP_SX * 0.36, bottom: 7, borderRadius: 6, backgroundColor: "#34495e" }} />
      <View style={{ position: "absolute", left: w * MAP_SX * 0.43, top: 11, width: w * MAP_SX * 0.15, height: h * MAP_SY * 0.34, borderRadius: 5, backgroundColor: "#d6b27c" }} />
      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={{ position: "absolute", left: 10, right: 10, top: 14 + row * 12, flexDirection: "row", justifyContent: "space-between" }}>
          {[0, 1, 2, 3].map((col) => (
            <View key={col} style={{ width: 4, height: 4, borderRadius: 1, backgroundColor: (row + col) % 2 ? "rgba(216,244,255,0.46)" : "rgba(255,235,157,0.72)" }} />
          ))}
        </View>
      ))}
      {label && (
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ position: "absolute", left: 6, right: 6, bottom: 4, color: "#f8fafc", fontSize: 8, fontWeight: "900", textAlign: "center", textShadowColor: "rgba(0,0,0,0.65)", textShadowRadius: 2 }}>
          {label}
        </Text>
      )}
    </View>
  );
}

function Crosswalk({ x, y, horizontal = true }: { x: number; y: number; horizontal?: boolean }) {
  return (
    <View style={{ position: "absolute", left: x * MAP_SX, top: y * MAP_SY, flexDirection: horizontal ? "row" : "column", gap: 2 }}>
      {[0, 1, 2, 3, 4].map((item) => (
        <View
          key={item}
          style={{
            width: (horizontal ? 4 : 22) * MAP_SX,
            height: (horizontal ? 22 : 4) * MAP_SY,
            backgroundColor: "rgba(255,255,255,0.75)"
          }}
        />
      ))}
    </View>
  );
}

function FerrisWheel({ x, y, size = 42 }: { x: number; y: number; size?: number }) {
  const s = size * MAP_SX;
  return (
    <View style={{ position: "absolute", left: x * MAP_SX, top: y * MAP_SY, width: s, height: s, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: s, height: s, borderRadius: s / 2, borderWidth: 4, borderColor: "#d94b3d", backgroundColor: "rgba(255,255,255,0.08)" }} />
      <View style={{ position: "absolute", width: 4, height: s, backgroundColor: "rgba(217,75,61,0.65)" }} />
      <View style={{ position: "absolute", width: s, height: 4, backgroundColor: "rgba(217,75,61,0.65)" }} />
      <View style={{ position: "absolute", width: s * 0.7, height: 3, backgroundColor: "rgba(217,75,61,0.65)", transform: [{ rotate: "45deg" }] }} />
      <View style={{ position: "absolute", width: s * 0.7, height: 3, backgroundColor: "rgba(217,75,61,0.65)", transform: [{ rotate: "-45deg" }] }} />
    </View>
  );
}

function Road({ x, y, w, h, horizontal = true }: { x: number; y: number; w: number; h: number; horizontal?: boolean }) {
  return (
    <View
      style={{
        position: "absolute",
        left: x * MAP_SX,
        top: y * MAP_SY,
        width: w * MAP_SX,
        height: h * MAP_SY,
        borderRadius: Math.max(2, Math.min(w * MAP_SX, h * MAP_SY) * 0.08),
        backgroundColor: "#202a33",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        shadowColor: "#000",
        shadowOpacity: 0.28,
        shadowRadius: 4,
        elevation: 1
      }}
    >
      <View
        style={{
          position: "absolute",
          left: horizontal ? 0 : "12%",
          right: horizontal ? 0 : undefined,
          top: horizontal ? "12%" : 0,
          bottom: horizontal ? undefined : 0,
          width: horizontal ? undefined : 1,
          height: horizontal ? 1 : undefined,
          backgroundColor: "rgba(255,255,255,0.13)"
        }}
      />
      <View
        style={{
          position: "absolute",
          left: horizontal ? 0 : "84%",
          right: horizontal ? 0 : undefined,
          top: horizontal ? "84%" : 0,
          bottom: horizontal ? undefined : 0,
          width: horizontal ? undefined : 1,
          height: horizontal ? 1 : undefined,
          backgroundColor: "rgba(255,255,255,0.13)"
        }}
      />
      <View
        style={{
          position: "absolute",
          left: horizontal ? 0 : "48%",
          right: horizontal ? 0 : undefined,
          top: horizontal ? "48%" : 0,
          bottom: horizontal ? undefined : 0,
          width: horizontal ? undefined : 2,
          height: horizontal ? 2 : undefined,
          backgroundColor: "rgba(247,203,91,0.72)"
        }}
      />
    </View>
  );
}

function DistrictZone({ zone }: { zone: (typeof DISTRICT_ZONES)[number] }) {
  const accent =
    zone.tone === "gold" ? "#f6b94f"
    : zone.tone === "purple" ? "#c4b5fd"
    : zone.tone === "warm" ? "#ff9f7a"
    : zone.tone === "blue" ? "#67d8ff"
    : "#8ee0bd";

  return (
    <View pointerEvents="none" style={{
      position: "absolute",
      left: zone.x * MAP_SX,
      top: zone.y * MAP_SY,
      width: zone.w * MAP_SX,
      height: zone.h * MAP_SY,
      borderRadius: 18,
      backgroundColor: zone.color,
      borderWidth: 2,
      borderColor: zone.border,
      overflow: "hidden"
    }}>
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: 18 * MAP_SY, backgroundColor: "rgba(255,255,255,0.16)" }} />
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 20 * MAP_SX, backgroundColor: "rgba(7,17,31,0.10)" }} />
      {[0.22, 0.48, 0.74].map((line) => (
        <View key={line} style={{ position: "absolute", left: 10, right: 10, top: zone.h * MAP_SY * line, height: 1, backgroundColor: "rgba(255,255,255,0.13)" }} />
      ))}
      <View style={{
        position: "absolute",
        left: 8,
        top: 8,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: "rgba(7,17,31,0.50)",
        borderWidth: 1,
        borderColor: accent + "66"
      }}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#ffffff", fontSize: 9, fontWeight: "900" }}>{zone.label}</Text>
        <Text numberOfLines={1} style={{ color: accent, fontSize: 7, fontWeight: "900", marginTop: 1 }}>{zone.sub}</Text>
      </View>
    </View>
  );
}

function MapLabel({ x, y, text, tone = "dark" }: { x: number; y: number; text: string; tone?: "dark" | "light" | "green" | "blue" }) {
  const bg = tone === "green" ? "rgba(16,78,46,0.88)" : tone === "blue" ? "rgba(13,88,116,0.88)" : tone === "light" ? "rgba(246,248,241,0.9)" : "rgba(8,15,25,0.86)";
  const fg = tone === "light" ? "#1b2733" : "#ffffff";
  return (
    <View style={{
      position: "absolute",
      left: x * MAP_SX,
      top: y * MAP_SY,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: bg,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.28)"
    }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: fg, fontSize: 9, fontWeight: "900" }}>{text}</Text>
    </View>
  );
}

function ParkingLot({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <View style={{ position: "absolute", left: x * MAP_SX, top: y * MAP_SY, width: w * MAP_SX, height: h * MAP_SY, backgroundColor: "#59616a", borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
      {[0.22, 0.44, 0.66].map((row) => (
        <View key={row} style={{ position: "absolute", left: 6, right: 6, top: h * MAP_SY * row, height: 1, backgroundColor: "rgba(255,255,255,0.58)" }} />
      ))}
      {[0.25, 0.50, 0.75].map((col) => (
        <View key={col} style={{ position: "absolute", top: 4, bottom: 4, left: w * MAP_SX * col, width: 1, backgroundColor: "rgba(255,255,255,0.45)" }} />
      ))}
    </View>
  );
}

function MapBadge({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(7,17,31,0.86)",
      borderRadius: 12,
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: color + "55"
    }}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <View>
        <Text style={{ color, fontSize: 10, fontWeight: "900" }}>{value}</Text>
        <Text style={{ color: "rgba(226,232,240,0.72)", fontSize: 8, fontWeight: "700" }}>{label}</Text>
      </View>
    </View>
  );
}

const cityIntelColor: Record<CityIntelUrgency, string> = {
  critical: "#ef4444",
  high: "#f6b94f",
  medium: "#60a5fa",
  low: "#38c793"
};

const districtNav = [
  { label: "Centre", slug: "cafe", color: colors.accent },
  ...RESIDENTIAL_DISTRICTS.map((district) => ({
    label: district.label,
    slug: district.locationSlug,
    color: district.color
  })),
  { label: "Parc", slug: "park", color: "#38c793" },
  { label: "Travail", slug: "office", color: "#60a5fa" }
];

const INTERIORS: Record<string, { title: string; tone: string; actions: string[] }> = {
  home: {
    title: "Intérieur maison",
    tone: "Repos, cuisine, dressing et reset des besoins.",
    actions: ["Dormir", "Cuisiner", "Changer de style"]
  },
  "residence-populaire": {
    title: "Quartier populaire",
    tone: "Loyers bas, beaucoup de passage, entraide et petites opportunites.",
    actions: ["Se reposer", "Cuisiner", "Parler voisins"]
  },
  "residence-confort": {
    title: "Residence confort",
    tone: "Logements stables pour progresser proprement sans exploser le budget.",
    actions: ["Routine", "Cuisiner", "Inviter"]
  },
  "residence-luxe": {
    title: "Residence riche",
    tone: "Zone premium : prestige, calme, reseau elite et image sociale forte.",
    actions: ["Recevoir", "Reseauter", "Style"]
  },
  market: {
    title: "Galerie commerciale",
    tone: "Courses, budget, nourriture et achats utiles.",
    actions: ["Acheter repas", "Comparer prix", "Voir offres"]
  },
  cafe: {
    title: "Café social",
    tone: "Rencontres, conversations et invitations légères.",
    actions: ["Lancer discussion", "Inviter quelqu'un", "Café solo"]
  },
  office: {
    title: "Bureau",
    tone: "Travail, crédibilité, argent et discipline.",
    actions: ["Démarrer shift", "Voir carrière", "Réseauter"]
  },
  park: {
    title: "Parc",
    tone: "Marche, détente, humeur et rencontres calmes.",
    actions: ["Marcher", "Respirer", "Rencontrer"]
  },
  gym: {
    title: "Salle de sport",
    tone: "Forme, énergie, discipline et image sociale.",
    actions: ["Séance rapide", "Programme", "Coach"]
  },
  restaurant: {
    title: "Restaurant",
    tone: "Dates, relation, humeur et réputation.",
    actions: ["Dîner", "Proposer date", "Sortie premium"]
  },
  cinema: {
    title: "Cinéma",
    tone: "Sorties, dates calmes, détente et culture.",
    actions: ["Voir film", "Inviter", "Soirée calme"]
  }
};

const LOCATION_ACTIONS: Record<string, { label: string; action: LifeActionId; icon: string }[]> = {
  home: [
    { label: "Dormir", action: "sleep", icon: "moon" },
    { label: "Cuisiner", action: "home-cooking", icon: "restaurant" },
    { label: "Douche", action: "shower", icon: "water" }
  ],
  "residence-populaire": [
    { label: "Repos", action: "rest-home", icon: "bed" },
    { label: "Cuisiner", action: "home-cooking", icon: "restaurant" },
    { label: "Douche", action: "shower", icon: "water" },
    { label: "Voisins", action: "cafe-chat", icon: "chatbubbles" }
  ],
  "residence-confort": [
    { label: "Repos", action: "rest-home", icon: "bed" },
    { label: "Cuisiner", action: "home-cooking", icon: "restaurant" },
    { label: "Douche", action: "shower", icon: "water" },
    { label: "Inviter", action: "cafe-chat", icon: "people" }
  ],
  "residence-luxe": [
    { label: "Recevoir", action: "go-out", icon: "sparkles" },
    { label: "Reseau", action: "cafe-chat", icon: "people" },
    { label: "Douche", action: "shower", icon: "water" },
    { label: "Reset", action: "rest-home", icon: "bed" }
  ],
  market: [
    { label: "Repas sain", action: "healthy-meal", icon: "nutrition" },
    { label: "Shopping", action: "shopping", icon: "bag" },
    { label: "Hydrater", action: "hydrate", icon: "water" }
  ],
  cafe: [
    { label: "Discuter", action: "cafe-chat", icon: "chatbubbles" },
    { label: "Lire", action: "read-book", icon: "book" },
    { label: "Sortir", action: "go-out", icon: "walk" }
  ],
  office: [
    { label: "Shift", action: "work-shift", icon: "briefcase" },
    { label: "Focus", action: "focus-task", icon: "laptop" },
    { label: "Réseauter", action: "cafe-chat", icon: "people" }
  ],
  park: [
    { label: "Marcher", action: "walk", icon: "walk" },
    { label: "Méditer", action: "meditate", icon: "leaf" },
    { label: "Sport co", action: "team-sport", icon: "football" }
  ],
  gym: [
    { label: "Gym", action: "gym", icon: "fitness" },
    { label: "Sport co", action: "team-sport", icon: "football" },
    { label: "Hydrater", action: "hydrate", icon: "water" }
  ],
  restaurant: [
    { label: "Restaurant", action: "restaurant-outing", icon: "restaurant" },
    { label: "Repas plaisir", action: "comfort-meal", icon: "fast-food" },
    { label: "Discuter", action: "cafe-chat", icon: "chatbubble" }
  ],
  cinema: [
    { label: "Cinéma", action: "cinema-date", icon: "film" },
    { label: "Sortir", action: "go-out", icon: "sparkles" },
    { label: "Discuter", action: "cafe-chat", icon: "chatbubbles" }
  ]
};

const FAKE_PLAYER_PERSONAS: Record<string, { displayName: string; style: string }> = {
  "test-live-ava": {
    displayName: "Ava Test",
    style: "accueillante"
  },
  "test-live-noa": {
    displayName: "Noa Test",
    style: "créatif"
  },
  "test-live-kim": {
    displayName: "Kim Test",
    style: "direct"
  }
};

function buildFakePlayerReply(player: WorldPresenceMember, body: string, playerName: string, locationName: string) {
  const clean = body.toLowerCase();
  const firstName = player.avatarName.split(" ")[0];
  const persona = FAKE_PLAYER_PERSONAS[player.userId]?.style ?? "social";

  if (clean.includes(WORLD_WIZZ_TOKEN.toLowerCase()) || /\bwizz\b/.test(clean)) {
    return `Wizz recu ${playerName}. Je suis bien present dans ${locationName}.`;
  }

  if (/\b(bonjour|salut|coucou|hello|yo|bjr)\b/.test(clean)) {
    return `Bonjour ${playerName}, je te reconnais. Moi c'est ${firstName}, je suis dans ${locationName}.`;
  }

  if (/(ça va|ca va|comment tu vas|tu vas bien)/.test(clean)) {
    return persona === "créatif"
      ? `Ça va bien ${playerName}. Je regarde l'ambiance de ${locationName}, il y a quelque chose à faire ici.`
      : `Oui ${playerName}, ça va. Je reste dispo ici si tu veux tester une interaction.`;
  }

  if (/(qui es|tu es qui|c'est qui|t'es qui)/.test(clean)) {
    return `Je suis ${firstName}, un joueur test simulé. Je peux répondre aux messages simples dans le lieu actuel.`;
  }

  if (/(aide|quoi faire|que faire|objectif)/.test(clean)) {
    return `Tu peux cliquer sur les lieux, tester le chat live, ou utiliser le panneau Test live. Là, on est à ${locationName}.`;
  }

  if (/(cinema|ciné|film|café|cafe|gym|restaurant|parc|marché|bureau|maison)/.test(clean)) {
    return `Bonne idée ${playerName}. Si tu changes de lieu, je peux te suivre avec le test live et répondre dans la nouvelle room.`;
  }

  if (/(merci|ok|d'accord|super|cool)/.test(clean)) {
    return `Avec plaisir ${playerName}. Je reste en ligne pour continuer le test.`;
  }

  return persona === "direct"
    ? `${playerName}, j'ai compris. Dis-moi si tu veux tester une invitation, un lieu ou un message live.`
    : `${playerName}, je note. Ici à ${locationName}, on peut discuter ou tester les interactions de la room.`;
}

// ─── NPC animé sur la carte ───────────────────────────────────────────────────
function cleanWorldChatBody(body: string) {
  return body.replace(WORLD_WIZZ_TOKEN, "").trim() || "Wizz !";
}

function LiveNpc({ npc, onPress }: { npc: NpcState; onPress: () => void }) {
  const visual    = getNpcVisual(npc.id);
  const pos       = pctToMap(npc.posX, npc.posY);
  const anim      = useRef(new Animated.ValueXY({ x: pos.x, y: pos.y })).current;
  const levelAnim = useRef(new Animated.Value(1)).current;
  const prev      = useRef({ x: pos.x, y: pos.y });
  const prevLevel = useRef(npc.level);

  useEffect(() => {
    if (Math.abs(prev.current.x - pos.x) > 1 || Math.abs(prev.current.y - pos.y) > 1) {
      Animated.timing(anim, {
        toValue: { x: pos.x, y: pos.y },
        duration: 900,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false
      }).start();
      prev.current = { x: pos.x, y: pos.y };
    }
  }, [pos.x, pos.y]);

  // Pulse badge niveau au level-up
  useEffect(() => {
    if (npc.level > prevLevel.current) {
      prevLevel.current = npc.level;
      Animated.sequence([
        Animated.spring(levelAnim, { toValue: 1.6, useNativeDriver: true, bounciness: 18 }),
        Animated.spring(levelAnim, { toValue: 1,   useNativeDriver: true }),
      ]).start();
    }
  }, [npc.level]);

  const ACTION_ICON: Record<string, string> = {
    sleeping: "😴", eating: "🍽️", chatting: "💬", exercising: "💪",
    walking: "🚶", working: "💼", idle: "💭"
  };
  const actionIcon = ACTION_ICON[npc.action] ?? "•";

  return (
    <Animated.View style={{ position: "absolute", left: anim.x, top: anim.y, alignItems: "center" }}>
      <Pressable onPress={onPress}>
        <AvatarSprite visual={visual} action={npc.action} size="xs" />
        {/* Badge niveau */}
        <Animated.View style={{
          position: "absolute", top: -4, right: -4,
          backgroundColor: npc.level >= 3 ? "#f6b94f" : "#38c793",
          borderRadius: 6, paddingHorizontal: 3, paddingVertical: 1,
          transform: [{ scale: levelAnim }],
          borderWidth: 1, borderColor: "rgba(0,0,0,0.4)"
        }}>
          <Text style={{ color: "#07111f", fontSize: 6, fontWeight: "900" }}>Nv{npc.level}</Text>
        </Animated.View>
        {/* Nom + action */}
        <View style={{ backgroundColor: "rgba(5,10,18,0.86)", borderRadius: 7, paddingHorizontal: 5, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
          <Text style={{ fontSize: 8 }}>{actionIcon}</Text>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{npc.name.split(" ")[0]}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Tuile de lieu ────────────────────────────────────────────────────────────
function LocationTile({
  slug, tile, label, metaLabel, metaColor, roomCode, isHere, isRecommended, isSelected, isEntering, npcCount, onlineCount, onPress
}: {
  slug: string;
  tile: (typeof LOCATION_TILES)[string];
  label: string;
  metaLabel: string;
  metaColor: string;
  roomCode?: string;
  isHere: boolean;
  isRecommended: boolean;
  isSelected: boolean;
  isEntering: boolean;
  npcCount: number;
  onlineCount: number;
  onPress: () => void;
}) {
  const glow = useRef(new Animated.Value(0.6)).current;
  const box = scaleTile(tile);
  const isHomeSuite = slug === "home";

  useEffect(() => {
    if (isHere || isRecommended || isEntering) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: isEntering ? 520 : 800, useNativeDriver: true }),
          Animated.timing(glow, { toValue: isEntering ? 0.64 : isHere ? 0.78 : 0.86, duration: isEntering ? 520 : 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      glow.setValue(1);
    }
  }, [isHere, isRecommended, isEntering]);

  const buildingHeight = Math.max(isHomeSuite ? 15 : 9, box.h * (isHomeSuite ? 0.18 : 0.12));

  return (
    <Pressable onPress={onPress} style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h + buildingHeight + 8, zIndex: isEntering ? 34 : isHere || isSelected || isHomeSuite ? 12 : 2 }}>
      <View style={{
        position: "absolute",
        left: 4,
        right: -5,
        bottom: 0,
        height: box.h,
        borderRadius: 14,
        backgroundColor: "rgba(37,48,56,0.42)",
        transform: [{ translateY: buildingHeight }]
      }} />
      <Animated.View style={{
        width: "100%", height: box.h,
        borderRadius: isHomeSuite ? 18 : 14,
        borderWidth: isEntering || isHomeSuite || isHere || isRecommended || isSelected ? 3 : 1.5,
        borderColor: isEntering ? "#38c793" : isHere ? colors.accent : isSelected ? "#67d8ff" : isHomeSuite ? "#d8f4ff" : isRecommended ? "#f6b94f" : "rgba(255,255,255,0.24)",
        opacity: glow,
        overflow: "hidden",
        shadowColor: tile.color,
        shadowOpacity: isEntering || isHomeSuite || isHere || isRecommended ? 0.95 : 0.5,
        shadowRadius: isEntering || isHomeSuite || isHere || isRecommended ? 18 : 7,
        elevation: isEntering || isHomeSuite || isHere || isRecommended ? 10 : 3,
      }}>
        <View style={{ position:"absolute", top:0, left:0, right:0, bottom:0, backgroundColor: tile.color }} />
        <View style={{ position:"absolute", top:0, left:0, right:0, height: Math.max(18, box.h * 0.24), backgroundColor:"rgba(255,255,255,0.22)" }} />
        <View style={{ position:"absolute", top:4, left:5, right:5, height:Math.max(8, box.h * 0.10), borderRadius:5, backgroundColor:"rgba(255,255,255,0.24)" }} />
        <View style={{ position:"absolute", right:0, top:0, bottom:0, width:Math.max(9, box.w * 0.12), backgroundColor:"rgba(0,0,0,0.20)" }} />
        <View style={{ position:"absolute", bottom:0, left:0, right:0, height:buildingHeight, backgroundColor:"rgba(0,0,0,0.28)" }} />
        {[0, 1, 2, 3].map((row) => (
          <View key={row} style={{ position:"absolute", left:12, right:Math.max(14, box.w * 0.16), top:24 + row * 13, flexDirection:"row", justifyContent:"space-between" }}>
            {[0, 1, 2].map((col) => (
              <View key={col} style={{ width:6, height:6, borderRadius:1.5, backgroundColor: (row + col) % 2 === 0 ? "rgba(255,235,157,0.84)" : "rgba(210,238,255,0.48)" }} />
            ))}
          </View>
        ))}
        <LocationDetail slug={slug} w={box.w} h={box.h} />

        {isHomeSuite && (
          <View style={{ position: "absolute", left: 8, top: 8, right: 8, height: 22, borderRadius: 10, backgroundColor: "rgba(216,244,255,0.24)", borderWidth: 1, borderColor: "rgba(255,255,255,0.36)" }} />
        )}
        <View style={{ flex:1, padding: isHomeSuite ? 10 : 8, justifyContent:"space-between" }}>
          <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
            <View style={{ backgroundColor: isHomeSuite ? "rgba(216,244,255,0.24)" : "rgba(0,0,0,0.46)", borderRadius:12, padding:isHomeSuite ? 7 : 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.32)" }}>
              <Ionicons name={tile.icon as never} size={isHomeSuite ? 23 : 19} color="#fff" />
            </View>
            {(isHomeSuite || isRecommended || isSelected || roomCode || isEntering) && (
              <View style={{ backgroundColor: isEntering ? "#38c793" : isSelected ? "#67d8ff" : "#f6b94f", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
                <Text style={{ color:"#07111f", fontSize: 9, fontWeight: "900" }}>{isEntering ? "LIVE" : isSelected ? "ENTRER" : isHomeSuite ? "HOME" : roomCode ? `#${roomCode}` : "GO"}</Text>
              </View>
            )}
            {(npcCount > 0 || onlineCount > 0) && (
              <View style={{ backgroundColor: onlineCount>0 ? "#38c793" : "rgba(255,255,255,0.28)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
                <Text style={{ color: onlineCount>0?"#07111f":"#fff", fontSize: 10, fontWeight: "900" }}>
                  {onlineCount > 0 ? `${onlineCount}🟢` : `${npcCount}`}
                </Text>
              </View>
            )}
          </View>
          <View style={{ backgroundColor: isHomeSuite ? "rgba(5,10,18,0.94)" : "rgba(5,10,18,0.88)", borderRadius: 11, paddingHorizontal: 9, paddingVertical: isHomeSuite ? 7 : 5, borderWidth: 1, borderColor: isHere ? colors.accent : isSelected ? "#67d8ff" : isHomeSuite ? "rgba(216,244,255,0.55)" : isRecommended ? "#f6b94f" : "rgba(255,255,255,0.24)" }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color:"#fff", fontSize:isHomeSuite ? 17 : 14, fontWeight:"900", textShadowColor:"rgba(0,0,0,0.75)", textShadowOffset:{width:0,height:1}, textShadowRadius:2 }}>
              {label}
            </Text>
            <Text numberOfLines={1} style={{ color: isHomeSuite ? "#d8f4ff" : metaColor, fontSize: isHomeSuite ? 10 : 9, fontWeight: "900", marginTop: 1 }}>
              {metaLabel}
            </Text>
            {isHere && (
              <Text style={{ color:"#8ee0bd", fontSize:isHomeSuite ? 11 : 9, fontWeight:"900" }}>ICI · ROOM #{roomCode ?? "LIVE"}</Text>
            )}
            {!isHere && isRecommended && (
              <Text style={{ color:"#ffe4a3", fontSize:9, fontWeight:"900" }}>Action conseillee</Text>
            )}
            {!isHere && isSelected && (
              <Text style={{ color:"#bfeeff", fontSize:9, fontWeight:"900" }}>Selection</Text>
            )}
            {isEntering && (
              <Text style={{ color:"#8ee0bd", fontSize:9, fontWeight:"900" }}>Connexion room...</Text>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Écran monde ──────────────────────────────────────────────────────────────
export default function WorldScreen() {
  const session             = useGameStore((s) => s.session);
  const avatar              = useGameStore((s) => s.avatar);
  const stats               = useGameStore((s) => s.stats);
  const currentLocationSlug = useGameStore((s) => s.currentLocationSlug);
  const travelTo            = useGameStore((s) => s.travelTo);
  const joinRoom            = useGameStore((s) => s.joinRoom);
  const npcs                = useGameStore((s) => s.npcs);
  const tickNpcs            = useGameStore((s) => s.tickNpcs);
  const conversations       = useGameStore((s) => s.conversations);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);
  const sendMessageStore    = useGameStore((s) => s.sendMessage);
  const performAction       = useGameStore((s) => s.performAction);
  const dailyGoals          = useGameStore((s) => s.dailyGoals);
  const relationships       = useGameStore((s) => s.relationships);
  const housingTier         = useGameStore((s) => s.housingTier);
  const playerLevel         = useGameStore((s) => s.playerLevel);

  const { members: realLivePlayers } = useWorldPresence();
  const [simulatedPlayers, setSimulatedPlayers] = useState<WorldPresenceMember[]>([]);
  const livePlayers = [...realLivePlayers, ...simulatedPlayers];
  const locationChat = useLocationChat(currentLocationSlug, livePlayers);
  const [selectedNpc, setSelectedNpc] = useState<NpcState | null>(null);
  const [activeRoomNpcId, setActiveRoomNpcId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [travelNotice, setTravelNotice] = useState<TravelNotice | null>(null);
  const [arrivalNotice, setArrivalNotice] = useState<ArrivalNotice | null>(null);
  const [roomEntryNotice, setRoomEntryNotice] = useState<RoomEntryNotice | null>(null);
  const [selectedLocationSlug, setSelectedLocationSlug] = useState(currentLocationSlug);
  const travelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomEntryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playerVisual = avatar ? getAvatarVisual(avatar) : null;
  const playerAction: AvatarAction =
    stats.energy < 20 ? "sleeping"
    : stats.hunger  < 25 ? "eating"
    : stats.sociability < 30 ? "walking"
    : "idle";

  // NPC tick toutes les 30 secondes
  useFocusEffect(
    useCallback(() => {
      tickNpcs();
      const id = setInterval(() => tickNpcs(), 30_000);
      return () => clearInterval(id);
    }, [])
  );

  const npcsByLoc = npcs.reduce<Record<string, NpcState[]>>((acc, n) => {
    if (!acc[n.locationSlug]) acc[n.locationSlug] = [];
    acc[n.locationSlug].push(n);
    return acc;
  }, {});

  const onlineCounts = livePlayers.reduce<Record<string, number>>((acc, p) => {
    acc[p.locationSlug] = (acc[p.locationSlug] ?? 0) + 1;
    return acc;
  }, {});

  const currentRoomNpcs = npcsByLoc[currentLocationSlug] ?? [];
  const currentLivePlayers = livePlayers.filter((player) => player.locationSlug === currentLocationSlug);
  const hasLiveLocationChat = currentLivePlayers.length > 0 || locationChat.messages.length > 0;
  const activeRoomNpc = currentRoomNpcs.find((npc) => npc.id === activeRoomNpcId) ?? currentRoomNpcs[0] ?? null;
  const activeConversation = activeRoomNpc
    ? conversations.find((conversation) => conversation.kind === "direct" && conversation.peerId === activeRoomNpc.id) ?? null
    : null;
  const visibleRoomMessages = hasLiveLocationChat ? locationChat.messages : activeConversation?.messages ?? [];
  const cityIntel = buildCityIntel({ stats, currentLocationSlug, npcs, livePlayers, relationships, housingTier });
  const cityIntelTone = cityIntelColor[cityIntel.urgency];
  const cityIntelDistance = routeDistance(currentLocationSlug, cityIntel.locationSlug);
  const cityIntelTravelPlans = buildTravelPlans(currentLocationSlug, cityIntel.locationSlug, stats.money, playerLevel, stats.reputation, housingTier);
  const recommendedTravel = preferredTravelPlan(cityIntelTravelPlans, cityIntelDistance, cityIntel.locationSlug);
  const hasPermit = hasDrivingPermit(playerLevel, stats.reputation, housingTier);
  const currentLocationName = worldLocations.find((l) => l.slug === currentLocationSlug)?.name ?? "Ville";
  const recommendedLocationName = worldLocations.find((l) => l.slug === cityIntel.locationSlug)?.name ?? cityIntel.locationSlug;
  const selectedLocation = worldLocations.find((l) => l.slug === selectedLocationSlug) ?? worldLocations.find((l) => l.slug === currentLocationSlug);
  const selectedLocationName = selectedLocation?.name ?? selectedLocationSlug;
  const selectedDistance = routeDistance(currentLocationSlug, selectedLocationSlug);
  const selectedTravelPlans = buildTravelPlans(currentLocationSlug, selectedLocationSlug, stats.money, playerLevel, stats.reputation, housingTier);
  const selectedRecommendedTravel = preferredTravelPlan(selectedTravelPlans, selectedDistance, selectedLocationSlug);
  const selectedNpcCount = npcsByLoc[selectedLocationSlug]?.length ?? 0;
  const selectedOnlineCount = onlineCounts[selectedLocationSlug] ?? 0;
  const selectedDistrict = getResidentialDistrictForLocation(selectedLocationSlug);
  const currentRoomCode = LOCATION_ROOM_CODES[currentLocationSlug] ?? "LOUNGE";
  const selectedRoomCode = LOCATION_ROOM_CODES[selectedLocationSlug] ?? "LOUNGE";
  const routeTargetSlug = roomEntryNotice?.locationSlug ?? travelNotice?.to ?? (selectedLocationSlug !== currentLocationSlug ? selectedLocationSlug : cityIntel.locationSlug);
  const routeColor = roomEntryNotice ? "#38c793" : travelNotice?.color ?? (selectedLocationSlug !== currentLocationSlug ? selectedRecommendedTravel?.color ?? "#67d8ff" : cityIntelTone);
  const quickRoomMessages = WORLD_CHAT_SHORTCUTS.map((item) => {
    if (item.startsWith("Bonjour")) return `Bonjour, c'est ${avatar?.displayName ?? "moi"}. Je suis a ${currentLocationName}.`;
    return item;
  });
  const currentLocationActions = LOCATION_ACTIONS[currentLocationSlug] ?? LOCATION_ACTIONS.cafe;
  const primaryLocationAction = currentLocationActions[0];
  const peopleHereCount = currentRoomNpcs.length + currentLivePlayers.length;
  const currentRoomParticipantNames = [
    ...currentLivePlayers.map((player) => player.avatarName.split(" ")[0]),
    ...currentRoomNpcs.map((npc) => npc.name.split(" ")[0])
  ].slice(0, 4);
  const currentRoomStatus = peopleHereCount > 0
    ? `${peopleHereCount} present${peopleHereCount > 1 ? "s" : ""}`
    : "room calme";
  const quickFlowSteps = [
    { label: "Choisir", active: selectedLocationSlug !== currentLocationSlug && !travelNotice, done: !!travelNotice || selectedLocationSlug === currentLocationSlug },
    { label: "Trajet", active: !!travelNotice, done: !!arrivalNotice && !travelNotice },
    { label: "Arriver", active: !!arrivalNotice && !travelNotice, done: selectedLocationSlug === currentLocationSlug && !travelNotice },
    { label: "Agir", active: !travelNotice && selectedLocationSlug === currentLocationSlug, done: false }
  ];

  useEffect(() => {
    return () => {
      if (travelTimerRef.current) clearTimeout(travelTimerRef.current);
      if (arrivalTimerRef.current) clearTimeout(arrivalTimerRef.current);
      if (roomEntryTimerRef.current) clearTimeout(roomEntryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setSelectedLocationSlug(currentLocationSlug);
  }, [currentLocationSlug]);

  useEffect(() => {
    if (currentRoomNpcs.length === 0) {
      setActiveRoomNpcId(null);
      return;
    }

    if (!activeRoomNpcId || !currentRoomNpcs.some((npc) => npc.id === activeRoomNpcId)) {
      setActiveRoomNpcId(currentRoomNpcs[0].id);
    }
  }, [currentLocationSlug, npcs, activeRoomNpcId]);

  useEffect(() => {
    if (!activeRoomNpc) return;
    startDirectConversation(activeRoomNpc.id, activeRoomNpc.name);
  }, [activeRoomNpc?.id]);

  const enterLocation = useCallback((slug: string, preferredMode?: TravelModeId) => {
    if (slug === currentLocationSlug) {
      const residents = npcsByLoc[slug] ?? [];
      setActiveRoomNpcId(residents[0]?.id ?? null);
      setSelectedNpc(null);
      setChatDraft("");
      return;
    }

    const distance = routeDistance(currentLocationSlug, slug);
    const plans = buildTravelPlans(currentLocationSlug, slug, stats.money, playerLevel, stats.reputation, housingTier);
    const requestedPlan = preferredMode ? plans.find((plan) => plan.mode === preferredMode && plan.available) : null;
    const plan = requestedPlan ?? preferredTravelPlan(plans, distance, slug);
    if (!plan) return;

    if (travelTimerRef.current) clearTimeout(travelTimerRef.current);
    if (arrivalTimerRef.current) clearTimeout(arrivalTimerRef.current);
    const notice: TravelNotice = {
      from: currentLocationSlug,
      to: slug,
      at: Date.now(),
      mode: plan.mode,
      modeLabel: plan.label,
      icon: plan.icon,
      color: plan.color,
      cost: plan.cost,
      durationLabel: plan.durationLabel,
      durationMs: plan.durationMs
    };

    setTravelNotice(notice);
    setArrivalNotice(null);
    setSelectedNpc(null);
    setChatDraft("");

    travelTimerRef.current = setTimeout(() => {
      travelTo(slug, { cost: plan.cost, modeLabel: plan.label, energyCost: plan.energyCost });
      const residents = npcsByLoc[slug] ?? [];
      const location = worldLocations.find((item) => item.slug === slug);
      setActiveRoomNpcId(residents[0]?.id ?? null);
      setArrivalNotice({ locationSlug: slug, locationName: location?.name ?? slug, at: Date.now() });
      setTravelNotice((current) => (current?.at === notice.at ? null : current));
      travelTimerRef.current = null;
      arrivalTimerRef.current = setTimeout(() => {
        setArrivalNotice((current) => (current?.locationSlug === slug ? null : current));
        arrivalTimerRef.current = null;
      }, 6500);
    }, plan.durationMs);
  }, [currentLocationSlug, housingTier, npcsByLoc, playerLevel, stats.money, stats.reputation, travelTo]);

  const beginRoomEntry = useCallback((slug: string) => {
    const code = LOCATION_ROOM_CODES[slug] ?? "LOUNGE";
    const location = worldLocations.find((item) => item.slug === slug);
    const roomName = slug === "home" ? "Home Suite" : location?.name ?? "Room";

    if (roomEntryTimerRef.current) clearTimeout(roomEntryTimerRef.current);
    if (travelTimerRef.current) clearTimeout(travelTimerRef.current);
    if (arrivalTimerRef.current) clearTimeout(arrivalTimerRef.current);

    setSelectedLocationSlug(slug);
    setSelectedNpc(null);
    setChatDraft("");
    setArrivalNotice(null);
    setTravelNotice(null);
    setRoomEntryNotice({
      code,
      locationSlug: slug,
      locationName: location?.name ?? slug,
      roomName,
      at: Date.now(),
      durationMs: ROOM_ENTRY_DURATION_MS
    });

    roomEntryTimerRef.current = setTimeout(() => {
      if (slug !== currentLocationSlug) {
        travelTo(slug, { cost: 0, modeLabel: "Entrée room", energyCost: 1 });
      }
      const room = joinRoom(code);
      setRoomEntryNotice(null);
      roomEntryTimerRef.current = null;
      if (room) {
        router.push(`/(app)/room/${room.id}`);
      }
    }, ROOM_ENTRY_DURATION_MS);
  }, [currentLocationSlug, joinRoom, travelTo]);

  const postLocationMessage = useCallback((body: string) => {
    const cleanDraft = body.trim();
    if (!cleanDraft) return;
    if (hasLiveLocationChat) {
      void locationChat.sendMessage(cleanDraft);
      const simulatedHere = simulatedPlayers.filter((player) => player.locationSlug === currentLocationSlug);
      if (simulatedHere.length > 0) {
        const locationName = worldLocations.find((location) => location.slug === currentLocationSlug)?.name ?? "ce lieu";
        const playerName = avatar?.displayName ?? session?.email?.split("@")[0] ?? "toi";
        simulatedHere.slice(0, 2).forEach((player, index) => {
          setTimeout(() => {
            locationChat.addLocalMessage({
              id: `fake-${player.userId}-${Date.now()}-${index}`,
              authorId: player.userId,
              authorName: player.avatarName,
              body: buildFakePlayerReply(player, cleanDraft, playerName, locationName),
              createdAt: new Date().toISOString(),
              kind: "message"
            });
          }, 650 + index * 850);
        });
      }
      return;
    }
    if (!activeConversation) return;
    sendMessageStore(activeConversation.id, cleanDraft);
  }, [activeConversation?.id, avatar?.displayName, currentLocationSlug, hasLiveLocationChat, locationChat.addLocalMessage, locationChat.sendMessage, sendMessageStore, session?.email, simulatedPlayers]);

  const sendRoomMessage = useCallback(() => {
    postLocationMessage(chatDraft);
    setChatDraft("");
  }, [chatDraft, postLocationMessage]);

  const sendRoomWizz = useCallback(() => {
    postLocationMessage(`${WORLD_WIZZ_TOKEN} Wizz ! Tu es la ?`);
  }, [postLocationMessage]);

  const seedLiveTestPlayers = useCallback(() => {
    const now = new Date().toISOString();
    setSimulatedPlayers([
      {
        userId: "test-live-ava",
        avatarName: "Ava Test",
        locationSlug: currentLocationSlug,
        action: "chatting",
        mood: 82,
        onlineAt: now,
        posX: 50,
        posY: 50
      },
      {
        userId: "test-live-noa",
        avatarName: "Noa Test",
        locationSlug: currentLocationSlug,
        action: "idle",
        mood: 74,
        onlineAt: now,
        posX: 56,
        posY: 54
      }
    ]);
  }, [currentLocationSlug]);

  const pushTestNpcIntoRoom = useCallback(() => {
    const firstNpc = currentRoomNpcs[0] ?? npcs[0] ?? null;
    if (!firstNpc) return;
    setActiveRoomNpcId(firstNpc.id);
    setSelectedNpc(firstNpc);
  }, [currentRoomNpcs, npcs]);

  const handleLocationAction = useCallback((action: LifeActionId) => {
    performAction(action);
    if (action === "cafe-chat" && activeRoomNpc) {
      startDirectConversation(activeRoomNpc.id, activeRoomNpc.name);
    }
  }, [activeRoomNpc, performAction, startDirectConversation]);

  const executeCityIntel = useCallback(() => {
    if (cityIntel.locationSlug !== currentLocationSlug) {
      enterLocation(cityIntel.locationSlug);
      return;
    }
    handleLocationAction(cityIntel.action);
  }, [cityIntel.action, cityIntel.locationSlug, currentLocationSlug, enterLocation, handleLocationAction]);

  const speakHereNow = useCallback(() => {
    if (activeRoomNpc) {
      setSelectedNpc(activeRoomNpc);
      postLocationMessage(`Bonjour ${activeRoomNpc.name.split(" ")[0]}, c'est ${avatar?.displayName ?? "moi"}. Tu es dispo ?`);
      return;
    }
    if (currentLivePlayers.length > 0) {
      postLocationMessage(`Bonjour, c'est ${avatar?.displayName ?? "moi"}. Qui est dispo ici ?`);
      return;
    }
    seedLiveTestPlayers();
  }, [activeRoomNpc, avatar?.displayName, currentLivePlayers.length, postLocationMessage, seedLiveTestPlayers]);

  const worldStatusStrip = (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {[
        { icon: "location", label: "Lieu", value: currentLocationName, color: colors.accent },
        { icon: "sparkles", label: "Action utile", value: recommendedLocationName, color: cityIntelTone },
        { icon: recommendedTravel?.icon ?? "walk", label: "Transport", value: `${recommendedTravel?.label ?? "A pied"} · ${recommendedTravel?.durationLabel ?? "0 min"}`, color: recommendedTravel?.color ?? "#38c793" },
        { icon: "chatbubbles", label: "Room", value: `${currentRoomNpcs.length + currentLivePlayers.length} ici`, color: currentRoomNpcs.length + currentLivePlayers.length > 0 ? "#38c793" : colors.muted }
      ].map((item) => (
        <Pressable
          key={item.label}
          onPress={() => {
            if (item.label === "Action utile") executeCityIntel();
            if (item.label === "Room") router.push("/(app)/(tabs)/chat");
          }}
          style={{
            flexGrow: 1,
            minWidth: IS_WIDE ? 170 : "47%",
            flexBasis: IS_WIDE ? 0 : "47%",
            backgroundColor: item.color + "12",
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: item.color + "36",
            flexDirection: "row",
            alignItems: "center",
            gap: 9
          }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: item.color + "20", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={item.icon as never} size={15} color={item.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: item.color, fontSize: 10, fontWeight: "900" }}>{item.label}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 12, fontWeight: "900", marginTop: 1 }}>{item.value}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );

  const cityIntelPanel = (
    <View style={{
      backgroundColor: cityIntelTone + "12",
      borderWidth: 1.5,
      borderColor: cityIntelTone + "45",
      borderRadius: 16,
      padding: 12,
      gap: 10
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: cityIntelTone, fontSize: 12, fontWeight: "900" }}>CITY INTEL</Text>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 2 }}>{cityIntel.title}</Text>
        </View>
        <View style={{ backgroundColor: cityIntelTone + "20", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: cityIntelTone + "40" }}>
          <Text style={{ color: cityIntelTone, fontSize: 10, fontWeight: "900" }}>{cityIntel.urgency.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={{ color: colors.textSoft, fontSize: 12, lineHeight: 17 }}>{cityIntel.body}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          <Text style={{ color: colors.textSoft, fontSize: 10, fontWeight: "800" }}>{cityIntel.reason}</Text>
        </View>
        {cityIntel.targetName && (
          <View style={{ backgroundColor: "rgba(56,199,147,0.12)", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(56,199,147,0.28)" }}>
            <Text style={{ color: "#8ee0bd", fontSize: 10, fontWeight: "900" }}>{cityIntel.targetName}</Text>
          </View>
        )}
        <Pressable onPress={executeCityIntel} style={{ marginLeft: "auto", backgroundColor: cityIntelTone, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: "#07111f", fontSize: 11, fontWeight: "900" }}>
            {cityIntel.locationSlug === currentLocationSlug ? cityIntel.actionLabel : "Y aller"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const transportPanel = (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.09)",
      borderRadius: 16,
      padding: 12,
      gap: 10
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>Trajet live</Text>
          <Text numberOfLines={1} style={{ color: colors.textSoft, fontSize: 11, marginTop: 2 }}>
            Vers {worldLocations.find((l) => l.slug === cityIntel.locationSlug)?.name ?? cityIntel.locationSlug}
          </Text>
        </View>
        <View style={{ backgroundColor: hasPermit ? "#38c79318" : "#f6b94f18", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: hasPermit ? "#38c79344" : "#f6b94f44" }}>
          <Text style={{ color: hasPermit ? "#38c793" : "#f6b94f", fontSize: 10, fontWeight: "900" }}>
            {hasPermit ? "Permis OK" : "Sans permis"}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {cityIntelTravelPlans.map((plan) => {
          const active = recommendedTravel?.mode === plan.mode;
          return (
            <Pressable
              key={plan.mode}
              onPress={() => plan.available && enterLocation(cityIntel.locationSlug, plan.mode)}
              disabled={!plan.available || cityIntel.locationSlug === currentLocationSlug}
              style={{
                flex: 1,
                minHeight: 76,
                borderRadius: 14,
                padding: 9,
                backgroundColor: active ? plan.color + "18" : "rgba(255,255,255,0.045)",
                borderWidth: 1,
                borderColor: active ? plan.color + "65" : "rgba(255,255,255,0.08)",
                opacity: plan.available ? 1 : 0.48,
                gap: 6
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Ionicons name={plan.icon as never} size={18} color={plan.available ? plan.color : colors.muted} />
                {active && <Text style={{ color: plan.color, fontSize: 9, fontWeight: "900" }}>AUTO</Text>}
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: plan.available ? colors.text : colors.muted, fontSize: 12, fontWeight: "900" }}>{plan.label}</Text>
              <Text numberOfLines={1} style={{ color: plan.available ? plan.color : colors.muted, fontSize: 10, fontWeight: "800" }}>
                {plan.durationLabel} · {plan.reason}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {travelNotice && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: travelNotice.color + "12", borderRadius: 12, padding: 9, borderWidth: 1, borderColor: travelNotice.color + "38" }}>
          <Ionicons name={travelNotice.icon as never} size={16} color={travelNotice.color} />
          <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 11, fontWeight: "800" }}>
            En route : {travelNotice.modeLabel} · {travelNotice.durationLabel}
          </Text>
          <Text style={{ color: travelNotice.color, fontSize: 10, fontWeight: "900" }}>
            {travelNotice.cost > 0 ? `-${travelNotice.cost} cr` : "gratuit"}
          </Text>
        </View>
      )}
    </View>
  );

  const districtNavPanel = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
      {districtNav.map((item) => {
        const active = currentLocationSlug === item.slug;
        return (
          <Pressable
            key={item.slug}
            onPress={() => enterLocation(item.slug)}
            style={{
              minWidth: 88,
              paddingHorizontal: 11,
              paddingVertical: 9,
              borderRadius: 14,
              backgroundColor: item.color + (active ? "24" : "12"),
              borderWidth: active ? 2 : 1,
              borderColor: item.color + (active ? "77" : "35"),
              alignItems: "center"
            }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: item.color, fontSize: 11, fontWeight: "900" }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const travelMenu = (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.055)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: 12,
      gap: 10
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>Se déplacer</Text>
        <Ionicons name="navigate" size={18} color={colors.accent} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[...worldLocations]
          .sort((a, b) => {
            const score = (loc: typeof worldLocations[number]) =>
              (loc.slug === currentLocationSlug ? 90 : 0) +
              (loc.slug === cityIntel.locationSlug ? 80 : 0) +
              ((onlineCounts[loc.slug] ?? 0) * 18) +
              ((npcsByLoc[loc.slug]?.length ?? 0) * 8);
            return score(b) - score(a);
          })
          .slice(0, IS_WIDE ? 6 : worldLocations.length)
          .map((loc) => {
          const isHere = loc.slug === currentLocationSlug;
          const npcHere = npcsByLoc[loc.slug]?.length ?? 0;
          const onlineHere = onlineCounts[loc.slug] ?? 0;
          const tile = LOCATION_TILES[loc.slug];
          const isRecommended = cityIntel.locationSlug === loc.slug;
          const residential = getResidentialDistrictForLocation(loc.slug);
          return (
            <Pressable
              key={loc.slug}
              onPress={() => !isHere && enterLocation(loc.slug)}
              style={{
                width: IS_WIDE ? "48%" : "47%",
                minHeight: 64,
                padding: 10,
                borderRadius: 12,
                backgroundColor: isHere ? "rgba(139,124,255,0.16)" : isRecommended ? "rgba(246,185,79,0.13)" : "rgba(255,255,255,0.045)",
                borderWidth: 1,
                borderColor: isHere ? colors.accent : isRecommended ? "rgba(246,185,79,0.38)" : "rgba(255,255,255,0.08)",
                gap: 5
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Ionicons name={(tile?.icon ?? "location") as never} size={14} color={isHere ? colors.accent : colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "700" }}>
                  {onlineHere > 0 ? `${onlineHere} live` : npcHere > 0 ? `${npcHere} ici` : ""}
                </Text>
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: isHere ? colors.accent : colors.text, fontWeight: "800", fontSize: 12 }}>{loc.name}</Text>
              <Text numberOfLines={1} style={{ color: residential?.color ?? colors.muted, fontSize: 9, fontWeight: residential ? "900" : "700" }}>
                {residential ? residential.label : loc.costHint}
              </Text>
              {isHere && <Text style={{ color: colors.accent, fontSize: 9, fontWeight: "700" }}>Tu es ici</Text>}
              {!isHere && isRecommended && <Text style={{ color: "#f6b94f", fontSize: 9, fontWeight: "900" }}>Conseille</Text>}
            </Pressable>
          );
        })}
      </View>
      {IS_WIDE && (
        <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 14 }}>
          Les lieux affiches sont tries par urgence, presence et utilite. La carte reste le raccourci complet.
        </Text>
      )}
    </View>
  );

  const selectedLocationPanel = selectedLocation ? (
    <View style={{
      position: "absolute",
      right: 12,
      bottom: travelNotice ? 162 : 12,
      width: Math.min(270, MAP_W - 24),
      backgroundColor: "rgba(7,17,31,0.93)",
      borderRadius: 16,
      padding: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: selectedLocationSlug === currentLocationSlug ? colors.accent + "66" : "#67d8ff66"
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: (selectedDistrict?.color ?? "#67d8ff") + "22", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: (selectedDistrict?.color ?? "#67d8ff") + "55" }}>
          <Ionicons name={(LOCATION_TILES[selectedLocationSlug]?.icon ?? "location") as never} size={17} color={selectedDistrict?.color ?? "#67d8ff"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>{selectedLocationName}</Text>
          <Text numberOfLines={1} style={{ color: selectedDistrict?.color ?? colors.textSoft, fontSize: 10, fontWeight: "900", marginTop: 1 }}>
            {selectedDistrict?.label ?? selectedLocation.costHint}
          </Text>
        </View>
        {selectedLocationSlug === currentLocationSlug && (
          <View style={{ backgroundColor: colors.accent, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4 }}>
            <Text style={{ color: "#07111f", fontSize: 9, fontWeight: "900" }}>ICI</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={{ color: colors.textSoft, fontSize: 11, lineHeight: 16 }}>{selectedLocation.summary}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, borderRadius: 11, padding: 8, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          <Text style={{ color: "#f6b94f", fontSize: 10, fontWeight: "900" }}>{selectedNpcCount}</Text>
          <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "800" }}>residents</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 11, padding: 8, backgroundColor: "rgba(56,199,147,0.10)", borderWidth: 1, borderColor: "rgba(56,199,147,0.22)" }}>
          <Text style={{ color: "#38c793", fontSize: 10, fontWeight: "900" }}>{selectedOnlineCount}</Text>
          <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "800" }}>live</Text>
        </View>
      </View>
      {selectedLocationSlug !== currentLocationSlug ? (
        <View style={{ flexDirection: "row", gap: 7 }}>
          {selectedTravelPlans.map((plan) => (
            <Pressable
              key={plan.mode}
              onPress={() => plan.available && enterLocation(selectedLocationSlug, plan.mode)}
              disabled={!plan.available}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 12,
                padding: 7,
                backgroundColor: plan.mode === selectedRecommendedTravel?.mode ? plan.color + "22" : "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: plan.mode === selectedRecommendedTravel?.mode ? plan.color + "70" : "rgba(255,255,255,0.10)",
                opacity: plan.available ? 1 : 0.42,
                alignItems: "center",
                justifyContent: "center",
                gap: 3
              }}
            >
              <Ionicons name={plan.icon as never} size={16} color={plan.available ? plan.color : colors.muted} />
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: plan.available ? colors.text : colors.muted, fontSize: 10, fontWeight: "900" }}>{plan.durationLabel}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable onPress={() => beginRoomEntry(selectedLocationSlug)} disabled={!!roomEntryNotice} style={{ borderRadius: 12, paddingVertical: 10, alignItems: "center", backgroundColor: colors.accent, opacity: roomEntryNotice ? 0.55 : 1 }}>
          <Text style={{ color: "#07111f", fontSize: 12, fontWeight: "900" }}>Entrer dans la room</Text>
        </Pressable>
      )}
    </View>
  ) : null;

  const residentsHere = (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.055)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: 12,
      gap: 10
    }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>
        Ici — {worldLocations.find((l) => l.slug === currentLocationSlug)?.name ?? "lieu courant"}
      </Text>
      {currentRoomNpcs.length === 0 && livePlayers.filter((p) => p.locationSlug === currentLocationSlug).length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 12 }}>Personne ici pour le moment.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {currentRoomNpcs.map((npc) => (
            <Pressable key={npc.id} onPress={() => { setSelectedNpc(npc); setActiveRoomNpcId(npc.id); }} style={{ alignItems: "center", gap: 3 }}>
              <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action} size="xs" />
              <Text style={{ color: colors.text, fontSize: 10, fontWeight: "800" }}>{npc.name.split(" ")[0]}</Text>
            </Pressable>
          ))}
          {livePlayers.filter((p) => p.locationSlug === currentLocationSlug).map((p) => (
            <View key={p.userId} style={{ alignItems: "center", gap: 3 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(56,199,147,0.14)", borderWidth: 1, borderColor: "#38c793", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person" size={17} color="#38c793" />
              </View>
              <Text style={{ color: "#38c793", fontSize: 10, fontWeight: "800" }}>{p.avatarName.split(" ")[0]}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const interior = INTERIORS[currentLocationSlug] ?? INTERIORS.cafe;
  const locationInterior = (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.055)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: 12,
      gap: 10
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>{interior.title}</Text>
        <Ionicons name="business" size={18} color={colors.accent} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{interior.tone}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(LOCATION_ACTIONS[currentLocationSlug] ?? LOCATION_ACTIONS.cafe).map((item) => (
          <Pressable
            key={item.action}
            onPress={() => handleLocationAction(item.action)}
            style={{
              minWidth: IS_WIDE ? "30%" : "45%",
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 10,
              backgroundColor: "rgba(139,124,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(139,124,255,0.28)"
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name={item.icon as never} size={13} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "800" }}>{item.label}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const dailyMissionPanel = (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.055)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: 12,
      gap: 10
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>Missions du jour</Text>
        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "900" }}>
          {dailyGoals.filter((goal) => goal.completed).length}/{dailyGoals.length}
        </Text>
      </View>
      <View style={{ gap: 7 }}>
        {dailyGoals.slice(0, 4).map((goal) => (
          <View key={goal.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: goal.completed ? "#38c793" : "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: goal.completed ? "#38c793" : "rgba(255,255,255,0.12)"
            }}>
              <Ionicons name={goal.completed ? "checkmark" : "ellipse-outline"} size={12} color={goal.completed ? "#07111f" : colors.muted} />
            </View>
            <Text style={{ color: goal.completed ? "#8ee0bd" : colors.text, fontSize: 12, fontWeight: goal.completed ? "800" : "600", flex: 1 }}>
              {goal.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const liveTestPanel = (
    <View style={{
      backgroundColor: "rgba(246,185,79,0.075)",
      borderWidth: 1,
      borderColor: "rgba(246,185,79,0.25)",
      borderRadius: 16,
      padding: 12,
      gap: 10
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: "#f6b94f", fontSize: 14, fontWeight: "900" }}>Test live</Text>
        <Ionicons name="flask" size={18} color="#f6b94f" />
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable onPress={seedLiveTestPlayers} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "#f6b94f" }}>
          <Text style={{ color: "#07111f", fontSize: 11, fontWeight: "900" }}>Simuler joueurs</Text>
        </Pressable>
        <Pressable onPress={() => setSimulatedPlayers([])} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)" }}>
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Vider</Text>
        </Pressable>
        <Pressable onPress={pushTestNpcIntoRoom} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(56,199,147,0.18)" }}>
          <Text style={{ color: "#8ee0bd", fontSize: 11, fontWeight: "800" }}>Tester NPC</Text>
        </Pressable>
      </View>
    </View>
  );

  const quickPlayPanel = (
    <View style={{
      backgroundColor: "rgba(56,199,147,0.075)",
      borderWidth: 1.5,
      borderColor: "rgba(56,199,147,0.28)",
      borderRadius: 18,
      padding: 12,
      gap: 11
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "900" }}>JOUER MAINTENANT</Text>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 2 }}>
            {travelNotice ? `En route vers ${worldLocations.find((l) => l.slug === travelNotice.to)?.name ?? travelNotice.to}` : arrivalNotice ? `Arrive a ${arrivalNotice.locationName}` : "Boucle rapide de la ville"}
          </Text>
        </View>
        <View style={{ backgroundColor: (travelNotice?.color ?? colors.accent) + "18", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: (travelNotice?.color ?? colors.accent) + "40" }}>
          <Text style={{ color: travelNotice?.color ?? colors.accent, fontSize: 10, fontWeight: "900" }}>{travelNotice ? travelNotice.modeLabel : "FOCUS"}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 6 }}>
        {quickFlowSteps.map((step, index) => {
          const color = step.active ? colors.accent : step.done ? "#60a5fa" : "rgba(226,232,240,0.38)";
          return (
            <View key={step.label} style={{ flex: 1, minHeight: 34, borderRadius: 11, paddingHorizontal: 6, paddingVertical: 6, backgroundColor: color + "14", borderWidth: 1, borderColor: color + "35", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color, fontSize: 9, fontWeight: "900" }}>0{index + 1}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color, fontSize: 9, fontWeight: "800", marginTop: 1 }}>{step.label}</Text>
            </View>
          );
        })}
      </View>

      {travelNotice && (
        <View style={{ gap: 7, backgroundColor: travelNotice.color + "10", borderRadius: 13, padding: 10, borderWidth: 1, borderColor: travelNotice.color + "35" }}>
          <TravelProgressBar notice={travelNotice} />
          <Text numberOfLines={1} style={{ color: travelNotice.color, fontSize: 10, fontWeight: "900" }}>
            Trajet en cours · {travelNotice.durationLabel}
          </Text>
        </View>
      )}

      {arrivalNotice && !travelNotice && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: colors.accent + "12", borderRadius: 13, padding: 10, borderWidth: 1, borderColor: colors.accent + "35" }}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
          <Text numberOfLines={2} style={{ flex: 1, color: colors.text, fontSize: 11, fontWeight: "800" }}>
            Tu es arrive. Parle aux personnes presentes ou lance l'action du lieu.
          </Text>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Pressable
          onPress={() => {
            if (travelNotice) return;
            if (selectedLocationSlug !== currentLocationSlug) {
              enterLocation(selectedLocationSlug, selectedRecommendedTravel?.mode);
              return;
            }
            executeCityIntel();
          }}
          style={{
            borderRadius: 14,
            padding: 11,
            backgroundColor: selectedLocationSlug !== currentLocationSlug ? "#67d8ff18" : cityIntelTone + "18",
            borderWidth: 1,
            borderColor: selectedLocationSlug !== currentLocationSlug ? "#67d8ff55" : cityIntelTone + "55",
            opacity: travelNotice ? 0.55 : 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 10
          }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: selectedLocationSlug !== currentLocationSlug ? "#67d8ff24" : cityIntelTone + "24", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={(selectedLocationSlug !== currentLocationSlug ? selectedRecommendedTravel?.icon ?? "navigate" : "flash") as never} size={17} color={selectedLocationSlug !== currentLocationSlug ? "#67d8ff" : cityIntelTone} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 13, fontWeight: "900" }}>
              {travelNotice ? "Trajet en cours" : selectedLocationSlug !== currentLocationSlug ? `Aller a ${selectedLocationName}` : cityIntel.locationSlug === currentLocationSlug ? cityIntel.actionLabel : `Aller a ${recommendedLocationName}`}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, fontWeight: "800", marginTop: 2 }}>
              {selectedLocationSlug !== currentLocationSlug
                ? `${selectedRecommendedTravel?.label ?? "Trajet"} · ${selectedRecommendedTravel?.durationLabel ?? "rapide"}`
                : cityIntel.reason}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={selectedLocationSlug !== currentLocationSlug ? "#67d8ff" : cityIntelTone} />
        </Pressable>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={speakHereNow}
            style={{
              flex: 1,
              minHeight: 74,
              borderRadius: 14,
              padding: 10,
              backgroundColor: peopleHereCount > 0 ? "rgba(56,199,147,0.13)" : "rgba(246,185,79,0.12)",
              borderWidth: 1,
              borderColor: peopleHereCount > 0 ? "rgba(56,199,147,0.38)" : "rgba(246,185,79,0.38)",
              gap: 7
            }}
          >
            <Ionicons name={peopleHereCount > 0 ? "chatbubbles" : "person-add"} size={18} color={peopleHereCount > 0 ? "#38c793" : "#f6b94f"} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}>
              {peopleHereCount > 0 ? "Parler ici" : "Peupler"}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, fontWeight: "800" }}>
              {peopleHereCount > 0 ? `${peopleHereCount} present` : "test live"}
            </Text>
          </Pressable>

          {primaryLocationAction && (
            <Pressable
              onPress={() => handleLocationAction(primaryLocationAction.action)}
              style={{
                flex: 1,
                minHeight: 74,
                borderRadius: 14,
                padding: 10,
                backgroundColor: "rgba(139,124,255,0.13)",
                borderWidth: 1,
                borderColor: "rgba(139,124,255,0.38)",
                gap: 7
              }}
            >
              <Ionicons name={primaryLocationAction.icon as never} size={18} color={colors.accent} />
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}>
                {primaryLocationAction.label}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, fontWeight: "800" }}>
                {currentLocationName}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  const selectedNpcFocusPanel = selectedNpc ? (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      borderRadius: 16,
      padding: 12,
      gap: 10
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <AvatarSprite visual={getNpcVisual(selectedNpc.id)} action={selectedNpc.action} size="sm" />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>{selectedNpc.name}</Text>
            <Text style={{ fontSize: 13 }}>{getNpcMoodEmoji(selectedNpc.mood)}</Text>
          </View>
          <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{getNpcStatusLine(selectedNpc)}</Text>
        </View>
        <Pressable onPress={() => setSelectedNpc(null)} style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
          <Ionicons name="close" size={16} color={colors.textSoft} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          { label: "Niv", value: selectedNpc.level, color: "#f6b94f" },
          { label: "Mood", value: selectedNpc.mood, color: "#38c793" },
          { label: "Cr", value: selectedNpc.money, color: "#60a5fa" }
        ].map((item) => (
          <View key={item.label} style={{ flex: 1, borderRadius: 11, padding: 8, backgroundColor: item.color + "12", borderWidth: 1, borderColor: item.color + "30", alignItems: "center" }}>
            <Text style={{ color: item.color, fontSize: 13, fontWeight: "900" }}>{item.value}</Text>
            <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "800" }}>{item.label}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => { setSelectedNpc(null); router.push("/(app)/(tabs)/chat"); }}
          style={{ flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center", backgroundColor: colors.accent }}
        >
          <Text style={{ color: "#07111f", fontSize: 12, fontWeight: "900" }}>Message</Text>
        </Pressable>
        <Pressable
          onPress={() => { setSelectedNpc(null); router.push("/(app)/outings"); }}
          style={{ flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center", backgroundColor: "#f6b94f22", borderWidth: 1, borderColor: "#f6b94f55" }}
        >
          <Text style={{ color: "#f6b94f", fontSize: 12, fontWeight: "900" }}>Inviter</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, overflow: "hidden", backgroundColor: "#07111f" }}>
      <View style={{ flex: 1 }}>

        {/* ── Header overlay ── */}
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
          flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
          paddingHorizontal: 14, paddingTop: 50, paddingBottom: 12,
          backgroundColor: "rgba(7,17,31,0.82)",
        }}>
          <View>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 17 }}>🏙️ {cityName}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>
              {npcs.filter((n) => n.presenceOnline).length} en ligne · clique un lieu
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/(app)/rooms")}
              style={{ backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <Ionicons name="people" size={13} color="#07111f" />
              <Text style={{ color: "#07111f", fontWeight: "900", fontSize: 11 }}>Rooms</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(app)/world-live")}
              style={{ backgroundColor: "rgba(139,124,255,0.18)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(139,124,255,0.35)" }}
            >
              <Ionicons name="radio" size={13} color="#d0c8ff" />
              <Text style={{ color: "#d0c8ff", fontWeight: "900", fontSize: 11 }}>Résidents</Text>
            </Pressable>
          </View>
        </View>
        {/* ── Carte 2D plein écran ── */}
        <View style={{ flex: 1, flexDirection: IS_WIDE ? "row" : "column", backgroundColor: "#07111f" }}>
        <View style={{
          width: MAP_W,
          height: MAP_H,
          backgroundColor: "#0d1f32",
          overflow: "hidden",
          borderRightWidth: IS_WIDE ? 1 : 0,
          borderRightColor: "rgba(255,255,255,0.10)"
        }}>
          {/* base quartiers */}
          <View style={{ position:"absolute", inset:0, backgroundColor:"#b7d0a3" }} />
          {DISTRICT_ZONES.map((zone) => (
            <DistrictZone key={zone.key} zone={zone} />
          ))}

          {/* eau et quais */}
          <View style={{ position:"absolute", left:210 * MAP_SX, right:0, top:0, height:92 * MAP_SY, backgroundColor:"#1488a8" }} />
          <View style={{ position:"absolute", left:250 * MAP_SX, right:0, bottom:0, height:96 * MAP_SY, backgroundColor:"#0f7892" }} />
          <View style={{ position:"absolute", left:226 * MAP_SX, top:76 * MAP_SY, width:164 * MAP_SX, height:20 * MAP_SY, backgroundColor:"#d9c79c", borderWidth: 1, borderColor: "rgba(96,66,32,0.18)", transform:[{ rotate:"-8deg" }] }} />
          <View style={{ position:"absolute", left:270 * MAP_SX, bottom:82 * MAP_SY, width:128 * MAP_SX, height:20 * MAP_SY, backgroundColor:"#d9c79c", borderWidth: 1, borderColor: "rgba(96,66,32,0.18)", transform:[{ rotate:"6deg" }] }} />
          {[235, 278, 322, 354].map((x, i) => (
            <View key={`dock-${i}`} style={{ position:"absolute", left:x * MAP_SX, top:(i % 2 === 0 ? 86 : 80) * MAP_SY, width:24 * MAP_SX, height:5 * MAP_SY, backgroundColor:"#8a6a43", transform:[{ rotate:"-8deg" }] }} />
          ))}
          {[222, 264, 306, 348].map((x, i) => (
            <View key={`wave-top-${i}`} pointerEvents="none" style={{ position:"absolute", left:x * MAP_SX, top:(30 + i * 10) * MAP_SY, width:28 * MAP_SX, height:2, borderRadius:2, backgroundColor:"rgba(229,251,255,0.34)", transform:[{ rotate:"-8deg" }] }} />
          ))}
          {[266, 302, 338].map((x, i) => (
            <View key={`wave-bottom-${i}`} pointerEvents="none" style={{ position:"absolute", left:x * MAP_SX, bottom:(20 + i * 13) * MAP_SY, width:32 * MAP_SX, height:2, borderRadius:2, backgroundColor:"rgba(229,251,255,0.30)", transform:[{ rotate:"6deg" }] }} />
          ))}
          <Text style={{ position:"absolute", right:16, top:22 * MAP_SY, color:"#e5fbff", fontSize:12, fontWeight:"900", textShadowColor:"rgba(0,0,0,0.35)", textShadowRadius:2 }}>Port</Text>
          <HarborBoat x={250} y={36} dir={1} delay={500} />
          <HarborBoat x={356} y={414} dir={-1} color="#fff2c7" delay={1800} distance={58} speed={15000} />

          <Cloud x={18} y={16} scale={0.9} />
          <Cloud x={300} y={116} scale={0.72} />
          <Birds x={244} y={26} />

          {/* routes principales */}
          <Road x={0} y={130} w={380} h={36} horizontal />
          <Road x={0} y={270} w={380} h={36} horizontal />
          <Road x={120} y={0} w={26} h={460} horizontal={false} />
          <Road x={240} y={0} w={26} h={460} horizontal={false} />
          <View style={{ position:"absolute", left:0, top:390 * MAP_SY, width:300 * MAP_SX, height:36 * MAP_SY, backgroundColor:"#263039", borderWidth:1, borderColor:"rgba(255,255,255,0.08)", transform:[{ rotate:"-10deg" }] }} />
          <View style={{ position:"absolute", left:148 * MAP_SX, top:128 * MAP_SY, width:82 * MAP_SX, height:40 * MAP_SY, borderRadius:20, borderWidth:2, borderColor:"rgba(255,255,255,0.12)", backgroundColor:"rgba(7,17,31,0.16)" }} />
          <View style={{ position:"absolute", left:262 * MAP_SX, top:268 * MAP_SY, width:82 * MAP_SX, height:40 * MAP_SY, borderRadius:20, borderWidth:2, borderColor:"rgba(255,255,255,0.12)", backgroundColor:"rgba(7,17,31,0.16)" }} />

          {[0, 44, 88, 154, 198, 286, 330].map((x) => <RoadLine key={`r1-${x}`} x={x} y={146} w={22} h={3} />)}
          {[12, 56, 100, 164, 208, 284, 328].map((x) => <RoadLine key={`r2-${x}`} x={x} y={286} w={22} h={3} />)}
          {[8, 56, 184, 330, 392].map((y) => <RoadLine key={`v1-${y}`} x={131} y={y} w={3} h={22} />)}
          {[10, 58, 184, 330, 392].map((y) => <RoadLine key={`v2-${y}`} x={251} y={y} w={3} h={22} />)}
          <Crosswalk x={112} y={126} horizontal />
          <Crosswalk x={232} y={268} horizontal />
          <Crosswalk x={122} y={300} horizontal={false} />
          <Crosswalk x={242} y={164} horizontal={false} />
          <RouteGuide
            fromSlug={travelNotice?.from ?? currentLocationSlug}
            toSlug={routeTargetSlug}
            color={routeColor}
          />
          {travelNotice && <LiveTravelMarker notice={travelNotice} />}
          {roomEntryNotice && <RoomEntryTargetPulse notice={roomEntryNotice} />}
          {roomEntryNotice && <RoomEntryOverlay notice={roomEntryNotice} />}

          {/* rond-point et place centrale */}
          <View style={{ position:"absolute", left:152 * MAP_SX, top:270 * MAP_SY, width:82 * MAP_SX, height:82 * MAP_SY, borderRadius:42 * MAP_SX, backgroundColor:"#20282f", borderWidth: 2, borderColor: "rgba(255,255,255,0.18)", alignItems:"center", justifyContent:"center" }}>
            <View style={{ width:60 * MAP_SX, height:60 * MAP_SX, borderRadius:30 * MAP_SX, backgroundColor:"#87ab59", alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:30 * MAP_SX, height:30 * MAP_SX, borderRadius:15 * MAP_SX, backgroundColor:"#75c9ed", borderWidth:2, borderColor:"rgba(255,255,255,0.62)" }} />
            </View>
            <Text style={{ position:"absolute", bottom:8, color:"#f2ffe9", fontSize:9, fontWeight:"900" }}>Fontaine</Text>
          </View>

          <MapLabel x={154} y={246} text="Centre-ville" tone="green" />
          <MapLabel x={18} y={142} text="Avenue Nord" />
          <MapLabel x={284} y={284} text="Boulevard Est" />
          <MapLabel x={72} y={398} text="Pont urbain" />
          <MapLabel x={14} y={442} text="Quartier pauvre" />
          <MapLabel x={142} y={74} text="Moyen riche" tone="blue" />
          <MapLabel x={286} y={432} text="Quartier riche" tone="light" />
          <CitySign x={274} y={132} label="BUSINESS" color="#93c5fd" />
          <CitySign x={16} y={258} label="GREEN ZONE" color="#8ee0bd" />
          <CitySign x={296} y={360} label="ELITE" color="#f6b94f" />
          <TransitStop x={106} y={114} icon="bus" label="Bus" color="#60a5fa" />
          <TransitStop x={268} y={268} icon="bus" label="Bus" color="#60a5fa" />
          <TransitStop x={216} y={304} icon="car-sport" label="Parking" color="#f6b94f" />

          <FerrisWheel x={282} y={28} size={46} />
          <UrbanBlock x={78} y={72} w={42} h={44} color="#64748b" label="HOME" />
          <UrbanBlock x={134} y={16} w={42} h={42} color="#6b9ab7" />
          <UrbanBlock x={202} y={92} w={34} h={34} color="#83a7bf" />
          <UrbanBlock x={6} y={222} w={36} h={34} color="#4f8f66" />
          <UrbanBlock x={80} y={222} w={36} h={34} color="#4f8f66" />
          <UrbanBlock x={152} y={214} w={72} h={44} color="#3f78a6" label="CITY" />
          <UrbanBlock x={270} y={218} w={22} h={42} color="#77909c" />
          <UrbanBlock x={338} y={236} w={34} h={36} color="#73808f" />
          <UrbanBlock x={156} y={366} w={40} h={48} color="#7c5ca8" />
          <UrbanBlock x={236} y={356} w={38} h={46} color="#8b5fc7" />
          <UrbanBlock x={288} y={426} w={38} h={28} color="#d4a23f" />
          <UrbanBlock x={338} y={404} w={32} h={36} color="#b88930" />
          <DecoBuilding x={8} y={20} w={72} h={44} color="#7b604e" label="INDUS" />
          <DecoBuilding x={86} y={14} w={42} h={40} color="#9a7558" />
          <DecoBuilding x={152} y={34} w={44} h={46} color="#d6b27c" />
          <DecoBuilding x={12} y={370} w={76} h={50} color="#c74d3a" label="MALL" windows={false} />
          <DecoBuilding x={96} y={348} w={44} h={58} color="#34495e" />
          <DecoBuilding x={142} y={342} w={42} h={64} color="#2f6d85" />
          <DecoBuilding x={274} y={388} w={72} h={48} color="#44606a" label="PORT" />
          <DecoBuilding x={274} y={154} w={58} h={42} color="#c4904d" label="HOTEL" />
          <DecoBuilding x={330} y={158} w={40} h={38} color="#526b82" label="BANK" />
          <ParkingLot x={92} y={414} w={58} h={34} />
          <ParkingLot x={284} y={104} w={58} h={28} />
          <View style={{ position:"absolute", left:292 * MAP_SX, top:332 * MAP_SY, width:78 * MAP_SX, height:46 * MAP_SY, borderRadius:38, backgroundColor:"#36424c", borderWidth:6, borderColor:"#6f7d86", alignItems:"center", justifyContent:"center" }}>
            <View style={{ width:50 * MAP_SX, height:24 * MAP_SY, borderRadius:24, backgroundColor:"#67b56b", borderWidth:2, borderColor:"rgba(255,255,255,0.35)" }} />
            <Text style={{ position:"absolute", bottom:-18, color:"#24313a", fontSize:9, fontWeight:"900" }}>Stade</Text>
          </View>

          {[18, 44, 88, 332, 354, 18, 54, 214, 280, 352, 148, 236, 258, 92, 182, 314, 336, 68, 108, 218, 28, 342].map((x, i) => (
            <CityTree key={`tree-${i}`} x={x} y={[172, 158, 176, 112, 126, 250, 248, 108, 160, 186, 314, 246, 250, 430, 420, 214, 238, 92, 106, 220, 336, 322][i]} size={i % 3 === 0 ? 14 : 11} />
          ))}
          <MovingCar y={140} color="#3498db" dir={1} speed={8400} delay={250} />
          <MovingCar y={153} color="#e74c3c" dir={-1} speed={10200} delay={1400} />
          <MovingCar y={280} color="#f6b94f" dir={1} speed={9100} delay={900} />
          <MovingCar y={293} color="#38c793" dir={-1} speed={7800} delay={2200} />
          <MovingCar y={400} color="#f97316" dir={1} speed={10800} delay={1800} />
          {[
            [24, 126], [88, 126], [168, 126], [226, 126], [286, 126], [344, 126],
            [34, 266], [96, 266], [168, 266], [226, 266], [286, 266], [344, 266],
            [116, 34], [116, 196], [116, 342], [236, 42], [236, 214], [236, 360]
          ].map(([x, y], i) => (
            <CityLight key={`light-${i}`} x={x} y={y} delay={i * 120} color={i % 4 === 0 ? "#67d8ff" : "#f6b94f"} />
          ))}

          {/* Tuiles */}
          {Object.entries(LOCATION_TILES).map(([slug, tile]) => {
            const loc = worldLocations.find((item) => item.slug === slug);
            const residential = getResidentialDistrictForLocation(slug);
            return (
              <LocationTile
                key={slug}
                slug={slug}
                tile={tile}
                label={loc?.name ?? slug}
                metaLabel={residential?.label ?? loc?.costHint ?? "ville"}
                metaColor={residential?.color ?? "rgba(226,232,240,0.82)"}
                roomCode={LOCATION_ROOM_CODES[slug]}
                isHere={currentLocationSlug === slug}
                isRecommended={cityIntel.locationSlug === slug}
                isSelected={selectedLocationSlug === slug && currentLocationSlug !== slug}
                isEntering={roomEntryNotice?.locationSlug === slug}
                npcCount={npcsByLoc[slug]?.length ?? 0}
                onlineCount={onlineCounts[slug] ?? 0}
                onPress={() => {
                  setSelectedLocationSlug(slug);
                  beginRoomEntry(slug);
                }}
              />
            );
          })}

          {/* NPCs animés */}
          {npcs.map((npc) => (
            <LiveNpc key={npc.id} npc={npc} onPress={() => { setSelectedNpc(npc); setActiveRoomNpcId(npc.id); }} />
          ))}

          {/* Joueurs en ligne (badge vert) */}
          {livePlayers.map((p) => {
            const tile = LOCATION_TILES[p.locationSlug];
            if (!tile) return null;
            const box = scaleTile(tile);
            return (
              <View
                key={p.userId}
                style={{ position: "absolute", left: box.x + 8, top: box.y + 8, backgroundColor: "#38c793", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}
              >
                <Text style={{ color: "#07111f", fontSize: 9, fontWeight: "900" }}>{p.avatarName.slice(0, 5)}</Text>
              </View>
            );
          })}

          {/* Avatar joueur courant */}
          {playerVisual && (() => {
            const tile = LOCATION_TILES[currentLocationSlug];
            if (!tile) return null;
            const box = scaleTile(tile);
            return (
              <View style={{ position: "absolute", left: box.x + box.w / 2 - 22, top: box.y + 6, alignItems: "center", zIndex: 40 }}>
                <View style={{ position: "absolute", top: -8, width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(56,199,147,0.18)", borderWidth: 2, borderColor: "rgba(56,199,147,0.55)" }} />
                <AvatarSprite visual={playerVisual} action={playerAction} size="xs" />
                <View style={{ backgroundColor: colors.accent, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" }}>
                  <Text style={{ color: "#07111f", fontSize: 9, fontWeight: "900" }}>VOUS</Text>
                </View>
              </View>
            );
          })()}

          {/* HUD lisible façon town map */}
          <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, top: IS_WIDE ? 104 : 96, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <View style={{
              maxWidth: MAP_W * 0.48,
              backgroundColor: "rgba(7,17,31,0.88)",
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)"
            }}>
              <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "900" }}>{cityName}</Text>
              <Text style={{ color: "rgba(226,232,240,0.78)", fontSize: 10, marginTop: 2 }}>
                {worldLocations.find((l) => l.slug === currentLocationSlug)?.name ?? "Ville"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <MapBadge icon="📍" label="lieu actuel" value={worldLocations.find((l) => l.slug === currentLocationSlug)?.name ?? "Ville"} color={colors.accent} />
              <MapBadge icon="🚌" label="transport" value={travelNotice ? travelNotice.modeLabel : recommendedTravel?.label ?? "A pied"} color={travelNotice?.color ?? recommendedTravel?.color ?? "#60a5fa"} />
              <MapBadge icon="👥" label="résidents" value={`${npcs.length}`} color="#f6b94f" />
              <MapBadge icon="🟢" label="en ligne" value={`${livePlayers.length}`} color="#38c793" />
            </View>
          </View>

          {!roomEntryNotice && (
            <Pressable
              onPress={() => beginRoomEntry(currentLocationSlug)}
              style={{
                position: "absolute",
                left: 12,
                top: IS_WIDE ? 168 : 150,
                maxWidth: Math.min(330, MAP_W - 24),
                borderRadius: 18,
                padding: 12,
                backgroundColor: "rgba(5,10,18,0.93)",
                borderWidth: 1.5,
                borderColor: "rgba(56,199,147,0.58)",
                shadowColor: "#38c793",
                shadowOpacity: 0.26,
                shadowRadius: 16,
                elevation: 14,
                gap: 9
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(56,199,147,0.18)", borderWidth: 1, borderColor: "rgba(56,199,147,0.45)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="navigate" size={20} color="#8ee0bd" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#8ee0bd", fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>VOUS ETES ICI</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#ffffff", fontSize: 16, fontWeight: "900", marginTop: 1 }}>
                    {currentLocationName}
                  </Text>
                  <Text numberOfLines={1} style={{ color: "rgba(226,232,240,0.76)", fontSize: 11, marginTop: 2 }}>
                    Room #{currentRoomCode} · {peopleHereCount} présent{peopleHereCount > 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.accent }}>
                  <Text style={{ color: "#07111f", fontSize: 11, fontWeight: "900" }}>CHAT</Text>
                </View>
              </View>
            </Pressable>
          )}

          <View pointerEvents="none" style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            backgroundColor: "rgba(7,17,31,0.86)",
            borderRadius: 14,
            padding: 10,
            gap: 6,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.16)"
          }}>
            {[
              { dot: colors.accent, label: "Tu es ici" },
              { dot: "#f6b94f", label: "Action" },
              { dot: "#60a5fa", label: "Bus" },
              { dot: "#f6b94f", label: "Voiture" },
              { dot: "#38c793", label: "Joueur live" },
              { dot: "#60a5fa", label: "Resident" }
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.dot }} />
                <Text style={{ color: "#e5edf7", fontSize: 10, fontWeight: "800" }}>{item.label}</Text>
              </View>
            ))}
          </View>

          {travelNotice && (
            <View pointerEvents="none" style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 96,
              backgroundColor: "rgba(7,17,31,0.92)",
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderWidth: 1,
              borderColor: colors.accent + "66",
              flexDirection: "row",
              alignItems: "center",
              gap: 10
            }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: travelNotice.color, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={travelNotice.icon as never} size={16} color="#07111f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: travelNotice.color, fontSize: 11, fontWeight: "900" }}>DEPLACEMENT · {travelNotice.modeLabel} · {travelNotice.durationLabel}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#ffffff", fontSize: 13, fontWeight: "900" }}>
                  {worldLocations.find((l) => l.slug === travelNotice.from)?.name ?? travelNotice.from}
                  {" -> "}
                  {worldLocations.find((l) => l.slug === travelNotice.to)?.name ?? travelNotice.to}
                </Text>
                <View style={{ marginTop: 7 }}>
                  <TravelProgressBar notice={travelNotice} />
                </View>
              </View>
              <Text style={{ color: "rgba(226,232,240,0.7)", fontSize: 10, fontWeight: "800" }}>
                {new Date(travelNotice.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          )}
          {arrivalNotice && !travelNotice && (
            <View pointerEvents="none" style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 96,
              backgroundColor: "rgba(7,17,31,0.92)",
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: colors.accent + "66",
              flexDirection: "row",
              alignItems: "center",
              gap: 10
            }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="checkmark" size={17} color="#07111f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "900" }}>ARRIVEE</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#ffffff", fontSize: 13, fontWeight: "900" }}>
                  {arrivalNotice.locationName}
                </Text>
              </View>
            </View>
          )}
          {selectedLocationPanel}
        </View>

          <View style={{
            width: WORLD_CHAT_W,
            height: WORLD_CHAT_H,
            minHeight: IS_WIDE ? undefined : 260,
            backgroundColor: "#081527",
            borderLeftWidth: IS_WIDE ? 1 : 0,
            borderTopWidth: IS_WIDE ? 0 : 1,
            borderRightWidth: 0,
            borderBottomWidth: 0,
            borderColor: hasLiveLocationChat || activeRoomNpc ? "rgba(56,199,147,0.35)" : "rgba(255,255,255,0.08)",
            borderRadius: IS_WIDE ? 0 : 16,
            paddingHorizontal: IS_WIDE ? 14 : 12,
            paddingBottom: IS_WIDE ? 14 : 12,
            paddingTop: IS_WIDE ? 104 : 12,
            gap: 10,
            zIndex: 30,
            shadowColor: "#38c793",
            shadowOpacity: 0.16,
            shadowRadius: 18,
            elevation: 12
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#8ee0bd", fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>MSN LIVE ROOM</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900", marginTop: 1 }}>Chat de lieu</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {worldLocations.find((l) => l.slug === currentLocationSlug)?.name ?? "room"}
                  {" · "}
                  Room #{currentRoomCode} · {locationChat.connected || activeRoomNpc ? "connecte" : "pret"}
                </Text>
              </View>
              <View style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: "rgba(56,199,147,0.16)",
                borderWidth: 1,
                borderColor: "rgba(56,199,147,0.38)",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Ionicons name="chatbubbles" size={22} color="#38c793" />
              </View>
            </View>

            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 14,
              backgroundColor: peopleHereCount > 0 ? "rgba(56,199,147,0.12)" : "rgba(255,255,255,0.055)",
              borderWidth: 1,
              borderColor: peopleHereCount > 0 ? "rgba(56,199,147,0.34)" : "rgba(255,255,255,0.10)"
            }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: peopleHereCount > 0 ? "#38c793" : "#f6b94f" }} />
              <Text numberOfLines={1} style={{ flex: 1, color: colors.textSoft, fontSize: 11, fontWeight: "800" }}>
                Room #{currentRoomCode} · {currentRoomStatus}
                {currentRoomParticipantNames.length > 0 ? ` · ${currentRoomParticipantNames.join(", ")}` : ""}
              </Text>
              <Pressable
                onPress={() => beginRoomEntry(currentLocationSlug)}
                disabled={!!roomEntryNotice}
                style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.accent, opacity: roomEntryNotice ? 0.55 : 1 }}
              >
                <Text style={{ color: "#07111f", fontSize: 10, fontWeight: "900" }}>ENTRER</Text>
              </Pressable>
            </View>

            <View style={{
              backgroundColor: selectedLocationSlug === currentLocationSlug ? "rgba(56,199,147,0.10)" : "rgba(103,216,255,0.10)",
              borderWidth: 1,
              borderColor: selectedLocationSlug === currentLocationSlug ? "rgba(56,199,147,0.28)" : "rgba(103,216,255,0.28)",
              borderRadius: 16,
              padding: 12,
              gap: 10
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={(LOCATION_TILES[selectedLocationSlug]?.icon ?? "location") as never} size={18} color={selectedLocationSlug === currentLocationSlug ? "#38c793" : "#67d8ff"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>
                    {selectedLocationName}
                  </Text>
                  <Text numberOfLines={1} style={{ color: selectedDistrict?.color ?? colors.muted, fontSize: 10, fontWeight: "900", marginTop: 2 }}>
                    Room #{selectedRoomCode} · {selectedLocationSlug === currentLocationSlug ? "position actuelle" : `${selectedRecommendedTravel?.label ?? "A pied"} · ${selectedRecommendedTravel?.durationLabel ?? "trajet"}`}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: selectedOnlineCount > 0 ? "#38c793" : colors.muted, fontSize: 12, fontWeight: "900" }}>{selectedOnlineCount} live</Text>
                  <Text style={{ color: "#f6b94f", fontSize: 10, fontWeight: "800" }}>{selectedNpcCount} NPC</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => {
                    if (selectedLocationSlug !== currentLocationSlug) {
                      beginRoomEntry(selectedLocationSlug);
                      return;
                    }
                    beginRoomEntry(selectedLocationSlug);
                  }}
                  disabled={!!travelNotice || !!roomEntryNotice}
                  style={{
                    flex: 1,
                    minHeight: 42,
                    borderRadius: 13,
                    backgroundColor: selectedLocationSlug === currentLocationSlug ? colors.accent : "#67d8ff",
                    opacity: travelNotice || roomEntryNotice ? 0.55 : 1,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 7
                  }}
                >
                  <Ionicons name={(selectedLocationSlug === currentLocationSlug ? primaryLocationAction?.icon ?? "flash" : selectedRecommendedTravel?.icon ?? "navigate") as never} size={16} color="#07111f" />
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#07111f", fontSize: 12, fontWeight: "900" }}>
                    {roomEntryNotice ? "Entrée..." : travelNotice ? "En trajet" : selectedLocationSlug === currentLocationSlug ? "Entrer chat" : "Entrer room"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={speakHereNow}
                  style={{
                    minHeight: 42,
                    borderRadius: 13,
                    paddingHorizontal: 12,
                    backgroundColor: "#f6b94f22",
                    borderWidth: 1,
                    borderColor: "#f6b94f55",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6
                  }}
                >
                  <Ionicons name="chatbubble-ellipses" size={15} color="#f6b94f" />
                  <Text style={{ color: "#f6b94f", fontSize: 12, fontWeight: "900" }}>Parler</Text>
                </Pressable>
              </View>
            </View>

            {hasLiveLocationChat || activeRoomNpc ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {currentLivePlayers.map((player) => (
                    <View
                      key={player.userId}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: 12,
                        backgroundColor: "rgba(56,199,147,0.14)",
                        borderWidth: 1,
                        borderColor: "#38c793"
                      }}
                    >
                      <Ionicons name="person" size={14} color="#38c793" />
                      <Text style={{ color: "#8ee0bd", fontSize: 11, fontWeight: "800" }}>
                        {player.avatarName.split(" ")[0]}
                      </Text>
                    </View>
                  ))}
                  {currentRoomNpcs.map((npc) => (
                    <Pressable
                      key={npc.id}
                      onPress={() => setActiveRoomNpcId(npc.id)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        borderRadius: 12,
                        backgroundColor: activeRoomNpc?.id === npc.id ? "rgba(56,199,147,0.18)" : "rgba(255,255,255,0.06)",
                        borderWidth: 1,
                        borderColor: activeRoomNpc?.id === npc.id ? "#38c793" : "rgba(255,255,255,0.08)"
                      }}
                    >
                      <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action} size="xs" />
                      <Text style={{ color: activeRoomNpc?.id === npc.id ? "#8ee0bd" : colors.text, fontSize: 11, fontWeight: "800" }}>
                        {npc.name.split(" ")[0]}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <ScrollView
                  style={IS_WIDE ? { flex: 1 } : { maxHeight: 120 }}
                  contentContainerStyle={{ gap: 8, paddingRight: 2 }}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {visibleRoomMessages.slice(-6).map((message) => {
                    const mine = message.authorId === "self" || message.authorId === session?.email;
                    const isWizz = message.body.includes(WORLD_WIZZ_TOKEN) || /^wizz/i.test(message.body.trim());
                    return (
                      <View
                        key={message.id}
                        style={{
                          alignSelf: mine ? "flex-end" : "flex-start",
                          maxWidth: "86%",
                          backgroundColor: isWizz ? "#f6b94f" : mine ? colors.accent : "rgba(255,255,255,0.09)",
                          borderRadius: 12,
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          borderWidth: isWizz ? 1 : 0,
                          borderColor: isWizz ? "#fff0a8" : "transparent"
                        }}
                      >
                        {!mine && (
                          <Text style={{ color: isWizz ? "#07111f" : "#8ee0bd", fontSize: 9, fontWeight: "900", marginBottom: 2 }}>
                            {"authorName" in message ? message.authorName : activeRoomNpc?.name ?? "Résident"}
                          </Text>
                        )}
                        {isWizz && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 }}>
                            <Ionicons name="flash" size={13} color="#07111f" />
                            <Text style={{ color: "#07111f", fontSize: 9, fontWeight: "900" }}>WIZZ</Text>
                          </View>
                        )}
                        <Text style={{ color: isWizz || mine ? "#07111f" : colors.text, fontSize: 12, fontWeight: isWizz || mine ? "800" : "600" }}>
                          {cleanWorldChatBody(message.body)}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 8 }}>
                  <Pressable
                    onPress={sendRoomWizz}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderRadius: 12,
                      backgroundColor: "#f6b94f22",
                      borderWidth: 1,
                      borderColor: "#f6b94f55"
                    }}
                  >
                    <Ionicons name="flash" size={13} color="#f6b94f" />
                    <Text style={{ color: "#f6b94f", fontSize: 11, fontWeight: "900" }}>Wizz</Text>
                  </Pressable>
                  {quickRoomMessages.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => postLocationMessage(item)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: 12,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.10)"
                      }}
                    >
                      <Text numberOfLines={1} style={{ color: colors.textSoft, fontSize: 11, fontWeight: "800" }}>{item}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <TextInput
                    value={chatDraft}
                    onChangeText={setChatDraft}
                    placeholder={hasLiveLocationChat ? "Message live dans ce lieu" : `Parler a ${activeRoomNpc?.name.split(" ")[0] ?? "un résident"}`}
                    placeholderTextColor={colors.muted}
                    onSubmitEditing={sendRoomMessage}
                    style={{
                      flex: 1,
                      minHeight: 42,
                      borderRadius: 12,
                      backgroundColor: "rgba(0,0,0,0.18)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.08)",
                      color: colors.text,
                      paddingHorizontal: 12,
                      fontSize: 13
                    }}
                  />
                  <Pressable
                    onPress={sendRoomMessage}
                    style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="send" size={18} color="#07111f" />
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={{ flex: 1, minHeight: 120, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.035)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14 }}>
                <Ionicons name="chatbubble-ellipses" size={30} color="#8ee0bd" />
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>Chat prêt</Text>
                <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 17 }}>Personne ici pour le moment. Peuple la room ou ouvre les rooms live.</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={seedLiveTestPlayers} style={{ borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "#f6b94f", flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="person-add" size={14} color="#07111f" />
                    <Text style={{ color: "#07111f", fontSize: 11, fontWeight: "900" }}>Peupler</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push("/(app)/rooms")} style={{ borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="people" size={14} color={colors.textSoft} />
                    <Text style={{ color: colors.textSoft, fontSize: 11, fontWeight: "900" }}>Rooms</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Panel NPC */}
        {!IS_WIDE && selectedNpc && (
          <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", gap: 10 }}>
            {/* Header NPC */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ position: "relative" }}>
                <AvatarSprite visual={getNpcVisual(selectedNpc.id)} action={selectedNpc.action} size="sm" />
                <View style={{
                  position: "absolute", top: -4, right: -4,
                  backgroundColor: selectedNpc.level >= 3 ? "#f6b94f" : "#38c793",
                  borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2
                }}>
                  <Text style={{ color: "#07111f", fontSize: 9, fontWeight: "900" }}>Nv{selectedNpc.level}</Text>
                </View>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{selectedNpc.name}</Text>
                  <Text style={{ fontSize: 14 }}>{getNpcMoodEmoji(selectedNpc.mood)}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{getNpcStatusLine(selectedNpc)}</Text>
                {/* XP bar */}
                <View style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", marginTop: 2 }}>
                  <View style={{
                    height: 3, borderRadius: 2,
                    width: `${(selectedNpc.xp % 100)}%`,
                    backgroundColor: "#f6b94f"
                  }} />
                </View>
              </View>
              <Pressable onPress={() => setSelectedNpc(null)}>
                <Ionicons name="close-circle" size={22} color={colors.muted} />
              </Pressable>
            </View>
            {/* Stats NPC */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {[
                { label: "💰", value: `${selectedNpc.money}cr` },
                { label: "⚡", value: `${selectedNpc.energy}%` },
                { label: "😊", value: `${selectedNpc.mood}%` },
                { label: "🔥", value: `${selectedNpc.streak}j` },
              ].map((s) => (
                <View key={s.label} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 6, alignItems: "center" }}>
                  <Text style={{ fontSize: 12 }}>{s.label}</Text>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 11 }}>{s.value}</Text>
                </View>
              ))}
            </View>
            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={() => { setSelectedNpc(null); router.push("/(app)/(tabs)/chat"); }}
                style={{ flex: 1, backgroundColor: colors.accent + "22", borderRadius: 12, padding: 10,
                  borderWidth: 1, borderColor: colors.accent + "44", alignItems: "center" }}>
                <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 13 }}>💬 Message</Text>
              </Pressable>
              <Pressable
                onPress={() => { setSelectedNpc(null); router.push("/(app)/outings"); }}
                style={{ flex: 1, backgroundColor: "#f6b94f22", borderRadius: 12, padding: 10,
                  borderWidth: 1, borderColor: "#f6b94f44", alignItems: "center" }}>
                <Text style={{ color: "#f6b94f", fontWeight: "800", fontSize: 13 }}>🎯 Inviter</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Avatar joueur */}
        {playerVisual && (
          <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", gap: 10 }}>
            <Text style={{ color: colors.textSoft, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 }}>Ton avatar</Text>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <AvatarSprite visual={playerVisual} action={playerAction} size="md" />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{avatar?.displayName}</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <View style={{ backgroundColor: colors.blue + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: colors.blue, fontSize: 10, fontWeight: "700" }}>Énergie {stats.energy}</Text>
                  </View>
                  <View style={{ backgroundColor: (stats.mood > 50 ? colors.accent : "#f39c12") + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: stats.mood > 50 ? colors.accent : "#f39c12", fontSize: 10, fontWeight: "700" }}>Humeur {stats.mood}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACTION_COLORS[playerAction] }} />
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{ACTION_LABELS[playerAction]}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {!IS_WIDE && (
        <>
        {/* Résidents ici */}
        <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", gap: 10 }}>
          <Text style={{ color: colors.textSoft, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 }}>
            Ici — {worldLocations.find((l) => l.slug === currentLocationSlug)?.name ?? "lieu courant"}
          </Text>
          {(npcsByLoc[currentLocationSlug] ?? []).length === 0 && livePlayers.filter((p) => p.locationSlug === currentLocationSlug).length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>Personne ici pour le moment.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingVertical: 8 }}>
              {(npcsByLoc[currentLocationSlug] ?? []).map((npc) => (
                <Pressable key={npc.id} onPress={() => { setSelectedNpc(npc); setActiveRoomNpcId(npc.id); }} style={{ alignItems: "center", gap: 3 }}>
                  <View style={{ position: "relative" }}>
                    <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action} size="sm" />
                    <View style={{
                      position: "absolute", top: -3, right: -3,
                      backgroundColor: npc.level >= 3 ? "#f6b94f" : "#38c793",
                      borderRadius: 6, paddingHorizontal: 3, paddingVertical: 1
                    }}>
                      <Text style={{ color: "#07111f", fontSize: 7, fontWeight: "900" }}>Nv{npc.level}</Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>{npc.name.split(" ")[0]}</Text>
                  <Text style={{ color: colors.muted, fontSize: 9 }}>{getNpcMoodEmoji(npc.mood)} {npc.mood}%</Text>
                </Pressable>
              ))}
              {livePlayers.filter((p) => p.locationSlug === currentLocationSlug).map((p) => (
                <View key={p.userId} style={{ alignItems: "center", gap: 4 }}>
                  <View style={{ width: 48, height: 60, backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 12, borderWidth: 1, borderColor: "#38c793", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="person" size={24} color="#38c793" />
                  </View>
                  <Text style={{ color: "#38c793", fontSize: 11, fontWeight: "700" }}>{p.avatarName.split(" ")[0]}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
        </>
        )}

        {/* Feed IA — Activités NPC en temps réel */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
            ⚡ ACTIVITÉ EN COURS
          </Text>
          {npcs.slice(0, 4).map((npc) => {
            const ACTION_ICON: Record<string, string> = {
              sleeping: "😴", eating: "🍽️", chatting: "💬", exercising: "💪",
              walking: "🚶", working: "💼", idle: "💭"
            };
            const icon = ACTION_ICON[npc.action] ?? "•";
            const xpPct = (npc.xp % 100);
            const lvlColor = npc.level >= 4 ? "#c084fc" : npc.level >= 2 ? "#f6b94f" : "#38c793";
            return (
              <Pressable
                key={npc.id}
                onPress={() => setSelectedNpc(npc)}
                style={{ flexDirection: "row", alignItems: "center", gap: 10,
                  backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 10,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
                <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action} size="xs" />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>{npc.name}</Text>
                    <View style={{ backgroundColor: lvlColor + "22", borderRadius: 6, paddingHorizontal: 5 }}>
                      <Text style={{ color: lvlColor, fontSize: 9, fontWeight: "900" }}>Nv{npc.level}</Text>
                    </View>
                    <Text style={{ fontSize: 11 }}>{icon}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>{getNpcStatusLine(npc)}</Text>
                  {/* XP bar */}
                  <View style={{ height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.07)" }}>
                    <View style={{ height: 2, borderRadius: 1, width: `${xpPct}%`, backgroundColor: lvlColor }} />
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ color: "#f6b94f", fontSize: 10, fontWeight: "700" }}>{npc.money}cr</Text>
                  <Text style={{ color: colors.muted, fontSize: 9 }}>🔥{npc.streak}j</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {!IS_WIDE && (
        <>
        {/* Se déplacer */}
        <Text style={{ color: colors.textSoft, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 }}>Se déplacer</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {worldLocations.map((loc) => {
            const isHere     = loc.slug === currentLocationSlug;
            const npcHere    = npcsByLoc[loc.slug]?.length ?? 0;
            const onlineHere = onlineCounts[loc.slug] ?? 0;
            const tile       = LOCATION_TILES[loc.slug];
            const isRecommended = cityIntel.locationSlug === loc.slug;
            const residential = getResidentialDistrictForLocation(loc.slug);
            return (
              <Pressable
                key={loc.slug}
                onPress={() => !isHere && enterLocation(loc.slug)}
                style={{
                  width: "47%",
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: isHere ? "rgba(139,124,255,0.12)" : isRecommended ? "rgba(246,185,79,0.12)" : "rgba(255,255,255,0.04)",
                  borderWidth: 1,
                  borderColor: isHere ? colors.accent : isRecommended ? "rgba(246,185,79,0.38)" : "rgba(255,255,255,0.08)",
                  gap: 4
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Ionicons name={(tile?.icon ?? "location") as never} size={13} color={isHere ? colors.accent : colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 10 }}>
                    {npcHere > 0 ? `${npcHere} résidents` : ""}
                    {onlineHere > 0 ? ` · ${onlineHere} 🟢` : ""}
                  </Text>
                </View>
                <Text style={{ color: isHere ? colors.accent : colors.text, fontWeight: "700", fontSize: 13 }}>{loc.name}</Text>
                <Text style={{ color: residential?.color ?? colors.muted, fontSize: 10, fontWeight: residential ? "900" : "700" }}>
                  {residential ? residential.label : loc.costHint}
                </Text>
                {isHere && <Text style={{ color: colors.accent, fontSize: 10 }}>Tu es ici</Text>}
                {!isHere && isRecommended && <Text style={{ color: "#f6b94f", fontSize: 10, fontWeight: "900" }}>Conseille</Text>}
              </Pressable>
            );
          })}
        </View>
        </>
        )}

      </View>
    </View>
  );
}
