"use client";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual } from "@/lib/avatar-visual";
import { getHousingTier } from "@/lib/housing";
import { hapticImpact } from "@/lib/safe-haptics";
import { getWellbeingScore } from "@/lib/selectors";
import { getSuggestedActions, useTimeContext } from "@/lib/time-context";
import type { LifeActionId } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";
import { useAppTheme } from "@/hooks/use-app-theme";

const L = {
  bg:        "#080808",
  card:      "#111111",
  cardAlt:   "#181818",
  text:      "#F5F2E8",
  textSoft:  "#A8A49A",
  muted:     "#4A4844",
  border:    "rgba(255,255,255,0.07)",
  primary:   "#FFD600",
  primaryBg: "#1A1500",
  green:     "#39FF14",
  greenBg:   "#091A03",
  gold:      "#FFD600",
  goldBg:    "#1A1500",
  red:       "#FF3B3B",
  redBg:     "#1A0808",
  blue:      "#00B4FF",
  blueBg:    "#001A2A",
  purple:    "#BF5FFF",
  purpleBg:  "#18082A",
  pink:      "#FF2D78",
  pinkBg:    "#1A0818",
  teal:      "#00FFD1",
  tealBg:    "#001A14",
  orange:    "#FF6B00",
  orangeBg:  "#1A0D00",
};

type ActionDef = {
  id: LifeActionId;
  emoji: string;
  label: string;
  costLabel: string;
  gainLabel: string;
  category: "survie" | "travail" | "social" | "santé";
  minEnergy?: number;
  minMoney?: number;
};

const ALL_ACTIONS: ActionDef[] = [
  { id: "healthy-meal",  emoji: "🍱", label: "Manger propre",     costLabel: "14 bl",  gainLabel: "+Dalle +Forme",      category: "survie" },
  { id: "home-cooking",  emoji: "🍳", label: "Faire la popote",   costLabel: "8 bl",   gainLabel: "+Dalle économe",     category: "survie" },
  { id: "sleep",         emoji: "🛌", label: "Roupiller",         costLabel: "temps",  gainLabel: "+Pêche max",         category: "survie" },
  { id: "nap",           emoji: "💤", label: "Piquer un som",     costLabel: "temps",  gainLabel: "+Pêche rapide",      category: "survie" },
  { id: "shower",        emoji: "🚿", label: "Se laver",          costLabel: "3 bl",   gainLabel: "+Look +Mood",        category: "survie" },
  { id: "work-shift",    emoji: "💼", label: "Aller au taff",     costLabel: "pêche",  gainLabel: "+Thunes +Côte",      category: "travail", minEnergy: 20 },
  { id: "cafe-chat",     emoji: "☕", label: "Poser au bando",    costLabel: "8 bl",   gainLabel: "+Réseau +Mood",      category: "social",  minMoney: 8 },
  { id: "team-sport",    emoji: "🏀", label: "Terrain de foot",   costLabel: "pêche",  gainLabel: "+Réseau +Forme",     category: "social",  minEnergy: 25 },
  { id: "walk",          emoji: "🏃", label: "Faire un tour",     costLabel: "pêche",  gainLabel: "+Mood -Stress",      category: "santé" },
  { id: "gym",           emoji: "🏋️", label: "Aller à la salle",  costLabel: "12 bl",  gainLabel: "+Forme +Discipline", category: "santé",   minEnergy: 22, minMoney: 12 },
  { id: "meditate",      emoji: "🧘", label: "Se poser",          costLabel: "temps",  gainLabel: "-Stress +Zen",       category: "santé" },
  { id: "read-book",     emoji: "📚", label: "S'instruire",       costLabel: "pêche",  gainLabel: "+Motivation",        category: "santé" },
  { id: "shopping",      emoji: "🛍️", label: "Le Marais / SNKRS", costLabel: "35 bl",  gainLabel: "+Look +Mood",        category: "social",  minMoney: 35 },
];

// ─── Daily Event Modal ────────────────────────────────────────────────────────
function DailyEventModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const dailyEvent        = useGameStore((s) => s.dailyEvent);
  const resolveDailyEvent = useGameStore((s) => s.resolveDailyEvent);
  if (!dailyEvent || dailyEvent.resolved || !visible) return null;

  const kindColor =
    dailyEvent.kind === "opportunity" ? L.primary :
    dailyEvent.kind === "windfall"    ? L.gold :
    dailyEvent.kind === "encounter"   ? L.purple : L.red;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end", padding: 16 }}>
        <View style={{ backgroundColor: L.card, borderRadius: 24, padding: 24, gap: 20,
          borderWidth: 1, borderColor: kindColor + "20" }}>
          <View style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: L.border, alignSelf: "center" }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Text style={{ fontSize: 32 }}>
              {dailyEvent.kind === "opportunity" ? "✨" : dailyEvent.kind === "windfall" ? "🎁" : dailyEvent.kind === "encounter" ? "👤" : "⚠️"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: kindColor, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>ÉVÉNEMENT DU JOUR</Text>
              <Text style={{ color: L.text, fontWeight: "900", fontSize: 18, marginTop: 2 }}>{dailyEvent.title}</Text>
            </View>
          </View>
          <Text style={{ color: L.textSoft, fontSize: 14, lineHeight: 22 }}>{dailyEvent.body}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => { resolveDailyEvent("accepted"); onClose(); }}
              style={{ flex: 2, paddingVertical: 16, borderRadius: 14, backgroundColor: kindColor, alignItems: "center" }}>
              <Text style={{ color: "#080808", fontWeight: "900", fontSize: 15 }}>{dailyEvent.actionLabel}</Text>
            </Pressable>
            {dailyEvent.kind !== "windfall" && (
              <Pressable onPress={() => { resolveDailyEvent("skipped"); onClose(); }}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: L.cardAlt,
                  borderWidth: 1, borderColor: L.border, alignItems: "center" }}>
                <Text style={{ color: L.muted, fontWeight: "700", fontSize: 14 }}>Passer</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── StatRow ──────────────────────────────────────────────────────────────────
function StatRow({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  const pct     = Math.max(0, Math.min(100, value));
  const danger  = pct < 30;
  const warn    = pct < 55;
  const color   = danger ? L.red : warn ? L.gold : L.green;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [pct]);

  const barW = barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11,
      borderBottomWidth: 1, borderBottomColor: L.border }}>
      <Text style={{ fontSize: 15, width: 22, textAlign: "center" }}>{emoji}</Text>
      <Text style={{ color: L.textSoft, fontSize: 13, fontWeight: "600", width: 48 }}>{label}</Text>
      <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.05)" }}>
        <Animated.View style={{ height: 3, borderRadius: 2, width: barW,
          backgroundColor: color,
          shadowColor: color, shadowOpacity: danger ? 0.7 : 0.4, shadowRadius: 4 }} />
      </View>
      <Text style={{ color: danger ? L.red : L.muted, fontSize: 12, fontWeight: "800",
        width: 26, textAlign: "right" }}>
        {Math.round(pct)}
      </Text>
    </View>
  );
}

// ─── ActionRow ────────────────────────────────────────────────────────────────
function ActionRow({ action, onPress, isNext, blockedReason }: {
  action: ActionDef;
  onPress: () => void;
  isNext: boolean;
  blockedReason?: string;
}) {
  const blocked = !!blockedReason;
  return (
    <Pressable onPress={() => { if (!blocked) { hapticImpact("light"); onPress(); } }}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: L.border,
        opacity: blocked ? 0.4 : 1 }}>
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: isNext ? L.primary + "15" : L.card,
        borderWidth: isNext ? 1 : 0,
        borderColor: L.primary + "35",
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: 20 }}>{blocked ? "🔒" : action.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: isNext ? L.primary : blocked ? L.muted : L.text,
          fontSize: 15, fontWeight: "800" }}>
          {action.label}
        </Text>
        <Text style={{ color: blocked ? L.muted : L.muted, fontSize: 12, marginTop: 1 }}>
          {blocked ? blockedReason : action.gainLabel}
        </Text>
      </View>
      {isNext ? (
        <View style={{ backgroundColor: L.primary, borderRadius: 5,
          paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: "#080808", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }}>
            MAINTENANT
          </Text>
        </View>
      ) : !blocked ? (
        <Text style={{ color: L.muted, fontSize: 11 }}>{action.costLabel}</Text>
      ) : null}
    </Pressable>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const avatar           = useGameStore((s) => s.avatar);
  const stats            = useGameStore((s) => s.stats);
  const performAction    = useGameStore((s) => s.performAction);
  const dailyGoals       = useGameStore((s) => s.dailyGoals);
  const bootstrap        = useGameStore((s) => s.bootstrap);
  const dailyEvent       = useGameStore((s) => s.dailyEvent);
  const playerLevel      = useGameStore((s) => s.playerLevel ?? 1);
  const housingTier      = useGameStore((s) => s.housingTier);
  const checkHousingRent = useGameStore((s) => s.checkHousingRent);
  const lifeFeed         = useGameStore((s) => s.lifeFeed ?? []);
  const worldEvent       = useGameStore((s) => s.worldEvent);
  const worldEventJoined = useGameStore((s) => s.worldEventJoined ?? false);
  const joinWorldEvent   = useGameStore((s) => s.joinWorldEvent);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  useFocusEffect(useCallback(() => { bootstrap(); checkHousingRent(); }, [bootstrap, checkHousingRent]));

  const timeCtx    = useTimeContext();
  const wellbeing  = getWellbeingScore(stats);
  const housing    = getHousingTier(housingTier);
  const suggested  = getSuggestedActions(timeCtx);
  const doneGoals  = dailyGoals.filter((g) => g.completed).length;
  const totalGoals = dailyGoals.length;

  // ── Seuils réalistes — alerte avant que ce soit trop tard ─────────────────
  const crises = [
    stats.energy < 25  && { emoji: "🛌", label: "T'es à plat",     body: "Roupille avant de faire quoi que ce soit.",  action: "sleep"        as LifeActionId },
    stats.hunger < 30  && { emoji: "🍱", label: "T'as la dalle",   body: "Mange quelque chose maintenant.",            action: "healthy-meal" as LifeActionId },
    stats.mood < 30    && { emoji: "🧘", label: "Mood au fond",     body: "Pose-toi. Ça changera tout.",                action: "meditate"     as LifeActionId },
    stats.hygiene < 25 && { emoji: "🚿", label: "Look en carton",  body: "Vas te laver avant de sortir.",              action: "shower"       as LifeActionId },
    stats.money < 20   && { emoji: "💼", label: "Plus de thunes",  body: "File au taff dès que t'as de la pêche.",     action: "work-shift"   as LifeActionId },
  ].filter(Boolean) as { emoji: string; label: string; body: string; action: LifeActionId }[];

  const topCrisis  = crises[0];
  const actionById = new Map(ALL_ACTIONS.map((a) => [a.id, a]));

  // Raison de blocage explicite
  function blockedReason(a: ActionDef): string | undefined {
    if (a.id === "work-shift" && !timeCtx.workAvailable) return "Pas dispo à cette heure";
    if (a.minEnergy && stats.energy < a.minEnergy) return `Pêche insuffisante (${Math.round(stats.energy)}/${a.minEnergy})`;
    if (a.minMoney  && stats.money  < a.minMoney)  return `Manque de thunes (${Math.round(stats.money)}/${a.minMoney} bl)`;
    return undefined;
  }

  // Liste : crise prioritaire + suggestions + essentiels, dispo d'abord puis bloqués
  const wantedIds = Array.from(new Set([
    topCrisis?.action,
    ...suggested,
    "work-shift", "healthy-meal", "sleep", "shower", "walk", "meditate",
  ].filter(Boolean) as LifeActionId[])).slice(0, 8);

  const allRows = wantedIds
    .map((id) => ({ action: actionById.get(id)!, blocked: blockedReason(actionById.get(id)!) }))
    .filter((r) => r.action);

  const availableRows = allRows.filter((r) => !r.blocked).slice(0, 5);
  const blockedRows   = allRows.filter((r) => r.blocked).slice(0, 2);
  const listRows      = [...availableRows, ...blockedRows];

  // Greeting selon l'heure
  const hour   = new Date().getHours();
  const salut  = hour < 12 ? "Bon matin" : hour < 18 ? "Bon aprèm" : "Bonne nuit";
  const name   = avatar?.displayName?.split(" ")[0] ?? "frère";

  // État de vie
  const wbColor  = wellbeing > 65 ? L.green : wellbeing > 40 ? L.gold : L.red;
  const wbLabel  = wellbeing > 65 ? "En forme 🔥" : wellbeing > 40 ? "Ça va tenir ⚡" : "Danger 🚨";

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim         = useRef(new Animated.Value(0)).current;
  const toastTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim          = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  function showToast(text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => setToast(null));
    toastTimer.current = setTimeout(() => setToast(null), 2100);
  }

  function handleAction(id: LifeActionId) {
    performAction(id);
    hapticImpact("medium");
    const msgs: Record<string, string> = {
      "work-shift":   "+thunes +côte 💰",
      "sleep":        "pêche rechargée ⚡",
      "nap":          "+pêche rapide ⚡",
      "healthy-meal": "+dalle +forme 🍱",
      "home-cooking": "+dalle 🍳",
      "shower":       "+look +mood 👟",
      "walk":         "+mood -stress 🏃",
      "gym":          "+forme 💪",
      "meditate":     "-stress +zen 🧘",
      "cafe-chat":    "+réseau ☕",
      "team-sport":   "+réseau +forme 🏀",
      "read-book":    "+motivation 📚",
      "shopping":     "+look 🛍️",
    };
    showToast(msgs[id] ?? "+xp 🔥");
  }

  const statRows = [
    { emoji: "⚡", label: "Pêche",  value: stats.energy   },
    { emoji: "🍱", label: "Dalle",  value: stats.hunger   },
    { emoji: "👟", label: "Look",   value: stats.hygiene  },
    { emoji: "😤", label: "Mood",   value: stats.mood     },
  ].sort((a, b) => a.value - b.value);

  return (
    <Animated.View style={{ flex: 1, backgroundColor: L.bg, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}>
        <DailyEventModal visible={eventModalOpen} onClose={() => setEventModalOpen(false)} />

        {/* ── HEADER ── */}
        <View style={{ paddingTop: 54, paddingHorizontal: 20, paddingBottom: 18,
          borderBottomWidth: 1, borderBottomColor: L.border }}>

          {/* Greeting */}
          <Text style={{ color: L.muted, fontSize: 12, fontWeight: "700",
            letterSpacing: 0.3, marginBottom: 10 }}>
            {salut}, {name}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22,
              backgroundColor: L.card, borderWidth: 1, borderColor: L.border,
              alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {avatar
                ? <AvatarSprite visual={getAvatarVisual(avatar)} action={stats.energy < 20 ? "sleeping" : "idle"} size="sm" />
                : <Text style={{ fontSize: 22 }}>🧢</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: L.text, fontSize: 16, fontWeight: "900" }}>
                {avatar?.displayName ?? "Mon perso"}
              </Text>
              <Text style={{ color: L.muted, fontSize: 12, marginTop: 1 }}>
                Niv. {playerLevel} · {housing.emoji} {housing.name}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: L.primary, fontSize: 15, fontWeight: "900" }}>
                💰 {stats.money} bl
              </Text>
            </View>
          </View>

          {/* Barre de vie avec label état */}
          <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: L.card }}>
              <View style={{ height: 3, borderRadius: 2,
                width: `${Math.max(0, Math.min(100, wellbeing))}%` as `${number}%`,
                backgroundColor: wbColor,
                shadowColor: wbColor, shadowOpacity: 0.7, shadowRadius: 4 }} />
            </View>
            <Text style={{ color: wbColor, fontSize: 11, fontWeight: "800", minWidth: 72,
              textAlign: "right" }}>
              {wbLabel}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>

          {/* ── URGENT — bouton pleine largeur ── */}
          {topCrisis && (() => {
            const action = actionById.get(topCrisis.action);
            const avail  = action ? !blockedReason(action) : false;
            return (
              <View style={{ marginTop: 20, backgroundColor: L.card, borderRadius: 16,
                padding: 18, gap: 14, borderWidth: 1, borderColor: L.red + "22" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 28 }}>{topCrisis.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: L.red, fontSize: 9, fontWeight: "900",
                      letterSpacing: 1.5 }}>URGENT</Text>
                    <Text style={{ color: L.text, fontSize: 17, fontWeight: "900",
                      marginTop: 2 }}>
                      {topCrisis.label}
                    </Text>
                    <Text style={{ color: L.textSoft, fontSize: 13, marginTop: 3 }}>
                      {topCrisis.body}
                    </Text>
                  </View>
                </View>
                {crises.length > 1 && (
                  <Text style={{ color: L.muted, fontSize: 11 }}>
                    +{crises.length - 1} autre{crises.length > 2 ? "s" : ""} point{crises.length > 2 ? "s" : ""} à régler
                  </Text>
                )}
                <Pressable
                  onPress={() => { if (action && avail) handleAction(topCrisis.action); }}
                  style={{ backgroundColor: avail ? L.red : L.cardAlt,
                    borderRadius: 12, paddingVertical: 16, alignItems: "center",
                    shadowColor: L.red, shadowOpacity: avail ? 0.3 : 0, shadowRadius: 10 }}>
                  <Text style={{ color: avail ? "#fff" : L.muted, fontSize: 15, fontWeight: "900" }}>
                    {avail ? `${topCrisis.emoji}  Faire maintenant` : "Non disponible maintenant"}
                  </Text>
                </Pressable>
              </View>
            );
          })()}

          {/* ── TON ÉTAT ── */}
          <View style={{ marginTop: 28 }}>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800",
              letterSpacing: 2, marginBottom: 2 }}>
              TON ÉTAT
            </Text>
            {statRows.map((s) => <StatRow key={s.label} {...s} />)}
          </View>

          {/* ── CE QUE TU FAIS ── */}
          <View style={{ marginTop: 28 }}>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800",
              letterSpacing: 2, marginBottom: 2 }}>
              CE QUE TU FAIS
            </Text>
            {listRows.map(({ action, blocked }, i) => (
              <ActionRow
                key={action.id}
                action={action}
                isNext={i === 0 && !blocked && !topCrisis}
                blockedReason={blocked}
                onPress={() => handleAction(action.id)}
              />
            ))}
          </View>

          {/* ── MISSIONS ── */}
          {totalGoals > 0 && (
            <Pressable onPress={() => router.push("/(app)/missions" as never)}
              style={{ marginTop: 24, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>
                MISSIONS
              </Text>
              <Text style={{ color: doneGoals === totalGoals ? L.green : L.textSoft,
                fontSize: 11, fontWeight: "800" }}>
                {doneGoals}/{totalGoals}
              </Text>
              <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: L.card, overflow: "hidden" }}>
                <View style={{ height: 3, borderRadius: 2,
                  width: `${(doneGoals / totalGoals) * 100}%` as `${number}%`,
                  backgroundColor: doneGoals === totalGoals ? L.green : L.primary }} />
              </View>
              <Text style={{ color: L.muted, fontSize: 12 }}>→</Text>
            </Pressable>
          )}

          {/* ── ÉVÉNEMENTS ── */}
          {worldEvent && (
            <Pressable onPress={() => !worldEventJoined && joinWorldEvent()}
              style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: L.card, borderRadius: 12, padding: 14,
                borderWidth: 1, borderColor: worldEventJoined ? L.border : L.teal + "22" }}>
              <Text style={{ fontSize: 20 }}>{worldEvent.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: L.teal, fontSize: 9, fontWeight: "800", letterSpacing: 1 }}>
                  ÉVÉNEMENT
                </Text>
                <Text numberOfLines={1} style={{ color: L.text, fontSize: 13, fontWeight: "700", marginTop: 1 }}>
                  {worldEvent.title}
                </Text>
              </View>
              <Text style={{ color: worldEventJoined ? L.green : L.teal, fontSize: 12, fontWeight: "800" }}>
                {worldEventJoined ? "✓" : "+XP →"}
              </Text>
            </Pressable>
          )}

          {dailyEvent && !dailyEvent.resolved && (
            <Pressable onPress={() => setEventModalOpen(true)}
              style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: L.card, borderRadius: 12, padding: 14,
                borderWidth: 1, borderColor: L.primary + "18" }}>
              <Text style={{ fontSize: 18 }}>📅</Text>
              <Text numberOfLines={1} style={{ color: L.text, fontSize: 13, fontWeight: "700", flex: 1 }}>
                {dailyEvent.title}
              </Text>
              <Text style={{ color: L.primary, fontSize: 12, fontWeight: "800" }}>→</Text>
            </Pressable>
          )}

          {/* ── FEED ── 3 lignes max ── */}
          {lifeFeed.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 2 }}>
                LE FEED
              </Text>
              {lifeFeed.slice(0, 3).map((item, i) => (
                <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                  paddingVertical: 10,
                  borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: L.border }}>
                  <Text style={{ fontSize: 14 }}>
                    {item.id.includes("lvl") ? "⬆️" : item.id.includes("encounter") ? "👤" : "·"}
                  </Text>
                  <Text style={{ color: L.textSoft, fontSize: 13, flex: 1 }}>{item.title}</Text>
                </View>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── Toast ── */}
      {toast && (
        <Animated.View pointerEvents="none" style={{
          position: "absolute", bottom: 100, left: 24, right: 24,
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0,1], outputRange: [8,0] }) }],
        }}>
          <View style={{ backgroundColor: L.card, borderRadius: 12,
            paddingHorizontal: 20, paddingVertical: 13,
            borderWidth: 1, borderColor: L.primary + "25", alignItems: "center" }}>
            <Text style={{ color: L.text, fontSize: 14, fontWeight: "800" }}>{toast}</Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
