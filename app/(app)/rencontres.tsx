"use client";

/**
 * Rencontres (§13-14) — hub que le joueur contrôle : son statut relationnel
 * (volontaire), qui peut lui envoyer un Feeling (séparé du statut), le mode
 * « Open to meet » temporaire, les zones sociales du moment (agrégées), et
 * les personnes croisées dans MyLife.
 */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchMyDatingPrefs,
  setDatingPrefs,
  fetchMyCrossings,
  fetchSocialZones,
  STATUS_META,
  PERMISSION_META,
  type DatingPrefs,
  type RelationshipStatus,
  type FeelingPermission,
  type Crossing,
  type SocialZone,
} from "@/lib/dating";
import { hapticImpact } from "@/lib/safe-haptics";

const C = {
  bg: "#080808",
  card: "#111111",
  cardAlt: "#181818",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  muted: "#4A4844",
  gold: "#FFD600",
  green: "#39FF14",
  pink: "#FF2D78",
};

const ZONE_META: Record<SocialZone["level"], { label: string; color: string }> = {
  quiet: { label: "calme", color: C.textSoft },
  active: { label: "animée", color: C.gold },
  hot: { label: "très sociale ce soir", color: C.pink },
};

export default function RencontresScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prefs, setPrefs] = useState<DatingPrefs | null>(null);
  const [crossings, setCrossings] = useState<Crossing[]>([]);
  const [zones, setZones] = useState<SocialZone[]>([]);

  const load = useCallback(async () => {
    const [p, c, z] = await Promise.all([fetchMyDatingPrefs(), fetchMyCrossings(), fetchSocialZones()]);
    setPrefs(p);
    setCrossings(c);
    setZones(z);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function pickStatus(s: RelationshipStatus) {
    hapticImpact("light");
    setPrefs((p) => (p ? { ...p, relationship_status: s } : p));
    const updated = await setDatingPrefs({ status: s });
    if (updated) setPrefs(updated);
  }

  async function pickPermission(perm: FeelingPermission) {
    hapticImpact("light");
    setPrefs((p) => (p ? { ...p, feeling_permission: perm } : p));
    const updated = await setDatingPrefs({ permission: perm });
    if (updated) setPrefs(updated);
  }

  async function toggleOpenToMeet() {
    hapticImpact("light");
    const active = !!prefs?.open_to_meet_until && new Date(prefs.open_to_meet_until) > new Date();
    const updated = await setDatingPrefs({ openMinutes: active ? 0 : 120 });
    if (updated) setPrefs(updated);
  }

  const openActive = !!prefs?.open_to_meet_until && new Date(prefs.open_to_meet_until) > new Date();

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
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>RENCONTRES</Text>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: "900" }}>Tu gardes le contrôle</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ paddingTop: 60, alignItems: "center" }}>
          <ActivityIndicator color={C.pink} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.pink} />}
        >
          {/* Statut relationnel */}
          <View>
            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 10 }}>
              MON STATUT
            </Text>
            <View style={{ gap: 8 }}>
              {(Object.keys(STATUS_META) as RelationshipStatus[]).map((s) => {
                const active = prefs?.relationship_status === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => pickStatus(s)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      backgroundColor: active ? C.pink + "1E" : C.card,
                      borderWidth: 1,
                      borderColor: active ? C.pink + "66" : C.border,
                      borderRadius: 11,
                      padding: 13,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{STATUS_META[s].emoji}</Text>
                    <Text style={{ color: active ? C.text : C.textSoft, fontSize: 13, fontWeight: active ? "800" : "600", flex: 1 }}>
                      {STATUS_META[s].label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={16} color={C.pink} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Permission Feeling — séparée du statut */}
          <View>
            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 4 }}>
              QUI PEUT M'ENVOYER UN FEELING ?
            </Text>
            <Text style={{ color: C.muted, fontSize: 11, marginBottom: 10 }}>
              Indépendant de ton statut. Toi seul décides.
            </Text>
            <View style={{ gap: 8 }}>
              {(Object.keys(PERMISSION_META) as FeelingPermission[]).map((perm) => {
                const active = prefs?.feeling_permission === perm;
                return (
                  <Pressable
                    key={perm}
                    onPress={() => pickPermission(perm)}
                    style={{
                      backgroundColor: active ? C.gold + "18" : C.card,
                      borderWidth: 1,
                      borderColor: active ? C.gold + "66" : C.border,
                      borderRadius: 11,
                      padding: 13,
                    }}
                  >
                    <Text style={{ color: active ? C.text : C.textSoft, fontSize: 13, fontWeight: active ? "800" : "600" }}>
                      {PERMISSION_META[perm]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Open to meet */}
          <Pressable
            onPress={toggleOpenToMeet}
            style={{
              backgroundColor: openActive ? C.green + "18" : C.card,
              borderWidth: 1,
              borderColor: openActive ? C.green + "66" : C.border,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <Text style={{ color: openActive ? C.green : C.text, fontSize: 14, fontWeight: "900" }}>
              💚 OPEN TO MEET {openActive ? "— actif" : ""}
            </Text>
            <Text style={{ color: C.textSoft, fontSize: 12, marginTop: 4 }}>
              {openActive
                ? "Tu apparais dans les zones sociales (agrégées, jamais ta position). Touche pour arrêter."
                : "Signale pendant 2 h que tu es dispo pour rencontrer, sans jamais partager ta position exacte."}
            </Text>
          </Pressable>

          {/* Zones sociales */}
          {zones.length > 0 && (
            <View>
              <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 10 }}>
                CE SOIR À TOULOUSE
              </Text>
              <View style={{ gap: 8 }}>
                {zones.map((z) => (
                  <View key={z.district_id} style={{ backgroundColor: C.card, borderRadius: 11, padding: 13, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: "800" }}>
                      💚 {z.district_name} — zone {ZONE_META[z.level].label}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: C.muted, fontSize: 10.5, marginTop: 8 }}>
                Toujours agrégé (min. 3 personnes). Jamais « quelqu'un à 80 m ».
              </Text>
            </View>
          )}

          {/* Croisés */}
          <View>
            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 10 }}>
              VOUS VOUS ÊTES CROISÉS
            </Text>
            {crossings.length === 0 ? (
              <Text style={{ color: C.textSoft, fontSize: 12.5, lineHeight: 18 }}>
                Personne encore. Va à un événement, une sortie de crew, une mission — c'est là qu'on se croise.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {crossings.map((c) => (
                  <Pressable
                    key={c.other_id}
                    onPress={() => router.push(`/(app)/profile-public?id=${c.other_id}`)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 11, padding: 13, borderWidth: 1, borderColor: C.border }}
                  >
                    <Text style={{ fontSize: 15 }}>👀</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>
                        Croisé {c.crossings_count > 1 ? `${c.crossings_count} fois` : "une fois"}
                      </Text>
                      <Text style={{ color: C.muted, fontSize: 11 }}>via {c.context}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={C.muted} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
