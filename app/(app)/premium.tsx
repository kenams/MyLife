import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { AppShell, Button, Card, Muted, NavBack, Pill, SectionTitle, Title } from "@/components/ui";
import { BOOSTS, COSMETICS, PREMIUM_FEATURES, PREMIUM_PRICES } from "@/lib/premium";
import { colors } from "@/lib/theme";
import type { BoostItem, CosmeticItem, PremiumTier } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

function FeatureRow({ icon, label, description }: { icon: string; label: string; description: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(139,124,255,0.15)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon as never} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{label}</Text>
        <Muted>{description}</Muted>
      </View>
      <Ionicons name="checkmark-circle" size={18} color="#38c793" />
    </View>
  );
}

function PlanCard({ tier, selected, onSelect }: { tier: PremiumTier; selected: boolean; onSelect: () => void }) {
  const plan = PREMIUM_PRICES[tier];
  const isYearly = tier === "yearly";
  return (
    <Pressable
      onPress={onSelect}
      style={{
        flex: 1,
        padding: 16,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: selected ? colors.accent : "rgba(255,255,255,0.1)",
        backgroundColor: selected ? "rgba(139,124,255,0.12)" : "rgba(255,255,255,0.04)",
        alignItems: "center",
        gap: 6
      }}
    >
      {isYearly && (
        <View style={{ backgroundColor: "#38c793", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: "#07111f", fontSize: 10, fontWeight: "800" }}>MEILLEURE OFFRE</Text>
        </View>
      )}
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{plan.label}</Text>
      <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 22 }}>{plan.price.split("/")[0]}</Text>
      <Muted>/{plan.price.split("/")[1]}</Muted>
      {isYearly && <Text style={{ color: colors.muted, fontSize: 11 }}>Économise 30€/an</Text>}
    </Pressable>
  );
}

function BoostCard({ boost, onBuy, canAfford }: { boost: BoostItem; onBuy: () => void; canAfford: boolean }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{boost.name}</Text>
        <Pill>{boost.price} crédits</Pill>
      </View>
      <Muted>{boost.description}</Muted>
      <View style={{ marginTop: 10 }}>
        <Button
          label={canAfford ? "Acheter" : "Solde insuffisant"}
          onPress={onBuy}
          disabled={!canAfford}
        />
      </View>
    </Card>
  );
}

function CosmeticCard({ item, owned, isPremium, canAfford, onBuy }: {
  item: CosmeticItem; owned: boolean; isPremium: boolean; canAfford: boolean; onBuy: () => void;
}) {
  const locked = item.requiresPremium && !isPremium;
  return (
    <Pressable
      onPress={locked ? undefined : onBuy}
      style={{
        width: "48%",
        padding: 14,
        borderRadius: 14,
        backgroundColor: owned ? "rgba(56,199,147,0.1)" : "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: owned ? "#38c793" : item.requiresPremium ? colors.accent : "rgba(255,255,255,0.08)",
        alignItems: "center",
        gap: 8,
        opacity: locked ? 0.5 : 1
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: item.color + "33", borderWidth: 3, borderColor: item.color, alignItems: "center", justifyContent: "center" }}>
        <Ionicons
          name={item.kind === "badge" ? "ribbon" : item.kind === "border" ? "ellipse" : "sparkles"}
          size={20}
          color={item.color}
        />
      </View>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, textAlign: "center" }}>{item.name}</Text>
      {owned ? (
        <Text style={{ color: "#38c793", fontSize: 11, fontWeight: "700" }}>ÉQUIPÉ</Text>
      ) : locked ? (
        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>PREMIUM</Text>
      ) : item.price > 0 ? (
        <Text style={{ color: canAfford ? colors.muted : "#f87171", fontSize: 11 }}>{item.price} crédits</Text>
      ) : (
        <Text style={{ color: "#38c793", fontSize: 11, fontWeight: "700" }}>GRATUIT</Text>
      )}
    </Pressable>
  );
}

export default function PremiumScreen() {
  const [selectedTier, setSelectedTier] = useState<PremiumTier>("yearly");
  const [premiumSuccess, setPremiumSuccess] = useState("");
  const [inlineMsg, setInlineMsg] = useState("");
  const isPremium = useGameStore((s) => s.isPremium);
  const premiumTier = useGameStore((s) => s.premiumTier);
  const premiumExpiresAt = useGameStore((s) => s.premiumExpiresAt);
  const money = useGameStore((s) => s.stats.money);
  const equippedCosmetics = useGameStore((s) => s.equippedCosmetics);
  const activatePremium = useGameStore((s) => s.activatePremium);
  const buyBoost = useGameStore((s) => s.buyBoost);
  const buyCosmetic = useGameStore((s) => s.buyCosmetic);

  const handleSubscribe = async () => {
    if (isPremium) {
      setPremiumSuccess(`Abonnement ${premiumTier} actif jusqu'au ${premiumExpiresAt ? new Date(premiumExpiresAt).toLocaleDateString("fr-FR") : "—"}.`);
      return;
    }
    const stripeUrl = PREMIUM_PRICES[selectedTier].stripeLink;
    const isPlaceholder = stripeUrl.includes("mylife_");

    if (isPlaceholder) {
      // Mode dev : activation locale directe
      activatePremium(selectedTier);
      setPremiumSuccess(`Premium ${selectedTier === "yearly" ? "annuel" : "mensuel"} activé ✓ (mode dev)`);
      return;
    }

    // Production : ouvrir Stripe
    const supported = await Linking.canOpenURL(stripeUrl);
    if (supported) {
      await Linking.openURL(stripeUrl);
      setPremiumSuccess("Redirection vers Stripe... Reviens ensuite et appuie sur 'Vérifier mon abonnement'.");
    } else {
      Alert.alert("Impossible d'ouvrir le lien de paiement.");
    }
  };

  const handleVerifySubscription = async () => {
    // Synchronise avec Supabase pour vérifier le statut premium
    const syncFn = useGameStore.getState().syncToSupabase;
    await syncFn();
    setPremiumSuccess("Statut vérifié depuis le serveur.");
  };

  const handleBuyBoost = (boostId: string) => {
    const result = buyBoost(boostId);
    setInlineMsg(result.ok ? "Boost activé ✓" : (result.error ?? "Erreur"));
    setTimeout(() => setInlineMsg(""), 3000);
  };

  const handleBuyCosmetic = (cosmeticId: string) => {
    const result = buyCosmetic(cosmeticId);
    setInlineMsg(result.ok ? "Cosmétique équipé ✓" : (result.error ?? "Erreur"));
    setTimeout(() => setInlineMsg(""), 3000);
  };

  return (
    <AppShell>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingBottom: 40 }}>

        {/* Header */}
        <View style={{ alignItems: "center", paddingTop: 8, gap: 8 }}>
          {isPremium ? (
            <>
              <Pill tone="accent">PREMIUM ACTIF</Pill>
              <Title>Tu es membre Premium</Title>
              <Muted>Abonnement {premiumTier} · expire le {premiumExpiresAt ? new Date(premiumExpiresAt).toLocaleDateString("fr-FR") : "—"}</Muted>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={36} color={colors.accent} />
              <Title>MyLife Premium</Title>
              <Text style={{ color: colors.muted, textAlign: "center" }}>Débloque tout le potentiel de ton avatar social.</Text>
            </>
          )}
        </View>

        {/* Features */}
        <Card>
          <SectionTitle>Ce que tu débloquas</SectionTitle>
          {PREMIUM_FEATURES.map((f) => (
            <FeatureRow key={f.id} icon={f.icon} label={f.label} description={f.description} />
          ))}
        </Card>

        {/* Plans */}
        {!isPremium && (
          <View style={{ gap: 12 }}>
            <SectionTitle>Choisir un plan</SectionTitle>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <PlanCard tier="monthly" selected={selectedTier === "monthly"} onSelect={() => setSelectedTier("monthly")} />
              <PlanCard tier="yearly" selected={selectedTier === "yearly"} onSelect={() => setSelectedTier("yearly")} />
            </View>
            <Button label={`S'abonner — ${PREMIUM_PRICES[selectedTier].price}`} onPress={() => void handleSubscribe()} />
            <Button label="Vérifier mon abonnement" variant="secondary" onPress={() => void handleVerifySubscription()} />
            <Text style={{ color: colors.muted, textAlign: "center", fontSize: 11 }}>
              Paiement sécurisé via Stripe. Annulation à tout moment.
            </Text>
          </View>
        )}

        {/* Boosts */}
        <View style={{ gap: 12 }}>
          <SectionTitle>Boosts (crédits in-game)</SectionTitle>
          <Muted>Solde actuel : {money} crédits</Muted>
          {BOOSTS.map((boost) => (
            <BoostCard
              key={boost.id}
              boost={boost}
              canAfford={money >= boost.price}
              onBuy={() => handleBuyBoost(boost.id)}
            />
          ))}
        </View>

        {/* Cosmétiques */}
        <View style={{ gap: 12 }}>
          <SectionTitle>Cosmétiques</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {COSMETICS.map((item) => (
              <CosmeticCard
                key={item.id}
                item={item}
                owned={equippedCosmetics.includes(item.id)}
                isPremium={isPremium}
                canAfford={money >= item.price}
                onBuy={() => handleBuyCosmetic(item.id)}
              />
            ))}
          </View>
        </View>

        {premiumSuccess ? (
          <View style={{ backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(56,199,147,0.3)" }}>
            <Text style={{ color: "#38c793", fontWeight: "700", textAlign: "center" }}>{premiumSuccess}</Text>
          </View>
        ) : null}
        {inlineMsg ? (
          <View style={{ backgroundColor: "rgba(139,124,255,0.1)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(139,124,255,0.3)" }}>
            <Text style={{ color: colors.accent, fontWeight: "700", textAlign: "center" }}>{inlineMsg}</Text>
          </View>
        ) : null}
        <NavBack fallback="/(app)/(tabs)/profile" />
      </ScrollView>
    </AppShell>
  );
}
