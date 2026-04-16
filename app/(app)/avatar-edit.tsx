import { router } from "expo-router";

import { AvatarForm } from "@/components/avatar-form";
import { AppShell, Card, Muted, NavBack, Pill, Title } from "@/components/ui";
import { useGameStore } from "@/stores/game-store";

export default function AvatarEditScreen() {
  const avatar = useGameStore((state) => state.avatar);
  const editAvatar = useGameStore((state) => state.editAvatar);

  if (!avatar) {
    return null;
  }

  return (
    <AppShell>
      <NavBack fallback="/(app)/(tabs)/profile" />
      <Card accent>
        <Pill>Edition</Pill>
        <Title>Affiner ton profil.</Title>
        <Muted>Tu peux ajuster ton image, tes preferences et ton intention sociale sans reset complet.</Muted>
      </Card>

      <AvatarForm
        initialAvatar={avatar}
        submitLabel="Enregistrer le profil"
        onSubmit={(nextAvatar) => {
          editAvatar(nextAvatar);
          router.back();
        }}
      />
    </AppShell>
  );
}
