"use client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  NPC_SOCIAL_FIRST_DELAY_MS,
  NPC_SOCIAL_REFUSAL_COOLDOWN_MS,
  NPC_SOCIAL_RETURN_DELAY_MS,
  selectNpcSocialPrompt,
  type NpcSocialPrompt,
} from "@/lib/npc-social";
import { useGameStore } from "@/stores/game-store";

const REFUSALS_KEY = "mylife:npc-social-refusals:v1";
type RefusalMap = Record<string, number>;

async function readActiveRefusals(now = Date.now()): Promise<RefusalMap> {
  try {
    const raw = await AsyncStorage.getItem(REFUSALS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RefusalMap;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, at]) => Number.isFinite(at) && now - at < NPC_SOCIAL_REFUSAL_COOLDOWN_MS),
    );
  } catch {
    return {};
  }
}

export function NpcSocialDirector() {
  const pathname = usePathname();
  const router = useRouter();
  const avatar = useGameStore((state) => state.avatar);
  const session = useGameStore((state) => state.session);
  const npcs = useGameStore((state) => state.npcs);
  const npcRelations = useGameStore((state) => state.npcRelations);
  const updateNpcRelation = useGameStore((state) => state.updateNpcRelation);
  const startDirectConversation = useGameStore((state) => state.startDirectConversation);
  const addSocialNotification = useGameStore((state) => state.addSocialNotification);

  const [prompt, setPrompt] = useState<NpcSocialPrompt | null>(null);
  const [refusals, setRefusals] = useState<RefusalMap>({});
  const shownForSession = useRef(false);
  const resolving = useRef(false);
  const sessionKey = `${session?.provider ?? "none"}:${session?.email ?? "none"}`;

  useEffect(() => {
    shownForSession.current = false;
    resolving.current = false;
    setPrompt(null);
    void readActiveRefusals().then(setRefusals);
  }, [sessionKey]);

  const candidate = useMemo(() => selectNpcSocialPrompt({
    npcs: npcs ?? [],
    relations: npcRelations ?? [],
    playerDistrict: avatar?.homeDistrict ?? "Capitole",
    refusedNpcIds: Object.keys(refusals),
  }), [avatar?.homeDistrict, npcRelations, npcs, refusals]);

  useEffect(() => {
    if (pathname !== "/map" || !avatar || !session || !candidate || shownForSession.current) return;
    const delay = candidate.kind === "reconnect-follow-up"
      ? NPC_SOCIAL_RETURN_DELAY_MS
      : NPC_SOCIAL_FIRST_DELAY_MS;
    const timer = setTimeout(() => {
      if (shownForSession.current) return;
      shownForSession.current = true;
      setPrompt(candidate);
    }, delay);
    return () => clearTimeout(timer);
  }, [avatar, candidate, pathname, session]);

  if (pathname !== "/map" || !prompt) return null;

  const accept = () => {
    if (resolving.current) return;
    resolving.current = true;
    setPrompt(null);
    // +15 is the existing threshold for a cloud-synced NPC "contact" relation.
    updateNpcRelation(prompt.npcId, 15, prompt.npcName);
    startDirectConversation(prompt.npcId, prompt.npcName);
    addSocialNotification({
      id: `npc-social-accepted-${prompt.npcId}-${Date.now()}`,
      kind: "social",
      title: `Tu as répondu à ${prompt.npcName}`,
      body: prompt.kind === "reconnect-follow-up"
        ? "Le lien reprend là où vous l'aviez laissé."
        : "Votre première rencontre est maintenant mémorisée.",
      createdAt: new Date().toISOString(),
      read: false,
    });
    router.push("/(app)/dm" as never);
  };

  const decline = () => {
    if (resolving.current) return;
    resolving.current = true;
    setPrompt(null);
    const next = { ...refusals, [prompt.npcId]: Date.now() };
    setRefusals(next);
    void AsyncStorage.setItem(REFUSALS_KEY, JSON.stringify(next));
    // Refusal is deliberately neutral: no relation score/count mutation.
    addSocialNotification({
      id: `npc-social-declined-${prompt.npcId}-${Date.now()}`,
      kind: "social",
      title: `${prompt.npcName} te laisse tranquille`,
      body: "Aucune pénalité. Il ou elle pourra revenir plus tard, sans spam.",
      createdAt: new Date().toISOString(),
      read: false,
    });
  };

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, bottom: 92, zIndex: 120 }}>
      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(12,12,14,0.96)", padding: 14, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 14 }}>
        <Text style={{ color: "#FFD600", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }}>
          HABITANT SIMULÉ · {prompt.district.toUpperCase()}
        </Text>
        <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "900", marginTop: 6 }}>{prompt.title}</Text>
        <Text style={{ color: "#C8C5BD", fontSize: 13, lineHeight: 19, marginTop: 5 }}>{prompt.body}</Text>
        <View style={{ flexDirection: "row", gap: 9, marginTop: 13 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Répondre à ${prompt.npcName}`} onPress={accept} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: "#FFD600", alignItems: "center" }}>
            <Text style={{ color: "#080808", fontWeight: "900", fontSize: 12 }}>RÉPONDRE</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Pas maintenant pour ${prompt.npcName}`} onPress={decline} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", alignItems: "center" }}>
            <Text style={{ color: "#E7E4DC", fontWeight: "800", fontSize: 12 }}>PAS MAINTENANT</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
