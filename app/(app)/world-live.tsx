/**
 * World Live — Carte interactive temps réel v2
 *
 * - Carte plus lisible avec districts et routes
 * - Toasts live des activités d'amis proches
 * - Toggle carte / liste
 * - NPCs animés avec badge humeur
 * - Joueur cliquable sur la carte
 */

import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  GestureResponderEvent,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { Button } from "@/components/ui";
import { VillageMap } from "@/components/village-map";
import { ACTION_LABELS, getAvatarVisual, getNpcVisual } from "@/lib/avatar-visual";
import {
  getNpcActivityResponse,
  getNpcDialogue,
  getNpcEmoteReaction,
  PROPOSABLE_ACTIVITIES,
  QUICK_EMOTES
} from "@/lib/npc-dialogue";
import { colors } from "@/lib/theme";
import type { NpcState } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

const SCREEN_W = Dimensions.get("window").width;
const MAP_W = SCREEN_W;
const MAP_H = 440;

// ─── Lieux sur la carte (positions absolues en px) ───────────────────────────
const TILES: {
  slug: string;
  label: string;
  emoji: string;
  x: number; y: number; w: number; h: number;
  color: string;
  district: "nord" | "sud";
}[] = [
  { slug: "home",       label: "Maison",      emoji: "🏠", x: 8,   y: 18,  w: 72, h: 55, color: "#3498db", district: "nord" },
  { slug: "cafe",       label: "Café",        emoji: "☕", x: 92,  y: 22,  w: 70, h: 50, color: "#e67e22", district: "nord" },
  { slug: "office",     label: "Bureau",      emoji: "💼", x: 174, y: 18,  w: 72, h: 55, color: "#2980b9", district: "nord" },
  { slug: "library",    label: "Bibliothèque",emoji: "📚", x: 258, y: 20,  w: 80, h: 52, color: "#8e44ad", district: "nord" },
  { slug: "park",       label: "Parc",        emoji: "🌳", x: 8,   y: 220, w: 80, h: 70, color: "#27ae60", district: "sud" },
  { slug: "gym",        label: "Gym",         emoji: "💪", x: 104, y: 228, w: 66, h: 64, color: "#e74c3c", district: "sud" },
  { slug: "restaurant", label: "Restaurant",  emoji: "🍽️", x: 184, y: 220, w: 72, h: 66, color: "#c0392b", district: "sud" },
  { slug: "cinema",     label: "Cinéma",      emoji: "🎬", x: 268, y: 224, w: 76, h: 62, color: "#2c3e50", district: "sud" },
  { slug: "market",     label: "Marché",      emoji: "🛒", x: 50,  y: 150, w: 68, h: 54, color: "#16a085", district: "centre" as "nord" },
  { slug: "club",       label: "Club",        emoji: "🎵", x: 220, y: 152, w: 68, h: 52, color: "#9b59b6", district: "sud" },
];

// Routes (lignes visuelles entre les zones)
const ROADS = [
  { x1: 0,      y1: 155, x2: MAP_W, y2: 155, vertical: false }, // route horizontale centrale
  { x1: 0,      y1: 100, x2: MAP_W, y2: 100, vertical: false }, // rue nord
  { x1: 0,      y1: 205, x2: MAP_W, y2: 205, vertical: false }, // rue sud
  { x1: 160,    y1: 0,   x2: 160,   y2: MAP_H, vertical: true }, // avenue centrale
  { x1: 90,     y1: 0,   x2: 90,    y2: MAP_H, vertical: true }, // rue est
  { x1: 250,    y1: 0,   x2: 250,   y2: MAP_H, vertical: true }, // rue ouest
];

function pct(posX: number, posY: number) {
  return { x: (posX / 100) * MAP_W, y: (posY / 100) * MAP_H };
}

function getTileForSlug(slug: string) {
  return TILES.find((t) => t.slug === slug) ?? TILES[0];
}

// ─── Toast live activité ami ──────────────────────────────────────────────────
type ToastItem = { id: string; name: string; emoji: string; text: string };

function LiveToastBanner({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  const toast = toasts[toasts.length - 1];
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3200),
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [toast.id]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", top: 12, left: 12, right: 12,
        opacity: fadeAnim,
        backgroundColor: "rgba(7,17,31,0.92)",
        borderRadius: 12,
        borderWidth: 1, borderColor: colors.accent + "60",
        paddingHorizontal: 14, paddingVertical: 10,
        flexDirection: "row", alignItems: "center", gap: 10,
        zIndex: 50,
      }}
    >
      <Text style={{ fontSize: 22 }}>{toast.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 12 }}>{toast.name}</Text>
        <Text style={{ color: colors.text, fontSize: 11 }}>{toast.text}</Text>
      </View>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#38c793" }} />
    </Animated.View>
  );
}

// ─── Tile de lieu sur la carte ────────────────────────────────────────────────
function LocationTile({
  tile,
  npcCount,
  onPress,
}: {
  tile: typeof TILES[0];
  npcCount: number;
  onPress: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (npcCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [npcCount]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: tile.x, top: tile.y, width: tile.w, height: tile.h,
        transform: [{ scale: pulseAnim }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={{
          flex: 1,
          backgroundColor: tile.color + "28",
          borderRadius: 10,
          borderWidth: npcCount > 0 ? 1.5 : 1,
          borderColor: npcCount > 0 ? tile.color + "cc" : tile.color + "55",
          alignItems: "center", justifyContent: "center",
          gap: 2,
        }}
      >
        <Text style={{ fontSize: 18 }}>{tile.emoji}</Text>
        <Text style={{ color: tile.color, fontSize: 9, fontWeight: "800", textAlign: "center" }}>{tile.label}</Text>
        {npcCount > 0 && (
          <View style={{
            position: "absolute", top: -6, right: -6,
            backgroundColor: tile.color,
            borderRadius: 9, minWidth: 18, height: 18,
            alignItems: "center", justifyContent: "center",
            paddingHorizontal: 4,
          }}>
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{npcCount}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Bulle de dialogue ─────────────────────────────────────────────────────────
function Bubble({ text, x, y }: { text: string; x: number; y: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [text]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: Math.max(4, Math.min(MAP_W - 130, x - 55)),
        top: Math.max(2, y - 44),
        opacity: fadeAnim,
        backgroundColor: "rgba(255,255,255,0.96)",
        borderRadius: 10,
        paddingHorizontal: 8, paddingVertical: 5,
        maxWidth: 130, zIndex: 30,
      }}
    >
      <Text style={{ color: "#07111f", fontSize: 11, fontWeight: "600" }}>{text}</Text>
      <View style={{
        position: "absolute", bottom: -6, left: 14,
        width: 0, height: 0,
        borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7,
        borderLeftColor: "transparent", borderRightColor: "transparent",
        borderTopColor: "rgba(255,255,255,0.96)",
      }} />
    </Animated.View>
  );
}

// ─── Avatar joueur ─────────────────────────────────────────────────────────────
function PlayerDot({ posX, posY, visual }: { posX: number; posY: number; visual: ReturnType<typeof getAvatarVisual> }) {
  const pos  = pct(posX, posY);
  const anim = useRef(new Animated.ValueXY({ x: pos.x, y: pos.y })).current;
  const prev = useRef({ x: pos.x, y: pos.y });

  useEffect(() => {
    if (Math.abs(prev.current.x - pos.x) > 1 || Math.abs(prev.current.y - pos.y) > 1) {
      prev.current = { x: pos.x, y: pos.y };
      Animated.timing(anim, {
        toValue: { x: pos.x, y: pos.y },
        duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: false,
      }).start();
    }
  }, [posX, posY]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        transform: [
          { translateX: Animated.add(anim.x, new Animated.Value(-20)) },
          { translateY: Animated.add(anim.y, new Animated.Value(-44)) },
        ],
        zIndex: 20,
      }}
    >
      <View style={{
        borderWidth: 2, borderColor: colors.accent, borderRadius: 22,
        shadowColor: colors.accent, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
      }}>
        <AvatarSprite visual={visual} action="idle" size="xs" />
      </View>
      <View style={{
        position: "absolute", bottom: -5, left: 0, right: 0,
        backgroundColor: colors.accent, borderRadius: 4,
        paddingHorizontal: 3, paddingVertical: 1, alignItems: "center",
      }}>
        <Text style={{ color: "#07111f", fontSize: 8, fontWeight: "800" }}>TOI</Text>
      </View>
    </Animated.View>
  );
}

// ─── NPC animé ─────────────────────────────────────────────────────────────────
function LiveNpc({ npc, onPress }: { npc: NpcState; onPress: () => void }) {
  const visual = getNpcVisual(npc.id);
  const pos    = pct(npc.posX, npc.posY);
  const anim   = useRef(new Animated.ValueXY({ x: pos.x, y: pos.y })).current;
  const prev   = useRef({ x: pos.x, y: pos.y });

  useEffect(() => {
    if (Math.abs(prev.current.x - pos.x) > 1 || Math.abs(prev.current.y - pos.y) > 1) {
      prev.current = { x: pos.x, y: pos.y };
      Animated.timing(anim, {
        toValue: { x: pos.x, y: pos.y },
        duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false,
      }).start();
    }
  }, [npc.posX, npc.posY]);

  const moodColor = npc.mood > 60 ? "#38c793" : npc.mood > 35 ? "#f39c12" : "#e74c3c";

  return (
    <Animated.View
      style={{
        position: "absolute",
        transform: [
          { translateX: Animated.add(anim.x, new Animated.Value(-18)) },
          { translateY: Animated.add(anim.y, new Animated.Value(-40)) },
        ],
        zIndex: 15,
      }}
    >
      <Pressable onPress={onPress}>
        <View style={{
          borderWidth: 2, borderColor: moodColor, borderRadius: 20,
          shadowColor: moodColor, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
        }}>
          <AvatarSprite visual={visual} action={npc.action} size="xs" />
        </View>
        <View style={{
          position: "absolute", bottom: -5, left: 0, right: 0,
          backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 4,
          paddingHorizontal: 3, paddingVertical: 1, alignItems: "center",
        }}>
          <Text style={{ color: "#fff", fontSize: 7, fontWeight: "700" }}>{npc.name.split(" ")[0]}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Légende carte (scroll horizontal) ────────────────────────────────────────
function MapLegend({ npcs }: { npcs: NpcState[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8, flexDirection: "row" }}
    >
      {TILES.map((tile) => {
        const count = npcs.filter((n) => n.locationSlug === tile.slug).length;
        return (
          <View
            key={tile.slug}
            style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              backgroundColor: count > 0 ? tile.color + "22" : "rgba(255,255,255,0.05)",
              borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
              borderWidth: 1, borderColor: count > 0 ? tile.color + "99" : "rgba(255,255,255,0.1)",
            }}
          >
            <Text style={{ fontSize: 13 }}>{tile.emoji}</Text>
            <Text style={{ color: count > 0 ? tile.color : colors.muted, fontSize: 11, fontWeight: "700" }}>
              {tile.label}
            </Text>
            {count > 0 && (
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: tile.color, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{count}</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Panneau NPC ───────────────────────────────────────────────────────────────
type ChatEntry = { id: string; from: "player" | "npc"; text: string };

function NpcPanel({ npc, onClose, onBubble }: {
  npc: NpcState;
  onClose: () => void;
  onBubble: (npcId: string, text: string) => void;
}) {
  const visual = getNpcVisual(npc.id);
  const [chat, setChat] = useState<ChatEntry[]>(() => [{
    id: "greeting", from: "npc",
    text: getNpcDialogue(npc.id, npc.action, npc.mood, "greeting"),
  }]);
  const [inputText, setInputText] = useState("");
  const [tab, setTab]             = useState<"chat" | "activités">("chat");
  const scrollRef                 = useRef<ScrollView>(null);
  const moodColor = npc.mood > 60 ? "#38c793" : npc.mood > 35 ? "#f39c12" : "#e74c3c";
  const tile = getTileForSlug(npc.locationSlug);

  const addLine = (from: "player" | "npc", text: string) => {
    const entry: ChatEntry = { id: `${Date.now()}-${Math.random()}`, from, text };
    setChat((prev) => [...prev, entry]);
    if (from === "npc") onBubble(npc.id, text);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const sendMessage = () => {
    const t = inputText.trim();
    if (!t) return;
    setInputText("");
    addLine("player", t);
    setTimeout(() => {
      const busy = npc.action === "sleeping" || npc.energy < 20;
      addLine("npc", getNpcDialogue(npc.id, npc.action, npc.mood, busy ? "busy" : "topic"));
    }, 600 + Math.random() * 500);
  };

  const sendEmote = (emote: string) => {
    addLine("player", emote);
    setTimeout(() => addLine("npc", getNpcEmoteReaction(npc.id, emote)), 500);
  };

  const proposeActivity = (slug: string) => {
    const act = PROPOSABLE_ACTIVITIES.find((a) => a.slug === slug);
    if (!act) return;
    addLine("player", `${act.emoji} Je te propose : ${act.label} !`);
    setTimeout(() => {
      const { accepted, line } = getNpcActivityResponse(npc.id, npc, slug);
      addLine("npc", line);
      if (accepted) setTimeout(() => addLine("npc", `On se retrouve à ${act.locationSlug} ?`), 800);
    }, 700);
  };

  return (
    <View style={{
      backgroundColor: "#0d1c2e",
      borderTopLeftRadius: 22, borderTopRightRadius: 22,
      borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
      maxHeight: 440,
    }}>
      {/* Handle */}
      <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" }} />
      </View>

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
        <View style={{ borderWidth: 2, borderColor: moodColor, borderRadius: 22 }}>
          <AvatarSprite visual={visual} action={npc.action} size="sm" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{npc.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{tile.emoji} {tile.label} · {ACTION_LABELS[npc.action]}</Text>
        </View>
        {/* Barres */}
        <View style={{ gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ color: colors.muted, fontSize: 9 }}>😊</Text>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <View style={{ width: `${npc.mood}%`, height: "100%", backgroundColor: moodColor, borderRadius: 3 }} />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ color: colors.muted, fontSize: 9 }}>⚡</Text>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <View style={{ width: `${npc.energy}%`, height: "100%", backgroundColor: "#3498db", borderRadius: 3 }} />
            </View>
          </View>
        </View>
        <Pressable onPress={onClose} style={{ padding: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, marginBottom: 10 }}>
        {(["chat", "activités"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
              backgroundColor: tab === t ? colors.accent : "rgba(255,255,255,0.06)",
            }}
          >
            <Text style={{ color: tab === t ? "#07111f" : colors.text, fontWeight: "700", fontSize: 12 }}>
              {t === "chat" ? "💬 Chat" : "🎯 Activités"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Chat */}
      {tab === "chat" && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ paddingHorizontal: 16 }}>
          <ScrollView
            ref={scrollRef}
            style={{ maxHeight: 155, marginBottom: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {chat.map((entry) => (
              <View key={entry.id} style={{
                flexDirection: "row",
                justifyContent: entry.from === "player" ? "flex-end" : "flex-start",
                marginBottom: 6,
              }}>
                <View style={{
                  backgroundColor: entry.from === "player" ? colors.accent : "rgba(255,255,255,0.1)",
                  borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, maxWidth: "82%",
                }}>
                  <Text style={{ color: entry.from === "player" ? "#07111f" : colors.text, fontSize: 12, fontWeight: "600" }}>
                    {entry.text}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Emotes rapides */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {QUICK_EMOTES.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => sendEmote(e)}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 18 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Input */}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingBottom: 12 }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12,
                paddingHorizontal: 14, paddingVertical: 10,
                color: colors.text, fontSize: 13, fontWeight: "600",
              }}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Dis quelque chose…"
              placeholderTextColor={colors.muted}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <Pressable
              onPress={sendMessage}
              style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: inputText.trim() ? colors.accent : "rgba(255,255,255,0.1)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 18 }}>→</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Activités */}
      {tab === "activités" && (
        <ScrollView style={{ maxHeight: 220, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
            Propose une activité à {npc.name.split(" ")[0]}
          </Text>
          <View style={{ gap: 8 }}>
            {PROPOSABLE_ACTIVITIES.map((act) => (
              <Pressable
                key={act.slug}
                onPress={() => { setTab("chat"); proposeActivity(act.slug); }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 10,
                  backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10,
                  paddingHorizontal: 12, paddingVertical: 10,
                }}
              >
                <Text style={{ fontSize: 22 }}>{act.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{act.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{act.locationSlug}</Text>
                </View>
                <Text style={{ color: colors.accent, fontSize: 12 }}>Proposer →</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Vue liste des lieux ───────────────────────────────────────────────────────
function TileListView({ npcs, onSelectNpc }: { npcs: NpcState[]; onSelectNpc: (npc: NpcState) => void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", marginBottom: 4, letterSpacing: 1 }}>
        LIEUX ACTIFS
      </Text>
      {TILES.map((tile) => {
        const present = npcs.filter((n) => n.locationSlug === tile.slug);
        return (
          <View
            key={tile.slug}
            style={{
              backgroundColor: present.length > 0 ? tile.color + "18" : "rgba(255,255,255,0.03)",
              borderRadius: 14, borderWidth: 1,
              borderColor: present.length > 0 ? tile.color + "55" : "rgba(255,255,255,0.07)",
              padding: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: present.length > 0 ? 8 : 0 }}>
              <Text style={{ fontSize: 24 }}>{tile.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{tile.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {present.length === 0 ? "Personne ici" : `${present.length} personne${present.length > 1 ? "s" : ""} présente${present.length > 1 ? "s" : ""}`}
                </Text>
              </View>
              {present.length > 0 && (
                <View style={{ backgroundColor: tile.color, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{present.length}</Text>
                </View>
              )}
            </View>
            {present.length > 0 && (
              <View style={{ gap: 6 }}>
                {present.map((npc) => {
                  const moodColor = npc.mood > 60 ? "#38c793" : npc.mood > 35 ? "#f39c12" : "#e74c3c";
                  return (
                    <Pressable
                      key={npc.id}
                      onPress={() => onSelectNpc(npc)}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 10,
                        backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 8,
                      }}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: moodColor }} />
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, flex: 1 }}>{npc.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{ACTION_LABELS[npc.action]}</Text>
                      <Text style={{ color: colors.accent, fontSize: 13 }}>💬</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {/* Boutons rapides */}
      <View style={{ gap: 8, marginTop: 8 }}>
        <Button label="🔐 Rooms & Secret Chat" onPress={() => router.push("/(app)/rooms")} />
        <Button label="🤖 Coach ARIA — IA Vie" variant="secondary" onPress={() => router.push("/(app)/coach")} />
      </View>
    </ScrollView>
  );
}

// ─── Screen principal ──────────────────────────────────────────────────────────
export default function WorldLiveScreen() {
  const avatar               = useGameStore((s) => s.avatar);
  const stats                = useGameStore((s) => s.stats);
  const npcs                 = useGameStore((s) => s.npcs);
  const tickNpcs             = useGameStore((s) => s.tickNpcs);
  const relationships        = useGameStore((s) => s.relationships);
  const travelTo             = useGameStore((s) => s.travelTo);
  const currentLocationSlug  = useGameStore((s) => s.currentLocationSlug);

  const [playerPos, setPlayerPos]   = useState({ x: 48, y: 50 });
  const [bubbles, setBubbles]       = useState<Record<string, { text: string; key: number }>>({});
  const [selectedNpc, setSelectedNpc] = useState<NpcState | null>(null);
  const [viewMode, setViewMode]     = useState<"map" | "list">("map");
  const [liveToasts, setLiveToasts] = useState<ToastItem[]>([]);

  const visual = avatar ? getAvatarVisual(avatar) : getNpcVisual("player");

  // Tick NPC toutes les 30s
  useEffect(() => {
    tickNpcs();
    const interval = setInterval(() => tickNpcs(), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Toasts live amis proches (score >= 45)
  useEffect(() => {
    const closeNpcs = npcs.filter((npc) => {
      const rel = relationships.find((r) => r.residentId === npc.id);
      return rel && rel.score >= 45;
    });
    if (closeNpcs.length === 0) return;
    const npc = closeNpcs[Math.floor(Math.random() * closeNpcs.length)];
    const tile = getTileForSlug(npc.locationSlug);
    const actionMsg = ACTION_LABELS[npc.action] ?? npc.action;
    const toast: ToastItem = {
      id: `${npc.id}-${Date.now()}`,
      name: npc.name,
      emoji: tile.emoji,
      text: `est à ${tile.label} — ${actionMsg}`,
    };
    setLiveToasts((prev) => [...prev.slice(-3), toast]);
  }, [npcs]);

  // Déplacement joueur sur la carte
  const handleMapPress = (e: GestureResponderEvent) => {
    if (selectedNpc) { setSelectedNpc(null); return; }
    const { locationX, locationY } = e.nativeEvent;
    setPlayerPos({
      x: Math.max(2, Math.min(98, (locationX / MAP_W) * 100)),
      y: Math.max(2, Math.min(98, (locationY / MAP_H) * 100)),
    });
  };

  const showBubble = useCallback((npcId: string, text: string) => {
    setBubbles((prev) => ({ ...prev, [npcId]: { text, key: Date.now() } }));
    setTimeout(() => setBubbles((prev) => {
      const next = { ...prev };
      delete next[npcId];
      return next;
    }), 3400);
  }, []);

  // Salutation auto quand joueur proche NPC
  const playerPx = pct(playerPos.x, playerPos.y);
  useEffect(() => {
    npcs.forEach((npc) => {
      const npcPx = pct(npc.posX, npc.posY);
      const dist  = Math.hypot(playerPx.x - npcPx.x, playerPx.y - npcPx.y);
      if (dist < 35 && !bubbles[npc.id]) {
        showBubble(npc.id, getNpcDialogue(npc.id, npc.action, npc.mood, "greeting"));
      }
    });
  }, [playerPos]);

  // NPC count per tile
  const npcCountPerTile: Record<string, number> = {};
  TILES.forEach((t) => {
    npcCountPerTile[t.slug] = npcs.filter((n) => n.locationSlug === t.slug).length;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10,
        backgroundColor: "rgba(7,17,31,0.97)",
        borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.06)",
      }}>
        <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>←</Text>
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>🗺️ Neo Paris</Text>
          <Text style={{ color: colors.muted, fontSize: 10 }}>Monde Live</Text>
        </View>
        {/* Toggle carte/liste */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Pressable
            onPress={() => setViewMode("map")}
            style={{
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
              backgroundColor: viewMode === "map" ? colors.accent + "30" : "transparent",
            }}
          >
            <Text style={{ color: viewMode === "map" ? colors.accent : colors.muted, fontSize: 11, fontWeight: "700" }}>🗺️</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode("list")}
            style={{
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
              backgroundColor: viewMode === "list" ? colors.accent + "30" : "transparent",
            }}
          >
            <Text style={{ color: viewMode === "list" ? colors.accent : colors.muted, fontSize: 11, fontWeight: "700" }}>☰</Text>
          </Pressable>
        </View>
      </View>

      {/* Vue Carte */}
      {viewMode === "map" && (
        <>
          {/* ── CARTE VILLAGE SVG ── */}
          <VillageMap
            currentSlug={currentLocationSlug}
            onLocationPress={(slug, label) => {
              travelTo(slug);
              setPlayerPos({ x: 50, y: 50 });
            }}
          />

          {/* Tip sous la carte */}
          <View style={{
            flexDirection: "row", justifyContent: "space-between",
            paddingHorizontal: 16, paddingVertical: 8,
            backgroundColor: "rgba(255,255,255,0.02)",
          }}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>Tap bâtiment → voyager</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>Liste → interagir NPCs</Text>
          </View>

          {/* Liste NPCs présents (si pas de panneau) */}
          {!selectedNpc && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 4 }}>
                RÉSIDENTS EN LIGNE
              </Text>
              {npcs.map((npc) => {
                const vis = getNpcVisual(npc.id);
                const tile = getTileForSlug(npc.locationSlug);
                const moodColor = npc.mood > 60 ? "#38c793" : npc.mood > 35 ? "#f39c12" : "#e74c3c";
                const rel = relationships.find((r) => r.residentId === npc.id);
                const isFriend = rel && rel.score >= 45;
                return (
                  <Pressable
                    key={npc.id}
                    onPress={() => setSelectedNpc(npc)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: isFriend ? "rgba(56,199,147,0.07)" : "rgba(255,255,255,0.04)",
                      borderRadius: 12, padding: 10,
                      borderWidth: 1,
                      borderColor: isFriend ? "rgba(56,199,147,0.25)" : "rgba(255,255,255,0.07)",
                    }}
                  >
                    <View style={{ borderWidth: 1.5, borderColor: moodColor, borderRadius: 20 }}>
                      <AvatarSprite visual={vis} action={npc.action} size="xs" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{npc.name}</Text>
                        {isFriend && <Text style={{ fontSize: 10 }}>💚</Text>}
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        {tile.emoji} {tile.label} · {ACTION_LABELS[npc.action]}
                      </Text>
                    </View>
                    <View style={{ gap: 3, width: 44 }}>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                        <View style={{ width: `${npc.mood}%`, height: "100%", backgroundColor: moodColor, borderRadius: 2 }} />
                      </View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                        <View style={{ width: `${npc.energy}%`, height: "100%", backgroundColor: "#3498db", borderRadius: 2 }} />
                      </View>
                    </View>
                    <Text style={{ color: colors.accent, fontSize: 12 }}>💬</Text>
                  </Pressable>
                );
              })}
              <View style={{ gap: 8, marginTop: 8 }}>
                <Button label="🔐 Rooms & Secret Chat" onPress={() => router.push("/(app)/rooms")} />
                <Button label="🤖 Coach ARIA" variant="secondary" onPress={() => router.push("/(app)/coach")} />
              </View>
            </ScrollView>
          )}

          {/* Panneau NPC sélectionné */}
          {selectedNpc && (
            <View style={{ flex: 1, justifyContent: "flex-end" }}>
              <NpcPanel
                npc={selectedNpc}
                onClose={() => setSelectedNpc(null)}
                onBubble={showBubble}
              />
            </View>
          )}
        </>
      )}

      {/* Vue Liste */}
      {viewMode === "list" && (
        <TileListView
          npcs={npcs}
          onSelectNpc={(npc) => {
            setViewMode("map");
            setSelectedNpc(npc);
          }}
        />
      )}
    </View>
  );
}
