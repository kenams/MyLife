import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { colors } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#091524",
          borderTopColor: "rgba(255,255,255,0.08)",
          height: 72,
          paddingBottom: 10,
          paddingTop: 8
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Vie",
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="world"
        options={{
          title: "Monde",
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Social",
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alertes",
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />
        }}
      />
    </Tabs>
  );
}
