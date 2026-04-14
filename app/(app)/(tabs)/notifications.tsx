import { router } from "expo-router";
import { View } from "react-native";

import { AppShell, Button, Card, ListRow, Muted, Pill, Title } from "@/components/ui";
import { useGameStore } from "@/stores/game-store";

export default function NotificationsScreen() {
  const notifications = useGameStore((state) => state.notifications);
  const markNotificationRead = useGameStore((state) => state.markNotificationRead);
  const markAllNotificationsRead = useGameStore((state) => state.markAllNotificationsRead);

  return (
    <AppShell>
      <Card accent>
        <Pill>Alertes</Pill>
        <Title>Rappels intelligents</Title>
        <Muted>
          Le MVP utilise un centre d'alertes interne. La structure est prete pour brancher ensuite des notifications
          locales Expo ou du push.
        </Muted>
        <Button label="Tout marquer comme lu" variant="secondary" onPress={markAllNotificationsRead} />
      </Card>

      {notifications.map((notification) => (
        <Card key={notification.id}>
          <ListRow
            title={notification.title}
            subtitle={notification.body}
            right={<Pill tone={notification.read ? "muted" : "accent"}>{notification.kind}</Pill>}
          />
          {!notification.read ? <Button label="Marquer comme lu" variant="ghost" onPress={() => markNotificationRead(notification.id)} /> : null}
        </Card>
      ))}

      <View>
        <Button label="Voir les conseils de vie" variant="secondary" onPress={() => router.push("/(app)/tips")} />
      </View>
    </AppShell>
  );
}
