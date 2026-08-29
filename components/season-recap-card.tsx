"use client";

/**
 * Carte de saison partageable (Phase C) — un résumé net de ce que le joueur a
 * construit pendant la saison : niveau, XP, quartier, badges. Bouton « Partager »
 * (Share natif / navigator.share sur web, copie presse-papier en dernier recours).
 */

import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Share, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchActiveSeason,
  fetchDistricts,
  fetchMyDistrict,
  fetchMyBadges,
  fetchMySeasonTotals,
} from "@/lib/season";
import { useGameStore } from "@/stores/game-store";
import { hapticSuccess } from "@/lib/safe-haptics";

const L = {
  card: "#101010",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  muted: "#4A4844",
  gold: "#FFD600",
  green: "#39FF14",
};

type Badge = { code: string; name: string; icon: string };

export function SeasonRecapCard() {
  const level = useGameStore((s) => s.playerLevel);
  const [loading, setLoading] = useState(true);
  const [seasonName, setSeasonName] = useState<string>("Saison 1");
  const [district, setDistrict] = useState<string | null>(null);
  const [totals, setTotals] = useState({ xp: 0, money: 0, reputation: 0 });
  const [badges, setBadges] = useState<Badge[]>([]);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const season = await fetchActiveSeason();
      const [districts, mine, t, b] = await Promise.all([
        fetchDistricts(),
        fetchMyDistrict(),
        fetchMySeasonTotals(),
        fetchMyBadges(),
      ]);
      if (!alive) return;
      if (season?.name) setSeasonName(season.name);
      const d = districts.find((x) => x.id === mine?.district_id);
      setDistrict(d?.name ?? null);
      setTotals(t);
      setBadges(b.map((x) => ({ code: x.code, name: x.name, icon: x.icon })));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function share() {
    const lines = [
      `MyLife — ${seasonName}`,
      `Niveau ${level} · ${totals.xp} XP de saison`,
      district ? `Quartier : ${district}` : null,
      badges.length ? `${badges.length} badge${badges.length > 1 ? "s" : ""} : ${badges.map((x) => x.icon).join(" ")}` : null,
      `Rejoins-moi sur MyLife.`,
    ].filter(Boolean);
    const message = lines.join("\n");
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: message });
      } else if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
      } else {
        await Share.share({ message });
      }
      hapticSuccess();
      setShared(true);
      setTimeout(() => setShared(false), 2200);
    } catch {
      /* annulé par l'utilisateur */
    }
  }

  if (loading) {
    return (
      <View style={{ margin: 16, padding: 24, alignItems: "center" }}>
        <ActivityIndicator color={L.gold} />
      </View>
    );
  }

  return (
    <View
      style={{
        margin: 16,
        backgroundColor: L.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: L.border,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: L.border }}>
        <Text style={{ color: L.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>MA CARTE DE SAISON</Text>
        <Text style={{ color: L.text, fontSize: 20, fontWeight: "900", marginTop: 4 }}>{seasonName}</Text>
        {district && (
          <Text style={{ color: L.textSoft, fontSize: 12.5, marginTop: 2 }}>Quartier · {district}</Text>
        )}
      </View>

      <View style={{ flexDirection: "row", padding: 18, gap: 14 }}>
        <Stat label="NIVEAU" value={`${level}`} />
        <Stat label="XP SAISON" value={`${totals.xp}`} />
        <Stat label="RÉPUTATION" value={`${totals.reputation}`} />
      </View>

      <View style={{ paddingHorizontal: 18, paddingBottom: 4 }}>
        <Text style={{ color: L.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 8 }}>
          BADGES ({badges.length})
        </Text>
        {badges.length === 0 ? (
          <Text style={{ color: L.textSoft, fontSize: 12.5, marginBottom: 12 }}>
            Aucun badge pour l'instant — termine des missions de saison pour en gagner.
          </Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {badges.map((b) => (
              <View
                key={b.code}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "rgba(255,214,0,0.10)",
                  borderRadius: 9,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ fontSize: 13 }}>{b.icon}</Text>
                <Text style={{ color: L.text, fontSize: 12, fontWeight: "700" }}>{b.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Pressable
        onPress={share}
        style={{
          margin: 14,
          marginTop: 6,
          borderRadius: 12,
          paddingVertical: 13,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          backgroundColor: shared ? "rgba(57,255,20,0.15)" : L.gold,
        }}
      >
        <Ionicons name={shared ? "checkmark" : "share-outline"} size={16} color={shared ? L.green : "#080808"} />
        <Text style={{ color: shared ? L.green : "#080808", fontWeight: "900", fontSize: 13.5 }}>
          {shared ? "Carte partagée" : "Partager ma carte"}
        </Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: L.gold, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: L.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.4, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
