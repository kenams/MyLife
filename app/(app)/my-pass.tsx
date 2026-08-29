"use client";

/**
 * My Pass (§12) — événements MyLife payables en Wory. Le manque de Wory
 * donne envie de jouer (missions proches, daily, mission crew), pas de payer.
 */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchActiveEvents,
  fetchMyPasses,
  buyEventPass,
  computeMissingWory,
  type MyLifeEvent,
  type EventPass,
} from "@/lib/events";
import { fetchMyWoryBalance } from "@/lib/wory";
import { wory } from "@/lib/branding";
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
};

const WHEN = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function MyPassScreen() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<MyLifeEvent[]>([]);
  const [passes, setPasses] = useState<EventPass[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [missing, setMissing] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [ev, ps, bal] = await Promise.all([fetchActiveEvents(), fetchMyPasses(), fetchMyWoryBalance()]);
    setEvents(ev);
    setPasses(ps);
    setBalance(bal);
    const miss: Record<string, number> = {};
    for (const e of ev) miss[e.id] = await computeMissingWory(e.wory_cost);
    setMissing(miss);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function buy(e: MyLifeEvent) {
    const res = await buyEventPass(e.id);
    if (res.ok) {
      hapticSuccess();
      load();
    } else {
      load();
    }
  }

  const passByEvent = new Map(passes.map((p) => [p.event_id, p]));

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
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>MY PASS</Text>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: "900" }}>Événements MyLife</Text>
        </View>
        {balance != null && (
          <Text style={{ color: C.gold, fontSize: 13, fontWeight: "900" }}>{wory(balance)}</Text>
        )}
      </View>

      {loading ? (
        <View style={{ paddingTop: 50, alignItems: "center" }}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 12 }}>
          {events.length === 0 && (
            <Text style={{ color: C.textSoft, fontSize: 12.5, lineHeight: 18 }}>
              Aucun événement pour l'instant. Reviens bientôt — les MyLife Nights se préparent.
            </Text>
          )}
          {events.map((e) => {
            const pass = passByEvent.get(e.id);
            const miss = missing[e.id] ?? 0;
            return (
              <View key={e.id} style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 }}>
                <Text style={{ color: C.gold, fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>🔥 {e.title.toUpperCase()}</Text>
                <Text style={{ color: C.textSoft, fontSize: 12.5, marginTop: 4 }}>
                  {cap(WHEN.format(new Date(e.starts_at)))}
                </Text>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: "800", marginTop: 6 }}>
                  Entrée : {e.wory_cost > 0 ? wory(e.wory_cost) : "gratuite"}
                </Text>

                {pass ? (
                  <View style={{ marginTop: 12, backgroundColor: "#0A0A0A", borderRadius: 12, padding: 14, alignItems: "center" }}>
                    <Text style={{ color: pass.status === "used" ? C.muted : C.green, fontSize: 11, fontWeight: "900" }}>
                      {pass.status === "used" ? "PASS UTILISÉ" : "MY PASS · montre ce code à l'entrée"}
                    </Text>
                    <Text selectable style={{ color: C.text, fontSize: 13, fontWeight: "700", letterSpacing: 2, marginTop: 8, textAlign: "center" }}>
                      {pass.token.match(/.{1,4}/g)?.join(" ")}
                    </Text>
                  </View>
                ) : miss > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: C.text, fontSize: 12.5, fontWeight: "800" }}>Il te manque {wory(miss)}</Text>
                    <View style={{ gap: 4, marginTop: 6 }}>
                      <Text style={{ color: C.textSoft, fontSize: 11.5 }}>· Mission proche +10</Text>
                      <Text style={{ color: C.textSoft, fontSize: 11.5 }}>· Daily +5</Text>
                      <Text style={{ color: C.textSoft, fontSize: 11.5 }}>· Mission de crew +8</Text>
                    </View>
                    <Pressable onPress={() => router.push("/(app)/(tabs)/map")} style={{ marginTop: 10 }}>
                      <Text style={{ color: C.gold, fontWeight: "900", fontSize: 12 }}>Aller gagner des Wory →</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => buy(e)}
                    style={{ marginTop: 12, backgroundColor: C.gold, borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
                  >
                    <Text style={{ color: "#080808", fontWeight: "900", fontSize: 13 }}>Prendre mon pass</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          <Pressable onPress={() => router.push("/(app)/pass-scanner")} style={{ marginTop: 8, alignItems: "center" }}>
            <Text style={{ color: C.textSoft, fontSize: 12, fontWeight: "800" }}>Je suis organisateur — scanner des pass</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
