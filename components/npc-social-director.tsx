"use client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  NPC_SOCIAL_FIRST_DELAY_MS,
  NPC_SOCIAL_REFUSAL_COOLDOWN_MS,
  NPC_SOCIAL_RETURN_DELAY_MS,
  selectNpcSocialPrompt,
  type NpcSocialPrompt,
} from "@/lib/npc-social";
import { seedLivingCityNpcs } from "@/lib/living-city";
import { useGameStore } from "@/stores/game-store";

const REFUSALS_KEY = "mylife:npc-social-refusals:v1";
const RETRY_MS = 15_000;
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

function isMapPath(pathname: string) {
  return pathname === "/map" || pathname.endsWith("/map");
}

function resolveCandidate(refusedNpcIds: string[]): NpcSocialPrompt | null {
  const state = useGameStore.getState();
  const playerDistrict = state.avatar?.homeDistrict ?? "Capitole";
  const relations = state.npcRelations ?? [];

  const current = selectNpcSocialPrompt({
    npcs: state.npcs ?? [],
    relations,
    playerDistrict,
    refusedNpcIds,
  });
  if (current) return current;

  // Hard reliability fallback: reuse the canonical Living City seed rather than
  // creating a second NPC engine. This repairs an empty/stale resident pool and
  // guarantees the social director still has a real simulated resident to use.
  const preset = state.livingCity?.preset ?? "NORMAL";
  const seeded = seedLivingCityNpcs(preset);
  if (seeded.length > 0) {
    const existing = state.npcs ?? [];
    if (existing.length === 0) useGameStore.setState({ npcs: seeded });
    return selectNpcSocialPrompt({
      npcs: seeded,
      relations,
      playerDistrict,
      refusedNpcIds,
    });
  }

  return null;
}

export function NpcSocialDirector() {
  const pathname = usePathname();
  const router = useRouter();
  const avatarReady = useGameStore((state) => Boolean(state.avatar));
  const sessionProvider = useGameStore((state) => state.session?.provider ?? "none");
  const sessionEmail = useGameStore((state) => state.session?.email ?? "none");
  const updateNpcRelation = useGameStore((state) => state.updateNpcRelation);
  const startDirectConversation = useGameStore((state) => state.startDirectConversation);
  const addSocialNotification = useGameStore((state) => state.addSocialNotification);

  const [prompt, setPrompt] = useState<NpcSocialPrompt | null>(null);
  const refusalsRef = useRef<RefusalMap>({});
  const shownForSession = useRef(false);
  const resolving = useRef(false);
  const accountKey = `${sessionProvider}:${sessionEmail}`;
  const onMap = isMapPath(pathname);

  useEffect(() => {
    shownForSession.current = false;
    resolving.current = false;
    setPrompt(null);
    void readActiveRefusals().then((next) => {
      refusalsRef.current = next;
    });
  }, [accountKey]);

  useEffect(() => {
    // Object identity for avatar/session/NPC arrays changes during hydration,
    // cloud sync and Living City ticks. Never depend on those objects here:
    // doing so continuously cancels and recreates the 45 s guarantee timer.
    // Avatar presence is enough to start: a stale hydration flag or auth refresh
    // must never make a populated Map socially dead.
    if (!onMap || !avatarReady || shownForSession.current) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const attempt = () => {
      if (cancelled || shownForSession.current) return;
      const candidate = resolveCandidate(Object.keys(refusalsRef.current));

      if (!candidate) {
        timer = setTimeout(attempt, RETRY_MS);
        return;
      }

      shownForSession.current = true;
      setPrompt(candidate);
    };

    const initial = resolveCandidate(Object.keys(refusalsRef.current));
    const delay = initial?.kind === "reconnect-follow-up"
      ? NPC_SOCIAL_RETURN_DELAY_MS
      : NPC_SOCIAL_FIRST_DELAY_MS;

    timer = setTimeout(attempt, delay);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [accountKey, avatarReady, onMap]);

  if (!onMap || !prompt) return null;

  const accept = () => {
    if (resolving.current) return;
    resolving.current = true;
    setPrompt(null);
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
    const next = { ...refusalsRef.current, [prompt.npcId]: Date.now() };
    refusalsRef.current = next;
    void AsyncStorage.setItem(REFUSALS_KEY, JSON.stringify(next));
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
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 12, right: 12, bottom: 92, zIndex: 10050, alignItems: "center" }}
    >
      <View
        testID="npc-social-card"
        accessibilityLiveRegion="assertive"
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.16)",
          backgroundColor: "rgba(12,12,14,0.98)",
          padding: 14,
          shadowColor: "#000",
          shadowOpacity: 0.42,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 30,
        }}
      >
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
