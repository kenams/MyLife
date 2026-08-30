import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useGameStore } from "@/stores/game-store";

const BADGE_RED  = "#ef4444";
const BADGE_GOLD = "#f59e0b";

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
  const missions      = useGameStore((s) => s.missionProgresses ?? []);
  const stats         = useGameStore((s) => s.stats ?? {} as typeof s.stats);
  const claimable     = missions.filter((m) => m.status === "completed").length;
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
  const unread = useGameStore((s) => (s.conversations ?? []).reduce((n, c) => n + c.unreadCount, 0));
  return (
    <View style={{ position: "relative" }}>
      <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} color={color} size={23} />
      <Badge count={unread} color={BADGE_RED} />
    </View>
  );
}

export default function TabsLayout() {
  const T = useAppTheme();

  return (
    <Tabs
      initialRouteName="map"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          // Keep the bar in the normal layout flow. The previous absolute
          // positioning visually covered the bottom of screens (especially
          // the NAVIGUER section on desktop/mobile). React Navigation now
          // reserves the required safe space for screen content.
          backgroundColor: T.tabBg,
          borderTopColor: T.tabBorder,
          borderTopWidth: 1,
          height: Platform.OS === "web" ? 70 : 72,
          paddingBottom: 8,
          paddingTop: 6,
          shadowColor: T.tabShadow,
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -4 },
          elevation: 16,
        },
        tabBarActiveTintColor:   T.tabActive,
        tabBarInactiveTintColor: T.tabInactive,
        tabBarItemStyle:   { minHeight: 54, borderRadius: 12, marginHorizontal: 1 },
        tabBarLabelStyle:  { fontSize: 10, fontWeight: "800", marginTop: 0 },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen name="home" options={{
        title: "Vie",
        href: null,
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? "sparkles" : "sparkles-outline"} color={color} size={23} />
        ),
      }} />
      <Tabs.Screen name="map" options={{
        title: "Map",
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? "map" : "map-outline"} color={color} size={23} />
        ),
      }} />
      <Tabs.Screen name="chat" options={{
        title: "Chat",
        tabBarIcon: ({ color, focused }) => <ChatIcon color={color} focused={focused} />,
      }} />
      <Tabs.Screen name="crews" options={{
        title: "Crews",
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? "shield" : "shield-outline"} color={color} size={23} />
        ),
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
