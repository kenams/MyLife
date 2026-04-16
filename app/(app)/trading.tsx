import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { COSMETICS } from "@/lib/premium";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

type TradeOffer = {
  id: string;
  from: string;
  offerType: "credits" | "cosmetic";
  offerValue: number | string;
  wantType: "credits" | "cosmetic";
  wantValue: number | string;
  createdAt: string;
  emoji: string;
};

const MOCK_OFFERS: TradeOffer[] = [
  {
    id: "t1", from: "Ava Laurent",
    offerType: "credits", offerValue: 50,
    wantType: "cosmetic", wantValue: "border-fire",
    createdAt: new Date().toISOString(), emoji: "👩"
  },
  {
    id: "t2", from: "Noa Blanc",
    offerType: "cosmetic", offerValue: "badge-gold",
    wantType: "credits", wantValue: 80,
    createdAt: new Date().toISOString(), emoji: "🧑"
  },
  {
    id: "t3", from: "Leila Moran",
    offerType: "credits", offerValue: 120,
    wantType: "credits", wantValue: 100,
    createdAt: new Date().toISOString(), emoji: "👩"
  },
  {
    id: "t4", from: "Alex Dumont",
    offerType: "cosmetic", offerValue: "aura-violet",
    wantType: "cosmetic", wantValue: "border-ice",
    createdAt: new Date().toISOString(), emoji: "🧑"
  },
];

function CosmeticName(id: string): string {
  return COSMETICS.find((c) => c.id === id)?.name ?? id;
}

function TradeCard({ offer, onAccept, canAccept }: {
  offer: TradeOffer;
  onAccept: () => void;
  canAccept: boolean;
}) {
  const offerLabel = offer.offerType === "credits"
    ? `${offer.offerValue} crédits`
    : CosmeticName(offer.offerValue as string);
  const wantLabel = offer.wantType === "credits"
    ? `${offer.wantValue} crédits`
    : CosmeticName(offer.wantValue as string);

  return (
    <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 22 }}>{offer.emoji}</Text>
        <View>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{offer.from}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>propose un échange</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: "#38c79315", borderRadius: 12, padding: 10,
          borderWidth: 1, borderColor: "#38c79330", alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 4 }}>OFFRE</Text>
          <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 14 }}>{offerLabel}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 18 }}>⇄</Text>
        <View style={{ flex: 1, backgroundColor: "#f6b94f15", borderRadius: 12, padding: 10,
          borderWidth: 1, borderColor: "#f6b94f30", alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 4 }}>VEUT</Text>
          <Text style={{ color: "#f6b94f", fontWeight: "800", fontSize: 14 }}>{wantLabel}</Text>
        </View>
      </View>
      <Pressable onPress={onAccept} disabled={!canAccept}
        style={{ backgroundColor: canAccept ? colors.accent : "rgba(255,255,255,0.06)",
          borderRadius: 12, padding: 12, alignItems: "center",
          borderWidth: canAccept ? 0 : 1, borderColor: "rgba(255,255,255,0.1)",
          opacity: canAccept ? 1 : 0.5 }}>
        <Text style={{ color: canAccept ? "#fff" : colors.muted, fontWeight: "800", fontSize: 14 }}>
          {canAccept ? "✓ Accepter l'échange" : "Ressources insuffisantes"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function TradingScreen() {
  const stats           = useGameStore((s) => s.stats);
  const equippedCosmetics = useGameStore((s) => s.equippedCosmetics);
  const sendMoney       = useGameStore((s) => s.sendMoneyToResident);

  const [tab, setTab]   = useState<"market" | "create">("market");
  const [offers, setOffers] = useState(MOCK_OFFERS);
  const [offerAmt, setOfferAmt]   = useState("");
  const [wantAmt, setWantAmt]     = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  function canAcceptOffer(offer: TradeOffer): boolean {
    if (offer.wantType === "credits") return stats.money >= (offer.wantValue as number);
    if (offer.wantType === "cosmetic") return equippedCosmetics.includes(offer.wantValue as string);
    return false;
  }

  function acceptOffer(offer: TradeOffer) {
    if (offer.wantType === "credits") {
      const res = sendMoney(offer.id, offer.from, offer.wantValue as number);
      if (!res.ok) { Alert.alert("Erreur", res.error); return; }
    }
    setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    Alert.alert("🎉 Échange réalisé !", `Tu as échangé avec ${offer.from}.`);
  }

  function createOffer() {
    if (!offerAmt || !wantAmt) {
      Alert.alert("Remplis tous les champs");
      return;
    }
    const offerNum = parseInt(offerAmt, 10);
    const wantNum  = parseInt(wantAmt, 10);
    if (isNaN(offerNum) || isNaN(wantNum)) {
      Alert.alert("Montants invalides");
      return;
    }
    if (offerNum > stats.money) {
      Alert.alert("Crédits insuffisants", `Tu as ${stats.money} crédits.`);
      return;
    }
    const newOffer: TradeOffer = {
      id: `my-${Date.now()}`,
      from: "Toi",
      offerType: "credits", offerValue: offerNum,
      wantType: "credits",  wantValue: wantNum,
      createdAt: new Date().toISOString(), emoji: "🧑"
    };
    setOffers((prev) => [newOffer, ...prev]);
    setOfferAmt(""); setWantAmt("");
    Alert.alert("✅ Offre publiée !", "Les autres joueurs peuvent maintenant l'accepter.");
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>💱 Trading</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            Échange crédits & cosmétiques avec d'autres joueurs
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <View style={{ backgroundColor: "#f6b94f15", borderRadius: 12, padding: 10, flex: 1, alignItems: "center" }}>
              <Text style={{ color: "#f6b94f", fontWeight: "900", fontSize: 18 }}>{stats.money}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>crédits</Text>
            </View>
            <View style={{ backgroundColor: "#c084fc15", borderRadius: 12, padding: 10, flex: 1, alignItems: "center" }}>
              <Text style={{ color: "#c084fc", fontWeight: "900", fontSize: 18 }}>{equippedCosmetics.length}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>cosmétiques</Text>
            </View>
            <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 10, flex: 1, alignItems: "center" }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{offers.length}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>offres actives</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 20, gap: 20 }}>

          {/* Tabs */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["market", "create"] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center",
                  backgroundColor: tab === t ? colors.accent + "22" : "rgba(255,255,255,0.05)",
                  borderWidth: tab === t ? 1.5 : 1,
                  borderColor: tab === t ? colors.accent + "50" : "rgba(255,255,255,0.08)" }}>
                <Text style={{ color: tab === t ? colors.accent : colors.muted, fontWeight: "700", fontSize: 13 }}>
                  {t === "market" ? "🛒 Marché" : "➕ Créer offre"}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === "market" && (
            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
                OFFRES DISPONIBLES ({offers.length})
              </Text>
              {offers.map((offer) => (
                <TradeCard
                  key={offer.id}
                  offer={offer}
                  canAccept={canAcceptOffer(offer)}
                  onAccept={() => acceptOffer(offer)}
                />
              ))}
              {offers.length === 0 && (
                <View style={{ alignItems: "center", padding: 40, gap: 8 }}>
                  <Text style={{ fontSize: 40 }}>📭</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>Aucune offre disponible</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Sois le premier à créer une offre !</Text>
                </View>
              )}
            </View>
          )}

          {tab === "create" && (
            <View style={{ gap: 16 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
                NOUVELLE OFFRE (CRÉDITS)
              </Text>

              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Tu offres (crédits)</Text>
                <TextInput
                  value={offerAmt}
                  onChangeText={setOfferAmt}
                  keyboardType="number-pad"
                  placeholder="Ex: 50"
                  placeholderTextColor={colors.muted}
                  style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
                    paddingHorizontal: 16, paddingVertical: 12,
                    color: colors.text, fontSize: 16, fontWeight: "700",
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                />
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Tu veux recevoir (crédits)</Text>
                <TextInput
                  value={wantAmt}
                  onChangeText={setWantAmt}
                  keyboardType="number-pad"
                  placeholder="Ex: 60"
                  placeholderTextColor={colors.muted}
                  style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
                    paddingHorizontal: 16, paddingVertical: 12,
                    color: colors.text, fontSize: 16, fontWeight: "700",
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                />
              </View>

              {offerAmt && wantAmt && (
                <View style={{ backgroundColor: parseInt(wantAmt || "0") > parseInt(offerAmt || "0") ? "#38c79312" : "#f6b94f12",
                  borderRadius: 12, padding: 12, borderWidth: 1,
                  borderColor: parseInt(wantAmt || "0") > parseInt(offerAmt || "0") ? "#38c79330" : "#f6b94f30" }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Ratio : tu offres {offerAmt} cr pour en recevoir {wantAmt} cr{" "}
                    {parseInt(wantAmt || "0") > parseInt(offerAmt || "0")
                      ? "✅ (gain potentiel)"
                      : "⚠️ (perte potentielle)"}
                  </Text>
                </View>
              )}

              <Pressable onPress={createOffer}
                style={{ backgroundColor: colors.accent, borderRadius: 16, padding: 16,
                  alignItems: "center", opacity: offerAmt && wantAmt ? 1 : 0.5 }}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>📤 Publier l'offre</Text>
              </Pressable>

              <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center" }}>
                Les échanges cosmétiques arrivent prochainement.
              </Text>
            </View>
          )}

        </View>
      </ScrollView>
    </Animated.View>
  );
}
