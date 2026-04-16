import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";

import { BOOSTS, COSMETICS, PREMIUM_FEATURES, PREMIUM_PRICES } from "@/lib/premium";
import { colors } from "@/lib/theme";
import type { PremiumTier } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

function FeatureRow({ icon, label, description }: { icon: string; label: string; description: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: "rgba(139,124,255,0.15)",
        alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon as never} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>{description}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={18} color="#38c793" />
    </View>
  );
}

function PlanCard({ tier, selected, onSelect }: { tier: PremiumTier; selected: boolean; onSelect: () => void }) {
  const plan = PREMIUM_PRICES[tier];
  const isYearly = tier === "yearly";
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected) {
      Animated.spring(scaleAnim, { toValue: 1.03, useNativeDriver: true, speed: 40 }).start();
    } else {
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
    }
  }, [selected]);

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <Pressable onPress={onSelect} style={{
        flex: 1, padding: 16, borderRadius: 18,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : "rgba(255,255,255,0.1)",
        backgroundColor: selected ? "rgba(139,124,255,0.14)" : "rgba(255,255,255,0.04)",
        alignItems: "center", gap: 6
      }}>
        {isYearly && (
          <View style={{ backgroundColor: "#38c793", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: "#07111f", fontSize: 10, fontWeight: "800" }}>MEILLEURE OFFRE</Text>
          </View>
        )}
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{plan.label}</Text>
        <Text style={{ color: selected ? colors.accent : colors.text, fontWeight: "900", fontSize: 24 }}>
          {plan.price.split("/")[0]}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>/{tier === "yearly" ? "an" : "mois"}</Text>
        {isYearly && (
          <Text style={{ color: "#38c793", fontSize: 10, fontWeight: "700" }}>Économise 50%</Text>
        )}
        {selected && (
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent,
            alignItems: "center", justifyContent: "center", marginTop: 4 }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>✓</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function PremiumScreen() {
  const isPremium        = useGameStore((s) => s.isPremium);
  const premiumTier      = useGameStore((s) => s.premiumTier);
  const premiumExpiresAt = useGameStore((s) => s.premiumExpiresAt);
  const activeBoosts     = useGameStore((s) => s.activeBoosts);
  const equippedCosmetics = useGameStore((s) => s.equippedCosmetics);
  const activatePremium  = useGameStore((s) => s.activatePremium);
  const deactivatePremium = useGameStore((s) => s.deactivatePremium);
  const buyBoost         = useGameStore((s) => s.buyBoost);
  const buyCosmetic      = useGameStore((s) => s.buyCosmetic);
  const stats            = useGameStore((s) => s.stats);

  const [selectedTier, setSelectedTier] = useState<PremiumTier>("yearly");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleSubscribe() {
    const plan = PREMIUM_PRICES[selectedTier];
    // Stripe checkout
    await Linking.openURL(plan.stripeLink);
    // Activation locale (en prod : webhook Stripe → Supabase → store)
    activatePremium(selectedTier);
    Alert.alert("✅ Premium activé", `Merci ! Tu bénéficies maintenant de l'abonnement ${plan.label}.`);
  }

  const now = Date.now();
  const activeBoostItem = activeBoosts.find((b) => b.activeUntil && new Date(b.activeUntil).getTime() > now);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* Header hero */}
        <View style={{
          backgroundColor: "#060d18",
          paddingHorizontal: 20, paddingTop: 56, paddingBottom: 28,
          alignItems: "center", gap: 8,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)"
        }}>
          <Pressable onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <View style={{ width: 72, height: 72, borderRadius: 36,
            backgroundColor: colors.accent + "22", borderWidth: 2.5, borderColor: colors.accent,
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 36 }}>⭐</Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28, textAlign: "center" }}>
            MyLife Premium
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
            Booste ta vie, débloques plus de features{"\n"}et progresse 2× plus vite.
          </Text>
          {isPremium && (
            <View style={{ backgroundColor: "#38c79320", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
              borderWidth: 1, borderColor: "#38c79350", marginTop: 4 }}>
              <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 13 }}>
                ✓ Actif — {premiumTier === "yearly" ? "Annuel" : "Mensuel"}
                {premiumExpiresAt ? ` jusqu'au ${new Date(premiumExpiresAt).toLocaleDateString("fr-FR")}` : ""}
              </Text>
            </View>
          )}
        </View>

        <View style={{ padding: 20, gap: 24 }}>

          {/* Plans */}
          {!isPremium && (
            <View style={{ gap: 14 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
                CHOISIR UN PLAN
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <PlanCard tier="monthly" selected={selectedTier === "monthly"} onSelect={() => setSelectedTier("monthly")} />
                <PlanCard tier="yearly"  selected={selectedTier === "yearly"}  onSelect={() => setSelectedTier("yearly")}  />
              </View>
              <Pressable onPress={handleSubscribe}
                style={{ backgroundColor: colors.accent, borderRadius: 16, padding: 18,
                  alignItems: "center", shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 12 }}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                  ⭐ S'abonner — {PREMIUM_PRICES[selectedTier].price}
                </Text>
              </Pressable>
              <Text style={{ color: colors.muted, fontSize: 10, textAlign: "center" }}>
                Paiement sécurisé par Stripe · Annulable à tout moment
              </Text>
            </View>
          )}

          {/* Features */}
          <View style={{ gap: 0, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 18, padding: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 8 }}>
              AVANTAGES PREMIUM
            </Text>
            {PREMIUM_FEATURES.map((f) => (
              <FeatureRow key={f.id} icon={f.icon} label={f.label} description={f.description} />
            ))}
          </View>

          {/* Boosts actifs */}
          {activeBoostItem && (
            <View style={{ backgroundColor: "#f6b94f10", borderRadius: 16, padding: 14,
              borderWidth: 1.5, borderColor: "#f6b94f35", flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 24 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#f6b94f", fontWeight: "800", fontSize: 14 }}>{activeBoostItem.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  Actif jusqu'à {new Date(activeBoostItem.activeUntil!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <Text style={{ color: "#f6b94f", fontWeight: "900", fontSize: 18 }}>x{activeBoostItem.multiplier}</Text>
            </View>
          )}

          {/* Boosts shop */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
              BOOSTS TEMPORAIRES
            </Text>
            {BOOSTS.map((boost) => {
              const isActive = activeBoosts.find((b) => b.id === boost.id && b.activeUntil && new Date(b.activeUntil).getTime() > now);
              return (
                <View key={boost.id} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 14,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#f6b94f20",
                    alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontWeight: "900", color: "#f6b94f", fontSize: 16 }}>x{boost.multiplier}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{boost.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{boost.description}</Text>
                  </View>
                  {isActive ? (
                    <View style={{ backgroundColor: "#38c79320", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: "#38c793", fontWeight: "700", fontSize: 12 }}>Actif</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        const result = buyBoost(boost.id);
                        if (!result.ok) Alert.alert("Erreur", result.error ?? "Impossible d'acheter");
                      }}
                      style={{ backgroundColor: "#f6b94f25", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
                        borderWidth: 1, borderColor: "#f6b94f50" }}>
                      <Text style={{ color: "#f6b94f", fontWeight: "800", fontSize: 13 }}>{boost.price} cr</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          {/* Cosmétiques */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
              COSMÉTIQUES
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {COSMETICS.map((cosm) => {
                const owned = equippedCosmetics.includes(cosm.id);
                const locked = cosm.requiresPremium && !isPremium;
                return (
                  <Pressable
                    key={cosm.id}
                    disabled={locked}
                    onPress={() => {
                      if (owned) return;
                      const result = buyCosmetic(cosm.id);
                      if (!result.ok) Alert.alert("Erreur", result.error ?? "Impossible");
                    }}
                    style={{
                      width: "47%", backgroundColor: owned ? cosm.color + "18" : "rgba(255,255,255,0.04)",
                      borderRadius: 14, padding: 14, gap: 8,
                      borderWidth: owned ? 1.5 : 1,
                      borderColor: owned ? cosm.color + "55" : locked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)",
                      opacity: locked ? 0.4 : 1,
                    }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cosm.color + "30",
                      alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: cosm.color, fontWeight: "900", fontSize: 14 }}>
                        {cosm.kind === "badge" ? "🏅" : cosm.kind === "border" ? "🔲" : "✨"}
                      </Text>
                    </View>
                    <Text style={{ color: owned ? cosm.color : colors.text, fontWeight: "700", fontSize: 13 }}>{cosm.name}</Text>
                    {locked ? (
                      <Text style={{ color: colors.muted, fontSize: 10 }}>🔒 Premium requis</Text>
                    ) : owned ? (
                      <Text style={{ color: cosm.color, fontSize: 10, fontWeight: "700" }}>✓ Possédé</Text>
                    ) : (
                      <Text style={{ color: "#f6b94f", fontWeight: "700", fontSize: 12 }}>
                        {cosm.price === 0 ? "Gratuit" : `${cosm.price} cr`}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Désactiver premium (debug) */}
          {isPremium && (
            <Pressable
              onPress={() => { deactivatePremium(); Alert.alert("Premium désactivé"); }}
              style={{ paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(255,80,80,0.08)",
                borderWidth: 1, borderColor: "rgba(255,80,80,0.2)", alignItems: "center" }}>
              <Text style={{ color: "#ff8d8d", fontWeight: "700", fontSize: 12 }}>Désactiver (debug)</Text>
            </Pressable>
          )}

        </View>
      </ScrollView>
    </Animated.View>
  );
}
