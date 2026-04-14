import { Text, View } from "react-native";

import { AppShell, Card, Muted, Pill, SectionTitle, Title } from "@/components/ui";
import { buildGuidanceEngine, getLifePatternLabel } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";
import type { GuidanceItem } from "@/lib/types";

function UrgencyBadge({ urgency }: { urgency: GuidanceItem["urgency"] }) {
  const color =
    urgency === "high"   ? "#f87171" :
    urgency === "medium" ? "#fbbf24" : colors.muted;
  const label =
    urgency === "high" ? "urgent" : urgency === "medium" ? "important" : "utile";
  return (
    <Text style={{ color, fontWeight: "700", fontSize: 11, textTransform: "uppercase" }}>
      {label}
    </Text>
  );
}

function CategoryPill({ category }: { category: GuidanceItem["category"] }) {
  const labels: Record<GuidanceItem["category"], string> = {
    energy: "energie",
    social: "social",
    budget: "budget",
    discipline: "discipline",
    wellbeing: "bien-etre"
  };
  return <Pill tone="muted">{labels[category]}</Pill>;
}

export default function TipsScreen() {
  const stats = useGameStore((state) => state.stats);
  const { pattern, items } = buildGuidanceEngine(stats);

  const patternColor =
    pattern === "burnout" || pattern === "neglect" || pattern === "recovery_needed"
      ? "#f87171"
      : pattern === "momentum"
      ? "#38c793"
      : pattern === "social_drought" || pattern === "grind_mode"
      ? "#fbbf24"
      : colors.accent;

  return (
    <AppShell>
      <Card accent>
        <Pill>Guidance Engine</Pill>
        <Title>Conseils issus de ton etat reel.</Title>
        <Muted>
          Le moteur analyse tes stats pour identifier ton pattern de vie actuel et te donner des actions concretes applicables maintenant.
        </Muted>
      </Card>

      <Card>
        <SectionTitle>Pattern detecte</SectionTitle>
        <Text style={{ color: patternColor, fontWeight: "800", fontSize: 16, marginBottom: 6 }}>
          {getLifePatternLabel(pattern)}
        </Text>
        <Muted>
          Ce pattern est calcule a partir de ton niveau de stress, d'energie, de discipline, de sociabilite et de regularite.
        </Muted>
      </Card>

      {items.map((item) => (
        <Card key={item.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <CategoryPill category={item.category} />
            <UrgencyBadge urgency={item.urgency} />
          </View>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15, marginBottom: 6 }}>
            {item.title}
          </Text>
          <Muted>{item.body}</Muted>
          <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: "rgba(215,184,122,0.08)", borderLeftWidth: 3, borderLeftColor: colors.accent }}>
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>
              Action : {item.action}
            </Text>
          </View>
        </Card>
      ))}
    </AppShell>
  );
}
