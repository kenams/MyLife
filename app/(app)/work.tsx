import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { AppShell, Button, Card, MetricCard, Muted, Pill, SectionTitle, Title } from "@/components/ui";
import { jobs } from "@/lib/game-engine";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

export default function WorkScreen() {
  const avatar = useGameStore((state) => state.avatar);
  const stats = useGameStore((state) => state.stats);
  const performAction = useGameStore((state) => state.performAction);
  const editAvatar = useGameStore((state) => state.editAvatar);

  const currentJob = avatar?.starterJob ?? jobs[0].slug;
  const [selecting, setSelecting] = useState(false);

  function switchJob(slug: string) {
    if (!avatar) return;
    editAvatar({ ...avatar, starterJob: slug });
    setSelecting(false);
  }

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
        <SectionTitle>Poste actuel</SectionTitle>
        {(() => {
          const job = jobs.find((j) => j.slug === currentJob) ?? jobs[0];
          return (
            <>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16, marginBottom: 4 }}>{job.name}</Text>
              <Muted>+{job.rewardCoins} credits · discipline +{job.disciplineReward} · stress +{job.stressCost} par shift</Muted>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Faire un shift" onPress={() => performAction("work-shift")} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Tache focus" variant="secondary" onPress={() => performAction("focus-task")} />
                </View>
              </View>
              <Button label={selecting ? "Annuler le changement" : "Changer de poste"} variant="ghost" onPress={() => setSelecting(!selecting)} />
            </>
          );
        })()}
      </Card>

      {selecting ? (
        <Card>
          <SectionTitle>Choisir un poste</SectionTitle>
          <Muted>Le changement est immediat. Ton prochain shift utilisera ce poste.</Muted>
          <View style={{ gap: 8, marginTop: 8 }}>
            {jobs.map((job) => {
              const isActive = job.slug === currentJob;
              return (
                <TouchableOpacity
                  key={job.slug}
                  onPress={() => switchJob(job.slug)}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: isActive ? colors.accent : colors.border,
                    backgroundColor: isActive ? "rgba(215,184,122,0.08)" : "transparent"
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{job.name}</Text>
                    {isActive ? <Pill>actuel</Pill> : null}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                    +{job.rewardCoins} credits · discipline +{job.disciplineReward} · reputation +{job.reputationReward} · stress +{job.stressCost}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Impact du travail</SectionTitle>
        <Muted>· La discipline monte et soutient le rang social</Muted>
        <Muted>· Le momentum actif booste les credits par shift</Muted>
        <Muted>· Un stress eleve avant un shift reduit le rendement net</Muted>
        <Muted>· La reputation progresse avec chaque shift realise</Muted>
      </Card>
    </AppShell>
  );
}
