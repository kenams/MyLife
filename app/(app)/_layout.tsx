import { View } from "react-native";
import { Stack } from "expo-router";

import { useLocalNotifications } from "@/hooks/use-local-notifications";
import { usePushTokenRegistration } from "@/hooks/use-push-token-registration";
import { useSocialNotifications } from "@/hooks/use-social-notifications";
import { GainToast } from "@/components/gain-toast";

function NotificationWatcher() {
  useLocalNotifications();
  usePushTokenRegistration();
  useSocialNotifications();
  return null;
}

export default function AppLayout() {
  return (
    <View style={{ flex: 1 }}>
      <NotificationWatcher />
      <Stack screenOptions={{ headerShown: false }} />
      <GainToast />
    </View>
  );
}
