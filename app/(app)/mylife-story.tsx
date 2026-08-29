"use client";

/**
 * MyLife Story (§15) — MA SEMAINE / MON MOIS / MON ANNÉE. Un récap que le
 * joueur a envie de partager : ce qu'il a vécu, pas ses stats brutes.
 */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGameStore } from "@/stores/game-store";
import {
  fetchStoryRecap,
  recapShareText,
  PERIOD_LABEL,
  type StoryPeriod,
  type StoryRecap,
} from "@/lib/story";
import { BRAND, wory } from "@/lib/branding";
import { hapticSuccess } from "@/lib/safe-haptics";

const C = {
  bg: "#080808",
  card: "#111111",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  muted: "#4A4844",
  gold: "#FFD600",
  green: "#39FF14",
  pink: "#FF2D78",
};

const PERIODS: StoryPeriod[] = ["week", "month", "year"];

export default function MyLifeStoryScreen() {
  const avatar = useGameStore((s) => s.avatar);
  const playerName = avatar?.displayName ?? "Joueur";
  const [period, setPeriod] = useState<StoryPeriod>("week");
  const [loading, setLoading] = useState(true);
  const [recap, setRecap] = useState<StoryRecap | null>(null);
  const [shared, setShared] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRecap(await fetchStoryRecap(period, playerName));
    setLoading(false);
  }, [period, playerName]);

  useEffect(() => {
    load();
  }, [load]);

  async function share() {
    if (!recap) return;
    try {
      await Share.share({ message: recapShareText(recap, BRAND.appName) });
      hapticSuccess();
      setShared(true);
      setTimeout(() => setShared(false), 2200);
    } catch {
      /* annulé */
    }
  }

  const empty =
    recap &&
    recap.woryGained === 0 &&
    recap.battlesPlayed === 0 &&
    recap.trophies.length === 0 &&
    recap.peopleMet === 0 &&
    !recap.becameCouple;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: 16,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View>
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>MON HISTOIRE</Text>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: "900" }}>Ce que tu as vécu</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8, padding: 16 }}>
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 9,
              alignItems: "center",
              backgroundColor: period === p ? C.gold : C.card,
              borderWidth: 1,
              borderColor: period === p ? C.gold : C.border,
            }}
          >
            <Text style={{ color: period === p ? "#080808" : C.textSoft, fontWeight: "900", fontSize: 11 }}>
              {PERIOD_LABEL[p]}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading || !recap ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}>
          <View
            style={{
              backgroundColor: C.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: C.border,
              padding: 20,
              gap: 14,
            }}
          >
            <Text style={{ color: C.gold, fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>
              {PERIOD_LABEL[period]}
            </Text>

            {empty ? (
              <Text style={{ color: C.textSoft, fontSize: 13, lineHeight: 19 }}>
                Rien de marquant sur cette période. Sors, rejoins une Battle, croise du monde — ton histoire s'écrit dehors.
              </Text>
            ) : (
              <>
                <Row emoji="🪙" label="Wory gagnés" value={wory(recap.woryGained, { symbol: false })} color={C.gold} />
                {recap.battlesPlayed > 0 && (
                  <Row
                    emoji="⚔️"
                    label="Battles"
                    value={`${recap.battlesPlayed} jouées · ${recap.battlesWon} gagnées`}
                    color={C.text}
                  />
                )}
                {recap.peopleMet > 0 && (
                  <Row emoji="👀" label="Personnes croisées" value={`${recap.peopleMet}`} color={C.pink} />
                )}
                {recap.becameCouple && <Row emoji="❤️" label="Nouveau statut" value="En couple" color={C.pink} />}
                {recap.trophies.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>TROPHÉES</Text>
                    {recap.trophies.map((t, i) => (
                      <Text key={i} style={{ color: C.gold, fontSize: 12.5, fontWeight: "700" }}>🏆 {t}</Text>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          <Pressable
            onPress={share}
            style={{
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              backgroundColor: shared ? "rgba(57,255,20,0.15)" : C.gold,
            }}
          >
            <Ionicons name={shared ? "checkmark" : "share-outline"} size={16} color={shared ? C.green : "#080808"} />
            <Text style={{ color: shared ? C.green : "#080808", fontWeight: "900", fontSize: 13.5 }}>
              {shared ? "Partagé" : "Partager mon récap"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Row({ emoji, label, value, color }: { emoji: string; label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ fontSize: 15 }}>{emoji}</Text>
      <Text style={{ color: C.textSoft, fontSize: 12.5, flex: 1 }}>{label}</Text>
      <Text style={{ color, fontSize: 13.5, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}
