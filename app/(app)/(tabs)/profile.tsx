import { router } from "expo-router";
import { Text, View } from "react-native";

import { AppShell, AvatarBadge, Button, Card, MetricCard, Muted, Pill, SectionTitle, Title } from "@/components/ui";
import { getSocialRankLabel } from "@/lib/selectors";
import { useGameStore } from "@/stores/game-store";

export default function ProfileScreen() {
  const session = useGameStore((state) => state.session);
  const avatar = useGameStore((state) => state.avatar);
  const stats = useGameStore((state) => state.stats);
  const relationships = useGameStore((state) => state.relationships);
  const signOut = useGameStore((state) => state.signOut);
  const resetAll = useGameStore((state) => state.resetAll);

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
      </View>

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
