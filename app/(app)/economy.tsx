import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

import { AppShell, Button, Card, MetricCard, Muted, NavBack, SectionTitle, Title } from "@/components/ui";
import { colors } from "@/lib/theme";
import type { MoneyTransfer } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";
import { residents } from "@/stores/game-store";

const TRANSFER_KIND_ICON: Record<MoneyTransfer["kind"], string> = {
  sent:     "arrow-up-circle",
  received: "arrow-down-circle",
  boost:    "flash",
  cosmetic: "sparkles"
};

const TRANSFER_KIND_COLOR: Record<MoneyTransfer["kind"], string> = {
  sent:     "#f87171",
  received: "#38c793",
  boost:    "#fbbf24",
  cosmetic: "#8b7cff"
};

function TransferRow({ item }: { item: MoneyTransfer }) {
  const icon = TRANSFER_KIND_ICON[item.kind];
  const color = TRANSFER_KIND_COLOR[item.kind];
  const isPositive = item.amount > 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon as never} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{item.description}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
      </View>
      <Text style={{ color: isPositive ? "#38c793" : "#f87171", fontWeight: "900", fontSize: 15 }}>
        {isPositive ? "+" : ""}{item.amount}
      </Text>
    </View>
  );
}

export default function EconomyScreen() {
  const money = useGameStore((s) => s.stats.money);
  const moneyTransfers = useGameStore((s) => s.moneyTransfers);
  const sendMoneyToResident = useGameStore((s) => s.sendMoneyToResident);
  const relationships = useGameStore((s) => s.relationships);

  const [selectedResident, setSelectedResident] = useState<string | null>(null);
  const [amount, setAmount] = useState("20");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");

  // Résidents avec lien établi (score > 30)
  const connectedResidents = residents.filter((r) => {
    const rel = relationships.find((rel) => rel.residentId === r.id);
    return rel && rel.score >= 30;
  });

  const handleSend = () => {
    setSendError(""); setSendSuccess("");
    if (!selectedResident) { setSendError("Choisis un résident."); return; }
    const resident = residents.find((r) => r.id === selectedResident);
    if (!resident) return;
    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum) || amountNum <= 0) { setSendError("Montant invalide (min 1 crédit)."); return; }
    setSending(true);
    const result = sendMoneyToResident(selectedResident, resident.name, amountNum);
    setSending(false);
    if (!result.ok) {
      setSendError(result.error ?? "Erreur inconnue.");
    } else {
      setSendSuccess(`${amountNum} crédits envoyés à ${resident.name} ✓`);
      setSelectedResident(null);
      setAmount("20");
      setTimeout(() => setSendSuccess(""), 4000);
    }
  };

  const totalSent = moneyTransfers
    .filter((t) => t.kind === "sent")
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);

  const totalSpentBoosts = moneyTransfers
    .filter((t) => t.kind === "boost" || t.kind === "cosmetic")
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);

  return (
    <AppShell>
      <FlatList
        data={moneyTransfers}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 0, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 20 }}>
            {/* Solde */}
            <Card accent>
              <Muted>Solde actuel</Muted>
              <Title>{money} crédits</Title>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <MetricCard label="Envoyé" value={`${totalSent}`} hint="crédits sociaux" />
                <MetricCard label="Dépensé" value={`${totalSpentBoosts}`} hint="boosts + cosmétiques" />
              </View>
            </Card>

            {/* Envoyer des crédits */}
            <Card>
              <SectionTitle>Envoyer des crédits</SectionTitle>
              <Muted>Renforce un lien en offrant des crédits à un résident connecté.</Muted>

              {connectedResidents.length === 0 ? (
                <Text style={{ color: colors.muted, marginTop: 8, fontStyle: "italic" }}>
                  Pas encore de lien suffisant. Interagis avec les résidents pour débloquer les transferts.
                </Text>
              ) : (
                <>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {connectedResidents.map((r) => (
                      <Pressable
                        key={r.id}
                        onPress={() => setSelectedResident(selectedResident === r.id ? null : r.id)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          backgroundColor: selectedResident === r.id ? colors.accent : "rgba(255,255,255,0.06)",
                          borderWidth: 1,
                          borderColor: selectedResident === r.id ? colors.accent : "rgba(255,255,255,0.1)"
                        }}
                      >
                        <Text style={{ color: selectedResident === r.id ? "#07111f" : colors.text, fontWeight: "700", fontSize: 13 }}>
                          {r.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>Montant :</Text>
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        color: colors.text,
                        fontWeight: "700",
                        fontSize: 15,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.1)"
                      }}
                      placeholder="20"
                      placeholderTextColor={colors.muted}
                      maxLength={3}
                    />
                    <Muted>/ 200 max</Muted>
                  </View>

                  <View style={{ marginTop: 12 }}>
                    <Button
                      label={sending ? "Envoi..." : selectedResident ? `Envoyer à ${residents.find((r) => r.id === selectedResident)?.name}` : "Sélectionne un résident"}
                      onPress={handleSend}
                      disabled={!selectedResident || sending}
                    />
                    {sendError ? (
                      <View style={{ backgroundColor: "rgba(255,80,80,0.1)", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "rgba(255,80,80,0.3)" }}>
                        <Text style={{ color: "#ff8d8d", fontSize: 13, fontWeight: "600" }}>⚠ {sendError}</Text>
                      </View>
                    ) : null}
                    {sendSuccess ? (
                      <View style={{ backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "rgba(56,199,147,0.3)" }}>
                        <Text style={{ color: "#38c793", fontSize: 13, fontWeight: "700" }}>✓ {sendSuccess}</Text>
                      </View>
                    ) : null}
                  </View>
                </>
              )}
            </Card>

            {/* Historique */}
            <SectionTitle>Historique des transactions</SectionTitle>
            {moneyTransfers.length === 0 && (
              <Text style={{ color: colors.muted, fontStyle: "italic" }}>Aucune transaction pour l'instant.</Text>
            )}
          </View>
        }
        renderItem={({ item }) => <TransferRow item={item} />}
        ItemSeparatorComponent={() => null}
        ListFooterComponent={
          <View style={{ paddingTop: 8 }}>
            <NavBack fallback="/(app)/(tabs)/profile" />
          </View>
        }
      />
    </AppShell>
  );
}
