"use client";

/**
 * QG du Crew (Phase D) — le lieu de vie de l'équipe : objectif commun de la
 * semaine + mur de souvenirs. Se branche sur `lib/crew-life.ts` qui dégrade
 * proprement tant que la migration `20260830000000_crew_life.sql` n'est pas
 * appliquée.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGameStore } from "@/stores/game-store";
import { getMyCrewId, fetchCrewMembers, type CrewMember } from "@/lib/crews";
import {
  fetchWeeklyGoal,
  fetchCrewMemories,
  addCrewMemory,
  type CrewWeeklyGoal,
  type CrewMemory,
} from "@/lib/crew-life";
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
  purple: "#BF5FFF",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

export default function CrewHqScreen() {
  const avatar = useGameStore((s) => s.avatar);
  const playerName = avatar?.displayName ?? "Joueur";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [crewId, setCrewId] = useState<string | null>(null);
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [goal, setGoal] = useState<CrewWeeklyGoal | null>(null);
  const [memories, setMemories] = useState<CrewMemory[]>([]);

  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = await getMyCrewId(playerName);
    setCrewId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    const [m, g, mem] = await Promise.all([
      fetchCrewMembers(id),
      fetchWeeklyGoal(id),
      fetchCrewMemories(id),
    ]);
    setMembers(m);
    setGoal(g);
    setMemories(mem);
    setLoading(false);
  }, [playerName]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function submitMemory() {
    if (!crewId) return;
    setSaving(true);
    setErr(null);
    const res = await addCrewMemory(crewId, title, body);
    setSaving(false);
    if (!res.ok) {
      setErr(res.error ?? "Échec de l'enregistrement.");
      return;
    }
    hapticSuccess();
    setTitle("");
    setBody("");
    setModal(false);
    const mem = await fetchCrewMemories(crewId);
    setMemories(mem);
  }

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
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>QG DU CREW</Text>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: "900" }}>La vie de l'équipe</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ paddingTop: 60, alignItems: "center" }}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : !crewId ? (
        <View style={{ padding: 28, alignItems: "center", gap: 14 }}>
          <Text style={{ fontSize: 30 }}>🤝</Text>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: "800", textAlign: "center" }}>
            Tu n'as pas encore de crew.
          </Text>
          <Text style={{ color: C.textSoft, fontSize: 12.5, textAlign: "center", lineHeight: 18 }}>
            Le QG, c'est là que ton équipe se retrouve : objectif commun de la semaine et mur de souvenirs.
          </Text>
          <Pressable
            onPress={() => router.push("/(app)/(tabs)/crews")}
            style={{ backgroundColor: C.gold, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 22 }}
          >
            <Text style={{ color: "#080808", fontWeight: "900", fontSize: 13 }}>Rejoindre un crew</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
        >
          {/* Membres */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 8 }}>
              MEMBRES ({members.length})
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {members.map((m) => (
                <View
                  key={m.user_id ?? m.player_name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: C.card,
                    borderRadius: 9,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: C.border,
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{m.player_emoji ?? "🧢"}</Text>
                  <Text style={{ color: C.text, fontSize: 12, fontWeight: "700" }}>{m.player_name}</Text>
                  {m.role === "founder" && (
                    <Text style={{ color: C.gold, fontSize: 10, fontWeight: "900" }}>★</Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Objectif de la semaine */}
          <View
            style={{
              margin: 16,
              backgroundColor: C.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: C.border,
              padding: 16,
            }}
          >
            <Text style={{ color: C.purple, fontSize: 10, fontWeight: "900", letterSpacing: 1.6 }}>
              OBJECTIF DU CREW · CETTE SEMAINE
            </Text>
            {goal ? (
              <>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: "800", marginTop: 6 }}>{goal.label}</Text>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#1E1E1E",
                    overflow: "hidden",
                    marginTop: 10,
                  }}
                >
                  <View
                    style={{
                      width: `${Math.min(100, (goal.progress / goal.target) * 100)}%`,
                      height: "100%",
                      backgroundColor: goal.progress >= goal.target ? C.green : C.purple,
                    }}
                  />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                  <Text style={{ color: C.textSoft, fontSize: 11.5, fontWeight: "800" }}>
                    {goal.progress}/{goal.target}
                  </Text>
                  <Text style={{ color: C.gold, fontSize: 11.5, fontWeight: "900" }}>+{goal.reward_xp} XP au crew</Text>
                </View>
              </>
            ) : (
              <Text style={{ color: C.textSoft, fontSize: 12.5, marginTop: 6 }}>
                L'objectif hebdo s'activera dès la prochaine synchro du crew.
              </Text>
            )}
          </View>

          {/* Souvenirs */}
          <View style={{ paddingHorizontal: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>
                SOUVENIRS DU CREW
              </Text>
              <Pressable
                onPress={() => setModal(true)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: C.gold,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Ionicons name="add" size={14} color="#080808" />
                <Text style={{ color: "#080808", fontWeight: "900", fontSize: 11.5 }}>Ajouter</Text>
              </Pressable>
            </View>

            {memories.length === 0 ? (
              <Text style={{ color: C.textSoft, fontSize: 12.5, lineHeight: 18, marginBottom: 20 }}>
                Rien encore. Après une sortie, une soirée, une mission réussie ensemble — laisse-en une trace ici.
              </Text>
            ) : (
              memories.map((m) => (
                <View
                  key={m.id}
                  style={{
                    backgroundColor: C.card,
                    borderRadius: 13,
                    borderWidth: 1,
                    borderColor: C.border,
                    padding: 14,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: "800" }}>{m.title}</Text>
                  {!!m.body && (
                    <Text style={{ color: C.textSoft, fontSize: 12.5, lineHeight: 18, marginTop: 4 }}>{m.body}</Text>
                  )}
                  <Text style={{ color: C.muted, fontSize: 10.5, marginTop: 8 }}>{timeAgo(m.created_at)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: C.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: 36,
              gap: 12,
            }}
          >
            <Text style={{ color: C.text, fontSize: 16, fontWeight: "900" }}>Nouveau souvenir</Text>
            <TextInput
              placeholder="Titre (ex : Soirée aux Carmes)"
              placeholderTextColor={C.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              style={{
                backgroundColor: "#1A1A1A",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 11,
                color: C.text,
                fontSize: 13.5,
              }}
            />
            <TextInput
              placeholder="Ce qui s'est passé (optionnel)"
              placeholderTextColor={C.muted}
              value={body}
              onChangeText={setBody}
              maxLength={1000}
              multiline
              style={{
                backgroundColor: "#1A1A1A",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 11,
                color: C.text,
                fontSize: 13.5,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
            {err && <Text style={{ color: "#FF6B6B", fontSize: 12 }}>{err}</Text>}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setModal(false)}
                style={{ flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: C.border }}
              >
                <Text style={{ color: C.textSoft, fontWeight: "800", fontSize: 13 }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={submitMemory}
                disabled={saving || !title.trim()}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: C.gold,
                  opacity: saving || !title.trim() ? 0.5 : 1,
                }}
              >
                <Text style={{ color: "#080808", fontWeight: "900", fontSize: 13 }}>
                  {saving ? "..." : "Enregistrer"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
