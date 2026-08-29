"use client";

/**
 * FOMO social des Territory Wars (§8) — sans sanction artificielle.
 *  - Avant : rappel local « Battle dans X min · ton crew a besoin de toi ».
 *  - Après : recap « ton crew a gagné / perdu » (le FOMO vient de « mon
 *    groupe a vécu quelque chose », pas d'une pénalité).
 */

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  fetchUpcomingBattles,
  fetchRecentResolvedForCrew,
  type TerritoryBattle,
} from "@/lib/territory-wars";
import { sendLocalNotification } from "@/lib/notifications";

const C = {
  card: "#111111",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  gold: "#FFD600",
  green: "#39FF14",
  red: "#FF3B3B",
};

const reminded = new Set<string>();

export function BattleFomo({ myCrewId }: { myCrewId: string | null }) {
  const [recaps, setRecaps] = useState<TerritoryBattle[]>([]);

  useEffect(() => {
    if (!myCrewId) return;
    let alive = true;
    (async () => {
      const [upcoming, resolved] = await Promise.all([
        fetchUpcomingBattles(),
        fetchRecentResolvedForCrew(myCrewId),
      ]);
      if (!alive) return;

      // Rappel local pour les Battles de mon crew qui démarrent bientôt.
      for (const b of upcoming) {
        if (b.status !== "scheduled") continue;
        if (b.attacker_crew !== myCrewId && b.defender_crew !== myCrewId) continue;
        if (reminded.has(b.id)) continue;
        const delay = Math.round((new Date(b.scheduled_at).getTime() - Date.now()) / 1000) - 30 * 60;
        if (delay > 60) {
          reminded.add(b.id);
          void sendLocalNotification(
            "Battle bientôt",
            `Bataille pour ${b.district_name} dans 30 min. Ton crew a besoin de toi. ⚔️`,
            delay
          );
        }
      }

      setRecaps(resolved);
    })();
    return () => {
      alive = false;
    };
  }, [myCrewId]);

  if (recaps.length === 0) return null;

  return (
    <View style={{ gap: 10 }}>
      {recaps.map((b) => {
        const won = b.winner_crew === myCrewId;
        const mine = b.attacker_crew === myCrewId ? b.attacker_pct : b.defender_pct;
        const other = b.attacker_crew === myCrewId ? b.defender_pct : b.attacker_pct;
        return (
          <Pressable
            key={b.id}
            onPress={() => router.push(`/(app)/battle/${b.id}`)}
            style={{
              backgroundColor: C.card,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: won ? C.green + "40" : C.red + "40",
              padding: 14,
            }}
          >
            <Text style={{ color: won ? C.green : C.red, fontSize: 12, fontWeight: "900", letterSpacing: 1 }}>
              {won ? "🎉 TON CREW A GAGNÉ" : "😬 TU AS RATÉ LA BATTLE"}
            </Text>
            <Text style={{ color: C.text, fontSize: 13.5, fontWeight: "800", marginTop: 4 }}>
              {b.district_name} · {mine?.toFixed(1)} % / {other?.toFixed(1)} %
            </Text>
            <Text style={{ color: C.textSoft, fontSize: 11.5, marginTop: 2 }}>
              {won ? "Le blason est à vous." : "Ton crew a joué sans toi — la prochaine, sois là."}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
