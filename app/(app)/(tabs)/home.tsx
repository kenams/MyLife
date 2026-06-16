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

// ─── Quartier Life dark tokens ────────────────────────────────────────────────
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
  { id: "healthy-meal",  emoji: "🍱", label: "Manger propre",     costLabel: "14 bl",   gainLabel: "+Dalle +Forme",       category: "survie" },
  { id: "home-cooking",  emoji: "🍳", label: "Faire la popote",   costLabel: "8 bl",    gainLabel: "+Dalle économe",      category: "survie" },
  { id: "sleep",         emoji: "🛌", label: "Roupiller",         costLabel: "temps",   gainLabel: "+Pêche max",          category: "survie" },
  { id: "nap",           emoji: "💤", label: "Piquer un som",     costLabel: "temps",   gainLabel: "+Pêche rapide",       category: "survie" },
  { id: "shower",        emoji: "🚿", label: "Se laver",          costLabel: "3 bl",    gainLabel: "+Look +Mood",         category: "survie" },
  { id: "work-shift",    emoji: "💼", label: "Aller au taff",     costLabel: "pêche",   gainLabel: "+Thunes +Côte",       category: "travail", minEnergy: 20 },
  { id: "cafe-chat",     emoji: "☕", label: "Poser au bando",    costLabel: "8 bl",    gainLabel: "+Réseau +Mood",       category: "social",  minMoney: 8 },
  { id: "team-sport",    emoji: "🏀", label: "Terrain de foot",   costLabel: "pêche",   gainLabel: "+Réseau +Forme",      category: "social",  minEnergy: 25 },
  { id: "walk",          emoji: "🏃", label: "Faire un tour",     costLabel: "pêche",   gainLabel: "+Mood -Stress",       category: "santé" },
  { id: "gym",           emoji: "🏋️", label: "Aller à la salle",  costLabel: "12 bl",   gainLabel: "+Forme +Discipline",  category: "santé",   minEnergy: 22, minMoney: 12 },
  { id: "meditate",      emoji: "🧘", label: "Se poser",          costLabel: "temps",   gainLabel: "-Stress +Zen",        category: "santé" },
  { id: "read-book",     emoji: "📚", label: "S'instruire",       costLabel: "pêche",   gainLabel: "+Motivation",         category: "santé" },
  { id: "shopping",      emoji: "🛍️", label: "Le Marais / SNKRS", costLabel: "35 bl",   gainLabel: "+Look +Mood",         category: "social",  minMoney: 35 },
];

// ─── Daily Event Modal ────────────────────────────────────────────────────────
function DailyEventModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const dailyEvent        = useGameStore((s) => s.dailyEvent);
  const resolveDailyEvent = useGameStore((s) => s.resolveDailyEvent);
  if (!dailyEvent || dailyEvent.resolved || !visible) return null;

  const kindColor =
    dailyEvent.kind === "opportunity" ? L.primary :
    dailyEvent.kind === "windfall"    ? L.gold :
    dailyEvent.kind === "encounter"   ? L.purple :
    dailyEvent.kind === "social"      ? L.blue : L.red;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end", padding: 16 }}>
        <View style={{ backgroundColor: L.card, borderRadius: 24, padding: 24, gap: 20,
          borderWidth: 1, borderColor: kindColor + "20" }}>
          <View style={{ width: 32, height: 3, borderRadius: 2,
            backgroundColor: L.border, alignSelf: "center" }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Text style={{ fontSize: 32 }}>
              {dailyEvent.kind === "opportunity" ? "✨" :
               dailyEvent.kind === "windfall"    ? "🎁" :
               dailyEvent.kind === "encounter"   ? "👤" : "⚠️"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: kindColor, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                ÉVÉNEMENT DU JOUR
              </Text>
              <Text style={{ color: L.text, fontWeight: "900", fontSize: 18, marginTop: 2 }}>
                {dailyEvent.title}
              </Text>
            </View>
          </View>
          <Text style={{ color: L.textSoft, fontSize: 14, lineHeight: 22 }}>{dailyEvent.body}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => { resolveDailyEvent("accepted"); onClose(); }}
              style={{ flex: 2, paddingVertical: 16, borderRadius: 14,
                backgroundColor: kindColor, alignItems: "center" }}>
              <Text style={{ color: "#080808", fontWeight: "900", fontSize: 15 }}>
                {dailyEvent.actionLabel}
              </Text>
            </Pressable>
            {dailyEvent.kind !== "windfall" && (
              <Pressable onPress={() => { resolveDailyEvent("skipped"); onClose(); }}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 14,
                  backgroundColor: L.cardAlt, borderWidth: 1, borderColor: L.border,
                  alignItems: "center" }}>
                <Text style={{ color: L.muted, fontWeight: "700", fontSize: 14 }}>Passer</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── StatRow — barre horizontal ultra simple ─────────────────────────────────
function StatRow({ emoji, label, value, urgent }: {
  emoji: string; label: string; value: number; urgent: boolean;
}) {
  const pct   = Math.max(0, Math.min(100, value));
  const color = urgent ? L.red : pct > 60 ? L.green : L.gold;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: L.border }}>
      <Text style={{ fontSize: 16, width: 22 }}>{emoji}</Text>
      <Text style={{ color: L.textSoft, fontSize: 13, fontWeight: "600", width: 52 }}>{label}</Text>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)" }}>
        <View style={{ height: 4, borderRadius: 2, width: `${pct}%` as `${number}%`,
          backgroundColor: color,
          shadowColor: color, shadowOpacity: 0.6, shadowRadius: 4 }} />
      </View>
      <Text style={{ color: urgent ? L.red : L.muted, fontSize: 12, fontWeight: "800", width: 28,
        textAlign: "right" }}>
        {Math.round(pct)}
      </Text>
    </View>
  );
}

// ─── ActionRow — liste verticale simple ──────────────────────────────────────
function ActionRow({ action, onPress, disabled, highlighted }: {
  action: ActionDef; onPress: () => void; disabled: boolean; highlighted?: boolean;
}) {
  return (
    <Pressable onPress={() => { hapticImpact("light"); onPress(); }} disabled={disabled}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: L.border,
        opacity: disabled ? 0.35 : 1 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12,
        backgroundColor: highlighted ? L.primary + "18" : L.cardAlt,
        borderWidth: highlighted ? 1 : 0,
        borderColor: highlighted ? L.primary + "40" : "transparent",
        alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 20 }}>{action.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: highlighted ? L.primary : L.text, fontSize: 15, fontWeight: "800" }}>
          {action.label}
        </Text>
        <Text style={{ color: L.muted, fontSize: 12, marginTop: 1 }}>{action.gainLabel}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text style={{ color: L.muted, fontSize: 11 }}>{action.costLabel}</Text>
        {highlighted && (
          <View style={{ backgroundColor: L.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: "#080808", fontSize: 9, fontWeight: "900" }}>MAINTENANT</Text>
          </View>
        )}
      </View>
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
  const dailyQuests      = useGameStore((s) => s.dailyQuests ?? []);
  const worldEvent       = useGameStore((s) => s.worldEvent);
  const worldEventJoined = useGameStore((s) => s.worldEventJoined ?? false);
  const joinWorldEvent   = useGameStore((s) => s.joinWorldEvent);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  useFocusEffect(useCallback(() => { bootstrap(); checkHousingRent(); }, [bootstrap, checkHousingRent]));

  const timeCtx   = useTimeContext();
  const wellbeing = getWellbeingScore(stats);
  const housing   = getHousingTier(housingTier);
  const suggested = getSuggestedActions(timeCtx);
  const doneGoals = dailyGoals.filter((g) => g.completed).length;
  const totalGoals= dailyGoals.length;

  const isAvailable = (a: ActionDef) => {
    if (a.minEnergy && stats.energy < a.minEnergy) return false;
    if (a.minMoney  && stats.money  < a.minMoney)  return false;
    if (a.id === "work-shift" && !timeCtx.workAvailable) return false;
    return true;
  };

  // Crises triées par urgence
  const crises = [
    stats.hunger < 18  && { emoji: "🍱", label: "T'as la dalle",    action: "healthy-meal" as LifeActionId },
    stats.energy < 15  && { emoji: "🛌", label: "T'es à plat",      action: "sleep"        as LifeActionId },
    stats.hygiene < 15 && { emoji: "👟", label: "Look au fond",      action: "shower"       as LifeActionId },
    stats.mood < 15    && { emoji: "🧘", label: "Mood à zéro",       action: "meditate"     as LifeActionId },
    stats.money < 20   && { emoji: "💼", label: "Plus de thunes",    action: "work-shift"   as LifeActionId },
  ].filter(Boolean) as { emoji: string; label: string; action: LifeActionId }[];

  const topCrisis  = crises[0];
  const actionById = new Map(ALL_ACTIONS.map((a) => [a.id, a]));

  // Liste courte : crise en premier, puis suggestions, puis essentiels
  const listIds = Array.from(new Set([
    topCrisis?.action,
    ...suggested,
    "work-shift", "healthy-meal", "sleep", "shower", "walk",
  ].filter(Boolean) as LifeActionId[])).slice(0, 6);
  const listActions = listIds.map((id) => actionById.get(id)).filter(Boolean) as ActionDef[];

  // Toast
  const [toast, setToast]   = useState<{ text: string } | null>(null);
  const toastAnim            = useRef(new Animated.Value(0)).current;
  const toastTimer           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim             = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  function showToast(text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }

  function handleAction(id: LifeActionId) {
    performAction(id);
    hapticImpact("medium");
    const msgs: Record<string, string> = {
      "work-shift":    "+thunes  +côte 💰",
      "sleep":         "pêche rechargée ⚡",
      "nap":           "+pêche rapide ⚡",
      "healthy-meal":  "+dalle  +forme 🍱",
      "home-cooking":  "+dalle 🍳",
      "shower":        "+look  +mood 👟",
      "walk":          "+mood  -stress 🏃",
      "gym":           "+forme 💪",
      "meditate":      "-stress  +zen 🧘",
      "cafe-chat":     "+réseau ☕",
      "team-sport":    "+réseau  +forme 🏀",
      "read-book":     "+motivation 📚",
      "shopping":      "+look 🛍️",
    };
    showToast(msgs[id] ?? "+xp 🔥");
  }

  // Stats à surveiller — seulement celles en danger ou quasi-danger
  const statRows = [
    { emoji: "⚡", label: "Pêche",  value: stats.energy,   urgent: stats.energy < 20   },
    { emoji: "🍱", label: "Dalle",  value: stats.hunger,   urgent: stats.hunger < 18   },
    { emoji: "👟", label: "Look",   value: stats.hygiene,  urgent: stats.hygiene < 15  },
    { emoji: "😤", label: "Mood",   value: stats.mood,     urgent: stats.mood < 15     },
  ].sort((a, b) => a.value - b.value); // les plus basses en premier

  const wbColor = wellbeing > 65 ? L.green : wellbeing > 40 ? L.gold : L.red;

  return (
    <Animated.View style={{ flex: 1, backgroundColor: L.bg, opacity: fadeAnim }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <DailyEventModal visible={eventModalOpen} onClose={() => setEventModalOpen(false)} />

        {/* ── HEADER ── */}
        <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: L.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22,
              backgroundColor: L.cardAlt, borderWidth: 1, borderColor: L.border,
              alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {avatar
                ? <AvatarSprite visual={getAvatarVisual(avatar)} action={stats.energy < 20 ? "sleeping" : "idle"} size="sm" />
                : <Text style={{ fontSize: 22 }}>🧢</Text>
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: L.text, fontSize: 16, fontWeight: "900" }}>
                {avatar?.displayName ?? "Mon perso"}
              </Text>
              <Text style={{ color: L.muted, fontSize: 12, marginTop: 1 }}>
                {timeCtx.weatherEmoji} {timeCtx.label} · Niv. {playerLevel}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Text style={{ color: L.primary, fontSize: 15, fontWeight: "900" }}>
                💰 {stats.money} bl
              </Text>
              <Text style={{ color: L.muted, fontSize: 11 }}>
                {housing.emoji} {housing.name}
              </Text>
            </View>
          </View>

          {/* Barre de vie simple */}
          <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: L.cardAlt }}>
              <View style={{ height: 3, borderRadius: 2,
                width: `${Math.max(0, Math.min(100, wellbeing))}%` as `${number}%`,
                backgroundColor: wbColor,
                shadowColor: wbColor, shadowOpacity: 0.8, shadowRadius: 4 }} />
            </View>
            <Text style={{ color: wbColor, fontSize: 12, fontWeight: "800", minWidth: 40, textAlign: "right" }}>
              {wellbeing}%
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>

          {/* ── FOCUS — UNE SEULE ACTION URGENTE ── */}
          {topCrisis && (
            <Pressable
              onPress={() => { const a = actionById.get(topCrisis.action); if (a && isAvailable(a)) handleAction(topCrisis.action); }}
              style={{ marginTop: 24, backgroundColor: L.cardAlt, borderRadius: 16,
                padding: 18, flexDirection: "row", alignItems: "center", gap: 14,
                borderWidth: 1, borderColor: L.red + "25" }}>
              <View style={{ width: 48, height: 48, borderRadius: 14,
                backgroundColor: L.red + "12", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 26 }}>{topCrisis.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: L.red, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>
                  URGENT
                </Text>
                <Text style={{ color: L.text, fontSize: 17, fontWeight: "900", marginTop: 2 }}>
                  {topCrisis.label}
                </Text>
              </View>
              <View style={{ backgroundColor: L.red, borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>Go →</Text>
              </View>
            </Pressable>
          )}

          {/* ── ÉTAT ── */}
          <View style={{ marginTop: 28 }}>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2,
              marginBottom: 4 }}>
              TON ÉTAT
            </Text>
            {statRows.map((s) => (
              <StatRow key={s.label} {...s} />
            ))}
          </View>

          {/* ── CE QUE TU FAIS ── */}
          <View style={{ marginTop: 28 }}>
            <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2,
              marginBottom: 4 }}>
              CE QUE TU FAIS
            </Text>
            {listActions.map((action, i) => (
              <ActionRow
                key={action.id}
                action={action}
                highlighted={i === 0 && !topCrisis}
                disabled={!isAvailable(action)}
                onPress={() => handleAction(action.id)}
              />
            ))}
          </View>

          {/* ── MISSIONS DU JOUR ── */}
          {totalGoals > 0 && (
            <Pressable onPress={() => router.push("/(app)/missions" as never)}
              style={{ marginTop: 28, flexDirection: "row", alignItems: "center",
                justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>
                  MISSIONS
                </Text>
                <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
                  backgroundColor: doneGoals === totalGoals ? L.green + "18" : L.cardAlt }}>
                  <Text style={{ color: doneGoals === totalGoals ? L.green : L.textSoft,
                    fontSize: 11, fontWeight: "800" }}>
                    {doneGoals}/{totalGoals}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: L.cardAlt,
                marginHorizontal: 14 }}>
                <View style={{ height: 3, borderRadius: 2,
                  width: `${totalGoals > 0 ? (doneGoals / totalGoals) * 100 : 0}%` as `${number}%`,
                  backgroundColor: L.primary }} />
              </View>
              <Text style={{ color: L.muted, fontSize: 12 }}>→</Text>
            </Pressable>
          )}

          {/* ── ÉVÉNEMENT MONDIAL ── */}
          {worldEvent && (
            <Pressable onPress={() => !worldEventJoined && joinWorldEvent()}
              style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: L.cardAlt, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: worldEventJoined ? L.border : L.teal + "25" }}>
              <Text style={{ fontSize: 22 }}>{worldEvent.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: L.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>
                  ÉVÉNEMENT · {worldEvent.city.name.toUpperCase()}
                </Text>
                <Text numberOfLines={1} style={{ color: L.text, fontSize: 13, fontWeight: "700",
                  marginTop: 1 }}>
                  {worldEvent.title}
                </Text>
              </View>
              <Text style={{ color: worldEventJoined ? L.green : L.teal, fontSize: 12,
                fontWeight: "800" }}>
                {worldEventJoined ? "✓" : "+XP →"}
              </Text>
            </Pressable>
          )}

          {/* ── ÉVÉNEMENT DU JOUR ── */}
          {dailyEvent && !dailyEvent.resolved && (
            <Pressable onPress={() => setEventModalOpen(true)}
              style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: L.cardAlt, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: L.primary + "20" }}>
              <Text style={{ fontSize: 22 }}>📅</Text>
              <Text numberOfLines={1} style={{ color: L.text, fontSize: 13, fontWeight: "700",
                flex: 1 }}>
                {dailyEvent.title}
              </Text>
              <Text style={{ color: L.primary, fontSize: 12, fontWeight: "800" }}>→</Text>
            </Pressable>
          )}

          {/* ── FEED — 3 lignes max ── */}
          {lifeFeed.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2,
                marginBottom: 4 }}>
                LE FEED
              </Text>
              {lifeFeed.slice(0, 3).map((item, i) => (
                <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 12,
                  paddingVertical: 10,
                  borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: L.border }}>
                  <Text style={{ fontSize: 14 }}>
                    {item.id.includes("lvl") ? "⬆️" : item.id.includes("encounter") ? "👤" : "·"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: L.textSoft, fontSize: 13 }}>{item.title}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      {/* Toast */}
      {toast && (
        <Animated.View pointerEvents="none" style={{
          position: "absolute", bottom: 100, left: 20, right: 20,
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0,1], outputRange: [10,0] }) }],
        }}>
          <View style={{ backgroundColor: L.card, borderRadius: 14,
            paddingHorizontal: 20, paddingVertical: 13,
            borderWidth: 1, borderColor: L.primary + "30",
            alignItems: "center" }}>
            <Text style={{ color: L.text, fontSize: 14, fontWeight: "800" }}>{toast.text}</Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
