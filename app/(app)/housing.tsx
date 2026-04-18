import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { canAffordHousing, getHousingTier, HOUSING_TIERS, type HousingTier, type HousingTierId } from "@/lib/housing";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

function ConditionBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 16, height: 16, borderRadius: 8,
        backgroundColor: ok ? colors.accent + "30" : colors.danger + "20",
        alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 8, color: ok ? colors.accent : colors.danger, fontWeight: "900" }}>
          {ok ? "✓" : "✗"}
        </Text>
      </View>
      <Text style={{ color: ok ? colors.textSoft : colors.muted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function TierCard({ tier, current, canAfford, money, level, reputation, streak, onUpgrade }: {
  tier: HousingTier;
  current: boolean;
  canAfford: boolean;
  money: number;
  level: number;
  reputation: number;
  streak: number;
  onUpgrade: () => void;
}) {
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (!current) return;
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
    ])).start();
  }, [current]);

  const locked = !canAfford && !current;

  return (
    <Animated.View style={{
      opacity: locked ? 0.6 : glowAnim,
      shadowColor: current ? tier.color : "transparent",
      shadowOpacity: current ? 0.3 : 0,
      shadowRadius: 16,
    }}>
      <View style={{
        backgroundColor: current ? tier.color + "12" : canAfford ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
        borderRadius: 20, padding: 18, gap: 12,
        borderWidth: current ? 2 : 1,
        borderColor: current ? tier.color : canAfford ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
      }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16,
            backgroundColor: tier.color + "20",
            borderWidth: current ? 2.5 : 1.5, borderColor: tier.color + (current ? "99" : "44"),
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 28 }}>{tier.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: tier.color, fontWeight: "900", fontSize: 17 }}>{tier.name}</Text>
              {current && (
                <View style={{ backgroundColor: tier.color + "25", borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: tier.color, fontSize: 9, fontWeight: "900" }}>ACTUEL</Text>
                </View>
              )}
              {locked && (
                <Text style={{ fontSize: 14 }}>🔒</Text>
              )}
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{tier.description}</Text>
          </View>
          {tier.rentPerDay > 0 && (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: colors.gold, fontWeight: "900", fontSize: 14 }}>{tier.rentPerDay} cr</Text>
              <Text style={{ color: colors.muted, fontSize: 9 }}>/jour</Text>
            </View>
          )}
        </View>

        {/* Avantages */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {tier.perks.map((perk) => (
            <View key={perk} style={{ backgroundColor: tier.color + "12", borderRadius: 8,
              paddingHorizontal: 10, paddingVertical: 4,
              borderWidth: 1, borderColor: tier.color + "30" }}>
              <Text style={{ color: tier.color, fontSize: 10, fontWeight: "700" }}>{perk}</Text>
            </View>
          ))}
        </View>

        {/* Conditions */}
        {!current && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>CONDITIONS</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {tier.minMoney > 0    && <ConditionBadge ok={money >= tier.minMoney}           label={`${tier.minMoney} cr`} />}
              {tier.minLevel > 1    && <ConditionBadge ok={level >= tier.minLevel}           label={`Niv.${tier.minLevel}`} />}
              {tier.minReputation > 0 && <ConditionBadge ok={reputation >= tier.minReputation} label={`${tier.minReputation} rep`} />}
              {tier.minStreak > 0   && <ConditionBadge ok={streak >= tier.minStreak}         label={`${tier.minStreak}j streak`} />}
            </View>
          </View>
        )}

        {/* Bouton upgrade */}
        {!current && canAfford && (
          <Pressable onPress={onUpgrade}
            style={{ backgroundColor: tier.color + "22", borderRadius: 14, padding: 13,
              alignItems: "center", borderWidth: 1.5, borderColor: tier.color + "55",
              shadowColor: tier.color, shadowOpacity: 0.3, shadowRadius: 8 }}>
            <Text style={{ color: tier.color, fontWeight: "900", fontSize: 14 }}>
              Emménager — {tier.rentPerDay > 0 ? `${tier.rentPerDay} cr/j` : "Gratuit"}
            </Text>
          </Pressable>
        )}
        {!current && !canAfford && !locked && (
          <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 10, alignItems: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Conditions non remplies</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function HousingScreen() {
  const stats          = useGameStore((s) => s.stats);
  const playerLevel    = useGameStore((s) => s.playerLevel ?? 1);
  const housingTier    = useGameStore((s) => s.housingTier);
  const wealthScore    = useGameStore((s) => s.wealthScore);
  const upgradeHousing = useGameStore((s) => s.upgradeHousing);
  const checkHousingRent = useGameStore((s) => s.checkHousingRent);

  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    checkHousingRent();
  }, []);

  const currentTier  = getHousingTier(housingTier);
  const currentIdx   = HOUSING_TIERS.findIndex((t) => t.id === housingTier);
  const nextTier     = HOUSING_TIERS[currentIdx + 1] ?? null;

  function tryUpgrade(tierId: HousingTierId) {
    const res = upgradeHousing(tierId);
    if (res.ok) {
      setSuccess(`✅ Tu vis maintenant dans un ${getHousingTier(tierId).name} !`);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(res.error ?? "Impossible.");
      setSuccess(null);
      setTimeout(() => setError(null), 3000);
    }
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={{ backgroundColor: "#050b18", paddingHorizontal: 20, paddingTop: 56,
          paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.border, overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: 70,
            backgroundColor: currentTier.color + "15" }} />
          <Pressable onPress={() => router.back()} style={{ marginBottom: 14 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>🏠 Immobilier</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            Ton logement définit ton statut dans la ville
          </Text>

          {/* Current housing highlight */}
          <View style={{ marginTop: 16, backgroundColor: currentTier.color + "14", borderRadius: 16,
            padding: 14, borderWidth: 1.5, borderColor: currentTier.color + "40",
            flexDirection: "row", alignItems: "center", gap: 12,
            shadowColor: currentTier.color, shadowOpacity: 0.2, shadowRadius: 12 }}>
            <Text style={{ fontSize: 32 }}>{currentTier.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: currentTier.color, fontWeight: "900", fontSize: 18 }}>{currentTier.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {currentTier.rentPerDay > 0 ? `${currentTier.rentPerDay} cr/jour` : "Gratuit"} · Score: {(wealthScore / 1000).toFixed(1)}k
              </Text>
            </View>
            {currentTier.rentPerDay > 0 && (
              <View style={{ backgroundColor: colors.gold + "15", borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.gold + "40" }}>
                <Text style={{ color: colors.gold, fontSize: 11, fontWeight: "800" }}>
                  Loyer actif
                </Text>
              </View>
            )}
          </View>

          {/* Prochain palier */}
          {nextTier && (
            <View style={{ marginTop: 10, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12,
              padding: 10, flexDirection: "row", alignItems: "center", gap: 8,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ fontSize: 16 }}>{nextTier.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textSoft, fontSize: 12 }}>
                  Prochain : <Text style={{ fontWeight: "800" }}>{nextTier.name}</Text>
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>
                  {stats.money < nextTier.minMoney ? `+${nextTier.minMoney - stats.money} cr manquants` : ""}
                  {playerLevel < nextTier.minLevel ? ` · Niv.${nextTier.minLevel} requis` : ""}
                </Text>
              </View>
              <Text style={{ color: nextTier.color, fontSize: 11, fontWeight: "800" }}>🎯</Text>
            </View>
          )}
        </View>

        {/* Feedback */}
        {(error || success) && (
          <View style={{ marginHorizontal: 20, marginTop: 14,
            backgroundColor: error ? colors.dangerGlow : colors.accentGlow,
            borderRadius: 12, padding: 12, borderWidth: 1,
            borderColor: error ? colors.danger + "55" : colors.accent + "55" }}>
            <Text style={{ color: error ? colors.danger : colors.accent, fontWeight: "700", fontSize: 13 }}>
              {error ?? success}
            </Text>
          </View>
        )}

        {/* Stats joueur */}
        <View style={{ flexDirection: "row", marginHorizontal: 20, marginTop: 16, gap: 10 }}>
          {[
            { label: "Argent", value: `${stats.money} cr`, color: colors.gold },
            { label: "Niveau",  value: `${playerLevel}`,   color: colors.purple },
            { label: "Réputation", value: `${stats.reputation}`, color: colors.accent },
            { label: "Streak",  value: `${stats.streak}j`, color: "#f87171" },
          ].map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: item.color + "10", borderRadius: 12,
              padding: 10, alignItems: "center", borderWidth: 1, borderColor: item.color + "30" }}>
              <Text style={{ color: item.color, fontWeight: "900", fontSize: 13 }}>{item.value}</Text>
              <Text style={{ color: colors.muted, fontSize: 9, marginTop: 2 }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── TIERS ── */}
        <View style={{ padding: 20, gap: 14 }}>
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
            PROPRIÉTÉS DISPONIBLES
          </Text>
          {HOUSING_TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              current={tier.id === housingTier}
              canAfford={canAffordHousing(tier, stats.money, playerLevel, stats.reputation, stats.streak)}
              money={stats.money}
              level={playerLevel}
              reputation={stats.reputation}
              streak={stats.streak}
              onUpgrade={() => tryUpgrade(tier.id)}
            />
          ))}

          <Text style={{ color: "rgba(255,255,255,0.1)", fontSize: 10, textAlign: "center" }}>
            Le loyer est prélevé automatiquement chaque 24h.
            Si tu n'as pas assez, tu es rétrogradé.
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}
