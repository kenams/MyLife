import { Text, View } from "react-native";

import { AppShell, Button, Card, ListRow, Muted, Pill, SectionTitle, Title } from "@/components/ui";
import { starterResidents } from "@/lib/game-engine";
import { getCompatibilityBadge, getRelationshipLabel, getResidentAccessibility } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";
import type { RelationshipRecord } from "@/lib/types";

const QUALITY_COLOR: Record<NonNullable<RelationshipRecord["quality"]>, string> = {
  inspirante: "#38c793",
  stable:     "#60a5fa",
  neutre:     colors.muted,
  fatigante:  "#fbbf24",
  toxique:    "#f87171"
};

const STATUS_STEPS = ["contact", "ami", "cercle-proche", "crush", "relation"] as const;
const STATUS_LABELS: Record<string, string> = {
  contact:        "Contact",
  ami:            "Ami",
  "cercle-proche": "Cercle proche",
  crush:          "Crush",
  relation:       "Relation"
};

function RelationProgress({ status }: { status: RelationshipRecord["status"] }) {
  const currentIdx = STATUS_STEPS.indexOf(status as typeof STATUS_STEPS[number]);
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginVertical: 6 }}>
      {STATUS_STEPS.map((step, i) => {
        const active = i === currentIdx;
        const passed = i < currentIdx;
        return (
          <View key={step} style={{ alignItems: "center", gap: 2 }}>
            <View style={{
              width: active ? 10 : 7,
              height: active ? 10 : 7,
              borderRadius: 5,
              backgroundColor: passed ? "#38c793" : active ? colors.accent : "rgba(255,255,255,0.12)"
            }} />
            <Text style={{ color: active ? colors.accent : passed ? "#38c793" : colors.muted, fontSize: 9, fontWeight: active ? "800" : "400" }}>
              {STATUS_LABELS[step]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 65 ? "#38c793" : score >= 40 ? colors.accent : score >= 20 ? "#fbbf24" : "#f87171";
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Score de lien</Text>
        <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{score}/100</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)" }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${score}%` }} />
      </View>
    </View>
  );
}

export default function RelationsScreen() {
  const avatar = useGameStore((state) => state.avatar);
  const stats = useGameStore((state) => state.stats);
  const relationships = useGameStore((state) => state.relationships);
  const startDirectConversation = useGameStore((state) => state.startDirectConversation);
  const sendInvitation = useGameStore((state) => state.sendInvitation);

  const sorted = [...relationships].sort((a, b) => b.score - a.score);

  const strongLinks = sorted.filter((r) => r.score >= 45);
  const activeLinks = sorted.filter((r) => r.score >= 20 && r.score < 45);
  const weakLinks = sorted.filter((r) => r.score < 20);

  return (
    <AppShell>
      <Card accent>
        <Pill>Relations</Pill>
        <Title>Ton cercle social vivant.</Title>
        <Muted>
          Chaque lien evolue selon tes interactions, ton mode de vie et ta regularite. Un lien de qualite se construit lentement, mais resiste mieux.
        </Muted>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 14, padding: 14, gap: 2 }}>
          <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 22 }}>{strongLinks.length}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Liens forts</Text>
        </View>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: "rgba(215,184,122,0.1)", borderRadius: 14, padding: 14, gap: 2 }}>
          <Text style={{ color: colors.accent, fontWeight: "800", fontSize: 22 }}>{activeLinks.length}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>En progression</Text>
        </View>
        <View style={{ flex: 1, minWidth: 100, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 14, gap: 2 }}>
          <Text style={{ color: colors.muted, fontWeight: "800", fontSize: 22 }}>{weakLinks.length}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>A activer</Text>
        </View>
      </View>

      {sorted.map((rel) => {
        const resident = starterResidents.find((r) => r.id === rel.residentId);
        if (!resident) return null;
        const access = getResidentAccessibility(resident.id, stats);
        const qualityColor = QUALITY_COLOR[rel.quality] ?? colors.muted;

        return (
          <Card key={rel.residentId}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{resident.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{resident.role} · {resident.status}</Text>
              </View>
              <Pill tone={rel.influence === "positive" ? "accent" : rel.influence === "negative" ? "warning" : "muted"}>
                {rel.influence}
              </Pill>
            </View>

            <RelationProgress status={rel.status} />
            <ScoreBar score={rel.score} />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
              <Text style={{ color: qualityColor, fontWeight: "700", fontSize: 12 }}>
                Lien {rel.quality}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>·</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {getCompatibilityBadge(avatar?.interests ?? [], resident.interests)}
              </Text>
            </View>

            <View style={{ marginTop: 6, padding: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.04)" }}>
              <Text style={{ color: access.level === "accessible" ? "#38c793" : access.level === "receptif" ? "#fbbf24" : colors.muted, fontSize: 12 }}>
                {access.level === "accessible" ? "● Accessible" : access.level === "receptif" ? "◑ Réceptif" : "○ Fermé"} — {access.hint}
              </Text>
            </View>

            {rel.isFollowing ? (
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700", marginTop: 4 }}>★ Tu suis ce profil</Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Button label="Message" variant="secondary" onPress={() => startDirectConversation(resident.id, resident.name)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Inviter"
                  variant={access.level === "ferme" ? "secondary" : "primary"}
                  onPress={() => sendInvitation(resident.id, "coffee-meetup")}
                />
              </View>
            </View>
          </Card>
        );
      })}
    </AppShell>
  );
}
