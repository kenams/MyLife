import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";

import { AppShell, AvatarBadge, Button, Card, MetricCard, Muted, Pill, SectionTitle, StatMeter, Title } from "@/components/ui";
import { getLocationName, getRecommendedAction, getSocialRankCopy, getSocialRankLabel, getUrgency, getUrgencyCopy, getWellbeingScore } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";
import type { DailyEvent } from "@/lib/types";

const EVENT_KIND_COLOR: Record<DailyEvent["kind"], string> = {
  opportunity: "#38c793",
  encounter:   "#8b7cff",
  setback:     "#f87171",
  windfall:    "#fbbf24",
  social:      "#60a5fa"
};

const EVENT_KIND_LABEL: Record<DailyEvent["kind"], string> = {
  opportunity: "Opportunite",
  encounter:   "Rencontre",
  setback:     "Imprévu",
  windfall:    "Aubaine",
  social:      "Social"
};

function EffectLine({ effects }: { effects: DailyEvent["effects"] }) {
  const entries = Object.entries(effects).filter(([, v]) => v !== 0 && v !== undefined);
  if (entries.length === 0) return <Muted>Aucun effet</Muted>;
  return (
    <Text style={{ color: colors.muted, fontSize: 12 }}>
      {entries.map(([k, v]) => `${k} ${(v as number) > 0 ? "+" : ""}${v}`).join("  ·  ")}
    </Text>
  );
}

function DailyEventCard({ event, onResolve }: { event: DailyEvent; onResolve: (c: "accepted" | "skipped") => void }) {
  const kindColor = EVENT_KIND_COLOR[event.kind];
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: kindColor }} />
        <Text style={{ color: kindColor, fontWeight: "800", fontSize: 12, textTransform: "uppercase" }}>
          {EVENT_KIND_LABEL[event.kind]} du jour
        </Text>
      </View>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16, marginBottom: 6 }}>{event.title}</Text>
      <Muted>{event.body}</Muted>
      <View style={{ gap: 10, marginTop: 12 }}>
        <View style={{ padding: 10, borderRadius: 12, backgroundColor: "rgba(56,199,147,0.08)", borderLeftWidth: 2, borderLeftColor: "#38c793" }}>
          <Text style={{ color: "#38c793", fontWeight: "700", fontSize: 13, marginBottom: 4 }}>{event.actionLabel}</Text>
          <EffectLine effects={event.effects} />
        </View>
        {Object.keys(event.skipEffects).length > 0 ? (
          <View style={{ padding: 10, borderRadius: 12, backgroundColor: "rgba(248,113,113,0.06)", borderLeftWidth: 2, borderLeftColor: colors.muted }}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13, marginBottom: 4 }}>{event.skipLabel}</Text>
            <EffectLine effects={event.skipEffects} />
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Button label={event.actionLabel} onPress={() => onResolve("accepted")} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={event.skipLabel === "N/A" ? "Ok" : event.skipLabel} variant="secondary" onPress={() => onResolve("skipped")} />
        </View>
      </View>
    </Card>
  );
}

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
  const dailyEvent = useGameStore((state) => state.dailyEvent);
  const resolveDailyEvent = useGameStore((state) => state.resolveDailyEvent);

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

      {dailyEvent && !dailyEvent.resolved ? (
        <DailyEventCard event={dailyEvent} onResolve={resolveDailyEvent} />
      ) : null}

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
