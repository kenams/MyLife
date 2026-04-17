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
import type { NpcState } from "@/lib/types";
import { useGameStore, worldLocations } from "@/stores/game-store";
import { useWorldPresence } from "@/hooks/use-world-presence";

// ─── Dimensions de la carte 2D ────────────────────────────────────────────────
const SCREEN_W = Dimensions.get("window").width;
const MAP_W = Math.min(SCREEN_W - 24, 560);
const MAP_H = Math.round(MAP_W * 0.72);
const MAP_BASE_W = 380;
const MAP_BASE_H = 270;
const MAP_SX = MAP_W / MAP_BASE_W;
const MAP_SY = MAP_H / MAP_BASE_H;
const IS_WIDE = SCREEN_W >= 720;

const LOCATION_TILES: Record<string, { x: number; y: number; w: number; h: number; color: string; icon: string }> = {
  "home":       { x: 16,  y: 22,  w: 78, h: 64, color: "#1a3a5c", icon: "home"       },
  "market":     { x: 108, y: 18,  w: 76, h: 60, color: "#238b5a", icon: "cart"       },
  "cafe":       { x: 198, y: 24,  w: 78, h: 64, color: "#c96a1d", icon: "cafe"       },
  "office":     { x: 290, y: 18,  w: 76, h: 66, color: "#226da6", icon: "briefcase"  },
  "park":       { x: 18,  y: 172, w: 82, h: 72, color: "#11866f", icon: "leaf"       },
  "gym":        { x: 112, y: 178, w: 76, h: 66, color: "#a92f25", icon: "fitness"    },
  "restaurant": { x: 202, y: 172, w: 86, h: 72, color: "#75339a", icon: "restaurant" },
  "cinema":     { x: 304, y: 172, w: 64, h: 72, color: "#27394d", icon: "film"       }
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
        borderRadius: 14,
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
        <View style={{ position:"absolute", top:0, left:0, right:0, bottom:0, backgroundColor: tile.color + "dd" }} />
        {/* bande toit foncée */}
        <View style={{ position:"absolute", top:0, left:0, right:0, height:"32%", backgroundColor:"rgba(0,0,0,0.35)" }} />
        {/* reflet bas */}
        <View style={{ position:"absolute", bottom:0, left:0, right:0, height:"18%", backgroundColor:"rgba(255,255,255,0.07)" }} />

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
  const avatar              = useGameStore((s) => s.avatar);
  const stats               = useGameStore((s) => s.stats);
  const currentLocationSlug = useGameStore((s) => s.currentLocationSlug);
  const travelTo            = useGameStore((s) => s.travelTo);
  const npcs                = useGameStore((s) => s.npcs);
  const tickNpcs            = useGameStore((s) => s.tickNpcs);
  const conversations       = useGameStore((s) => s.conversations);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);
  const sendMessageStore    = useGameStore((s) => s.sendMessage);

  const { members: livePlayers } = useWorldPresence();
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
  const activeRoomNpc = currentRoomNpcs.find((npc) => npc.id === activeRoomNpcId) ?? currentRoomNpcs[0] ?? null;
  const activeConversation = activeRoomNpc
    ? conversations.find((conversation) => conversation.kind === "direct" && conversation.peerId === activeRoomNpc.id) ?? null
    : null;

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
    if (!activeConversation || !chatDraft.trim()) return;
    sendMessageStore(activeConversation.id, chatDraft);
    setChatDraft("");
  }, [activeConversation?.id, chatDraft, sendMessageStore]);

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
          <View style={{ height: 130, backgroundColor: "#0a1628", position: "relative", overflow: "hidden" }}>
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
          <View style={{ backgroundColor: "#0f1d30", padding: 14, flexDirection:"row", alignItems:"center", gap:12 }}>
            <View style={{ width:42, height:42, borderRadius:21, backgroundColor:"rgba(139,124,255,0.18)", borderWidth:1, borderColor:"rgba(139,124,255,0.4)", alignItems:"center", justifyContent:"center" }}>
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
        <View style={{ flexDirection: IS_WIDE ? "row" : "column", gap: 12, alignItems: IS_WIDE ? "stretch" : "center" }}>
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
            borderColor: activeRoomNpc ? "rgba(56,199,147,0.35)" : "rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 12,
            gap: 10
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>Chat de lieu</Text>
                <Muted>{worldLocations.find((l) => l.slug === currentLocationSlug)?.name ?? "room"}</Muted>
              </View>
              <Ionicons name="chatbubbles" size={22} color={activeRoomNpc ? "#38c793" : colors.muted} />
            </View>

            {activeRoomNpc ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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
                  {(activeConversation?.messages ?? []).slice(-6).map((message) => {
                    const mine = message.authorId === "self";
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
                    placeholder={`Parler a ${activeRoomNpc.name.split(" ")[0]}`}
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

      </View>
    </ScrollView>
  );
}
