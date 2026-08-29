"use client";

/**
 * « Ça se passe maintenant » (§16) — bandeau d'ouverture : la ville continue
 * de vivre. Rien ici ne dépend d'une position précise (§6).
 */

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { getMyCrewId } from "@/lib/crews";
import { fetchHappeningNow, type HappeningItem } from "@/lib/happening-now";
import { useGameStore } from "@/stores/game-store";

const C = {
  card: "#111111",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  gold: "#FFD600",
  red: "#FF3B3B",
};

export function HappeningNow() {
  const router = useRouter();
  const avatar = useGameStore((s) => s.avatar);
  const playerName = avatar?.displayName ?? "Joueur";
  const [items, setItems] = useState<HappeningItem[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const crewId = await getMyCrewId(playerName);
      const data = await fetchHappeningNow(crewId);
      if (alive) setItems(data);
    })();
    return () => {
      alive = false;
    };
  }, [playerName]);

  if (items.length === 0) return null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 12,
        backgroundColor: C.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.border,
        overflow: "hidden",
      }}
    >
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6, flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Text style={{ fontSize: 13 }}>🔥</Text>
        <Text style={{ color: C.gold, fontSize: 10, fontWeight: "900", letterSpacing: 1.6 }}>TOULOUSE BOUGE</Text>
      </View>
      {items.map((it, i) => (
        <Pressable
          key={it.key}
          onPress={() => it.href && router.push(it.href as any)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: C.border,
          }}
        >
          <Text style={{ fontSize: 14 }}>{it.emoji}</Text>
          <Text style={{ color: it.urgent ? C.red : C.text, fontSize: 12.5, fontWeight: it.urgent ? "800" : "600", flex: 1 }}>
            {it.text}
          </Text>
          {it.href && <Text style={{ color: C.textSoft, fontSize: 15 }}>›</Text>}
        </Pressable>
      ))}
    </View>
  );
}
