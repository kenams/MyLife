import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";

import { buildMapEvents } from "@/lib/map-events";
import { useGameStore } from "@/stores/game-store";

const TAB_ACTIVE   = "#6366f1";
const TAB_INACTIVE = "#8fa3b8";
const BADGE_RED    = "#ef4444";
const BADGE_GOLD   = "#f59e0b";

function Badge({ count, color }: { count: number; color: string }) {
  if (count <= 0) return null;
  return (
    <View style={{
      position: "absolute", top: -5, right: -8,
      minWidth: 17, height: 17, borderRadius: 9,
      backgroundColor: color, alignItems: "center", justifyContent: "center",
      paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#ffffff"
    }}>
      <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

function QuestesIcon({ color, focused }: { color: string; focused: boolean }) {
  const missions     = useGameStore((s) => s.missionProgresses ?? []);
  const stats        = useGameStore((s) => s.stats);
  const claimable    = missions.filter((m) => m.status === "completed").length;
  const hoursSinceEat = stats.lastMealAt
    ? (Date.now() - new Date(stats.lastMealAt).getTime()) / 3_600_000 : 99;
  const critical = [hoursSinceEat > 7, stats.energy < 15, stats.hygiene < 20].filter(Boolean).length;
  const total    = claimable + critical;
  return (
    <View style={{ position: "relative" }}>
      <Ionicons name={focused ? "trophy" : "trophy-outline"} color={color} size={23} />
      <Badge count={total} color={critical > 0 ? BADGE_RED : BADGE_GOLD} />
    </View>
  );
}

function ChatIcon({ color, focused }: { color: string; focused: boolean }) {
  const unread = useGameStore((s) => s.conversations.reduce((n, c) => n + c.unreadCount, 0));
  return (
    <View style={{ position: "relative" }}>
      <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} color={color} size={23} />
      <Badge count={unread} color={BADGE_RED} />
    </View>
  );
}

function WorldIcon({ color, focused }: { color: string; focused: boolean }) {
  const stats  = useGameStore((s) => s.stats);
  const urgent = buildMapEvents(stats, 5).filter((e) => e.severity !== "low").length;
  return (
    <View style={{ position: "relative" }}>
      <Ionicons name={focused ? "compass" : "compass-outline"} color={color} size={23} />
      <Badge count={urgent} color={urgent > 1 ? BADGE_RED : BADGE_GOLD} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 10,
          backgroundColor: "rgba(255,255,255,0.97)",
          borderTopColor: "rgba(0,0,0,0.06)",
          borderTopWidth: 1,
          borderRadius: 24,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          shadowColor: "rgba(99,102,241,0.15)",
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -4 },
          elevation: 16,
        },
        tabBarActiveTintColor:   TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarItemStyle:   { borderRadius: 16, marginHorizontal: 2 },
        tabBarLabelStyle:  { fontSize: 10, fontWeight: "800", marginTop: 1 },
      }}
    >
      <Tabs.Screen name="home" options={{
        title: "Vie",
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? "sparkles" : "sparkles-outline"} color={color} size={23} />
        ),
      }} />
      <Tabs.Screen name="world" options={{
        title: "Ville",
        tabBarIcon: ({ color, focused }) => <WorldIcon color={color} focused={focused} />,
      }} />
      <Tabs.Screen name="chat" options={{
        title: "Chat",
        tabBarIcon: ({ color, focused }) => <ChatIcon color={color} focused={focused} />,
      }} />
      <Tabs.Screen name="notifications" options={{
        title: "Objectifs",
        tabBarIcon: ({ color, focused }) => <QuestesIcon color={color} focused={focused} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: "Profil",
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? "person-circle" : "person-circle-outline"} color={color} size={23} />
        ),
      }} />
    </Tabs>
  );
}
