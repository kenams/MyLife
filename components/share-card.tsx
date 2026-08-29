import { useEffect } from "react";
import { Pressable, Share, Text, View } from "react-native";

import type { AvatarProfile, AvatarStats } from "@/lib/types";

const C = {
  bg:     "rgba(0,0,0,0.88)",
  card:   "#111111",
  border: "rgba(255,255,255,0.10)",
  text:   "#F5F2E8",
  soft:   "#A8A49A",
  muted:  "#4A4844",
  gold:   "#FFD600",
  green:  "#39FF14",
  red:    "#FF3B3B",
  purple: "#BF5FFF",
};

function levelColor(level: number): string {
  if (level >= 20) return C.gold;
  if (level >= 10) return C.purple;
  if (level >= 5)  return "#00B4FF";
  return C.green;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

interface ShareCardProps {
  visible: boolean;
  onClose: () => void;
  stats: AvatarStats;
  avatar: AvatarProfile;
  playerLevel: number;
  crewTag?: string | null;
  crewColor?: string | null;
  money: number;
}

export function ShareCard({
  visible, onClose, stats, avatar, playerLevel, crewTag, crewColor, money,
}: ShareCardProps) {
  if (!visible) return null;

  const xpPct = (playerLevel * 17) % 100; // proxy visuel XP
  const lc    = levelColor(playerLevel);

  async function handleShare() {
    await Share.share({
      message: `Je suis niveau ${playerLevel} sur MyLife — rejoins-moi !`,
    });
  }

  const gridStats: { label: string; value: string; color: string }[] = [
    { label: "Réputation", value: String(stats.reputation),           color: C.purple },
    { label: "Wory",       value: `${Math.round(money)}`,             color: C.gold   },
    { label: "Streak",     value: `${stats.streak}j`,                 color: C.green  },
    { label: "Fitness",    value: `${Math.round(stats.fitness)}`,     color: "#00B4FF" },
  ];

  return (
    <View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 200, backgroundColor: C.bg,
      alignItems: "center", justifyContent: "center",
    }}>
      {/* Fermer zone vide */}
      <Pressable
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onClose}
      />

      {/* Carte */}
      <View style={{
        width: 340,
        backgroundColor: C.card,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: lc + "50",
        overflow: "hidden",
        shadowColor: lc,
        shadowOpacity: 0.4,
        shadowRadius: 24,
      }}>
        {/* Header */}
        <View style={{
          backgroundColor: lc + "12",
          borderBottomWidth: 1,
          borderBottomColor: lc + "30",
          padding: 24,
          alignItems: "center",
          gap: 8,
        }}>
          <Text style={{ fontSize: 64, lineHeight: 72 }}>
            {avatar.gender === "homme" ? "🧢" : "👑"}
          </Text>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "900" }}>
            {avatar.displayName}
          </Text>
          <View style={{
            backgroundColor: lc + "22", borderRadius: 20,
            paddingHorizontal: 12, paddingVertical: 4,
            borderWidth: 1, borderColor: lc + "50",
          }}>
            <Text style={{ color: lc, fontSize: 12, fontWeight: "900" }}>
              NIV. {playerLevel}
            </Text>
          </View>
        </View>

        {/* XP bar */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.muted, fontSize: 10 }}>XP</Text>
            <Text style={{ color: lc, fontSize: 10, fontWeight: "800" }}>{xpPct}%</Text>
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)" }}>
            <View style={{
              height: 4, borderRadius: 2,
              width: `${xpPct}%` as `${number}%`,
              backgroundColor: lc,
            }} />
          </View>
        </View>

        {/* Stats grille 2×2 */}
        <View style={{
          flexDirection: "row", flexWrap: "wrap",
          paddingHorizontal: 16, paddingTop: 16, gap: 8,
        }}>
          {gridStats.map((s) => (
            <View key={s.label} style={{
              width: "47%",
              backgroundColor: s.color + "10",
              borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: s.color + "25",
              alignItems: "center", gap: 2,
            }}>
              <Text style={{ color: s.color, fontSize: 18, fontWeight: "900" }}>{s.value}</Text>
              <Text style={{ color: C.muted, fontSize: 10 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Crew */}
        {crewTag && (
          <View style={{
            marginHorizontal: 16, marginTop: 12,
            backgroundColor: (crewColor ?? C.green) + "12",
            borderRadius: 12, padding: 10,
            borderWidth: 1, borderColor: (crewColor ?? C.green) + "30",
            flexDirection: "row", alignItems: "center", gap: 8,
          }}>
            <Text style={{ fontSize: 18 }}>🛡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: crewColor ?? C.green, fontSize: 13, fontWeight: "900" }}>
                [{crewTag}]
              </Text>
              <Text style={{ color: C.muted, fontSize: 10 }}>Crew actif</Text>
            </View>
          </View>
        )}

        {/* Tagline */}
        <View style={{ alignItems: "center", paddingVertical: 16 }}>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            MyLife · Toulouse · {todayLabel()}
          </Text>
        </View>

        {/* Actions */}
        <View style={{
          flexDirection: "row", gap: 10,
          paddingHorizontal: 16, paddingBottom: 20,
        }}>
          <Pressable
            onPress={onClose}
            style={{
              flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1, borderColor: C.border,
            }}>
            <Text style={{ color: C.soft, fontSize: 16, fontWeight: "800" }}>×</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleShare()}
            style={{
              flex: 3, paddingVertical: 13, borderRadius: 14, alignItems: "center",
              backgroundColor: lc + "18",
              borderWidth: 1, borderColor: lc + "50",
            }}>
            <Text style={{ color: lc, fontSize: 14, fontWeight: "900" }}>📤 Partager</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
