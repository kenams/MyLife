import { router } from "expo-router";

import { AvatarForm } from "@/components/avatar-form";
import { AppShell, Card, Muted, Pill, Title } from "@/components/ui";
import { useGameStore } from "@/stores/game-store";

export default function AvatarScreen() {
  const completeAvatar = useGameStore((state) => state.completeAvatar);

  return (
    <AppShell>
      <Card accent>
        <Pill>Onboarding</Pill>
        <Title>Construis une identite sociale complete.</Title>
        <Muted>
          Ton avatar ne sert pas juste a afficher un nom. Il definit ton rythme, ton image, tes attentes, ton corps et
          ta facon d'entrer dans le monde.
        </Muted>
      </Card>

      <AvatarForm
        submitLabel="Entrer dans le quartier"
        onSubmit={(avatar) => {
          completeAvatar(avatar);
          router.replace("/(app)/(tabs)/home");
        }}
      />
    </AppShell>
  );
}
