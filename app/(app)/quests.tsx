"use client";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { useGameStore } from "@/stores/game-store";
import type { DailyQuest, QuestCategory } from "@/lib/daily-quests";

const D = {
  bg:       "#0f1117",
  card:     "#1a1d27",
  card2:    "#22263a",
  text:     "#e8edf5",
  textSoft: "#8fa3b8",
  muted:    "#4a5568",
  border:   "#2a3148",
  primary:  "#6366f1",
  green:    "#10b981",
  gold:     "#f59e0b",
  red:      "#ef4444",
  purple:   "#8b5cf6",
  teal:     "#14b8a6",
  orange:   "#f97316",
};

const CAT_COLOR: Record<QuestCategory, string> = {
  survie:      D.orange,
  social:      D.primary,
  explore:     D.teal,
  progression: D.purple,
};
const CAT_LABEL: Record<QuestCategory, string> = {
  survie:      "Survie",
  social:      "Social",
  explore:     "Explorer",
  progression: "Progression",
};

function QuestCard({ quest, onClaim }: { quest: DailyQuest; onClaim: () => void }) {
  const color = CAT_COLOR[quest.category];
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    if (!quest.completed || quest.claimed) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(onClaim);
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        style={{
          backgroundColor: quest.claimed ? D.card : quest.completed ? color + "18" : D.card,
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: quest.claimed ? D.border : quest.completed ? color + "50" : D.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          shadowColor: quest.completed && !quest.claimed ? color : "transparent",
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 },
        }}>

        {/* Icône état */}
        <View style={{
          width: 48, height: 48, borderRadius: 16,
          backgroundColor: quest.claimed ? D.green + "15" : quest.completed ? color + "20" : D.card2,
          alignItems: "center", justifyContent: "center",
          borderWidth: 1,
          borderColor: quest.claimed ? D.green + "30" : quest.completed ? color + "40" : D.border,
        }}>
          <Text style={{ fontSize: 22 }}>
            {quest.claimed ? "✅" : quest.completed ? "🎁" : quest.emoji}
          </Text>
        </View>

        {/* Contenu */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <View style={{ backgroundColor: color + "20", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ color, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 }}>
                {CAT_LABEL[quest.category].toUpperCase()}
              </Text>
            </View>
            {quest.claimed && (
              <Text style={{ color: D.green, fontSize: 10, fontWeight: "700" }}>RÉCLAMÉ</Text>
            )}
          </View>
          <Text style={{
            color: quest.claimed ? D.muted : D.text,
            fontWeight: "800", fontSize: 15,
            textDecorationLine: quest.claimed ? "line-through" : "none",
          }}>
            {quest.title}
          </Text>
          <Text numberOfLines={1} style={{ color: D.textSoft, fontSize: 12, marginTop: 2 }}>
            {quest.description}
          </Text>
        </View>

        {/* Récompense */}
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={{ color: D.gold, fontSize: 12, fontWeight: "800" }}>+{quest.xpReward} XP</Text>
          {quest.moneyReward > 0 && (
            <Text style={{ color: D.green, fontSize: 11, fontWeight: "700" }}>+{quest.moneyReward} Wory</Text>
          )}
          {quest.completed && !quest.claimed && (
            <View style={{ backgroundColor: color, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>CLAIM</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function QuestsScreen() {
  const dailyQuests   = useGameStore((s) => s.dailyQuests ?? []);
  const claimReward   = useGameStore((s) => s.claimQuestReward);
  const playerLevel   = useGameStore((s) => s.playerLevel ?? 1);
  const playerXp      = useGameStore((s) => s.playerXp ?? 0);
  const worldEvent    = useGameStore((s) => s.worldEvent);
  const joined        = useGameStore((s) => s.worldEventJoined ?? false);
  const joinWorldEvent = useGameStore((s) => s.joinWorldEvent);

  const completed  = dailyQuests.filter((q) => q.completed).length;
  const claimed    = dailyQuests.filter((q) => q.claimed).length;
  const total      = dailyQuests.length;
  const allDone    = total > 0 && completed === total;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    function update() {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const diff = endOfDay.getTime() - now.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setTimeLeft(`${h}h${m.toString().padStart(2, "0")}m`);
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const xpNextLevel = playerLevel * 200;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: D.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={{ paddingTop: 54, paddingBottom: 24, paddingHorizontal: 20,
          backgroundColor: D.primary, overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -30, right: -20, width: 140, height: 140,
            borderRadius: 70, backgroundColor: "rgba(255,255,255,0.07)" }} />
          <Pressable onPress={() => router.back()}
            style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12,
              paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 16 }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 26 }}>Quêtes du jour</Text>
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 4 }}>
            {completed}/{total} accomplies · Refresh dans {timeLeft}
          </Text>

          {/* XP bar */}
          <View style={{ marginTop: 16, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700" }}>
                Niveau {playerLevel}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                {playerXp % 200}/{200} XP
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
              <View style={{ height: 8, borderRadius: 4,
                width: `${Math.min(100, ((playerXp % 200) / 200) * 100)}%` as `${number}%`,
                backgroundColor: "#fff" }} />
            </View>
          </View>
        </View>

        <View style={{ padding: 16, gap: 16, maxWidth: 640, width: "100%", alignSelf: "center" }}>

          {/* Progress banner */}
          {allDone && claimed < total && (
            <View style={{ backgroundColor: D.gold + "15", borderRadius: 18, padding: 16,
              borderWidth: 1, borderColor: D.gold + "40",
              flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 28 }}>🎉</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: D.gold, fontWeight: "900", fontSize: 15 }}>Toutes les quêtes terminées !</Text>
                <Text style={{ color: D.textSoft, fontSize: 12, marginTop: 2 }}>Clique sur chaque quête pour réclamer ta récompense.</Text>
              </View>
            </View>
          )}

          {/* Progress bar */}
          {total > 0 && (
            <View style={{ backgroundColor: D.card, borderRadius: 16, padding: 14,
              borderWidth: 1, borderColor: D.border, gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: D.text, fontWeight: "800", fontSize: 13 }}>Progression du jour</Text>
                <Text style={{ color: D.primary, fontWeight: "800", fontSize: 13 }}>{completed}/{total}</Text>
              </View>
              <View style={{ height: 10, borderRadius: 5, backgroundColor: D.border, overflow: "hidden" }}>
                <View style={{ height: 10, borderRadius: 5,
                  width: `${Math.round((completed / total) * 100)}%` as `${number}%`,
                  backgroundColor: D.primary }} />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {dailyQuests.map((q) => (
                  <View key={q.id} style={{ flex: 1, height: 4, borderRadius: 2,
                    backgroundColor: q.claimed ? D.green : q.completed ? D.gold : D.border }} />
                ))}
              </View>
            </View>
          )}

          {/* Quest list */}
          <Text style={{ color: D.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }}>
            QUÊTES ({total})
          </Text>
          {total === 0 ? (
            <View style={{ backgroundColor: D.card, borderRadius: 18, padding: 20, alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 32 }}>⏳</Text>
              <Text style={{ color: D.textSoft, fontSize: 14 }}>Les quêtes se chargent au prochain refresh…</Text>
              <Pressable onPress={() => router.back()}
                style={{ backgroundColor: D.primary, borderRadius: 12,
                  paddingHorizontal: 20, paddingVertical: 10 }}>
                <Text style={{ color: "#fff", fontWeight: "800" }}>Retour au jeu</Text>
              </Pressable>
            </View>
          ) : (
            dailyQuests.map((quest) => (
              <QuestCard key={quest.id} quest={quest} onClaim={() => claimReward(quest.id)} />
            ))
          )}

          {/* World Event */}
          {worldEvent && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: D.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }}>
                ÉVÉNEMENT MONDIAL
              </Text>
              <Pressable
                onPress={() => !joined && joinWorldEvent()}
                style={{
                  backgroundColor: joined ? D.card : D.teal + "15",
                  borderRadius: 20, padding: 18,
                  borderWidth: 1, borderColor: joined ? D.border : D.teal + "50",
                  flexDirection: "row", alignItems: "center", gap: 14,
                }}>
                <View style={{ width: 54, height: 54, borderRadius: 18,
                  backgroundColor: D.teal + "20", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 26 }}>{worldEvent.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: joined ? D.muted : D.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>
                    {worldEvent.city.emoji} {worldEvent.city.name.toUpperCase()}
                  </Text>
                  <Text style={{ color: D.text, fontWeight: "800", fontSize: 15, marginTop: 2 }}>
                    {worldEvent.title}
                  </Text>
                  <Text numberOfLines={2} style={{ color: D.textSoft, fontSize: 12, marginTop: 2, lineHeight: 18 }}>
                    {worldEvent.description}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                    <Text style={{ color: D.gold, fontSize: 11, fontWeight: "700" }}>+{worldEvent.xpReward} XP</Text>
                    <Text style={{ color: D.green, fontSize: 11, fontWeight: "700" }}>+{worldEvent.moneyReward} Wory</Text>
                    <Text style={{ color: D.purple, fontSize: 11, fontWeight: "700" }}>+{worldEvent.moodBonus} humeur</Text>
                    <Text style={{ color: D.textSoft, fontSize: 11 }}>👥 {worldEvent.participantCount}</Text>
                  </View>
                </View>
                {!joined ? (
                  <View style={{ backgroundColor: D.teal, borderRadius: 12,
                    paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>REJOINDRE</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: D.green + "20", borderRadius: 12,
                    paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text style={{ color: D.green, fontWeight: "800", fontSize: 12 }}>✓ REJOINT</Text>
                  </View>
                )}
              </Pressable>
            </View>
          )}

          {/* Tip */}
          <View style={{ backgroundColor: D.card, borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: D.border, flexDirection: "row", gap: 12 }}>
            <Text style={{ fontSize: 22 }}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: D.text, fontWeight: "700", fontSize: 13 }}>Comment gagner des quêtes ?</Text>
              <Text style={{ color: D.textSoft, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                Effectue des actions normalement depuis l'accueil. Les quêtes se complètent automatiquement selon tes actions.
              </Text>
            </View>
          </View>

        </View>
      </ScrollView>
    </Animated.View>
  );
}
