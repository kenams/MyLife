import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { PARIS_QUARTIERS_LIST } from "@/lib/live-chat";
import { supabase } from "@/lib/supabase";

const L = {
  bg: "#080808", card: "#111111", cardAlt: "#181818",
  text: "#F5F2E8", soft: "#A8A49A", muted: "#4A4844",
  border: "rgba(255,255,255,0.07)", primary: "#FFD600",
  primaryBg: "#1A1500", green: "#39FF14", greenBg: "#091A03",
  purple: "#BF5FFF", purpleBg: "#18082A",
  teal: "#00FFD1", tealBg: "#001A14",
};

function LivePulse({ color = L.green }: { color?: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.7, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: 10, height: 10, borderRadius: 5,
        backgroundColor: color, opacity: 0.3, transform: [{ scale: pulse }] }} />
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

export default function QuartiersScreen() {
  const [counts, setCounts]   = useState<Record<string, number>>({});
  const [hasNpc, setHasNpc]   = useState<Record<string, boolean>>({});
  const [total,  setTotal]    = useState(0);

  useEffect(() => {
    if (!supabase) return;

    // Compteur messages par quartier (dernières 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabase.from("quartier_messages")
      .select("quartier, is_npc")
      .gte("created_at", since)
      .then(({ data }) => {
        if (!data) return;
        const cnt: Record<string, number> = {};
        const npc: Record<string, boolean> = {};
        for (const m of data) {
          cnt[m.quartier] = (cnt[m.quartier] ?? 0) + 1;
          if (m.is_npc) npc[m.quartier] = true;
        }
        setCounts(cnt);
        setHasNpc(npc);
        setTotal(data.length);
      });
  }, []);

  const activeIds = new Set(Object.keys(counts));

  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>

      {/* Header */}
      <View style={{ paddingTop: 54, paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: L.border }}>
        <Pressable onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: L.card,
            alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Text style={{ color: L.text, fontSize: 16 }}>←</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: L.text, fontSize: 22, fontWeight: "900" }}>Quartiers Toulouse</Text>
            <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }}>Chats live · effacés dans 24h</Text>
          </View>
          {total > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: L.greenBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
              borderWidth: 1, borderColor: L.green + "30" }}>
              <LivePulse />
              <Text style={{ color: L.green, fontSize: 11, fontWeight: "800" }}>{total} messages</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, gap: 8 }}
        showsVerticalScrollIndicator={false}>
        {PARIS_QUARTIERS_LIST.map((q) => {
          const msgCount = counts[q.id] ?? 0;
          const live     = msgCount > 0 || activeIds.has(q.id);
          const npcHere  = hasNpc[q.id] ?? false;
          const hot      = msgCount >= 5;

          return (
            <Pressable key={q.id}
              onPress={() => router.push(`/(app)/live-chat?quartier=${q.id}` as never)}
              style={{ flexDirection: "row", alignItems: "center", gap: 14,
                backgroundColor: hot ? L.primaryBg : L.card,
                borderRadius: 16, padding: 14,
                borderWidth: 1, borderColor: hot ? L.primary + "25" : L.border,
                shadowColor: hot ? L.primary : "transparent",
                shadowOpacity: hot ? 0.08 : 0, shadowRadius: 10 }}>

              {/* Emoji bulle */}
              <View style={{ width: 48, height: 48, borderRadius: 24,
                backgroundColor: live ? (hot ? L.primaryBg : L.cardAlt) : L.cardAlt,
                alignItems: "center", justifyContent: "center",
                borderWidth: 1.5, borderColor: live ? (hot ? L.primary + "40" : L.border) : "transparent" }}>
                <Text style={{ fontSize: 24 }}>{q.emoji}</Text>
              </View>

              {/* Infos */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <Text style={{ color: hot ? L.primary : L.text, fontSize: 15, fontWeight: "800" }}>
                    {q.id}
                  </Text>
                  {hot && (
                    <View style={{ backgroundColor: L.primary, borderRadius: 5,
                      paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ color: "#080808", fontSize: 8, fontWeight: "900" }}>HOT</Text>
                    </View>
                  )}
                  {npcHere && (
                    <View style={{ backgroundColor: L.purpleBg, borderRadius: 5,
                      paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: L.purple + "30" }}>
                      <Text style={{ color: L.purple, fontSize: 8, fontWeight: "900" }}>NPC</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: L.muted, fontSize: 12 }}>{q.desc}</Text>
                {msgCount > 0 && (
                  <Text style={{ color: L.green, fontSize: 10, fontWeight: "700", marginTop: 3 }}>
                    {msgCount} message{msgCount > 1 ? "s" : ""} · 24h
                  </Text>
                )}
              </View>

              {/* Status */}
              <View style={{ alignItems: "center", gap: 4 }}>
                {live ? <LivePulse color={hot ? L.primary : L.green} /> : (
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: L.muted }} />
                )}
                <Text style={{ color: L.muted, fontSize: 10 }}>→</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
