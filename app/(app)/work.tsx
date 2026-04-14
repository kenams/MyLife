import { jobs } from "@/lib/game-engine";
import { AppShell, Button, Card, ListRow, MetricCard, Muted, Pill, SectionTitle, Title } from "@/components/ui";
import { useGameStore } from "@/stores/game-store";
import { View } from "react-native";

export default function WorkScreen() {
  const avatar = useGameStore((state) => state.avatar);
  const stats = useGameStore((state) => state.stats);
  const performAction = useGameStore((state) => state.performAction);

  return (
    <AppShell>
      <Card accent>
        <Pill>Travail</Pill>
        <Title>Revenus, discipline et statut.</Title>
        <Muted>Le travail ne sert pas seulement a gagner des credits. Il soutient ton niveau de vie et ton rang social.</Muted>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <MetricCard label="Credits" value={`${stats.money}`} hint="budget actuel" />
        <MetricCard label="Discipline" value={`${stats.discipline}%`} hint="constance productive" />
        <MetricCard label="Score social" value={`${stats.socialRankScore}%`} hint="niveau de vie percu" />
      </View>

      <Card>
        <SectionTitle>Metier de depart</SectionTitle>
        <Muted>{avatar?.starterJob ?? "Aucun"}</Muted>
        <Button label="Faire un shift" onPress={() => performAction("work-shift")} />
        <Button label="Faire une tache focus" variant="secondary" onPress={() => performAction("focus-task")} />
      </Card>

      <Card>
        <SectionTitle>Metiers disponibles</SectionTitle>
        {jobs.map((job) => (
          <ListRow
            key={job.slug}
            title={job.name}
            subtitle={`+${job.rewardCoins} credits · discipline +${job.disciplineReward} · stress +${job.stressCost}`}
          />
        ))}
      </Card>
    </AppShell>
  );
}
