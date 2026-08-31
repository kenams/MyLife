import { Pressable, Text, View } from "react-native";
import type { ToulouseGeopolitics } from "@/lib/crew-geopolitics";

const C = {
  card: "#101010",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  soft: "#A8A49A",
  muted: "#5D5951",
  gold: "#FFD600",
  red: "#FF3B3B",
};

export function ToulousePowerBoard({
  geopolitics,
  totalTerritories,
  onOpenRanking,
}: {
  geopolitics: ToulouseGeopolitics;
  totalTerritories: number;
  onOpenRanking: () => void;
}) {
  const { leader, challenger, gap, contestedTerritories, neutralTerritories } = geopolitics;
  const leaderShare = leader && totalTerritories > 0 ? Math.round((leader.territories / totalTerritories) * 100) : 0;
  const cityState = !leader
    ? "TOULOUSE EST OUVERTE"
    : gap <= 35 || contestedTerritories.length >= 2
      ? "TOULOUSE EST SOUS TENSION"
      : `${leader.tag} MÈNE TOULOUSE`;

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: leader?.color ?? C.border, overflow: "hidden" }}>
      <View style={{ height: 3, backgroundColor: leader?.color ?? C.gold }} />
      <View style={{ padding: 16 }}>
        <Text style={{ color: leader ? C.gold : C.soft, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>
          RAPPORT DE FORCE · MAINTENANT
        </Text>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900", marginTop: 5 }}>
          {cityState}
        </Text>

        {leader ? (
          <>
            <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 27 }}>{leader.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: "900" }}>
                  {leader.name} [{leader.tag}]
                </Text>
                <Text style={{ color: C.soft, fontSize: 11.5, marginTop: 2 }}>
                  {leader.territories}/{totalTerritories} territoires · {leaderShare}% de la ville · puissance {leader.score}
                </Text>
              </View>
              <Text style={{ color: C.gold, fontSize: 10, fontWeight: "900" }}>#1</Text>
            </View>

            {challenger && (
              <View style={{ marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", alignItems: "center", gap: 9 }}>
                <Text style={{ fontSize: 19 }}>{challenger.emoji}</Text>
                <Text style={{ color: C.soft, fontSize: 11.5, flex: 1 }} numberOfLines={2}>
                  Principal rival : <Text style={{ color: C.text, fontWeight: "900" }}>{challenger.name} [{challenger.tag}]</Text> · écart {gap}
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={{ color: C.soft, fontSize: 12, lineHeight: 18, marginTop: 9 }}>
            Aucun Crew ne contrôle encore la ville. Les premiers territoires vont définir l'équilibre de Toulouse.
          </Text>
        )}

        <View style={{ flexDirection: "row", gap: 8, marginTop: 13 }}>
          <View style={{ flex: 1, backgroundColor: contestedTerritories.length ? C.red + "18" : "rgba(255,255,255,0.04)", borderRadius: 10, padding: 10 }}>
            <Text style={{ color: contestedTerritories.length ? C.red : C.muted, fontSize: 10, fontWeight: "900" }}>ZONES CHAUDES</Text>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "900", marginTop: 2 }}>{contestedTerritories.length}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 10 }}>
            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900" }}>À PRENDRE</Text>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "900", marginTop: 2 }}>{neutralTerritories.length}</Text>
          </View>
        </View>

        {contestedTerritories[0] && (
          <Text style={{ color: C.soft, fontSize: 11.5, lineHeight: 17, marginTop: 11 }}>
            ⚔️ Point chaud : {contestedTerritories[0].district_name} · influence {contestedTerritories[0].influence}%
            {contestedTerritories[0].next_battle_at ? " · Battle programmée" : ""}
          </Text>
        )}

        <Pressable
          onPress={onOpenRanking}
          accessibilityRole="button"
          style={{ minHeight: 44, marginTop: 13, borderRadius: 10, borderWidth: 1, borderColor: C.gold + "55", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: C.gold, fontSize: 11.5, fontWeight: "900" }}>VOIR LE CLASSEMENT DES CREWS →</Text>
        </Pressable>
      </View>
    </View>
  );
}
