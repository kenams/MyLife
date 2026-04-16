import { Stack } from "expo-router";

import { useLocalNotifications } from "@/hooks/use-local-notifications";
import { usePushTokenRegistration } from "@/hooks/use-push-token-registration";

function NotificationWatcher() {
  useLocalNotifications();
  usePushTokenRegistration();
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
