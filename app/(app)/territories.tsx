"use client";

/**
 * Territoires de Toulouse (spec §4) — vue publique : qui contrôle quoi,
 * influence, prestige, prochaine Battle. Réagit en temps réel aux conquêtes.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchTerritories,
  subscribeTerritories,
  daysHeld,
  type Territory,
} from "@/lib/territories";
import { fetchUpcomingBattles, createBattle, type TerritoryBattle } from "@/lib/territory-wars";
import { nextBattleSlot, formatSlot } from "@/lib/battle-schedule";
import { useGameStore } from "@/stores/game-store";
import { getMyCrewId, getMyOfficerCrewId } from "@/lib/crews";
import { TerritoryPresenceBanner } from "@/components/territory-presence-banner";
import { BattleFomo } from "@/components/battle-fomo";
import { ToulousePowerBoard } from "@/components/toulouse-power-board";
import { CrewContextActionCard } from "@/components/crew-context-action-card";
import { fetchCrewContextActionCompletedToday } from "@/lib/crew-context-action-api";
import { selectCrewContextAction } from "@/lib/crew-context-actions";
import { buildToulouseGeopolitics } from "@/lib/crew-geopolitics";

const T = {
  bg: "#080808",
  card: "#101010",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  muted: "#4A4844",
  gold: "#FFD600",
  green: "#39FF14",
  red: "#FF3B3B",
};

const WHEN = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function TerritoriesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Territory[]>([]);
  const [battles, setBattles] = useState<TerritoryBattle[]>([]);
  const [myCrew, setMyCrew] = useState<string | null>(null);
  const [officerCrew, setOfficerCrew] = useState<string | null>(null);
  const [crewActionDoneToday, setCrewActionDoneToday] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const params = useLocalSearchParams<{ focus?: string | string[] }>();
  const focusedTerritoryId = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  const avatar = useGameStore((s) => s.avatar);
  const playerLevel = useGameStore((s) => s.playerLevel ?? 1);
  const playerName = avatar?.displayName ?? "Joueur";

  useEffect(() => {
    getMyCrewId(playerName).then(setMyCrew);
    getMyOfficerCrewId().then(setOfficerCrew);
    fetchCrewContextActionCompletedToday().then(setCrewActionDoneToday);
  }, [playerName]);

  const load = useCallback(async () => {
    const [data, b] = await Promise.all([fetchTerritories(), fetchUpcomingBattles()]);
    setBattles(b);
    data.sort((a, b) => {
      const ba = a.next_battle_at ? 0 : 1;
      const bb = b.next_battle_at ? 0 : 1;
      if (ba !== bb) return ba - bb;
      return b.prestige - a.prestige;
    });
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return subscribeTerritories(load);
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const owned = items.filter((i) => i.owner_crew_id).length;
  const battleByDistrict = new Map(battles.map((b) => [b.district_id, b]));
  const geopolitics = useMemo(() => buildToulouseGeopolitics(items), [items]);
  const crewAction = useMemo(() => selectCrewContextAction({
    geopolitics,
    territories: items,
    battles,
    myCrewId: myCrew,
    playerLevel,
    canLaunchBattle: Boolean(myCrew && officerCrew === myCrew),
    completedToday: crewActionDoneToday,
  }), [battles, crewActionDoneToday, geopolitics, items, myCrew, officerCrew, playerLevel]);

  async function launchBattle(t: Territory) {
    setBusy(t.id);
    const slot = nextBattleSlot();
    const res = await createBattle(t.district_id, slot);
    setBusy(null);
    if (res.ok && res.id) {
      router.push(`/(app)/battle/${res.id}`);
    } else {
      alert(res.error ?? "Impossible de lancer la Battle (réservé aux officiers).");
    }
  }

  async function launchBattleForDistrict(districtId: string) {
    const territory = items.find((item) => item.district_id === districtId);
    if (territory) await launchBattle(territory);
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
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
          borderBottomColor: T.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={T.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>TERRITOIRES</Text>
          <Text style={{ color: T.text, fontSize: 19, fontWeight: "900" }}>Toulouse</Text>
        </View>
        {!loading && (
          <Text style={{ color: T.textSoft, fontSize: 11.5, fontWeight: "800" }}>
            {owned}/{items.length} contrôlés
          </Text>
        )}
      </View>

      {loading ? (
        <View style={{ paddingTop: 60, alignItems: "center" }}>
          <ActivityIndicator color={T.gold} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gold} />}
        >
          <ToulousePowerBoard
            geopolitics={geopolitics}
            totalTerritories={items.length}
            onOpenRanking={() => router.push("/(app)/leaderboard")}
          />
          {crewAction && (
            <CrewContextActionCard
              action={crewAction}
              onTerritoryChanged={load}
              onLaunchBattle={launchBattleForDistrict}
            />
          )}
          <TerritoryPresenceBanner territories={items} myCrewId={myCrew} />
          <BattleFomo myCrewId={myCrew} />

          {items.length === 0 && (
            <Text style={{ color: T.textSoft, fontSize: 12.5, lineHeight: 18 }}>
              Les territoires s'activeront à la prochaine synchro de la ville.
            </Text>
          )}
          {items.map((t) => {
            const held = daysHeld(t.conquered_at);
            const accent = t.owner_color ?? T.muted;
            const hot = Boolean(t.next_battle_at) || (Boolean(t.owner_crew_id) && t.influence < 60);
            const focused = t.id === focusedTerritoryId;
            return (
              <View
                key={t.id}
                style={{
                  backgroundColor: T.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: focused ? T.gold : hot ? T.red + "50" : T.border,
                  overflow: "hidden",
                }}
              >
                <View style={{ height: 3, backgroundColor: accent }} />
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 16 }}>{t.district_emoji}</Text>
                    <Text style={{ color: T.text, fontSize: 16, fontWeight: "900", flex: 1, letterSpacing: 0.5 }}>
                      {t.district_name.toUpperCase()}
                    </Text>
                    {hot && <Text style={{ color: T.red, fontSize: 9.5, fontWeight: "900" }}>SOUS TENSION</Text>}
                    {t.prestige > 1 && (
                      <Text style={{ color: T.gold, fontSize: 11, fontWeight: "900" }}>★{t.prestige}</Text>
                    )}
                  </View>

                  <Text style={{ color: t.owner_crew_id ? accent : T.textSoft, fontSize: 13, fontWeight: "800", marginTop: 6 }}>
                    {t.owner_crew_id
                      ? `${t.owner_emoji ?? "🏳️"} ${t.owner_name} [${t.owner_tag}]`
                      : "Territoire neutre · à prendre"}
                  </Text>

                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#1E1E1E",
                      overflow: "hidden",
                      marginTop: 10,
                    }}
                  >
                    <View style={{ width: `${t.influence}%`, height: "100%", backgroundColor: accent }} />
                  </View>
                  <Text style={{ color: T.textSoft, fontSize: 11, fontWeight: "700", marginTop: 4 }}>
                    Influence : {t.influence} %
                  </Text>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
                    {held != null && (
                      <Text style={{ color: T.muted, fontSize: 11 }}>Contrôlé depuis {held} j</Text>
                    )}
                    {t.defenses_won > 0 && (
                      <Text style={{ color: T.muted, fontSize: 11 }}>{t.defenses_won} défense{t.defenses_won > 1 ? "s" : ""}</Text>
                    )}
                  </View>

                  {t.next_battle_at && (
                    <View
                      style={{
                        marginTop: 10,
                        backgroundColor: T.red + "18",
                        borderRadius: 9,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                      }}
                    >
                      <Text style={{ color: T.red, fontSize: 11.5, fontWeight: "900" }}>
                        ⚔️ Prochaine Battle : {cap(WHEN.format(new Date(t.next_battle_at)))}
                      </Text>
                    </View>
                  )}

                  {battleByDistrict.has(t.district_id) ? (
                    <Pressable
                      onPress={() => router.push(`/(app)/battle/${battleByDistrict.get(t.district_id)!.id}`)}
                      style={{ marginTop: 10, backgroundColor: T.gold, borderRadius: 9, paddingVertical: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: "#080808", fontWeight: "900", fontSize: 12 }}>
                        {battleByDistrict.get(t.district_id)!.status === "live" ? "Rejoindre la Battle EN COURS" : "Voir la Battle prévue"}
                      </Text>
                    </Pressable>
                  ) : (
                    myCrew && myCrew !== t.owner_crew_id && (
                      <Pressable
                        onPress={() => launchBattle(t)}
                        disabled={busy === t.id}
                        style={{
                          marginTop: 10,
                          borderRadius: 9,
                          paddingVertical: 10,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: T.red + "55",
                          opacity: busy === t.id ? 0.5 : 1,
                        }}
                      >
                        <Text style={{ color: T.red, fontWeight: "900", fontSize: 12 }}>
                          ⚔️ Lancer une Battle · {formatSlot(nextBattleSlot())}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
