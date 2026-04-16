import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { AppShell, Button, Card, Muted, NavBack, Pill, SectionTitle, Title } from "@/components/ui";
import { activities } from "@/lib/game-engine";
import { resolveOutingResult } from "@/lib/game-engine";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";
import type { OutingContext, OutingIntensity } from "@/lib/types";

const OUTINGABLE_SLUGS = [
  "coffee-meetup",
  "restaurant-date",
  "cinema-night",
  "group-outing",
  "party-night",
  "evening-walk",
  "solo-cafe"
];

const INTENSITIES: { value: OutingIntensity; label: string; hint: string }[] = [
  { value: "chill",    label: "Chill",    hint: "Moins de depense, moins de fatigue, qualite preservee" },
  { value: "normale",  label: "Normale",  hint: "Sortie equilibree, effets standards" },
  { value: "festive",  label: "Festive",  hint: "Humeur et sociabilite max, mais fatigue et budget elevees" }
];

const CONTEXTS: { value: OutingContext; label: string; hint: string }[] = [
  { value: "solo",       label: "Solo",       hint: "Calme interieur, discipline +, sociabilite -" },
  { value: "amis",       label: "Amis",       hint: "Liens consolides, humeur +, stress -" },
  { value: "romantique", label: "Romantique", hint: "Humeur max, stress -, qualite sociale +" },
  { value: "groupe",     label: "Groupe",     hint: "Sociabilite forte, stress +, discipline -" }
];

function ChoiceRow<T extends string>({
  options,
  selected,
  onSelect
}: {
  options: { value: T; label: string; hint: string }[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onSelect(opt.value)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: selected === opt.value ? colors.accent : colors.border,
            backgroundColor: selected === opt.value ? "rgba(215,184,122,0.12)" : "rgba(255,255,255,0.04)"
          }}
        >
          <Text style={{ color: selected === opt.value ? colors.accent : colors.muted, fontWeight: "700", fontSize: 13 }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function OutingsScreen() {
  const stats = useGameStore((state) => state.stats);
  const performOuting = useGameStore((state) => state.performOuting);

  const [selectedSlug, setSelectedSlug] = useState<string>("coffee-meetup");
  const [intensity, setIntensity] = useState<OutingIntensity>("normale");
  const [context, setContext] = useState<OutingContext>("amis");

  const outingActivities = activities.filter((a) => OUTINGABLE_SLUGS.includes(a.slug));
  const preview = resolveOutingResult({ activitySlug: selectedSlug, intensity, context }, stats);

  const qualityColor =
    preview.socialQualityHint === "haute" ? "#38c793" :
    preview.socialQualityHint === "basse" ? "#f87171" : "#fbbf24";

  return (
    <AppShell>
      <NavBack fallback="/(app)/(tabs)/home" />
      <Card accent>
        <Pill>Sorties</Pill>
        <Title>Choisir sa sortie intelligemment.</Title>
        <Muted>
          Ni trop, ni trop peu. L'intensite et le contexte changent tout. Une soiree festive en groupe avec un mode de vie instable attire de mauvais liens.
        </Muted>
      </Card>

      <Card>
        <SectionTitle>Type de sortie</SectionTitle>
        <View style={{ gap: 8 }}>
          {outingActivities.map((a) => (
            <TouchableOpacity
              key={a.slug}
              onPress={() => setSelectedSlug(a.slug)}
              style={{
                padding: 12,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: selectedSlug === a.slug ? colors.accent : colors.border,
                backgroundColor: selectedSlug === a.slug ? "rgba(215,184,122,0.08)" : "transparent"
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{a.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{a.summary}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>Intensite</SectionTitle>
        <ChoiceRow options={INTENSITIES} selected={intensity} onSelect={setIntensity} />
        <Muted>{INTENSITIES.find((i) => i.value === intensity)?.hint}</Muted>
      </Card>

      <Card>
        <SectionTitle>Contexte</SectionTitle>
        <ChoiceRow options={CONTEXTS} selected={context} onSelect={setContext} />
        <Muted>{CONTEXTS.find((c) => c.value === context)?.hint}</Muted>
      </Card>

      <Card>
        <SectionTitle>Apercu de la sortie</SectionTitle>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 8 }}>{preview.label}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          <Pill tone={preview.moodGain >= 10 ? "accent" : "muted"}>Humeur +{preview.moodGain}</Pill>
          <Pill tone={preview.sociabilityGain >= 12 ? "accent" : "muted"}>Social +{preview.sociabilityGain}</Pill>
          <Pill tone={preview.energyCost > 14 ? "warning" : "muted"}>Energie -{preview.energyCost}</Pill>
          <Pill tone={preview.budgetCost > 20 ? "warning" : "muted"}>Budget -{preview.budgetCost}</Pill>
          <Pill tone={preview.stressDelta > 5 ? "warning" : "muted"}>
            Stress {preview.stressDelta >= 0 ? "+" : ""}{preview.stressDelta}
          </Pill>
          <Pill tone={preview.disciplineDelta < -2 ? "warning" : "muted"}>
            Discipline {preview.disciplineDelta >= 0 ? "+" : ""}{preview.disciplineDelta}
          </Pill>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Qualite des rencontres probables :</Text>
          <Text style={{ color: qualityColor, fontWeight: "800", fontSize: 13 }}>{preview.socialQualityHint.toUpperCase()}</Text>
        </View>
        <Button
          label={`Partir : ${preview.label.split("—")[0].trim()}`}
          onPress={() => performOuting({ activitySlug: selectedSlug, intensity, context })}
        />
      </Card>
    </AppShell>
  );
}
