import { Stack } from "expo-router";

import { useLocalNotifications } from "@/hooks/use-local-notifications";

function NotificationWatcher() {
  useLocalNotifications();
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
