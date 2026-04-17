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
const IS_WIDE = SCREEN_W >= 720;
const MAP_W = Math.min(SCREEN_W - 24, IS_WIDE ? 540 : 560);
const MAP_H = IS_WIDE ? Math.min(Math.round(MAP_W * 1.02), Math.max(420, SCREEN_H - 250)) : Math.round(MAP_W * 1.18);
const MAP_BASE_W = 380;
const MAP_BASE_H = 460;
const MAP_SX = MAP_W / MAP_BASE_W;
const MAP_SY = MAP_H / MAP_BASE_H;

const LOCATION_TILES: Record<string, { x: number; y: number; w: number; h: number; color: string; icon: string }> = {
  "home":       { x: 30,  y: 58,  w: 76, h: 68, color: "#1a3a5c", icon: "home"       },
  "market":     { x: 26,  y: 286, w: 86, h: 76, color: "#238b5a", icon: "cart"       },
  "cafe":       { x: 234, y: 84,  w: 78, h: 66, color: "#c96a1d", icon: "cafe"       },
  "office":     { x: 146, y: 170, w: 86, h: 92, color: "#226da6", icon: "briefcase"  },
  "park":       { x: 24,  y: 162, w: 86, h: 78, color: "#11866f", icon: "leaf"       },
  "gym":        { x: 286, y: 300, w: 78, h: 84, color: "#a92f25", icon: "fitness"    },
  "restaurant": { x: 196, y: 330, w: 84, h: 76, color: "#75339a", icon: "restaurant" },
  "cinema":     { x: 300, y: 206, w: 64, h: 76, color: "#27394d", icon: "film"       }
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
        backgroundColor: "rgba(255,255,255,0.45)"
      }}
    />
  );
}

function CityTree({ x, y, size = 12 }: { x: number; y: number; size?: number }) {
  const s = size * MAP_SX;
  return (
    <View style={{ position: "absolute", left: x * MAP_SX, top: y * MAP_SY, width: s, height: s, alignItems: "center", justifyContent: "center" }}>
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

  return (
    <Pressable onPress={onPress} style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h }}>
      <Animated.View style={{
        width: "100%", height: "100%",
        borderRadius: 10,
        borderWidth: isHere ? 2.5 : 1,
        borderColor: isHere ? colors.accent : "rgba(255,255,255,0.14)",
        opacity: glow,
        overflow: "hidden",
        shadowColor: tile.color,
        shadowOpacity: isHere ? 0.7 : 0.3,
        shadowRadius: isHere ? 10 : 4,
        elevation: isHere ? 6 : 2,
      }}>
        {/* fond dégradé */}
        <View style={{ position:"absolute", top:0, left:0, right:0, bottom:0, backgroundColor: tile.color }} />
        {/* bande toit foncée */}
        <View style={{ position:"absolute", top:3, left:3, right:3, bottom:3, borderRadius:8, backgroundColor:"rgba(0,0,0,0.16)", borderWidth:1, borderColor:"rgba(255,255,255,0.10)" }} />
        {/* reflet bas */}
        <View style={{ position:"absolute", top:8, left:8, right:8, height:5, borderRadius:3, backgroundColor:"rgba(255,255,255,0.22)" }} />
        <View style={{ position:"absolute", bottom:7, left:8, right:8, height:5, borderRadius:3, backgroundColor:"rgba(0,0,0,0.24)" }} />
        {[0, 1, 2].map((row) => (
          <View key={row} style={{ position:"absolute", left:10, right:10, top:22 + row * 13, flexDirection:"row", justifyContent:"space-between" }}>
            {[0, 1, 2].map((col) => (
              <View key={col} style={{ width:5, height:5, borderRadius:1.5, backgroundColor: (row + col) % 2 === 0 ? "rgba(255,235,157,0.68)" : "rgba(210,238,255,0.32)" }} />
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

        {/* contenu */}
        <View style={{ flex:1, padding: 7, justifyContent:"space-between" }}>
          <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
            <View style={{ backgroundColor:"rgba(0,0,0,0.3)", borderRadius:8, padding:3 }}>
              <Ionicons name={tile.icon as never} size={16} color="#fff" />
            </View>
            {(npcCount > 0 || onlineCount > 0) && (
              <View style={{ backgroundColor: onlineCount>0 ? "#38c793" : "rgba(255,255,255,0.25)", borderRadius: 9, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ color: onlineCount>0?"#07111f":"#fff", fontSize: 9, fontWeight: "900" }}>
                  {onlineCount > 0 ? `${onlineCount}🟢` : `${npcCount}`}
                </Text>
              </View>
            )}
          </View>
          <View>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color:"#fff", fontSize:11, fontWeight:"900", textShadowColor:"rgba(0,0,0,0.5)", textShadowOffset:{width:0,height:1}, textShadowRadius:2 }}>
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
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{cityName}</Text>
            <Muted>{npcs.length} résidents actifs{livePlayers.length > 0 ? ` · ${livePlayers.length} en ligne` : ""}</Muted>
          </View>
          <Pressable
            onPress={() => router.push("/(app)/rooms")}
            style={{ backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="people" size={14} color="#07111f" />
            <Text style={{ color: "#07111f", fontWeight: "800", fontSize: 13 }}>Rooms live</Text>
          </Pressable>
        </View>

        {/* Hero — World Live */}
        <Pressable
          onPress={() => router.push("/(app)/world-live")}
          style={{
            borderRadius: 20,
            overflow: "hidden",
            borderWidth: 1.5,
            borderColor: "rgba(139,124,255,0.5)",
            shadowColor: "#8b7cff",
            shadowOpacity: 0.4,
            shadowRadius: 18,
            elevation: 8,
          }}
        >
          {/* Fond ville miniature */}
          <View style={{ height: IS_WIDE ? 86 : 130, backgroundColor: "#0a1628", position: "relative", overflow: "hidden" }}>
            {/* Ciel gradient */}
            <View style={{ position: "absolute", inset: 0, backgroundColor: "#0d1e3a" }} />
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, backgroundColor: "#1a2d4a", opacity: 0.7 }} />
            {/* Étoiles */}
            {[10,22,38,55,70,83,95,18,42,65,78,90].map((x, i) => (
              <View key={i} style={{ position:"absolute", left:`${x}%`, top: (i % 3) * 14 + 5, width: i%5===0?3:2, height:i%5===0?3:2, borderRadius:2, backgroundColor: "rgba(255,255,255,0.7)" }} />
            ))}
            {/* Immeubles silhouette */}
            {[
              {l:2,  w:22, h:70,  c:"#112240"},
              {l:26, w:18, h:90,  c:"#0e1e36"},
              {l:46, w:28, h:55,  c:"#1a2d4a"},
              {l:50, w:14, h:105, c:"#0c1928"},
              {l:66, w:22, h:75,  c:"#112240"},
              {l:75, w:16, h:60,  c:"#0e1e36"},
              {l:90, w:20, h:85,  c:"#0c1928"},
            ].map((b, i) => (
              <View key={i} style={{ position:"absolute", left:`${b.l}%`, bottom:0, width:b.w, height:b.h, backgroundColor:b.c, borderTopLeftRadius:3, borderTopRightRadius:3 }}>
                {/* Fenêtres allumées */}
                {[0,1,2,3].map(row => (
                  <View key={row} style={{ flexDirection:"row", gap:3, padding:3, marginTop: row * 14 + 6 }}>
                    {[0,1].map(col => (
                      <View key={col} style={{ width:5, height:5, borderRadius:1, backgroundColor:(i+row+col)%3===0?"rgba(255,190,60,0.8)":"rgba(200,230,255,0.15)" }} />
                    ))}
                  </View>
                ))}
              </View>
            ))}
            {/* Route */}
            <View style={{ position:"absolute", bottom:0, left:0, right:0, height:22, backgroundColor:"#1a2030" }}>
              {[0,0.12,0.24,0.36,0.48,0.60,0.72,0.84].map((x,i) => (
                <View key={i} style={{ position:"absolute", left:`${x*100+4}%`, top:9, width:"8%", height:3, backgroundColor:"rgba(251,191,36,0.35)" }} />
              ))}
            </View>
            {/* NPCs dots animés */}
            {([{x:"18%",y:55,c:"#38c793"},{x:"38%",y:62,c:"#f6b94f"},{x:"60%",y:50,c:"#c084fc"},{x:"80%",y:58,c:"#fb7185"}] as {x:`${number}%`,y:number,c:string}[]).map((d,i) => (
              <View key={i} style={{ position:"absolute", left:d.x, top:d.y, width:8, height:8, borderRadius:4, backgroundColor:d.c, borderWidth:1.5, borderColor:"#fff" }} />
            ))}
            {/* Lampadaires */}
            {[15,35,55,75,92].map((x,i) => (
              <View key={i} style={{ position:"absolute", left:`${x}%`, bottom:22 }}>
                <View style={{ width:2, height:20, backgroundColor:"#4a5568", marginLeft:3 }} />
                <View style={{ width:8, height:8, borderRadius:4, backgroundColor:"rgba(255,220,80,0.8)", marginLeft:0 }} />
              </View>
            ))}
            {/* Badge LIVE */}
            <View style={{ position:"absolute", top:10, right:12, backgroundColor:"#ef4444", borderRadius:8, paddingHorizontal:8, paddingVertical:3, flexDirection:"row", alignItems:"center", gap:4 }}>
              <View style={{ width:6, height:6, borderRadius:3, backgroundColor:"#fff" }} />
              <Text style={{ color:"#fff", fontSize:10, fontWeight:"900" }}>LIVE</Text>
            </View>
          </View>

          {/* CTA bas */}
          <View style={{ backgroundColor: "#0f1d30", padding: IS_WIDE ? 10 : 14, flexDirection:"row", alignItems:"center", gap:12 }}>
            <View style={{ width: IS_WIDE ? 34 : 42, height: IS_WIDE ? 34 : 42, borderRadius:21, backgroundColor:"rgba(139,124,255,0.18)", borderWidth:1, borderColor:"rgba(139,124,255,0.4)", alignItems:"center", justifyContent:"center" }}>
              <Text style={{ fontSize: 20 }}>🗺️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#d0c8ff", fontWeight: "900", fontSize: 15 }}>Ville Interactive</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Explore, déplace-toi, interagis avec les résidents</Text>
            </View>
            <View style={{ backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: "#07111f", fontWeight: "900", fontSize: 13 }}>Ouvrir →</Text>
            </View>
          </View>
        </Pressable>

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
          {/* fond herbe */}
          <View style={{ position:"absolute", inset:0, backgroundColor:"#0d2010", opacity:0.6 }} />
          {/* routes horizontales */}
          <View style={{ position:"absolute", left:0, right:0, top:MAP_H*0.40, height:28, backgroundColor:"rgba(26,33,48,0.95)" }} />
          <View style={{ position:"absolute", left:0, right:0, top:MAP_H*0.40+13, height:2, borderStyle:"dashed", borderWidth:0, backgroundColor:"transparent" }} />
          {/* lignes pointillées route */}
          {[0,0.10,0.20,0.30,0.40,0.55,0.65,0.75,0.85].map((x,i) => (
            <View key={i} style={{ position:"absolute", left:MAP_W*x, top:MAP_H*0.413, width:MAP_W*0.07, height:2, backgroundColor:"rgba(251,191,36,0.4)" }} />
          ))}
          {/* route verticale */}
          <View style={{ position:"absolute", left:MAP_W*0.47, top:0, bottom:0, width:22, backgroundColor:"rgba(26,33,48,0.9)" }} />
          {[0,0.10,0.20,0.30,0.55,0.65,0.75,0.85,0.95].map((y,i) => (
            <View key={i} style={{ position:"absolute", left:MAP_W*0.479, top:MAP_H*y, width:2, height:MAP_H*0.07, backgroundColor:"rgba(251,191,36,0.4)" }} />
          ))}
          {/* place centrale */}
          <View style={{ position:"absolute", left:MAP_W*0.12, right:MAP_W*0.12, top:MAP_H*0.47, height:50, borderRadius:25, backgroundColor:"rgba(56,199,147,0.10)", borderWidth:1, borderColor:"rgba(56,199,147,0.2)" }}>
            <Text style={{ position:"absolute", left:0, right:0, top:16, textAlign:"center", color:"#8ee0bd", fontSize:11, fontWeight:"900" }}>⛲ Place centrale</Text>
          </View>
          <View style={{ position:"absolute", inset:0, backgroundColor:"#9bb98f" }} />
          <View style={{ position:"absolute", left:210 * MAP_SX, right:0, top:0, height:92 * MAP_SY, backgroundColor:"#1784a2" }} />
          <View style={{ position:"absolute", left:250 * MAP_SX, right:0, bottom:0, height:96 * MAP_SY, backgroundColor:"#0f7892" }} />
          <View style={{ position:"absolute", left:226 * MAP_SX, top:76 * MAP_SY, width:164 * MAP_SX, height:18 * MAP_SY, backgroundColor:"#d6c7a4", transform:[{ rotate:"-8deg" }] }} />
          <View style={{ position:"absolute", left:270 * MAP_SX, bottom:82 * MAP_SY, width:128 * MAP_SX, height:18 * MAP_SY, backgroundColor:"#d6c7a4", transform:[{ rotate:"6deg" }] }} />
          <Cloud x={18} y={16} scale={0.9} />
          <Cloud x={300} y={116} scale={0.72} />
          <Birds x={244} y={26} />

          <View style={{ position:"absolute", left:0, right:0, top:130 * MAP_SY, height:34 * MAP_SY, backgroundColor:"#2d3238" }} />
          <View style={{ position:"absolute", left:0, right:0, top:270 * MAP_SY, height:34 * MAP_SY, backgroundColor:"#2d3238" }} />
          <View style={{ position:"absolute", left:120 * MAP_SX, top:0, bottom:0, width:24 * MAP_SX, backgroundColor:"#2d3238" }} />
          <View style={{ position:"absolute", left:240 * MAP_SX, top:0, bottom:0, width:24 * MAP_SX, backgroundColor:"#2d3238" }} />
          <View style={{ position:"absolute", left:0, top:390 * MAP_SY, width:300 * MAP_SX, height:34 * MAP_SY, backgroundColor:"#2d3238", transform:[{ rotate:"-10deg" }] }} />

          {[0, 44, 88, 154, 198, 286, 330].map((x) => <RoadLine key={`r1-${x}`} x={x} y={146} w={22} h={3} />)}
          {[12, 56, 100, 164, 208, 284, 328].map((x) => <RoadLine key={`r2-${x}`} x={x} y={286} w={22} h={3} />)}
          {[8, 56, 184, 330, 392].map((y) => <RoadLine key={`v1-${y}`} x={131} y={y} w={3} h={22} />)}
          {[10, 58, 184, 330, 392].map((y) => <RoadLine key={`v2-${y}`} x={251} y={y} w={3} h={22} />)}
          <Crosswalk x={112} y={126} horizontal />
          <Crosswalk x={232} y={268} horizontal />
          <Crosswalk x={122} y={300} horizontal={false} />
          <Crosswalk x={242} y={164} horizontal={false} />

          <View style={{ position:"absolute", left:152 * MAP_SX, top:270 * MAP_SY, width:82 * MAP_SX, height:82 * MAP_SY, borderRadius:42 * MAP_SX, backgroundColor:"#2b3338", alignItems:"center", justifyContent:"center" }}>
            <View style={{ width:60 * MAP_SX, height:60 * MAP_SX, borderRadius:30 * MAP_SX, backgroundColor:"#7fa455", alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:30 * MAP_SX, height:30 * MAP_SX, borderRadius:15 * MAP_SX, backgroundColor:"#75c9ed", borderWidth:2, borderColor:"rgba(255,255,255,0.62)" }} />
            </View>
            <Text style={{ position:"absolute", bottom:8, color:"#f2ffe9", fontSize:9, fontWeight:"900" }}>Fontaine</Text>
          </View>

          <FerrisWheel x={282} y={28} size={46} />
          <DecoBuilding x={8} y={20} w={72} h={44} color="#7b604e" label="INDUS" />
          <DecoBuilding x={86} y={14} w={42} h={40} color="#9a7558" />
          <DecoBuilding x={152} y={34} w={44} h={46} color="#d6b27c" />
          <DecoBuilding x={12} y={370} w={76} h={50} color="#c74d3a" label="MALL" windows={false} />
          <DecoBuilding x={96} y={348} w={44} h={58} color="#34495e" />
          <DecoBuilding x={142} y={342} w={42} h={64} color="#2f6d85" />
          <DecoBuilding x={274} y={388} w={72} h={48} color="#44606a" label="PORT" />
          <View style={{ position:"absolute", left:292 * MAP_SX, top:332 * MAP_SY, width:78 * MAP_SX, height:46 * MAP_SY, borderRadius:38, backgroundColor:"#36424c", borderWidth:6, borderColor:"#6f7d86", alignItems:"center", justifyContent:"center" }}>
            <View style={{ width:50 * MAP_SX, height:24 * MAP_SY, borderRadius:24, backgroundColor:"#67b56b", borderWidth:2, borderColor:"rgba(255,255,255,0.35)" }} />
          </View>

          {[18, 44, 88, 332, 354, 18, 54, 214, 280, 352, 148, 236, 258, 92, 182].map((x, i) => (
            <CityTree key={`tree-${i}`} x={x} y={[172, 158, 176, 112, 126, 250, 248, 108, 160, 186, 314, 246, 250, 430, 420][i]} size={i % 3 === 0 ? 14 : 11} />
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
