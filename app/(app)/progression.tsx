import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { getLevelTitle, getTalentPoints, getTalentsForCategory, isTalentUnlocked, LEVEL_MILESTONES, TALENTS, type TalentCategory } from "@/lib/progression";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

const XP_PER_LEVEL = 200;

const CATEGORIES: { id: TalentCategory; label: string; emoji: string; color: string }[] = [
  { id: "corps",   label: "Corps",   emoji: "💪", color: "#f6b94f" },
  { id: "esprit",  label: "Esprit",  emoji: "🧠", color: "#c084fc" },
  { id: "social",  label: "Social",  emoji: "😎", color: "#38c793" },
  { id: "travail", label: "Travail", emoji: "💼", color: "#60a5fa" },
];

function TalentNode({ talent, isUnlocked, canUnlock, onUnlock }: {
  talent: (typeof TALENTS)[0];
  isUnlocked: boolean;
  canUnlock: boolean;
  onUnlock: () => void;
}) {
  const cat = CATEGORIES.find((c) => c.id === talent.category);
  const nodeColor = cat?.color ?? colors.accent;

  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isUnlocked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isUnlocked]);

  const tierLabel = ["", "Tier I", "Tier II", "Tier III"][talent.tier];

  return (
    <Animated.View style={{
      opacity: isUnlocked ? glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) : 1
    }}>
      <View style={{
        backgroundColor: isUnlocked ? nodeColor + "18" : canUnlock ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
        borderRadius: 16, padding: 14, gap: 8,
        borderWidth: isUnlocked ? 2 : 1,
        borderColor: isUnlocked ? nodeColor : canUnlock ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20,
            backgroundColor: isUnlocked ? nodeColor + "25" : "rgba(255,255,255,0.06)",
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 20, opacity: isUnlocked || canUnlock ? 1 : 0.3 }}>{talent.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: isUnlocked ? nodeColor : canUnlock ? colors.text : colors.muted,
                fontWeight: "800", fontSize: 14 }}>
                {talent.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "600" }}>{tierLabel}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>{talent.description}</Text>
          </View>
          {isUnlocked && (
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: nodeColor,
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#000", fontWeight: "900", fontSize: 11 }}>✓</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>Niv. {talent.unlockLevel} requis</Text>
          {canUnlock && !isUnlocked && (
            <Pressable onPress={onUnlock}
              style={{ backgroundColor: nodeColor, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: "#000", fontWeight: "900", fontSize: 12 }}>Débloquer</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function ProgressionScreen() {
  const playerXp       = useGameStore((s) => s.playerXp ?? 0);
  const playerLevel    = useGameStore((s) => s.playerLevel ?? 1);
  const unlockedTalents = useGameStore((s) => s.unlockedTalents ?? []);
  const unlockTalent   = useGameStore((s) => s.unlockTalent);

  const [activeCategory, setActiveCategory] = useState<TalentCategory>("corps");

  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const xpInLevel  = playerXp % XP_PER_LEVEL;
  const xpPct      = (xpInLevel / XP_PER_LEVEL) * 100;
  const levelTitle = getLevelTitle(playerLevel);
  const talentPoints = getTalentPoints(playerLevel);
  const spentPoints  = unlockedTalents.length;
  const remainingPoints = talentPoints - spentPoints;

  const categoryTalents = getTalentsForCategory(activeCategory);
  const catColor = CATEGORIES.find((c) => c.id === activeCategory)?.color ?? colors.accent;

  // Next milestones
  const milestoneKeys = Object.keys(LEVEL_MILESTONES).map(Number).sort((a, b) => a - b);
  const nextMilestone = milestoneKeys.find((k) => k > playerLevel);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>⚡ Progression</Text>

          {/* Level card */}
          <View style={{ marginTop: 16, backgroundColor: "#f6b94f12", borderRadius: 18, padding: 16,
            borderWidth: 1.5, borderColor: "#f6b94f30", gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#f6b94f25",
                borderWidth: 2.5, borderColor: "#f6b94f",
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#f6b94f", fontWeight: "900", fontSize: 22 }}>{playerLevel}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#f6b94f", fontWeight: "900", fontSize: 18 }}>{levelTitle}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{playerXp} XP total</Text>
                {nextMilestone && (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Niveau {nextMilestone} → {LEVEL_MILESTONES[nextMilestone]}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#c084fc", fontWeight: "900", fontSize: 20 }}>{remainingPoints}</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>points talents</Text>
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>XP vers niveau {playerLevel + 1}</Text>
                <Text style={{ color: "#f6b94f", fontSize: 11, fontWeight: "700" }}>{xpInLevel}/{XP_PER_LEVEL}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <View style={{ height: 8, borderRadius: 4, width: `${xpPct}%`, backgroundColor: "#f6b94f" }} />
              </View>
            </View>
          </View>
        </View>

        <View style={{ padding: 20, gap: 20 }}>

          {/* Tab catégories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat.id;
                return (
                  <Pressable key={cat.id} onPress={() => setActiveCategory(cat.id)}
                    style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                      backgroundColor: active ? cat.color + "25" : "rgba(255,255,255,0.05)",
                      borderWidth: active ? 1.5 : 1,
                      borderColor: active ? cat.color + "60" : "rgba(255,255,255,0.08)" }}>
                    <Text style={{ color: active ? cat.color : colors.muted, fontWeight: "700", fontSize: 13 }}>
                      {cat.emoji} {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Talents de la catégorie */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: catColor, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
              ARBRE {activeCategory.toUpperCase()}
            </Text>
            {categoryTalents.map((talent, i) => {
              const isUnlocked = unlockedTalents.includes(talent.id);
              const canUnlock = !isUnlocked &&
                isTalentUnlocked(talent.id, unlockedTalents, playerLevel) &&
                remainingPoints > 0;
              // Connector line between tiers
              const prevTalent = i > 0 ? categoryTalents[i - 1] : null;
              const prevUnlocked = prevTalent ? unlockedTalents.includes(prevTalent.id) : true;

              return (
                <View key={talent.id}>
                  {i > 0 && (
                    <View style={{ alignItems: "center", marginVertical: 2 }}>
                      <View style={{ width: 2, height: 12,
                        backgroundColor: prevUnlocked ? catColor + "60" : "rgba(255,255,255,0.06)" }} />
                    </View>
                  )}
                  <TalentNode
                    talent={talent}
                    isUnlocked={isUnlocked}
                    canUnlock={canUnlock}
                    onUnlock={() => unlockTalent(talent.id)}
                  />
                </View>
              );
            })}
          </View>

          {/* Stats récap */}
          <View style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 16, gap: 10,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
              RÉCAPITULATIF
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ alignItems: "center", minWidth: 70 }}>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}>{unlockedTalents.length}</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>talents débloqués</Text>
              </View>
              <View style={{ alignItems: "center", minWidth: 70 }}>
                <Text style={{ color: "#f6b94f", fontWeight: "900", fontSize: 20 }}>{playerXp}</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>XP total</Text>
              </View>
              <View style={{ alignItems: "center", minWidth: 70 }}>
                <Text style={{ color: "#c084fc", fontWeight: "900", fontSize: 20 }}>{remainingPoints}</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>pts talents dispo</Text>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    </Animated.View>
  );
}
