import { AppShell, Button, Card, Muted, Pill, SectionTitle, StatMeter, Title } from "@/components/ui";
import { useGameStore } from "@/stores/game-store";

export default function HealthScreen() {
  const stats = useGameStore((state) => state.stats);
  const performAction = useGameStore((state) => state.performAction);

  return (
    <AppShell>
      <Card accent>
        <Pill>Corps</Pill>
        <Title>Sante, hygiene et forme.</Title>
        <Muted>Le poids, la discipline, l'energie et le stress bougent ensemble. Le bon arbitrage reste la regularite.</Muted>
      </Card>

      <Card>
        <SectionTitle>Tableau corporel</SectionTitle>
        <StatMeter label="Sante" value={stats.health} />
        <StatMeter label="Forme physique" value={stats.fitness} tone="violet" />
        <StatMeter label="Hygiene" value={stats.hygiene} tone={stats.hygiene < 40 ? "warning" : "accent"} />
        <StatMeter label="Hydratation" value={stats.hydration} tone={stats.hydration < 40 ? "warning" : "accent"} />
        <StatMeter label="Discipline" value={stats.discipline} />
        <StatMeter label="Motivation" value={stats.motivation} tone="violet" />
        <StatMeter label="Charge de stress" value={100 - stats.stress} tone={stats.stress > 65 ? "danger" : "accent"} />
        <Muted>Poids actuel : {stats.weight} kg</Muted>
      </Card>

      <Card>
        <SectionTitle>Actions utiles</SectionTitle>
        <Button label="Boire de l'eau" onPress={() => performAction("hydrate")} />
        <Button label="Prendre une douche" variant="secondary" onPress={() => performAction("shower")} />
        <Button label="Marcher" variant="secondary" onPress={() => performAction("walk")} />
        <Button label="Faire une seance salle" variant="secondary" onPress={() => performAction("gym")} />
      </Card>
    </AppShell>
  );
}
