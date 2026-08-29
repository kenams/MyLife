"use client";

/**
 * Bannière de présence territoriale (§5) — n'apparaît QUE si le joueur se
 * trouve sur un territoire tenu par un crew rival. Propose une mission
 * d'influence clandestine. Rien de la position du joueur n'est publié ;
 * seul un agrégat crew+jour part au serveur (voir lib/territory-presence).
 */

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { requestAndGetLocation } from "@/lib/life-map";
import { currentEnemyTerritory, reportTerritoryActivity, claimInfluenceMission, type InfluenceMission } from "@/lib/territory-presence";
import type { Territory } from "@/lib/territories";
import { wory } from "@/lib/branding";
import { hapticSuccess } from "@/lib/safe-haptics";

const C = {
  card: "#1A0E0E",
  border: "#FF3B3B",
  text: "#F5F2E8",
  textSoft: "#C9A9A9",
  gold: "#FFD600",
  green: "#39FF14",
};

export function TerritoryPresenceBanner({
  territories,
  myCrewId,
}: {
  territories: Territory[];
  myCrewId: string | null;
}) {
  const [enemy, setEnemy] = useState<Territory | null>(null);
  const [mission, setMission] = useState<InfluenceMission | null>(null);
  const [claimed, setClaimed] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const loc = await requestAndGetLocation().catch(() => null);
      if (!alive || !loc) return;
      const e = currentEnemyTerritory({ lat: loc.lat, lng: loc.lng }, territories, myCrewId);
      setEnemy(e);
    })();
    return () => {
      alive = false;
    };
  }, [territories, myCrewId]);

  if (!enemy) return null;

  async function startMission() {
    if (!enemy) return;
    hapticSuccess();
    const m = await reportTerritoryActivity(enemy.district_id);
    setMission(m);
  }

  async function claim() {
    if (!mission) return;
    const res = await claimInfluenceMission(mission.id);
    if (res) {
      hapticSuccess();
      setClaimed(res.wory);
      setMission({ ...mission, status: "claimed" });
    }
  }

  return (
    <View
      style={{
        backgroundColor: C.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border + "66",
        padding: 14,
      }}
    >
      <Text style={{ color: C.border, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>
        ⚠️ TERRITOIRE ENNEMI
      </Text>
      <Text style={{ color: C.text, fontSize: 13.5, fontWeight: "800", marginTop: 4 }}>
        Tu es sur {enemy.district_name} — {enemy.owner_emoji ?? "🏳️"} {enemy.owner_tag}
      </Text>
      <Text style={{ color: C.textSoft, fontSize: 12, marginTop: 2 }}>
        Influence adverse : {enemy.influence} %
      </Text>

      {!mission && (
        <Pressable
          onPress={startMission}
          style={{ marginTop: 12, backgroundColor: C.border, borderRadius: 9, paddingVertical: 10, alignItems: "center" }}
        >
          <Text style={{ color: "#0A0000", fontWeight: "900", fontSize: 12 }}>
            🕵️ Mission d'influence — {wory(30)} à la clé
          </Text>
        </Pressable>
      )}

      {mission && mission.status !== "claimed" && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: C.textSoft, fontSize: 11.5 }}>
            Réalise {mission.target} activités dans ce quartier — {mission.progress}/{mission.target}
          </Text>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: "#3A1A1A", overflow: "hidden", marginTop: 6 }}>
            <View
              style={{
                width: `${(mission.progress / mission.target) * 100}%`,
                height: "100%",
                backgroundColor: mission.status === "done" ? C.green : C.gold,
              }}
            />
          </View>
          {mission.status === "done" && (
            <Pressable
              onPress={claim}
              style={{ marginTop: 10, backgroundColor: C.gold, borderRadius: 9, paddingVertical: 9, alignItems: "center" }}
            >
              <Text style={{ color: "#080808", fontWeight: "900", fontSize: 12 }}>Récupérer {wory(30)}</Text>
            </Pressable>
          )}
        </View>
      )}

      {claimed != null && (
        <Text style={{ color: C.green, fontSize: 12, fontWeight: "900", marginTop: 10 }}>
          +{wory(claimed)} · influence adverse grignotée
        </Text>
      )}
    </View>
  );
}
