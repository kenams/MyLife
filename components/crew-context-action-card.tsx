"use client";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import {
  performCrewContextAction,
  type CrewContextActionResult,
} from "@/lib/crew-context-action-api";
import type { CrewContextAction } from "@/lib/crew-context-actions";
import { hapticSuccess } from "@/lib/safe-haptics";

const C = {
  bg: "#101010",
  border: "rgba(255,214,0,0.32)",
  text: "#F5F2E8",
  soft: "#AAA69D",
  gold: "#FFD600",
  green: "#39FF14",
  red: "#FF3B3B",
};

export function CrewContextActionCard({
  action,
  onTerritoryChanged,
  onLaunchBattle,
}: {
  action: CrewContextAction;
  onTerritoryChanged: () => Promise<void>;
  onLaunchBattle: (districtId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrewContextActionResult | null>(null);

  async function act() {
    setError(null);

    if (action.kind === "JOIN_CREW") {
      router.push("/(app)/(tabs)/crews");
      return;
    }
    if (action.kind === "BATTLE" && action.battleId) {
      router.push(`/(app)/battle/${action.battleId}`);
      return;
    }
    if (action.kind === "EXPAND" && action.districtId) {
      setBusy(true);
      await onLaunchBattle(action.districtId);
      setBusy(false);
      return;
    }
    if (!action.territoryId) return;

    setBusy(true);
    const response = await performCrewContextAction(action.territoryId);
    setBusy(false);
    if (!response.ok || !response.result) {
      setError(response.error ?? "Action indisponible");
      return;
    }

    setResult(response.result);
    if (response.result.applied) {
      hapticSuccess();
      await onTerritoryChanged();
    }
  }

  const doneHere = result?.territoryId === action.territoryId;
  const accent = action.kind === "BATTLE" ? C.red : C.gold;

  return (
    <View
      testID="crew-context-action"
      style={{
        backgroundColor: C.bg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: accent + "66",
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Ionicons
          name={action.kind === "DEFEND" ? "shield-checkmark" : action.kind === "BATTLE" ? "flash" : "navigate"}
          size={20}
          color={accent}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: accent, fontSize: 10, fontWeight: "900" }}>ACTION CREW DU JOUR</Text>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: "900", marginTop: 2 }}>
            {action.title}
          </Text>
        </View>
      </View>

      <Text style={{ color: C.soft, fontSize: 12, lineHeight: 17, marginTop: 9 }}>
        {action.body}
      </Text>

      {result && (
        <View
          testID="crew-context-result"
          style={{ marginTop: 10, padding: 10, borderRadius: 6, backgroundColor: C.green + "12" }}
        >
          <Text style={{ color: C.green, fontSize: 12, fontWeight: "900" }}>
            {result.applied && doneHere
              ? `Influence ${result.influenceBefore}% -> ${result.influenceAfter}%`
              : "Contribution Crew deja realisee aujourd'hui"}
          </Text>
          <Text style={{ color: C.soft, fontSize: 10.5, marginTop: 2 }}>
            {result.applied && doneHere ? "Effet enregistre dans l'historique du territoire." : "Une seule action tactique est autorisee par jour."}
          </Text>
        </View>
      )}

      {error && <Text style={{ color: C.red, fontSize: 11.5, marginTop: 9 }}>{error}</Text>}

      {!result && (
        <Pressable
          testID="crew-context-cta"
          accessibilityRole="button"
          accessibilityLabel={action.cta}
          disabled={busy}
          onPress={() => void act()}
          style={{
            minHeight: 44,
            marginTop: 12,
            borderRadius: 8,
            backgroundColor: accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.55 : 1,
          }}
        >
          {busy
            ? <ActivityIndicator size="small" color="#080808" />
            : <Text style={{ color: "#080808", fontSize: 12, fontWeight: "900" }}>{action.cta}</Text>}
        </Pressable>
      )}
    </View>
  );
}
