import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";

import { colors } from "@/lib/theme";

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
            <View style={{ position: "relative" }}>
              <Ionicons name={focused ? "sparkles" : "sparkles-outline"} color={color} size={24} />
            </View>
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} color={color} size={24} />
          )
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alertes",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "notifications" : "notifications-outline"} color={color} size={24} />
          )
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
