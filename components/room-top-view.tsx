import React, { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual, getNpcVisual } from "@/lib/avatar-visual";
import type { AvatarAction } from "@/lib/avatar-visual";
import type { Room, RoomMember } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

// ─── Dimensions canvas ────────────────────────────────────────────────────────
export const ROOM_W = 320;
export const ROOM_H = 380;

// ─── Types mobilier ───────────────────────────────────────────────────────────
type FurnitureKind =
  | "table-round"   | "table-rect"  | "chair"       | "sofa"
  | "counter"       | "shelf"       | "plant"        | "tv"
  | "rug"           | "bed"         | "lamp"         | "stage"
  | "podium"        | "seat-row"    | "treadmill"    | "barbell"
  | "mat"           | "mirror"      | "bar-counter"  | "dj-booth"
  | "spotlight"     | "window"      | "door"         | "coffee-machine"
  | "fireplace"     | "pool-table"  | "arcade";

type FurnitureItem = {
  kind: FurnitureKind;
  x: number;   // centre % du canvas
  y: number;   // centre % du canvas
  w: number;   // largeur px
  h: number;   // hauteur px
  rotation?: number;
  label?: string;
};

type SeatPosition = { x: number; y: number; action: AvatarAction };

type RoomLayout = {
  floorColor: string;
  floorAccent: string;
  wallColor: string;
  gridColor: string;
  furniture: FurnitureItem[];
  seats: SeatPosition[];
  ambiance: string;  // emoji décoratif
};

// ─── Métadonnées mobilier ─────────────────────────────────────────────────────
const FURNITURE_META: Record<FurnitureKind, { emoji: string; color: string; labelColor: string }> = {
  "table-round":    { emoji: "🍽️", color: "#2a4a2e", labelColor: "#6fcf80" },
  "table-rect":     { emoji: "🪑", color: "#2a3a4a", labelColor: "#7ab8d4" },
  "chair":          { emoji: "",   color: "#1e3a2e", labelColor: "#4ade80" },
  "sofa":           { emoji: "🛋️", color: "#2a1a4a", labelColor: "#a78bfa" },
  "counter":        { emoji: "☕", color: "#1a2a1a", labelColor: "#86efac" },
  "shelf":          { emoji: "📚", color: "#2a1e10", labelColor: "#d97706" },
  "plant":          { emoji: "🪴", color: "#0f2e1a", labelColor: "#4ade80" },
  "tv":             { emoji: "📺", color: "#1a1a2e", labelColor: "#60a5fa" },
  "rug":            { emoji: "",   color: "#1a1a3a", labelColor: "#8b7cff" },
  "bed":            { emoji: "🛏️", color: "#2a1a2e", labelColor: "#c084fc" },
  "lamp":           { emoji: "💡", color: "#2a2a1a", labelColor: "#fbbf24" },
  "stage":          { emoji: "🎤", color: "#1a0d2e", labelColor: "#c084fc" },
  "podium":         { emoji: "🎯", color: "#1a1a0a", labelColor: "#f6b94f" },
  "seat-row":       { emoji: "",   color: "#1a2030", labelColor: "#7ab8d4" },
  "treadmill":      { emoji: "🏃", color: "#0a2030", labelColor: "#38bdf8" },
  "barbell":        { emoji: "🏋️", color: "#1a1a1a", labelColor: "#e2e8f0" },
  "mat":            { emoji: "🧘", color: "#0a1e2e", labelColor: "#34d399" },
  "mirror":         { emoji: "🪞", color: "#1e2e3a", labelColor: "#93c5fd" },
  "bar-counter":    { emoji: "🍸", color: "#2a1a0a", labelColor: "#f6b94f" },
  "dj-booth":       { emoji: "🎧", color: "#1a0a2e", labelColor: "#e879f9" },
  "spotlight":      { emoji: "💛", color: "#1a1a0a", labelColor: "#fde047" },
  "window":         { emoji: "🪟", color: "#0a1e2e", labelColor: "#7dd3fc" },
  "door":           { emoji: "🚪", color: "#1a0a0a", labelColor: "#f87171" },
  "coffee-machine": { emoji: "☕", color: "#1a0a0a", labelColor: "#fbbf24" },
  "fireplace":      { emoji: "🔥", color: "#2a0a0a", labelColor: "#f97316" },
  "pool-table":     { emoji: "🎱", color: "#0a2a0a", labelColor: "#4ade80" },
  "arcade":         { emoji: "🕹️", color: "#1a0a2e", labelColor: "#a78bfa" },
};

// ─── Layouts par type de room ──────────────────────────────────────────────────
const LAYOUTS: Record<string, RoomLayout> = {

  // ─── CAFÉ PUBLIC ─────────────────────────────────────────────────────────
  public: {
    floorColor: "#0e1e12",
    floorAccent: "rgba(56,199,147,0.04)",
    wallColor: "#0a160e",
    gridColor: "rgba(56,199,147,0.06)",
    ambiance: "☕🌿",
    furniture: [
      // Comptoir bar (haut)
      { kind: "counter",       x: 50,  y: 10,  w: 200, h: 32, label: "Bar" },
      // Machine à café
      { kind: "coffee-machine", x: 85, y: 10,  w: 28,  h: 22 },
      // Tables rondes
      { kind: "table-round",   x: 25,  y: 38,  w: 52,  h: 52 },
      { kind: "table-round",   x: 75,  y: 38,  w: 52,  h: 52 },
      { kind: "table-round",   x: 25,  y: 68,  w: 52,  h: 52 },
      { kind: "table-round",   x: 75,  y: 68,  w: 52,  h: 52 },
      // Chaises autour tables
      { kind: "chair", x: 14,  y: 34,  w: 18,  h: 18 },
      { kind: "chair", x: 36,  y: 34,  w: 18,  h: 18 },
      { kind: "chair", x: 14,  y: 44,  w: 18,  h: 18 },
      { kind: "chair", x: 36,  y: 44,  w: 18,  h: 18 },
      { kind: "chair", x: 64,  y: 34,  w: 18,  h: 18 },
      { kind: "chair", x: 86,  y: 34,  w: 18,  h: 18 },
      { kind: "chair", x: 64,  y: 44,  w: 18,  h: 18 },
      { kind: "chair", x: 86,  y: 44,  w: 18,  h: 18 },
      // Plantes décoratives
      { kind: "plant", x: 7,   y: 7,   w: 28,  h: 32 },
      { kind: "plant", x: 93,  y: 7,   w: 28,  h: 32 },
      { kind: "plant", x: 7,   y: 93,  w: 24,  h: 28 },
      { kind: "plant", x: 93,  y: 93,  w: 24,  h: 28 },
      // Fenêtres
      { kind: "window", x: 50,  y: 3,   w: 60,  h: 14 },
      // Canapé lounge
      { kind: "sofa",   x: 50,  y: 88,  w: 120, h: 28 },
      // Lampe
      { kind: "lamp",   x: 50,  y: 58,  w: 16,  h: 16 },
    ],
    seats: [
      { x: 14, y: 32, action: "chatting" },
      { x: 36, y: 42, action: "idle" },
      { x: 64, y: 32, action: "eating" },
      { x: 86, y: 42, action: "chatting" },
      { x: 25, y: 66, action: "chatting" },
      { x: 75, y: 66, action: "idle" },
    ]
  },

  // ─── HOME PRIVÉE ─────────────────────────────────────────────────────────
  private: {
    floorColor: "#0e1020",
    floorAccent: "rgba(139,124,255,0.04)",
    wallColor: "#090c18",
    gridColor: "rgba(139,124,255,0.05)",
    ambiance: "🏠🕯️",
    furniture: [
      // TV (haut centre)
      { kind: "tv",     x: 50,  y: 8,   w: 120, h: 22, label: "TV" },
      // Table basse
      { kind: "table-rect", x: 50, y: 42,  w: 80,  h: 38 },
      // Canapé (bas)
      { kind: "sofa",   x: 50,  y: 70,  w: 140, h: 34 },
      // Bibliothèque gauche
      { kind: "shelf",  x: 8,   y: 40,  w: 30,  h: 80, label: "📚" },
      // Plante
      { kind: "plant",  x: 8,   y: 12,  w: 26,  h: 30 },
      { kind: "plant",  x: 92,  y: 12,  w: 26,  h: 30 },
      // Tapis central
      { kind: "rug",    x: 50,  y: 52,  w: 160, h: 100 },
      // Lampes de sol
      { kind: "lamp",   x: 20,  y: 72,  w: 14,  h: 22 },
      { kind: "lamp",   x: 80,  y: 72,  w: 14,  h: 22 },
      // Fenêtre
      { kind: "window", x: 85,  y: 5,   w: 40,  h: 14 },
      { kind: "window", x: 15,  y: 5,   w: 40,  h: 14 },
      // Bureau côté droit
      { kind: "table-rect", x: 90, y: 40, w: 34, h: 28, label: "Bureau" },
      // Cheminée
      { kind: "fireplace", x: 50, y: 93, w: 60, h: 24 },
    ],
    seats: [
      { x: 35, y: 70, action: "idle" },
      { x: 50, y: 70, action: "chatting" },
      { x: 65, y: 70, action: "idle" },
      { x: 90, y: 38, action: "working" },
    ]
  },

  // ─── ÉVÉNEMENT ───────────────────────────────────────────────────────────
  event: {
    floorColor: "#0e0a1e",
    floorAccent: "rgba(246,185,79,0.04)",
    wallColor: "#08060e",
    gridColor: "rgba(246,185,79,0.05)",
    ambiance: "🎉🎤",
    furniture: [
      // Scène / écran (haut)
      { kind: "stage",  x: 50,  y: 10,  w: 220, h: 48, label: "SCÈNE" },
      // Podium DJ
      { kind: "dj-booth", x: 50, y: 25,  w: 60,  h: 28 },
      // Spots lumières
      { kind: "spotlight", x: 20, y: 4,  w: 18,  h: 18 },
      { kind: "spotlight", x: 50, y: 4,  w: 18,  h: 18 },
      { kind: "spotlight", x: 80, y: 4,  w: 18,  h: 18 },
      // Rangées de chaises
      { kind: "seat-row", x: 50, y: 50,  w: 220, h: 16, label: "Rang A" },
      { kind: "seat-row", x: 50, y: 62,  w: 220, h: 16, label: "Rang B" },
      { kind: "seat-row", x: 50, y: 74,  w: 220, h: 16, label: "Rang C" },
      // Bar côté droit
      { kind: "bar-counter", x: 90, y: 60, w: 28, h: 80, label: "Bar", rotation: 90 },
      // Tables cocktail
      { kind: "table-round", x: 15, y: 62,  w: 34,  h: 34 },
      { kind: "table-round", x: 15, y: 82,  w: 34,  h: 34 },
      // Plantes déco
      { kind: "plant", x: 7,   y: 7,   w: 22,  h: 26 },
      { kind: "plant", x: 93,  y: 7,   w: 22,  h: 26 },
    ],
    seats: [
      { x: 30, y: 50, action: "chatting" },
      { x: 45, y: 50, action: "idle" },
      { x: 60, y: 50, action: "waving" },
      { x: 30, y: 62, action: "idle" },
      { x: 50, y: 62, action: "chatting" },
      { x: 15, y: 60, action: "idle" },
    ]
  },

  // ─── GYM ─────────────────────────────────────────────────────────────────
  gym: {
    floorColor: "#0a0e1a",
    floorAccent: "rgba(96,165,250,0.04)",
    wallColor: "#070a14",
    gridColor: "rgba(96,165,250,0.06)",
    ambiance: "💪🏋️",
    furniture: [
      // Miroir (haut)
      { kind: "mirror", x: 50, y: 5,   w: 240, h: 18, label: "MIROIR" },
      // Tapis de course (gauche)
      { kind: "treadmill", x: 12, y: 25, w: 44, h: 26 },
      { kind: "treadmill", x: 12, y: 50, w: 44, h: 26 },
      // Haltères (centre gauche)
      { kind: "barbell", x: 30, y: 72,  w: 60,  h: 18, label: "Poids" },
      // Tapis yoga (centre)
      { kind: "mat", x: 55, y: 42,  w: 50,  h: 80 },
      { kind: "mat", x: 70, y: 42,  w: 50,  h: 80 },
      // Bancs
      { kind: "table-rect", x: 82, y: 25, w: 50, h: 20, label: "Banc" },
      { kind: "table-rect", x: 82, y: 48, w: 50, h: 20, label: "Banc" },
      // Rack haltères (droite)
      { kind: "shelf", x: 92, y: 75,  w: 24,  h: 60, label: "Rack" },
      // Plantes
      { kind: "plant", x: 5,  y: 90,  w: 22,  h: 26 },
      { kind: "plant", x: 95, y: 90,  w: 22,  h: 26 },
    ],
    seats: [
      { x: 12, y: 23, action: "exercising" },
      { x: 12, y: 48, action: "exercising" },
      { x: 55, y: 40, action: "exercising" },
      { x: 70, y: 40, action: "idle" },
      { x: 82, y: 23, action: "idle" },
    ]
  },

  // ─── RESTAURANT ──────────────────────────────────────────────────────────
  restaurant: {
    floorColor: "#0e100a",
    floorAccent: "rgba(246,185,79,0.03)",
    wallColor: "#0a0c08",
    gridColor: "rgba(246,185,79,0.04)",
    ambiance: "🍷✨",
    furniture: [
      // Comptoir cuisine (haut)
      { kind: "counter",   x: 50, y: 7,   w: 200, h: 28, label: "Cuisine" },
      // Tables dîner
      { kind: "table-rect", x: 22, y: 32,  w: 64, h: 36 },
      { kind: "table-rect", x: 78, y: 32,  w: 64, h: 36 },
      { kind: "table-rect", x: 22, y: 65,  w: 64, h: 36 },
      { kind: "table-rect", x: 78, y: 65,  w: 64, h: 36 },
      // Chaises
      { kind: "chair", x: 10, y: 30, w: 16, h: 16 },
      { kind: "chair", x: 34, y: 30, w: 16, h: 16 },
      { kind: "chair", x: 66, y: 30, w: 16, h: 16 },
      { kind: "chair", x: 90, y: 30, w: 16, h: 16 },
      { kind: "chair", x: 10, y: 63, w: 16, h: 16 },
      { kind: "chair", x: 34, y: 63, w: 16, h: 16 },
      { kind: "chair", x: 66, y: 63, w: 16, h: 16 },
      { kind: "chair", x: 90, y: 63, w: 16, h: 16 },
      // Décors
      { kind: "plant",  x: 7,  y: 7,  w: 26, h: 30 },
      { kind: "plant",  x: 93, y: 7,  w: 26, h: 30 },
      { kind: "fireplace", x: 50, y: 93, w: 60, h: 22 },
      // Lampes
      { kind: "lamp",   x: 22, y: 48,  w: 12, h: 12 },
      { kind: "lamp",   x: 78, y: 48,  w: 12, h: 12 },
      { kind: "lamp",   x: 22, y: 80,  w: 12, h: 12 },
      { kind: "lamp",   x: 78, y: 80,  w: 12, h: 12 },
    ],
    seats: [
      { x: 22, y: 30, action: "eating" },
      { x: 78, y: 30, action: "eating" },
      { x: 10, y: 28, action: "chatting" },
      { x: 22, y: 63, action: "idle" },
      { x: 90, y: 63, action: "chatting" },
    ]
  },

  // ─── PARK (extérieur) ────────────────────────────────────────────────────
  park: {
    floorColor: "#0a1e0e",
    floorAccent: "rgba(74,222,128,0.04)",
    wallColor: "#071408",
    gridColor: "rgba(74,222,128,0.05)",
    ambiance: "🌿🌳",
    furniture: [
      // Arbres
      { kind: "plant", x: 12,  y: 12,  w: 44,  h: 52 },
      { kind: "plant", x: 88,  y: 12,  w: 44,  h: 52 },
      { kind: "plant", x: 12,  y: 88,  w: 38,  h: 44 },
      { kind: "plant", x: 88,  y: 88,  w: 38,  h: 44 },
      // Fontaine centrale
      { kind: "rug",   x: 50,  y: 50,  w: 70,  h: 70, label: "Fontaine" },
      // Bancs
      { kind: "table-rect", x: 50, y: 25, w: 60, h: 14, label: "Banc" },
      { kind: "table-rect", x: 50, y: 75, w: 60, h: 14, label: "Banc" },
      { kind: "table-rect", x: 20, y: 50, w: 14, h: 50, label: "Banc" },
      { kind: "table-rect", x: 80, y: 50, w: 14, h: 50, label: "Banc" },
      // Lampadaires
      { kind: "lamp",   x: 35,  y: 35,  w: 14,  h: 22 },
      { kind: "lamp",   x: 65,  y: 35,  w: 14,  h: 22 },
      { kind: "lamp",   x: 35,  y: 65,  w: 14,  h: 22 },
      { kind: "lamp",   x: 65,  y: 65,  w: 14,  h: 22 },
    ],
    seats: [
      { x: 50, y: 22, action: "idle" },
      { x: 35, y: 22, action: "chatting" },
      { x: 50, y: 78, action: "walking" },
      { x: 22, y: 45, action: "idle" },
      { x: 78, y: 55, action: "chatting" },
    ]
  },
};

// Fallback si kind non trouvé
const DEFAULT_LAYOUT = LAYOUTS.public;

function getLayout(room: Room): RoomLayout {
  if (room.locationSlug?.includes("gym"))        return LAYOUTS.gym;
  if (room.locationSlug?.includes("restaurant")) return LAYOUTS.restaurant;
  if (room.locationSlug?.includes("park"))       return LAYOUTS.park;
  if (room.kind === "private")                   return LAYOUTS.private;
  if (room.kind === "event")                     return LAYOUTS.event;
  return LAYOUTS.public;
}

// ─── Grille de sol ────────────────────────────────────────────────────────────
function FloorGrid({ color }: { color: string }) {
  const lines: React.ReactElement[] = [];
  const step = 32;
  for (let x = 0; x <= ROOM_W; x += step) {
    lines.push(
      <View key={`v${x}`} style={{
        position: "absolute", left: x, top: 0,
        width: 1, height: ROOM_H, backgroundColor: color
      }} />
    );
  }
  for (let y = 0; y <= ROOM_H; y += step) {
    lines.push(
      <View key={`h${y}`} style={{
        position: "absolute", top: y, left: 0,
        height: 1, width: ROOM_W, backgroundColor: color
      }} />
    );
  }
  return <>{lines}</>;
}

// ─── Pièce de mobilier ────────────────────────────────────────────────────────
function Furniture({ item }: { item: FurnitureItem }) {
  const meta = FURNITURE_META[item.kind];
  const px   = (item.x / 100) * ROOM_W - item.w / 2;
  const py   = (item.y / 100) * ROOM_H - item.h / 2;

  const isLarge = item.kind === "counter" || item.kind === "stage" || item.kind === "mirror" ||
                  item.kind === "sofa"    || item.kind === "seat-row" || item.kind === "rug";

  return (
    <View style={{
      position: "absolute",
      left: px, top: py,
      width: item.w, height: item.h,
      backgroundColor: meta.color,
      borderRadius: item.kind === "table-round" ? item.w / 2
                  : item.kind === "plant"       ? item.w / 2
                  : item.kind === "lamp"        ? item.w / 2
                  : item.kind === "spotlight"   ? item.w / 2
                  : item.kind === "chair"       ? 6
                  : 8,
      borderWidth: isLarge ? 1.5 : 1,
      borderColor: meta.labelColor + "50",
      alignItems: "center",
      justifyContent: "center",
      // Ombre légère
      shadowColor: meta.labelColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    }}>
      {meta.emoji ? (
        <Text style={{ fontSize: item.w < 24 ? 8 : item.w < 40 ? 12 : 16 }}>{meta.emoji}</Text>
      ) : null}
      {item.label && item.w > 40 ? (
        <Text style={{
          color: meta.labelColor, fontSize: 8, fontWeight: "800",
          letterSpacing: 0.5, marginTop: meta.emoji ? 2 : 0
        }} numberOfLines={1}>
          {item.label}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Membre animé ─────────────────────────────────────────────────────────────
function RoomAvatar({
  x, y, name, isMe, visual, action
}: {
  x: number; y: number; name: string;
  isMe?: boolean;
  visual: ReturnType<typeof getNpcVisual>;
  action: AvatarAction;
}) {
  const px = (x / 100) * ROOM_W - 16;
  const py = (y / 100) * ROOM_H - 28;

  // Bulle "en direct"
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    ).start();
  }, []);

  return (
    <View style={{ position: "absolute", left: px, top: py, alignItems: "center", zIndex: 10 }}>
      {/* Badge nom */}
      <Animated.View style={{
        transform: [{ scale: pulseAnim }],
        backgroundColor: isMe ? "rgba(88,214,163,0.25)" : "rgba(255,255,255,0.12)",
        borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 2,
        borderWidth: 1, borderColor: isMe ? "#58d6a3" : "rgba(255,255,255,0.15)"
      }}>
        <Text style={{ color: isMe ? "#58d6a3" : "#f4f7fb", fontSize: 7, fontWeight: "800" }} numberOfLines={1}>
          {name.split(" ")[0]}{isMe ? " ✦" : ""}
        </Text>
      </Animated.View>
      <AvatarSprite visual={visual} action={action} size="xs" />
    </View>
  );
}

// ─── NPC auto-placé ───────────────────────────────────────────────────────────
const NPC_POSITIONS: Record<string, { x: number; y: number; action: AvatarAction }> = {
  ava:   { x: 25, y: 38, action: "chatting" },
  noa:   { x: 75, y: 38, action: "idle"     },
  leila: { x: 50, y: 68, action: "waving"   },
};

// ─── Légende ─────────────────────────────────────────────────────────────────
function Legend({ layout }: { layout: RoomLayout }) {
  const uniqueKinds = [...new Set(layout.furniture.map((f) => f.kind))].slice(0, 5);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 4 }}>
      {uniqueKinds.map((k) => {
        const m = FURNITURE_META[k];
        return (
          <View key={k} style={{
            flexDirection: "row", alignItems: "center", gap: 4,
            backgroundColor: m.color + "80", borderRadius: 6,
            paddingHorizontal: 7, paddingVertical: 3,
            borderWidth: 1, borderColor: m.labelColor + "40"
          }}>
            {m.emoji ? <Text style={{ fontSize: 10 }}>{m.emoji}</Text> : null}
            <Text style={{ color: m.labelColor, fontSize: 9, fontWeight: "700" }}>
              {k.replace(/-/g, " ")}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
type Props = {
  room: Room;
  members: { userId: string; avatarName: string; action: AvatarAction; isOnline: boolean }[];
  myUserId: string;
};

export function RoomTopView({ room, members, myUserId }: Props) {
  const layout   = getLayout(room);
  const myAvatar = useGameStore.getState().avatar;
  const myVisual = myAvatar ? getAvatarVisual(myAvatar) : getNpcVisual("ava");

  // Associer chaque membre à une position assise
  const memberPositions = members.map((m, idx) => {
    const isNpc  = m.userId.startsWith("npc-");
    const npcId  = isNpc ? m.userId.replace("npc-", "") : null;
    const seat   = layout.seats[idx % layout.seats.length];
    const npcPos = npcId ? NPC_POSITIONS[npcId] : null;
    const pos    = npcPos ?? seat;

    return {
      ...m,
      x:      pos?.x ?? 50,
      y:      pos?.y ?? 50,
      action: m.action ?? pos?.action ?? "idle",
      visual: npcId ? getNpcVisual(npcId) : (m.userId === myUserId ? myVisual : getNpcVisual("ava")),
      isMe:   m.userId === myUserId
    };
  });

  return (
    <View style={{ gap: 10 }}>
      {/* Canvas principal */}
      <View style={{
        width: ROOM_W,
        height: ROOM_H,
        alignSelf: "center",
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.1)",
        // Ombre externe
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 12,
      }}>

        {/* Sol */}
        <View style={{ position: "absolute", inset: 0, backgroundColor: layout.floorColor }} />

        {/* Accent de sol */}
        <View style={{
          position: "absolute", inset: 0,
          backgroundColor: layout.floorAccent
        }} />

        {/* Grille */}
        <FloorGrid color={layout.gridColor} />

        {/* Murs (bordures internes épaisses) */}
        <View style={{
          position: "absolute", inset: 0,
          borderWidth: 12,
          borderColor: layout.wallColor,
          borderRadius: 20
        }} />

        {/* Mobilier (rendu bas en haut = z-order correct) */}
        {layout.furniture
          .slice()
          .sort((a, b) => a.y - b.y)
          .map((item, i) => (
            <Furniture key={i} item={item} />
          ))}

        {/* Membres */}
        {memberPositions.map((m) => (
          <RoomAvatar
            key={m.userId}
            x={m.x}
            y={m.y}
            name={m.avatarName}
            isMe={m.isMe}
            visual={m.visual}
            action={m.action}
          />
        ))}

        {/* Overlay ambiance (coin bas droite) */}
        <View style={{
          position: "absolute", bottom: 14, right: 14,
          backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 10,
          paddingHorizontal: 8, paddingVertical: 4
        }}>
          <Text style={{ fontSize: 16 }}>{layout.ambiance}</Text>
        </View>

        {/* Nom de la room */}
        <View style={{
          position: "absolute", top: 14, left: 14,
          backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8,
          paddingHorizontal: 9, paddingVertical: 4,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.12)"
        }}>
          <Text style={{ color: "#f4f7fb", fontSize: 10, fontWeight: "800" }} numberOfLines={1}>
            {room.name}
          </Text>
        </View>

        {/* Indicateur membres live */}
        <View style={{
          position: "absolute", top: 14, right: 14,
          flexDirection: "row", alignItems: "center", gap: 5,
          backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8,
          paddingHorizontal: 9, paddingVertical: 4,
          borderWidth: 1, borderColor: "rgba(56,199,147,0.3)"
        }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#38c793" }} />
          <Text style={{ color: "#38c793", fontSize: 10, fontWeight: "800" }}>
            {members.length} live
          </Text>
        </View>
      </View>

      {/* Légende */}
      <Legend layout={layout} />
    </View>
  );
}
