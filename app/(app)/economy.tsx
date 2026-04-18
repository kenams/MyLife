import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, FlatList, Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/lib/theme";
import type { MoneyTransfer } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";
import { residents } from "@/stores/game-store";

const KIND_COLOR: Record<MoneyTransfer["kind"], string> = {
  sent:     "#f87171",
  received: "#38c793",
  boost:    "#fbbf24",
  cosmetic: "#8b7cff",
};
const KIND_EMOJI: Record<MoneyTransfer["kind"], string> = {
  sent: "↑", received: "↓", boost: "⚡", cosmetic: "✨",
};

function TransferRow({ item }: { item: MoneyTransfer }) {
  const color = KIND_COLOR[item.kind];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: color + "20",
        alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color, fontWeight: "900", fontSize: 16 }}>{KIND_EMOJI[item.kind]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{item.description}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      <Text style={{ color: item.amount > 0 ? "#38c793" : "#f87171", fontWeight: "900", fontSize: 15 }}>
        {item.amount > 0 ? "+" : ""}{item.amount}
      </Text>
    </View>
  );
}

export default function EconomyScreen() {
  const money              = useGameStore((s) => s.stats.money);
  const moneyTransfers     = useGameStore((s) => s.moneyTransfers);
  const sendMoneyToResident = useGameStore((s) => s.sendMoneyToResident);
  const relationships      = useGameStore((s) => s.relationships);

  const [selectedResident, setSelectedResident] = useState<string | null>(null);
  const [amount, setAmount]   = useState("20");
  const [sendError, setSendError]   = useState("");
  const [sendSuccess, setSendSuccess] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const connectedResidents = residents.filter((r) => {
    const rel = relationships.find((rel) => rel.residentId === r.id);
    return rel && rel.score >= 30;
  });

  const totalSent  = moneyTransfers.filter((t) => t.kind === "sent").reduce((a, t) => a + Math.abs(t.amount), 0);
  const totalSpent = moneyTransfers.filter((t) => t.kind === "boost" || t.kind === "cosmetic").reduce((a, t) => a + Math.abs(t.amount), 0);

  function handleSend() {
    setSendError(""); setSendSuccess("");
    if (!selectedResident) { setSendError("Choisis un résident."); return; }
    const resident = residents.find((r) => r.id === selectedResident);
    if (!resident) return;
    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) { setSendError("Montant invalide (min 1)."); return; }
    const result = sendMoneyToResident(selectedResident, resident.name, amountNum);
    if (!result.ok) {
      setSendError(result.error ?? "Erreur.");
    } else {
      setSendSuccess(`${amountNum} cr envoyés à ${resident.name} ✓`);
      setSelectedResident(null); setAmount("20");
      setTimeout(() => setSendSuccess(""), 4000);
    }
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: colors.bg }}>
      <FlatList
        data={moneyTransfers}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={{ backgroundColor: "#060d18", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
              borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <View style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: 60,
                backgroundColor: "#38c79308" }} />
              <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
              </Pressable>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 26 }}>💰 Économie</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>Gère tes crédits et transferts</Text>

              {/* Solde + stats */}
              <View style={{ marginTop: 16, backgroundColor: "#38c79314", borderRadius: 18, padding: 16,
                borderWidth: 1.5, borderColor: "#38c79330", gap: 10 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>SOLDE ACTUEL</Text>
                <Text style={{ color: "#38c793", fontWeight: "900", fontSize: 36 }}>{money} <Text style={{ fontSize: 18 }}>cr</Text></Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1, backgroundColor: "#f8717115", borderRadius: 10, padding: 10,
                    borderWidth: 1, borderColor: "#f8717130" }}>
                    <Text style={{ color: "#f87171", fontWeight: "800", fontSize: 16 }}>{totalSent}</Text>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>cr envoyés</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: "#fbbf2415", borderRadius: 10, padding: 10,
                    borderWidth: 1, borderColor: "#fbbf2430" }}>
                    <Text style={{ color: "#fbbf24", fontWeight: "800", fontSize: 16 }}>{totalSpent}</Text>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>cr dépensés</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Envoyer des crédits */}
            <View style={{ margin: 20, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, padding: 16,
              gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                ENVOYER DES CRÉDITS
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Renforce un lien en offrant des crédits à un résident connecté.
              </Text>

              {connectedResidents.length === 0 ? (
                <Text style={{ color: colors.muted, fontStyle: "italic", fontSize: 12 }}>
                  Pas encore de lien suffisant — interagis avec les résidents.
                </Text>
              ) : (
                <>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {connectedResidents.map((r) => (
                      <Pressable key={r.id}
                        onPress={() => setSelectedResident(selectedResident === r.id ? null : r.id)}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                          backgroundColor: selectedResident === r.id ? colors.accent : "rgba(255,255,255,0.06)",
                          borderWidth: 1, borderColor: selectedResident === r.id ? colors.accent : "rgba(255,255,255,0.1)" }}>
                        <Text style={{ color: selectedResident === r.id ? "#07111f" : colors.text,
                          fontWeight: "700", fontSize: 13 }}>{r.name}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>Montant :</Text>
                    <TextInput
                      value={amount} onChangeText={setAmount} keyboardType="numeric"
                      style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10,
                        paddingHorizontal: 14, paddingVertical: 10, color: colors.text,
                        fontWeight: "700", fontSize: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
                      placeholder="20" placeholderTextColor={colors.muted} maxLength={3}
                    />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>/ 200 max</Text>
                  </View>

                  <Pressable onPress={handleSend}
                    disabled={!selectedResident}
                    style={{ backgroundColor: selectedResident ? colors.accent + "20" : "rgba(255,255,255,0.04)",
                      borderRadius: 14, padding: 13, alignItems: "center",
                      borderWidth: 1, borderColor: selectedResident ? colors.accent + "50" : "rgba(255,255,255,0.06)" }}>
                    <Text style={{ color: selectedResident ? colors.accent : colors.muted, fontWeight: "800", fontSize: 14 }}>
                      {selectedResident ? `Envoyer à ${residents.find((r) => r.id === selectedResident)?.name}` : "Sélectionne un résident"}
                    </Text>
                  </Pressable>

                  {sendError ? (
                    <View style={{ backgroundColor: "rgba(255,80,80,0.1)", borderRadius: 10, padding: 10,
                      borderWidth: 1, borderColor: "rgba(255,80,80,0.3)" }}>
                      <Text style={{ color: "#ff8d8d", fontSize: 13 }}>⚠ {sendError}</Text>
                    </View>
                  ) : null}
                  {sendSuccess ? (
                    <View style={{ backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 10, padding: 10,
                      borderWidth: 1, borderColor: "rgba(56,199,147,0.3)" }}>
                      <Text style={{ color: "#38c793", fontSize: 13, fontWeight: "700" }}>✓ {sendSuccess}</Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>

            {/* Titre historique */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>
                HISTORIQUE DES TRANSACTIONS
              </Text>
              {moneyTransfers.length === 0 && (
                <Text style={{ color: colors.muted, fontStyle: "italic", marginTop: 8, fontSize: 12 }}>
                  Aucune transaction pour l'instant.
                </Text>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <TransferRow item={item} />
          </View>
        )}
      />
    </Animated.View>
  );
}
