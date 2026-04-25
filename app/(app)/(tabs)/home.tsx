"use client";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual } from "@/lib/avatar-visual";

import { getHousingTier } from "@/lib/housing";
import { getWellbeingScore } from "@/lib/selectors";
import { getSuggestedActions, useTimeContext } from "@/lib/time-context";
import { colors } from "@/lib/theme";
import type { LifeActionId } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

// ─── Constantes ───────────────────────────────────────────────────────────────

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
  { id: "healthy-meal",  emoji: "🍱", label: "Repas sain",     costLabel: "14 cr",   gainLabel: "+Faim +Santé",       category: "survie" },
  { id: "home-cooking",  emoji: "🍳", label: "Cuisiner",        costLabel: "8 cr",    gainLabel: "+Faim ×2 économique",category: "survie" },
  { id: "sleep",         emoji: "🛌", label: "Dormir",          costLabel: "temps",   gainLabel: "+Énergie max",        category: "survie" },
  { id: "nap",           emoji: "💤", label: "Sieste 20 min",   costLabel: "temps",   gainLabel: "+Énergie rapide",     category: "survie" },
  { id: "shower",        emoji: "🚿", label: "Douche",          costLabel: "3 cr",    gainLabel: "+Hygiène +Humeur",    category: "survie" },
  { id: "work-shift",    emoji: "💼", label: "Travailler",      costLabel: "énergie", gainLabel: "+Argent +Rép",        category: "travail", minEnergy: 20 },
  { id: "cafe-chat",     emoji: "☕", label: "Café social",     costLabel: "8 cr",    gainLabel: "+Social +Humeur",     category: "social",  minMoney: 8 },
  { id: "team-sport",    emoji: "🏀", label: "Sport collectif", costLabel: "énergie", gainLabel: "+Social +Forme",      category: "social",  minEnergy: 25 },
  { id: "walk",          emoji: "🏃", label: "Marcher",         costLabel: "énergie", gainLabel: "+Humeur -Stress",     category: "santé" },
  { id: "gym",           emoji: "🏋️", label: "Salle de sport",  costLabel: "12 cr",   gainLabel: "+Forme +Discipline",  category: "santé",   minEnergy: 22, minMoney: 12 },
  { id: "meditate",      emoji: "🧘", label: "Méditer",         costLabel: "temps",   gainLabel: "-Stress +Zen",        category: "santé" },
  { id: "read-book",     emoji: "📚", label: "Lire",            costLabel: "énergie", gainLabel: "+Motivation +Calme",  category: "santé" },
  { id: "shopping",      emoji: "🛍️", label: "Shopping",        costLabel: "35 cr",   gainLabel: "+Image +Humeur",      category: "social",  minMoney: 35 },
];

const CATEGORY_COLORS: Record<ActionDef["category"], string> = {
  survie:  "#f97316",
  travail: "#3b82f6",
  social:  "#a855f7",
  santé:   "#22c55e",
};

// ─── Event du jour Modal ──────────────────────────────────────────────────────

function DailyEventModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const dailyEvent = useGameStore((s) => s.dailyEvent);
  const resolveDailyEvent = useGameStore((s) => s.resolveDailyEvent);
  if (!dailyEvent || dailyEvent.resolved || !visible) return null;

  const kindColor =
    dailyEvent.kind === "opportunity" ? colors.accent :
    dailyEvent.kind === "windfall"    ? colors.gold :
    dailyEvent.kind === "encounter"   ? colors.purple :
    dailyEvent.kind === "social"      ? colors.blue : colors.danger;
  const kindEmoji =
    dailyEvent.kind === "opportunity" ? "✨" :
    dailyEvent.kind === "windfall"    ? "🎁" :
    dailyEvent.kind === "encounter"   ? "👤" :
    dailyEvent.kind === "social"      ? "🤝" : "⚠️";

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end", padding: 16 }}>
        <View style={{
          backgroundColor: "#0d1117", borderRadius: 28, padding: 24, gap: 18,
          borderWidth: 1.5, borderColor: kindColor + "40",
          shadowColor: kindColor, shadowOpacity: 0.4, shadowRadius: 40,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: kindColor + "20",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 28 }}>{kindEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: kindColor, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 2 }}>
                ÉVÉNEMENT DU JOUR
              </Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{dailyEvent.title}</Text>
            </View>
          </View>
          <Text style={{ color: colors.textSoft, fontSize: 14, lineHeight: 22 }}>{dailyEvent.body}</Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: kindColor + "12", borderRadius: 14, padding: 12,
              borderWidth: 1, borderColor: kindColor + "30" }}>
              <Text style={{ color: kindColor, fontWeight: "800", fontSize: 12, marginBottom: 6 }}>✓ {dailyEvent.actionLabel}</Text>
              {Object.entries(dailyEvent.effects).filter(([, v]) => v).map(([k, v]) => (
                <Text key={k} style={{ color: colors.accent, fontSize: 11 }}>
                  {(v as number) > 0 ? "+" : ""}{v} {k}
                </Text>
              ))}
            </View>
            {dailyEvent.kind !== "windfall" && (
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 12,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>✗ Ignorer</Text>
                {Object.entries(dailyEvent.skipEffects).filter(([, v]) => v).map(([k, v]) => (
                  <Text key={k} style={{ color: colors.danger, fontSize: 11 }}>
                    {(v as number) > 0 ? "+" : ""}{v} {k}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => { resolveDailyEvent("accepted"); onClose(); }}
              style={{ flex: 2, paddingVertical: 16, borderRadius: 16, backgroundColor: kindColor + "22",
                borderWidth: 1.5, borderColor: kindColor + "55", alignItems: "center" }}>
              <Text style={{ color: kindColor, fontWeight: "900", fontSize: 15 }}>{dailyEvent.actionLabel}</Text>
            </Pressable>
            {dailyEvent.kind !== "windfall" && (
              <Pressable onPress={() => { resolveDailyEvent("skipped"); onClose(); }}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center" }}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Passer</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function NeedTile({ emoji, label, value, color }: { emoji: string; label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const urgent = pct < 25;
  const displayColor = urgent ? colors.danger : pct < 45 ? colors.gold : color;
  return (
    <View style={{
      flex: 1,
      minWidth: 138,
      backgroundColor: displayColor + "12",
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: displayColor + "35",
      gap: 9,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
        <Text style={{ color: displayColor, fontSize: 20, fontWeight: "900" }}>{Math.round(pct)}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>{label}</Text>
      <View style={{ height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <View style={{ height: 6, borderRadius: 999, width: `${pct}%` as `${number}%`, backgroundColor: displayColor }} />
      </View>
    </View>
  );
}

function SimpleActionButton({
  action,
  onPress,
  disabled,
  primary = false,
}: {
  action: ActionDef;
  onPress: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  const color = CATEGORY_COLORS[action.category];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        minWidth: 150,
        borderRadius: 16,
        padding: 14,
        gap: 8,
        backgroundColor: primary ? color : color + "12",
        borderWidth: 1,
        borderColor: primary ? color : color + "35",
        opacity: disabled ? 0.45 : 1,
      }}>
      <Text style={{ fontSize: 24 }}>{action.emoji}</Text>
      <Text style={{ color: primary ? "#06120d" : colors.text, fontSize: 14, fontWeight: "900" }}>
        {action.label}
      </Text>
      <Text numberOfLines={1} style={{ color: primary ? "rgba(6,18,13,0.72)" : color, fontSize: 11, fontWeight: "700" }}>
        {action.gainLabel}
      </Text>
    </Pressable>
  );
}

// ─── Screen principal ─────────────────────────────────────────────────────────

export default function HomeScreen() {
  const avatar           = useGameStore((s) => s.avatar);
  const stats            = useGameStore((s) => s.stats);
  const currentLocation  = useGameStore((s) => s.currentLocationSlug);
  const performAction    = useGameStore((s) => s.performAction);
  const dailyGoals       = useGameStore((s) => s.dailyGoals);
  const bootstrap        = useGameStore((s) => s.bootstrap);
  const dailyEvent       = useGameStore((s) => s.dailyEvent);
  const playerLevel      = useGameStore((s) => s.playerLevel ?? 1);
  const housingTier      = useGameStore((s) => s.housingTier);
  const checkHousingRent = useGameStore((s) => s.checkHousingRent);
  const lifeFeed         = useGameStore((s) => s.lifeFeed ?? []);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  useFocusEffect(useCallback(() => { bootstrap(); checkHousingRent(); }, [bootstrap, checkHousingRent]));

  const timeCtx     = useTimeContext();
  const wellbeing   = getWellbeingScore(stats);
  const housing     = getHousingTier(housingTier);
  const suggested   = getSuggestedActions(timeCtx);
  const doneGoals   = dailyGoals.filter((g) => g.completed).length;
  const totalGoals  = dailyGoals.length;
  const goalPct     = totalGoals > 0 ? (doneGoals / totalGoals) * 100 : 0;
  const wbColor     = wellbeing > 65 ? colors.accent : wellbeing > 40 ? colors.gold : colors.danger;

  const isAvailable = (a: ActionDef) => {
    if (a.minEnergy && stats.energy < a.minEnergy) return false;
    if (a.minMoney  && stats.money  < a.minMoney)  return false;
    if (a.id === "work-shift" && !timeCtx.workAvailable) return false;
    return true;
  };

  // Alertes critiques
  const crises = [
    stats.hunger < 18  && { emoji: "🍱", title: "Ton personnage a faim", body: "Mange maintenant pour récupérer.", action: "healthy-meal" as LifeActionId },
    stats.energy < 15  && { emoji: "🛌", title: "Il est épuisé", body: "Dors pour reprendre de l'énergie.", action: "sleep" as LifeActionId },
    stats.hygiene < 15 && { emoji: "🚿", title: "Hygiène trop basse", body: "Prends une douche avant de socialiser.", action: "shower" as LifeActionId },
    stats.mood < 15    && { emoji: "🧘", title: "Moral très bas", body: "Fais une pause calme.", action: "meditate" as LifeActionId },
    stats.money < 20   && { emoji: "💼", title: "Budget serré", body: "Travaille dès que possible.", action: "work-shift" as LifeActionId },
  ].filter(Boolean) as { emoji: string; title: string; body: string; action: LifeActionId }[];
  const primaryCrisis = crises[0];
  const actionById = new Map(ALL_ACTIONS.map((action) => [action.id, action]));
  const quickActionIds = Array.from(new Set([
    primaryCrisis?.action,
    ...suggested,
    "healthy-meal",
    "sleep",
    "shower",
    "work-shift",
    "walk",
  ].filter(Boolean) as LifeActionId[])).slice(0, 4);
  const quickActions = quickActionIds
    .map((id) => actionById.get(id))
    .filter(Boolean) as ActionDef[];
  const primaryAction = primaryCrisis ? actionById.get(primaryCrisis.action) : quickActions[0];
  const locationLabel = currentLocation === "home" ? "Chez toi" : currentLocation;
  const keyNeeds = [
    { emoji: "🍱", label: "Faim", value: stats.hunger, color: colors.gold },
    { emoji: "⚡", label: "Énergie", value: stats.energy, color: colors.blue },
    { emoji: "🚿", label: "Hygiène", value: stats.hygiene, color: colors.teal },
    { emoji: "😊", label: "Moral", value: stats.mood, color: colors.purple },
    { emoji: "❤️", label: "Santé", value: stats.health, color: colors.danger },
    { emoji: "👥", label: "Social", value: stats.sociability, color: colors.accent },
    { emoji: "✨", label: "Image", value: stats.attractiveness, color: colors.purple },
    { emoji: "🧘", label: "Zen", value: 100 - stats.stress, color: "#a78bfa" },
  ].sort((a, b) => a.value - b.value).slice(0, 4);
  const nextGoal = dailyGoals.find((goal) => !goal.completed);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}>
        <DailyEventModal visible={eventModalOpen} onClose={() => setEventModalOpen(false)} />

        <View style={{
          width: "100%",
          maxWidth: 980,
          alignSelf: "center",
          paddingHorizontal: 16,
          paddingTop: 38,
          gap: 16,
        }}>
          <View style={{
            borderRadius: 24,
            padding: 18,
            backgroundColor: "#07111f",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            gap: 16,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 74, height: 74, alignItems: "center", justifyContent: "center" }}>
                <View style={{
                  position: "absolute",
                  width: 74,
                  height: 74,
                  borderRadius: 37,
                  backgroundColor: wbColor + "18",
                  borderWidth: 2,
                  borderColor: wbColor + "55",
                }} />
                {avatar ? (
                  <AvatarSprite
                    visual={getAvatarVisual(avatar)}
                    action={stats.energy < 20 ? "sleeping" : "idle"}
                    size="sm"
                  />
                ) : (
                  <Text style={{ fontSize: 34 }}>🧑</Text>
                )}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 24 }}>
                  {avatar?.displayName ?? "Mon personnage"}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.textSoft, fontSize: 12, marginTop: 3 }}>
                  {timeCtx.weatherEmoji} {timeCtx.label} · {locationLabel}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end", gap: 7 }}>
                <View style={{ backgroundColor: colors.goldGlow, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }}>
                  <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 13 }}>💰 {stats.money}</Text>
                </View>
                <Pressable onPress={() => router.push("/(app)/housing" as never)}
                  style={{ backgroundColor: housing.color + "16", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
                    borderWidth: 1, borderColor: housing.color + "38" }}>
                  <Text style={{ color: housing.color, fontWeight: "800", fontSize: 11 }}>{housing.emoji} {housing.name}</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ gap: 7 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: wbColor, fontSize: 12, fontWeight: "900" }}>État général {wellbeing}%</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Niveau {playerLevel}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <View style={{ height: 8, borderRadius: 999, width: `${Math.max(0, Math.min(100, wellbeing))}%` as `${number}%`, backgroundColor: wbColor }} />
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => primaryAction ? performAction(primaryAction.id) : router.push("/(app)/(tabs)/world" as never)}
            style={{
              borderRadius: 22,
              padding: 18,
              backgroundColor: primaryCrisis ? "rgba(255,92,92,0.14)" : "rgba(56,199,147,0.12)",
              borderWidth: 1,
              borderColor: primaryCrisis ? "rgba(255,92,92,0.36)" : "rgba(56,199,147,0.32)",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}>
            <Text style={{ fontSize: 30 }}>{primaryCrisis?.emoji ?? "✅"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: primaryCrisis ? colors.danger : colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 }}>
                PRIORITÉ
              </Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18, marginTop: 2 }}>
                {primaryCrisis?.title ?? "Tout est stable"}
              </Text>
              <Text numberOfLines={2} style={{ color: colors.textSoft, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
                {primaryCrisis?.body ?? "Tu peux explorer la ville, progresser ou socialiser."}
              </Text>
              {crises.length > 1 && (
                <Text style={{ color: colors.danger, fontSize: 11, fontWeight: "800", marginTop: 6 }}>
                  +{crises.length - 1} autre{crises.length > 2 ? "s" : ""} point{crises.length > 2 ? "s" : ""} à régler
                </Text>
              )}
            </View>
            <View style={{
              backgroundColor: primaryCrisis ? colors.danger : colors.accent,
              borderRadius: 14,
              paddingHorizontal: 13,
              paddingVertical: 10,
            }}>
              <Text style={{ color: "#07111f", fontWeight: "900", fontSize: 12 }}>
                {primaryAction?.label ?? "Ville"}
              </Text>
            </View>
          </Pressable>

          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }}>
              À SURVEILLER
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {keyNeeds.map((need) => (
                <NeedTile key={need.label} {...need} />
              ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }}>
              ACTIONS RAPIDES
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {quickActions.map((action, index) => (
                <SimpleActionButton
                  key={action.id}
                  action={action}
                  primary={index === 0}
                  disabled={!isAvailable(action)}
                  onPress={() => performAction(action.id)}
                />
              ))}
            </View>
          </View>

          <View style={{
            borderRadius: 20,
            padding: 16,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.07)",
            gap: 12,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>Objectif du jour</Text>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "900" }}>{doneGoals}/{totalGoals}</Text>
            </View>
            <View style={{ height: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <View style={{ height: 7, borderRadius: 999, width: `${goalPct}%` as `${number}%`, backgroundColor: colors.accent }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: nextGoal ? "rgba(255,255,255,0.08)" : colors.accent + "25", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: nextGoal ? colors.muted : colors.accent, fontSize: 12 }}>{nextGoal ? "1" : "✓"}</Text>
              </View>
              <Text numberOfLines={1} style={{ color: colors.textSoft, fontSize: 13, flex: 1 }}>
                {nextGoal?.label ?? "Tous les objectifs sont terminés."}
              </Text>
              <Pressable onPress={() => router.push("/(app)/missions" as never)}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>Voir</Text>
              </Pressable>
            </View>
          </View>

          {dailyEvent && !dailyEvent.resolved && (
            <Pressable onPress={() => setEventModalOpen(true)}
              style={{
                backgroundColor: colors.goldGlow,
                borderRadius: 18,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.gold + "35",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}>
              <Text style={{ fontSize: 22 }}>📅</Text>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "800", flex: 1 }}>
                {dailyEvent.title}
              </Text>
              <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "900" }}>Ouvrir</Text>
            </Pressable>
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { emoji: "🗺️", label: "Ville", route: "/(app)/(tabs)/world" },
              { emoji: "💊", label: "Santé", route: "/(app)/health" },
              { emoji: "💼", label: "Travail", route: "/(app)/work" },
              { emoji: "👥", label: "Relations", route: "/(app)/relations" },
            ].map((item) => (
              <Pressable key={item.route} onPress={() => router.push(item.route as never)}
                style={{ flexDirection: "row", alignItems: "center", gap: 7,
                  backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 999,
                  paddingHorizontal: 13, paddingVertical: 9,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
                <Text style={{ color: colors.textSoft, fontSize: 12, fontWeight: "800" }}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          {lifeFeed.length > 0 && (
            <View style={{ opacity: 0.72 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginBottom: 8 }}>
                DERNIER ÉVÉNEMENT
              </Text>
              <View style={{ backgroundColor: "rgba(255,255,255,0.035)", borderRadius: 16, padding: 13,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: colors.textSoft, fontWeight: "800", fontSize: 13 }}>{lifeFeed[0].title}</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{lifeFeed[0].body}</Text>
              </View>
            </View>
          )}

          <View style={{ height: 8 }} />
        </View>
      </ScrollView>
    </Animated.View>
  );
}
