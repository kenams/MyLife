import { Stack } from "expo-router";

import { useLocalNotifications } from "@/hooks/use-local-notifications";
import { usePushTokenRegistration } from "@/hooks/use-push-token-registration";
import { useSocialNotifications } from "@/hooks/use-social-notifications";

function NotificationWatcher() {
  useLocalNotifications();
  usePushTokenRegistration();
  useSocialNotifications();
  return null;
}

export default function AppLayout() {
  return (
    <>
      <NotificationWatcher />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
