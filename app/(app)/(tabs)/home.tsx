import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";

import { AppShell, AvatarBadge, Button, Card, MetricCard, Muted, Pill, SectionTitle, StatMeter, Title } from "@/components/ui";
import { getLocationName, getRecommendedAction, getSocialRankCopy, getSocialRankLabel, getUrgency, getUrgencyCopy, getWellbeingScore } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

function QuickAction({
  title,
  copy,
  onPress
}: {
  title: string;
  copy: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flexBasis: "48%", backgroundColor: colors.cardAlt, padding: 14, borderRadius: 20, gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{title}</Text>
      <Text style={{ color: colors.muted, lineHeight: 18 }}>{copy}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const avatar = useGameStore((state) => state.avatar);
  const stats = useGameStore((state) => state.stats);
  const currentLocationSlug = useGameStore((state) => state.currentLocationSlug);
  const performAction = useGameStore((state) => state.performAction);
  const claimDailyReward = useGameStore((state) => state.claimDailyReward);
  const dailyGoals = useGameStore((state) => state.dailyGoals);
  const advice = useGameStore((state) => state.advice);
  const lifeFeed = useGameStore((state) => state.lifeFeed);
  const bootstrap = useGameStore((state) => state.bootstrap);

  useFocusEffect(
    useCallback(() => {
      bootstrap();
    }, [bootstrap])
  );

  const wellbeing = getWellbeingScore(stats);
  const socialRank = getSocialRankLabel(stats.socialRankScore);
  const recommendedAction = getRecommendedAction(stats);

  return (
    <AppShell>
      <Card accent>
        <Pill tone={getUrgency(stats) === "Routine stable" ? "accent" : "warning"}>{getUrgency(stats)}</Pill>
        <Title>{avatar ? `Bonjour ${avatar.displayName}` : "Bonjour"}</Title>
        <Muted>{getUrgencyCopy(stats)}</Muted>
        <AvatarBadge
          title={avatar?.displayName ?? "Avatar"}
          subtitle={`${avatar?.photoStyle ?? "Minimal clean"} · ${getLocationName(currentLocationSlug)}`}
        />
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <MetricCard label="Budget" value={`${stats.money}`} hint="credits disponibles" />
        <MetricCard label="Bien-etre" value={`${wellbeing}%`} hint="etat global du jour" />
        <MetricCard label="Rang social" value={socialRank} hint={getSocialRankCopy(socialRank)} />
      </View>

      <Card>
        <SectionTitle>Etat du corps et du mental</SectionTitle>
        <StatMeter label="Faim" value={stats.hunger} tone={stats.hunger < 35 ? "danger" : "accent"} />
        <StatMeter label="Hydratation" value={stats.hydration} tone={stats.hydration < 35 ? "warning" : "accent"} />
        <StatMeter label="Energie" value={stats.energy} tone={stats.energy < 35 ? "danger" : "accent"} />
        <StatMeter label="Hygiene" value={stats.hygiene} tone={stats.hygiene < 35 ? "warning" : "accent"} />
        <StatMeter label="Humeur" value={stats.mood} tone={stats.mood < 35 ? "warning" : "violet"} />
        <StatMeter label="Sociabilite" value={stats.sociability} tone={stats.sociability < 35 ? "warning" : "accent"} />
        <StatMeter label="Sante" value={stats.health} />
        <StatMeter label="Forme" value={stats.fitness} tone="violet" />
        <StatMeter label="Stress" value={100 - stats.stress} tone={stats.stress > 65 ? "danger" : "accent"} />
      </Card>

      <Card>
        <SectionTitle>Actions du moment</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <QuickAction title="Repas sain" copy="+ faim + sante + discipline" onPress={() => performAction("healthy-meal")} />
          <QuickAction title="Dormir" copy="+ energie + motivation" onPress={() => performAction("sleep")} />
          <QuickAction title="Douche" copy="+ hygiene + image sociale" onPress={() => performAction("shower")} />
          <QuickAction title="Shift travail" copy="+ argent + progression" onPress={() => performAction("work-shift")} />
          <QuickAction title="Marche" copy="- stress + forme" onPress={() => performAction("walk")} />
          <QuickAction title="Cafe" copy="+ lien + humeur" onPress={() => performAction("cafe-chat")} />
        </View>
        <Muted>Action recommandee maintenant : {recommendedAction}</Muted>
      </Card>

      <Card>
        <SectionTitle>Cadence quotidienne</SectionTitle>
        {dailyGoals.map((goal) => (
          <Text key={goal.id} style={{ color: goal.completed ? "#b9ffd9" : colors.muted }}>
            {goal.completed ? "✓" : "○"} {goal.label}
          </Text>
        ))}
        <Button label="Recuperer la reward quotidienne" onPress={claimDailyReward} />
      </Card>

      <Card>
        <SectionTitle>Conseils applicables a la vraie vie</SectionTitle>
        {advice.map((item) => (
          <View key={item.id} style={{ gap: 4, paddingVertical: 4 }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>{item.title}</Text>
            <Muted>{item.body}</Muted>
          </View>
        ))}
        <Button label="Voir les conseils complets" variant="secondary" onPress={() => router.push("/(app)/tips")} />
      </Card>

      <Card>
        <SectionTitle>Navigation utile</SectionTitle>
        <Button label="Corps, habitudes et forme" variant="secondary" onPress={() => router.push("/(app)/health")} />
        <Button label="Travail et revenus" variant="secondary" onPress={() => router.push("/(app)/work")} />
        <Button label="Sorties et vie sociale" variant="secondary" onPress={() => router.push("/(app)/outings")} />
      </Card>

      <Card>
        <SectionTitle>Fil de vie recente</SectionTitle>
        {lifeFeed.slice(0, 4).map((item) => (
          <View key={item.id} style={{ gap: 4, paddingVertical: 4 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
            <Muted>{item.body}</Muted>
          </View>
        ))}
      </Card>
    </AppShell>
  );
}
