import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";

import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

function QueuetesBadge({ color, focused }: { color: string; focused: boolean }) {
  const missions   = useGameStore((s) => s.missionProgresses ?? []);
  const stats      = useGameStore((s) => s.stats);
  const claimable  = missions.filter((m) => m.status === "completed").length;
  const hoursSinceEat = stats.lastMealAt
    ? (Date.now() - new Date(stats.lastMealAt).getTime()) / 3_600_000 : 99;
  const criticalTasks = [
    hoursSinceEat > 7,
    stats.energy < 15,
    stats.hygiene < 20,
  ].filter(Boolean).length;
  const badgeCount = claimable + criticalTasks;
  const badgeColor = criticalTasks > 0 ? "#ef4444" : "#f6b94f";
  return (
    <View style={{ position: "relative" }}>
      <Ionicons name={focused ? "trophy" : "trophy-outline"} color={color} size={24} />
      {badgeCount > 0 && (
        <View style={{
          position: "absolute", top: -4, right: -6,
          minWidth: 16, height: 16, borderRadius: 8,
          backgroundColor: badgeColor, alignItems: "center", justifyContent: "center", paddingHorizontal: 3
        }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
        </View>
      )}
    </View>
  );
}

function ChatBadge({ color, focused }: { color: string; focused: boolean }) {
  const conversations = useGameStore((s) => s.conversations);
  const unread = conversations.reduce((s, c) => s + c.unreadCount, 0);
  return (
    <View style={{ position: "relative" }}>
      <Ionicons name={focused ? "people" : "people-outline"} color={color} size={24} />
      {unread > 0 && (
        <View style={{
          position: "absolute", top: -4, right: -8,
          minWidth: 16, height: 16, borderRadius: 8,
          backgroundColor: "#e74c3c", alignItems: "center", justifyContent: "center",
          paddingHorizontal: 3
        }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#060f1b",
          borderTopColor: "rgba(255,255,255,0.07)",
          height: 76,
          paddingBottom: 12,
          paddingTop: 10
        },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: "rgba(155,169,189,0.5)",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Vie",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} color={color} size={24} />
          )
        }}
      />
      <Tabs.Screen
        name="world"
        options={{
          title: "Monde",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} color={color} size={24} />
          )
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Social",
          tabBarIcon: ({ color, focused }) => <ChatBadge color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Quêtes",
          tabBarIcon: ({ color, focused }) => <QueuetesBadge color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} color={color} size={24} />
          )
        }}
      />
    </Tabs>
  );
}
