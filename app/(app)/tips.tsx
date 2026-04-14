import { AppShell, Card, ListRow, Muted, Pill, Title } from "@/components/ui";
import { useGameStore } from "@/stores/game-store";

export default function TipsScreen() {
  const advice = useGameStore((state) => state.advice);

  return (
    <AppShell>
      <Card accent>
        <Pill>Conseils</Pill>
        <Title>Conseils de vie applicables.</Title>
        <Muted>Le moteur reste volontairement simple, concret et non medical. L'objectif est d'aider sans moraliser.</Muted>
      </Card>

      {advice.map((item) => (
        <Card key={item.id}>
          <ListRow title={item.title} subtitle={item.body} right={<Pill tone="muted">{item.category}</Pill>} />
        </Card>
      ))}
    </AppShell>
  );
}
