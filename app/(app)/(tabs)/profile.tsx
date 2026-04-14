import { router } from "expo-router";
import { Text, View } from "react-native";

import { AppShell, AvatarBadge, Button, Card, MetricCard, Muted, Pill, SectionTitle, Title } from "@/components/ui";
import { getMomentumState, getSocialRankLabel, getSocialRankProgressData, RANK_ORDER } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

const RANK_LABELS: Record<string, string> = {
  precaire:    "Précaire",
  modeste:     "Modeste",
  stable:      "Stable",
  confortable: "Confortable",
  influent:    "Influent",
  elite:       "Élite"
};

export default function ProfileScreen() {
  const session = useGameStore((state) => state.session);
  const avatar = useGameStore((state) => state.avatar);
  const stats = useGameStore((state) => state.stats);
  const relationships = useGameStore((state) => state.relationships);
  const datePlans = useGameStore((state) => state.datePlans);
  const signOut = useGameStore((state) => state.signOut);
  const resetAll = useGameStore((state) => state.resetAll);
  const momentum = getMomentumState(stats);

  return (
    <AppShell>
      <Card accent>
        <Pill>{session?.provider === "supabase" ? "Supabase" : "Mode local"}</Pill>
        <Title>{avatar?.displayName ?? "Avatar"}</Title>
        <Muted>{session?.email ?? "Aucun compte actif"}</Muted>
        <AvatarBadge
          title={avatar?.displayName ?? "Avatar"}
          subtitle={`${avatar?.photoStyle ?? "Minimal clean"} · ${avatar?.outfitStyle ?? "urbain"} · ${avatar?.ageRange ?? "-"}`}
          tone="violet"
        />
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <MetricCard label="Rang" value={getSocialRankLabel(stats.socialRankScore)} hint="niveau de vie et image sociale" />
        <MetricCard label="Reputation" value={`${stats.reputation}`} hint="credibilite sociale" />
        <MetricCard label="Poids" value={`${stats.weight} kg`} hint="evolue selon nutrition et sport" />
        <MetricCard
          label="Attractivite"
          value={`${stats.attractiveness}`}
          hint="fitness + hygiene + stabilite + discipline"
        />
        <MetricCard
          label="Etat mental"
          value={stats.mentalStability === "stable" ? "Stable" : stats.mentalStability === "fragile" ? "Fragile" : "Sature"}
          hint="derive du stress, humeur et regularite"
        />
        <MetricCard
          label="Momentum"
          value={momentum.label}
          hint={`serie ${stats.streak} j · x${momentum.multiplier.toFixed(2)}`}
        />
      </View>

      <Card>
        <SectionTitle>Statut social</SectionTitle>
        {(() => {
          const rp = getSocialRankProgressData(stats);
          const currentIdx = RANK_ORDER.indexOf(rp.rank);
          return (
            <>
              <View style={{ gap: 6, marginBottom: 12 }}>
                {RANK_ORDER.map((r, i) => {
                  const isCurrent = r === rp.rank;
                  const isPassed = i < currentIdx;
                  return (
                    <View key={r} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={{ fontSize: 13, color: isPassed ? "#38c793" : isCurrent ? colors.accent : colors.muted, fontWeight: isCurrent ? "800" : "400" }}>
                        {isPassed ? "✓" : isCurrent ? "▶" : "○"} {RANK_LABELS[r]}
                      </Text>
                      {isCurrent ? (
                        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>— actuel</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Score : {rp.score}</Text>
                  {rp.nextRank ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>+{rp.scoreToNext} pour {RANK_LABELS[rp.nextRank]}</Text>
                  ) : (
                    <Text style={{ color: "#38c793", fontSize: 12, fontWeight: "700" }}>Rang maximum</Text>
                  )}
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.accent, width: `${rp.progress}%` }} />
                </View>
              </View>
              <SectionTitle>Pour monter</SectionTitle>
              {rp.tips.map((tip, i) => (
                <Muted key={i}>· {tip}</Muted>
              ))}
            </>
          );
        })()}
      </Card>

      <Card>
        <SectionTitle>Identite et style</SectionTitle>
        <Muted>{avatar?.bio ?? "Aucune bio."}</Muted>
        <Muted>Genre : {avatar?.gender ?? "-"}</Muted>
        <Muted>Origine / style : {avatar?.originStyle ?? "-"}</Muted>
        <Muted>Trait principal : {avatar?.personalityTrait ?? "-"}</Muted>
        <Muted>Ambition : {avatar?.ambition ?? "-"}</Muted>
        <Muted>Rythme de vie : {avatar?.lifeRhythm ?? "-"}</Muted>
        <Muted>Objectif : {avatar?.personalGoal ?? "-"}</Muted>
        <Button label="Editer le profil" variant="secondary" onPress={() => router.push("/(app)/avatar-edit")} />
      </Card>

      <Card>
        <SectionTitle>Preferences sociales</SectionTitle>
        <Muted>Recherche : {avatar?.lookingFor.join(", ") ?? "-"}</Muted>
        <Muted>Interets : {avatar?.interests.join(", ") ?? "-"}</Muted>
        <Muted>Traits apprecies : {avatar?.appreciatedTraits.join(", ") ?? "-"}</Muted>
        <Muted>Relations actives : {relationships.filter((item) => item.score > 30).length}</Muted>
        <Muted>Dates planifies : {datePlans.filter((item) => item.status === "accepted" || item.status === "proposed").length}</Muted>
      </Card>

      <Card>
        <SectionTitle>Monetisation MVP</SectionTitle>
        <Text style={{ color: "#f4f7fb", lineHeight: 22 }}>
          Le socle est deja compatible avec des skins, abonnements premium, boosts tres legers et objets sociaux sans
          casser la logique principale de progression.
        </Text>
      </Card>

      <Button label="Se deconnecter" variant="secondary" onPress={signOut} />
      <Button label="Reinitialiser la demo" variant="ghost" onPress={resetAll} />
    </AppShell>
  );
}
