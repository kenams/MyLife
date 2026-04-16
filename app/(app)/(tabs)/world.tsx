import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { Button, Card, Muted, Pill, SectionTitle } from "@/components/ui";
import type { AvatarAction } from "@/lib/avatar-visual";
import { ACTION_COLORS, ACTION_LABELS, getAvatarVisual, getNpcVisual } from "@/lib/avatar-visual";
import { cityName } from "@/lib/game-data";
import { LOCATION_COORDS, tickAllNpcs } from "@/lib/npc-brain";
import { colors } from "@/lib/theme";
import type { NpcState } from "@/lib/types";
import { useGameStore, worldLocations } from "@/stores/game-store";
import { useWorldPresence } from "@/hooks/use-world-presence";

// ─── Dimensions de la carte 2D ────────────────────────────────────────────────
const MAP_W = 340;
const MAP_H = 220;

const LOCATION_TILES: Record<string, { x: number; y: number; w: number; h: number; color: string; icon: string }> = {
  "home":       { x: 8,   y: 12,  w: 62, h: 52, color: "#1a3a5c", icon: "home"       },
  "market":     { x: 80,  y: 8,   w: 60, h: 48, color: "#27ae60", icon: "cart"       },
  "cafe":       { x: 155, y: 18,  w: 62, h: 50, color: "#e67e22", icon: "cafe"       },
  "office":     { x: 232, y: 10,  w: 64, h: 52, color: "#2980b9", icon: "briefcase"  },
  "park":       { x: 10,  y: 130, w: 70, h: 70, color: "#16a085", icon: "leaf"       },
  "gym":        { x: 95,  y: 135, w: 58, h: 62, color: "#c0392b", icon: "fitness"    },
  "restaurant": { x: 170, y: 128, w: 72, h: 64, color: "#8e44ad", icon: "restaurant" },
  "cinema":     { x: 260, y: 124, w: 68, h: 68, color: "#2c3e50", icon: "film"       }
};

function pctToMap(posX: number, posY: number) {
  return { x: (posX / 100) * MAP_W, y: (posY / 100) * MAP_H };
}

// ─── NPC animé sur la carte ───────────────────────────────────────────────────
function LiveNpc({ npc, onPress }: { npc: NpcState; onPress: () => void }) {
  const visual = getNpcVisual(npc.id);
  const pos    = pctToMap(npc.posX, npc.posY);
  const anim   = useRef(new Animated.ValueXY({ x: pos.x, y: pos.y })).current;
  const prev   = useRef({ x: pos.x, y: pos.y });

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

  return (
    <Animated.View style={{ position: "absolute", left: anim.x, top: anim.y, alignItems: "center" }}>
      <Pressable onPress={onPress}>
        <AvatarSprite visual={visual} action={npc.action} size="xs" />
        <View style={{ backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 5, paddingHorizontal: 3 }}>
          <Text style={{ color: "#fff", fontSize: 7, fontWeight: "700" }}>{npc.name.split(" ")[0]}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Tuile de lieu ────────────────────────────────────────────────────────────
function LocationTile({
  slug, tile, isHere, npcCount, onlineCount, onPress
}: {
  slug: string;
  tile: (typeof LOCATION_TILES)[string];
  isHere: boolean;
  npcCount: number;
  onlineCount: number;
  onPress: () => void;
}) {
  const glow = useRef(new Animated.Value(0.6)).current;

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
    <Pressable onPress={onPress}>
      <Animated.View style={{
        position: "absolute",
        left: tile.x, top: tile.y,
        width: tile.w, height: tile.h,
        backgroundColor: tile.color,
        borderRadius: 10,
        borderWidth: isHere ? 2 : 1,
        borderColor: isHere ? colors.accent : "rgba(255,255,255,0.12)",
        opacity: glow,
        padding: 4,
        justifyContent: "space-between"
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Ionicons name={tile.icon as never} size={10} color="#fff" />
          {onlineCount > 0 && (
            <View style={{ backgroundColor: "#38c793", borderRadius: 8, paddingHorizontal: 3 }}>
              <Text style={{ color: "#07111f", fontSize: 7, fontWeight: "800" }}>{onlineCount}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 3, flexWrap: "wrap" }}>
          {Array.from({ length: Math.min(npcCount, 5) }).map((_, i) => (
            <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" }} />
          ))}
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

  const { members: livePlayers } = useWorldPresence();
  const [selectedNpc, setSelectedNpc] = useState<NpcState | null>(null);

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

        {/* Carte 2D */}
        <View style={{
          width: MAP_W, height: MAP_H,
          backgroundColor: "#0d1f32",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          alignSelf: "center"
        }}>
          {/* Tuiles */}
          {Object.entries(LOCATION_TILES).map(([slug, tile]) => (
            <LocationTile
              key={slug}
              slug={slug}
              tile={tile}
              isHere={currentLocationSlug === slug}
              npcCount={npcsByLoc[slug]?.length ?? 0}
              onlineCount={onlineCounts[slug] ?? 0}
              onPress={() => travelTo(slug)}
            />
          ))}

          {/* NPCs animés */}
          {npcs.map((npc) => (
            <LiveNpc key={npc.id} npc={npc} onPress={() => setSelectedNpc(npc)} />
          ))}

          {/* Joueurs en ligne (badge vert) */}
          {livePlayers.map((p) => {
            const tile = LOCATION_TILES[p.locationSlug];
            if (!tile) return null;
            return (
              <View
                key={p.userId}
                style={{ position: "absolute", left: tile.x + 4, top: tile.y + 4, backgroundColor: "#38c793", borderRadius: 6, paddingHorizontal: 3 }}
              >
                <Text style={{ color: "#07111f", fontSize: 7, fontWeight: "800" }}>{p.avatarName.slice(0, 5)}</Text>
              </View>
            );
          })}

          {/* Avatar joueur courant */}
          {playerVisual && (() => {
            const tile = LOCATION_TILES[currentLocationSlug];
            if (!tile) return null;
            return (
              <View style={{ position: "absolute", left: tile.x + tile.w / 2 - 16, top: tile.y + 6 }}>
                <AvatarSprite visual={playerVisual} action={playerAction} size="xs" />
                <View style={{ backgroundColor: colors.accent, borderRadius: 5, paddingHorizontal: 3 }}>
                  <Text style={{ color: "#07111f", fontSize: 7, fontWeight: "800" }}>Toi</Text>
                </View>
              </View>
            );
          })()}
        </View>

        {/* Panel NPC */}
        {selectedNpc && (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <AvatarSprite visual={getNpcVisual(selectedNpc.id)} action={selectedNpc.action} size="sm" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{selectedNpc.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACTION_COLORS[selectedNpc.action] }} />
                  <Muted>{ACTION_LABELS[selectedNpc.action]} · humeur {Math.round(selectedNpc.mood)}%</Muted>
                </View>
              </View>
              <Pressable onPress={() => setSelectedNpc(null)}>
                <Ionicons name="close-circle" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <View style={{ marginTop: 10 }}>
              <Button label="Envoyer un message" variant="secondary" onPress={() => { setSelectedNpc(null); router.push("/(app)/(tabs)/chat"); }} />
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
                <Pressable key={npc.id} onPress={() => setSelectedNpc(npc)} style={{ alignItems: "center", gap: 4 }}>
                  <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action} size="sm" />
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>{npc.name.split(" ")[0]}</Text>
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

        {/* Mode Live — Carte interactive */}
        <Pressable
          onPress={() => router.push("/(app)/world-live")}
          style={{
            backgroundColor: "rgba(139,124,255,0.15)",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.accent,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent + "22", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 22 }}>🗺️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 14 }}>Mode Live — Carte interactive</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Déplace-toi et interagis avec Ava, Noa & Leila en temps réel</Text>
          </View>
          <Text style={{ color: colors.accent, fontSize: 18 }}>→</Text>
        </Pressable>

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
                onPress={() => !isHere && travelTo(loc.slug)}
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
