import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { Button, Card, Muted, Pill, SectionTitle } from "@/components/ui";
import type { AvatarAction } from "@/lib/avatar-visual";
import { ACTION_COLORS, ACTION_LABELS, getAvatarVisual, getNpcVisual } from "@/lib/avatar-visual";
import { cityName } from "@/lib/game-data";
import { LOCATION_COORDS, tickAllNpcs } from "@/lib/npc-brain";
import { getNpcStatusLine, getNpcMoodEmoji } from "@/lib/npc-ai";
import { colors } from "@/lib/theme";
import type { LifeActionId, NpcState, WorldPresenceMember } from "@/lib/types";
import { useGameStore, worldLocations } from "@/stores/game-store";
import { useLocationChat } from "@/hooks/use-location-chat";
import { useWorldPresence } from "@/hooks/use-world-presence";

// ─── Dimensions de la carte 2D ────────────────────────────────────────────────
const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const IS_WIDE = SCREEN_W >= 1360;
const MAP_W = Math.min(SCREEN_W - 24, IS_WIDE ? Math.min(Math.max(660, SCREEN_W * 0.5), 860) : 620);
const MAP_H = IS_WIDE ? Math.min(Math.round(MAP_W * 0.82), Math.max(540, SCREEN_H - 190)) : Math.round(MAP_W * 1.04);
const MAP_BASE_W = 380;
const MAP_BASE_H = 460;
const MAP_SX = MAP_W / MAP_BASE_W;
const MAP_SY = MAP_H / MAP_BASE_H;

const LOCATION_TILES: Record<string, { x: number; y: number; w: number; h: number; color: string; icon: string }> = {
  "home":       { x: 22,  y: 50,  w: 92,  h: 80, color: "#245c8f", icon: "home"       },
  "market":     { x: 18,  y: 286, w: 104, h: 82, color: "#2f9e62", icon: "cart"       },
  "cafe":       { x: 262, y: 66,  w: 86,  h: 78, color: "#d97328", icon: "cafe"       },
  "office":     { x: 146, y: 166, w: 94,  h: 104, color: "#2d7ec2", icon: "briefcase"  },
  "park":       { x: 18,  y: 164, w: 96,  h: 88, color: "#15936e", icon: "leaf"       },
  "gym":        { x: 282, y: 300, w: 88,  h: 90, color: "#c23c32", icon: "fitness"    },
  "restaurant": { x: 188, y: 328, w: 92,  h: 86, color: "#8140aa", icon: "restaurant" },
  "cinema":     { x: 294, y: 202, w: 76,  h: 84, color: "#33465e", icon: "film"       }
};

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
        backgroundColor: "#263039",
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

const INTERIORS: Record<string, { title: string; tone: string; actions: string[] }> = {
  home: {
    title: "Intérieur maison",
    tone: "Repos, cuisine, dressing et reset des besoins.",
    actions: ["Dormir", "Cuisiner", "Changer de style"]
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
        <View style={{ backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 5, paddingHorizontal: 3, flexDirection: "row", alignItems: "center", gap: 1 }}>
          <Text style={{ fontSize: 6 }}>{actionIcon}</Text>
          <Text style={{ color: "#fff", fontSize: 7, fontWeight: "700" }}>{npc.name.split(" ")[0]}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Tuile de lieu ────────────────────────────────────────────────────────────
function LocationTile({
  slug, tile, label, isHere, npcCount, onlineCount, onPress
}: {
  slug: string;
  tile: (typeof LOCATION_TILES)[string];
  label: string;
  isHere: boolean;
  npcCount: number;
  onlineCount: number;
  onPress: () => void;
}) {
  const glow = useRef(new Animated.Value(0.6)).current;
  const box = scaleTile(tile);

  useEffect(() => {
    if (isHere) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.6, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      glow.setValue(0.6);
    }
  }, [isHere]);

  const buildingHeight = Math.max(9, box.h * 0.12);

  return (
    <Pressable onPress={onPress} style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h + buildingHeight + 8 }}>
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
        borderRadius: 14,
        borderWidth: isHere ? 3 : 1.5,
        borderColor: isHere ? colors.accent : "rgba(255,255,255,0.24)",
        opacity: glow,
        overflow: "hidden",
        shadowColor: tile.color,
        shadowOpacity: isHere ? 0.85 : 0.42,
        shadowRadius: isHere ? 14 : 6,
        elevation: isHere ? 6 : 2,
      }}>
        <View style={{ position:"absolute", top:0, left:0, right:0, bottom:0, backgroundColor: tile.color }} />
        <View style={{ position:"absolute", top:0, left:0, right:0, height: Math.max(16, box.h * 0.22), backgroundColor:"rgba(255,255,255,0.18)" }} />
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
        {slug === "park" && (
          <>
            <View style={{ position:"absolute", left:8, top:12, width:16, height:16, borderRadius:8, backgroundColor:"#2ca65a" }} />
            <View style={{ position:"absolute", right:8, bottom:14, width:18, height:18, borderRadius:9, backgroundColor:"#38c793" }} />
            <View style={{ position:"absolute", left:"38%", top:"34%", width:22, height:22, borderRadius:11, backgroundColor:"rgba(88,178,255,0.50)", borderWidth:1, borderColor:"rgba(255,255,255,0.35)" }} />
          </>
        )}

        <View style={{ flex:1, padding: 8, justifyContent:"space-between" }}>
          <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
            <View style={{ backgroundColor:"rgba(0,0,0,0.46)", borderRadius:11, padding:5, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" }}>
              <Ionicons name={tile.icon as never} size={19} color="#fff" />
            </View>
            {(npcCount > 0 || onlineCount > 0) && (
              <View style={{ backgroundColor: onlineCount>0 ? "#38c793" : "rgba(255,255,255,0.28)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
                <Text style={{ color: onlineCount>0?"#07111f":"#fff", fontSize: 10, fontWeight: "900" }}>
                  {onlineCount > 0 ? `${onlineCount}🟢` : `${npcCount}`}
                </Text>
              </View>
            )}
          </View>
          <View style={{ backgroundColor: "rgba(5,10,18,0.82)", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: isHere ? colors.accent : "rgba(255,255,255,0.22)" }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color:"#fff", fontSize:13, fontWeight:"900", textShadowColor:"rgba(0,0,0,0.75)", textShadowOffset:{width:0,height:1}, textShadowRadius:2 }}>
              {label}
            </Text>
            {isHere && (
              <Text style={{ color:"#8ee0bd", fontSize:9, fontWeight:"700" }}>📍 Tu es ici</Text>
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
  const npcs                = useGameStore((s) => s.npcs);
  const tickNpcs            = useGameStore((s) => s.tickNpcs);
  const conversations       = useGameStore((s) => s.conversations);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);
  const sendMessageStore    = useGameStore((s) => s.sendMessage);
  const performAction       = useGameStore((s) => s.performAction);
  const dailyGoals          = useGameStore((s) => s.dailyGoals);

  const { members: realLivePlayers } = useWorldPresence();
  const [simulatedPlayers, setSimulatedPlayers] = useState<WorldPresenceMember[]>([]);
  const livePlayers = [...realLivePlayers, ...simulatedPlayers];
  const locationChat = useLocationChat(currentLocationSlug, livePlayers);
  const [selectedNpc, setSelectedNpc] = useState<NpcState | null>(null);
  const [activeRoomNpcId, setActiveRoomNpcId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");

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

  const enterLocation = useCallback((slug: string) => {
    travelTo(slug);
    const residents = npcsByLoc[slug] ?? [];
    setActiveRoomNpcId(residents[0]?.id ?? null);
    setSelectedNpc(null);
    setChatDraft("");
  }, [npcsByLoc, travelTo]);

  const sendRoomMessage = useCallback(() => {
    const cleanDraft = chatDraft.trim();
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
      setChatDraft("");
      return;
    }
    if (!activeConversation) return;
    sendMessageStore(activeConversation.id, cleanDraft);
    setChatDraft("");
  }, [activeConversation?.id, avatar?.displayName, chatDraft, currentLocationSlug, hasLiveLocationChat, locationChat.addLocalMessage, locationChat.sendMessage, sendMessageStore, session?.email, simulatedPlayers]);

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
        {worldLocations.map((loc) => {
          const isHere = loc.slug === currentLocationSlug;
          const npcHere = npcsByLoc[loc.slug]?.length ?? 0;
          const onlineHere = onlineCounts[loc.slug] ?? 0;
          const tile = LOCATION_TILES[loc.slug];
          return (
            <Pressable
              key={loc.slug}
              onPress={() => !isHere && enterLocation(loc.slug)}
              style={{
                width: IS_WIDE ? "48%" : "47%",
                minHeight: 64,
                padding: 10,
                borderRadius: 12,
                backgroundColor: isHere ? "rgba(139,124,255,0.16)" : "rgba(255,255,255,0.045)",
                borderWidth: 1,
                borderColor: isHere ? colors.accent : "rgba(255,255,255,0.08)",
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
              {isHere && <Text style={{ color: colors.accent, fontSize: 9, fontWeight: "700" }}>Tu es ici</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

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
        <Muted>Personne ici pour le moment.</Muted>
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
      <Muted>{interior.tone}</Muted>
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#07111f" }} showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, gap: 20, paddingBottom: 40 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <View>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 21 }}>World Map</Text>
            <Muted>{cityName} · clique un bâtiment pour entrer</Muted>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/(app)/rooms")}
              style={{ backgroundColor: colors.accent, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="people" size={14} color="#07111f" />
              <Text style={{ color: "#07111f", fontWeight: "900", fontSize: 12 }}>Rooms</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(app)/world-live")}
              style={{ backgroundColor: "rgba(139,124,255,0.18)", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(139,124,255,0.35)" }}
            >
              <Ionicons name="radio" size={14} color="#d0c8ff" />
              <Text style={{ color: "#d0c8ff", fontWeight: "900", fontSize: 12 }}>Live</Text>
            </Pressable>
          </View>
        </View>

        {/* Carte 2D + chat de lieu */}
        <View style={{ width: "100%", flexDirection: IS_WIDE ? "row" : "column", gap: 12, alignItems: IS_WIDE ? "stretch" : "center" }}>
        <View style={{
          width: MAP_W, height: MAP_H,
          backgroundColor: "#0d1f32",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
          overflow: "hidden",
          alignSelf: "center",
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 5
        }}>
          {/* base quartiers */}
          <View style={{ position:"absolute", inset:0, backgroundColor:"#b7d0a3" }} />
          <View style={{ position:"absolute", left:0, top:0, width:126 * MAP_SX, height:132 * MAP_SY, backgroundColor:"#a6c69c" }} />
          <View style={{ position:"absolute", left:132 * MAP_SX, top:0, width:88 * MAP_SX, height:132 * MAP_SY, backgroundColor:"#9fc1d0" }} />
          <View style={{ position:"absolute", left:0, top:164 * MAP_SY, width:126 * MAP_SX, height:106 * MAP_SY, backgroundColor:"#8fc688" }} />
          <View style={{ position:"absolute", left:264 * MAP_SX, top:164 * MAP_SY, width:116 * MAP_SX, height:120 * MAP_SY, backgroundColor:"#b8cbb4" }} />
          <View style={{ position:"absolute", left:0, top:304 * MAP_SY, width:150 * MAP_SX, height:156 * MAP_SY, backgroundColor:"#87bd78" }} />
          <View style={{ position:"absolute", left:144 * MAP_SX, top:304 * MAP_SY, width:136 * MAP_SX, height:156 * MAP_SY, backgroundColor:"#a69dbe" }} />

          {/* eau et quais */}
          <View style={{ position:"absolute", left:210 * MAP_SX, right:0, top:0, height:92 * MAP_SY, backgroundColor:"#1488a8" }} />
          <View style={{ position:"absolute", left:250 * MAP_SX, right:0, bottom:0, height:96 * MAP_SY, backgroundColor:"#0f7892" }} />
          <View style={{ position:"absolute", left:226 * MAP_SX, top:76 * MAP_SY, width:164 * MAP_SX, height:20 * MAP_SY, backgroundColor:"#d9c79c", borderWidth: 1, borderColor: "rgba(96,66,32,0.18)", transform:[{ rotate:"-8deg" }] }} />
          <View style={{ position:"absolute", left:270 * MAP_SX, bottom:82 * MAP_SY, width:128 * MAP_SX, height:20 * MAP_SY, backgroundColor:"#d9c79c", borderWidth: 1, borderColor: "rgba(96,66,32,0.18)", transform:[{ rotate:"6deg" }] }} />
          {[235, 278, 322, 354].map((x, i) => (
            <View key={`dock-${i}`} style={{ position:"absolute", left:x * MAP_SX, top:(i % 2 === 0 ? 86 : 80) * MAP_SY, width:24 * MAP_SX, height:5 * MAP_SY, backgroundColor:"#8a6a43", transform:[{ rotate:"-8deg" }] }} />
          ))}
          <Text style={{ position:"absolute", right:16, top:22 * MAP_SY, color:"#e5fbff", fontSize:12, fontWeight:"900", textShadowColor:"rgba(0,0,0,0.35)", textShadowRadius:2 }}>Port</Text>

          <Cloud x={18} y={16} scale={0.9} />
          <Cloud x={300} y={116} scale={0.72} />
          <Birds x={244} y={26} />

          {/* routes principales */}
          <Road x={0} y={130} w={380} h={36} horizontal />
          <Road x={0} y={270} w={380} h={36} horizontal />
          <Road x={120} y={0} w={26} h={460} horizontal={false} />
          <Road x={240} y={0} w={26} h={460} horizontal={false} />
          <View style={{ position:"absolute", left:0, top:390 * MAP_SY, width:300 * MAP_SX, height:36 * MAP_SY, backgroundColor:"#263039", borderWidth:1, borderColor:"rgba(255,255,255,0.08)", transform:[{ rotate:"-10deg" }] }} />

          {[0, 44, 88, 154, 198, 286, 330].map((x) => <RoadLine key={`r1-${x}`} x={x} y={146} w={22} h={3} />)}
          {[12, 56, 100, 164, 208, 284, 328].map((x) => <RoadLine key={`r2-${x}`} x={x} y={286} w={22} h={3} />)}
          {[8, 56, 184, 330, 392].map((y) => <RoadLine key={`v1-${y}`} x={131} y={y} w={3} h={22} />)}
          {[10, 58, 184, 330, 392].map((y) => <RoadLine key={`v2-${y}`} x={251} y={y} w={3} h={22} />)}
          <Crosswalk x={112} y={126} horizontal />
          <Crosswalk x={232} y={268} horizontal />
          <Crosswalk x={122} y={300} horizontal={false} />
          <Crosswalk x={242} y={164} horizontal={false} />

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

          <FerrisWheel x={282} y={28} size={46} />
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

          {/* Tuiles */}
          {Object.entries(LOCATION_TILES).map(([slug, tile]) => (
            <LocationTile
              key={slug}
              slug={slug}
              tile={tile}
              label={worldLocations.find((item) => item.slug === slug)?.name ?? slug}
              isHere={currentLocationSlug === slug}
              npcCount={npcsByLoc[slug]?.length ?? 0}
              onlineCount={onlineCounts[slug] ?? 0}
              onPress={() => enterLocation(slug)}
            />
          ))}

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
              <View style={{ position: "absolute", left: box.x + box.w / 2 - 16, top: box.y + 8 }}>
                <AvatarSprite visual={playerVisual} action={playerAction} size="xs" />
                <View style={{ backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 4 }}>
                  <Text style={{ color: "#07111f", fontSize: 8, fontWeight: "900" }}>Toi</Text>
                </View>
              </View>
            );
          })()}

          {/* HUD lisible façon town map */}
          <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, top: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <View style={{
              maxWidth: MAP_W * 0.48,
              backgroundColor: "rgba(7,17,31,0.88)",
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)"
            }}>
              <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "900" }}>Ville interactive</Text>
              <Text style={{ color: "rgba(226,232,240,0.78)", fontSize: 10, marginTop: 2 }}>
                Clique un immeuble pour entrer
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <MapBadge icon="📍" label="lieu actuel" value={worldLocations.find((l) => l.slug === currentLocationSlug)?.name ?? "Ville"} color={colors.accent} />
              <MapBadge icon="👥" label="résidents" value={`${npcs.length}`} color="#f6b94f" />
              <MapBadge icon="🟢" label="en ligne" value={`${livePlayers.length}`} color="#38c793" />
            </View>
          </View>

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
              { dot: "#38c793", label: "Joueur live" },
              { dot: "#f6b94f", label: "Résident" }
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.dot }} />
                <Text style={{ color: "#e5edf7", fontSize: 10, fontWeight: "800" }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

          <View style={{
            width: IS_WIDE ? 310 : MAP_W,
            minHeight: IS_WIDE ? MAP_H : 210,
            backgroundColor: "rgba(255,255,255,0.055)",
            borderWidth: 1,
            borderColor: hasLiveLocationChat || activeRoomNpc ? "rgba(56,199,147,0.35)" : "rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 12,
            gap: 10
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>Chat de lieu</Text>
                <Muted>
                  {worldLocations.find((l) => l.slug === currentLocationSlug)?.name ?? "room"}
                  {hasLiveLocationChat ? ` · live ${locationChat.connected ? "connecté" : "connexion"}` : ""}
                </Muted>
              </View>
              <Ionicons name="chatbubbles" size={22} color={hasLiveLocationChat || activeRoomNpc ? "#38c793" : colors.muted} />
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
                        backgroundColor: activeRoomNpc.id === npc.id ? "rgba(56,199,147,0.18)" : "rgba(255,255,255,0.06)",
                        borderWidth: 1,
                        borderColor: activeRoomNpc.id === npc.id ? "#38c793" : "rgba(255,255,255,0.08)"
                      }}
                    >
                      <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action} size="xs" />
                      <Text style={{ color: activeRoomNpc.id === npc.id ? "#8ee0bd" : colors.text, fontSize: 11, fontWeight: "800" }}>
                        {npc.name.split(" ")[0]}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <ScrollView style={{ maxHeight: IS_WIDE ? MAP_H - 190 : 120 }} contentContainerStyle={{ gap: 8 }}>
                  {visibleRoomMessages.slice(-6).map((message) => {
                    const mine = message.authorId === "self" || message.authorId === session?.email;
                    return (
                      <View
                        key={message.id}
                        style={{
                          alignSelf: mine ? "flex-end" : "flex-start",
                          maxWidth: "86%",
                          backgroundColor: mine ? colors.accent : "rgba(255,255,255,0.09)",
                          borderRadius: 12,
                          paddingHorizontal: 10,
                          paddingVertical: 7
                        }}
                      >
                        {!mine && (
                          <Text style={{ color: "#8ee0bd", fontSize: 9, fontWeight: "900", marginBottom: 2 }}>
                            {"authorName" in message ? message.authorName : activeRoomNpc?.name ?? "Résident"}
                          </Text>
                        )}
                        <Text style={{ color: mine ? "#07111f" : colors.text, fontSize: 12, fontWeight: mine ? "800" : "600" }}>
                          {message.body}
                        </Text>
                      </View>
                    );
                  })}
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
              <View style={{ flex: 1, minHeight: 120, alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Ionicons name="person-outline" size={28} color={colors.muted} />
                <Muted>Personne ici pour le moment.</Muted>
              </View>
            )}
          </View>

          {IS_WIDE && (
            <View style={{ flex: 1, minWidth: 300, maxWidth: 520, gap: 12 }}>
              {travelMenu}
              {dailyMissionPanel}
              {locationInterior}
              {residentsHere}
              {liveTestPanel}
            </View>
          )}
        </View>

        {/* Panel NPC */}
        {selectedNpc && (
          <Card>
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
          </Card>
        )}

        {/* Avatar joueur */}
        {playerVisual && (
          <Card>
            <SectionTitle>Ton avatar</SectionTitle>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <AvatarSprite visual={playerVisual} action={playerAction} size="md" />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{avatar?.displayName}</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Pill>Énergie {stats.energy}</Pill>
                  <Pill tone={stats.mood > 50 ? "accent" : "warning"}>Humeur {stats.mood}</Pill>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACTION_COLORS[playerAction] }} />
                  <Muted>{ACTION_LABELS[playerAction]}</Muted>
                </View>
              </View>
            </View>
          </Card>
        )}

        {!IS_WIDE && (
        <>
        {/* Résidents ici */}
        <Card>
          <SectionTitle>
            Ici — {worldLocations.find((l) => l.slug === currentLocationSlug)?.name ?? "lieu courant"}
          </SectionTitle>
          {(npcsByLoc[currentLocationSlug] ?? []).length === 0 && livePlayers.filter((p) => p.locationSlug === currentLocationSlug).length === 0 ? (
            <Muted>Personne ici pour le moment.</Muted>
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
        </Card>
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
        <SectionTitle>Se déplacer</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {worldLocations.map((loc) => {
            const isHere     = loc.slug === currentLocationSlug;
            const npcHere    = npcsByLoc[loc.slug]?.length ?? 0;
            const onlineHere = onlineCounts[loc.slug] ?? 0;
            const tile       = LOCATION_TILES[loc.slug];
            return (
              <Pressable
                key={loc.slug}
                onPress={() => !isHere && enterLocation(loc.slug)}
                style={{
                  width: "47%",
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: isHere ? "rgba(139,124,255,0.12)" : "rgba(255,255,255,0.04)",
                  borderWidth: 1,
                  borderColor: isHere ? colors.accent : "rgba(255,255,255,0.08)",
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
                {isHere && <Text style={{ color: colors.accent, fontSize: 10 }}>Tu es ici</Text>}
              </Pressable>
            );
          })}
        </View>
        </>
        )}

      </View>
    </ScrollView>
  );
}
