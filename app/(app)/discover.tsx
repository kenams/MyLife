import { router } from "expo-router";
import { Text, View } from "react-native";

import { AppShell, Button, Card, ListRow, Muted, Pill, Title } from "@/components/ui";
import { starterResidents } from "@/lib/game-engine";
import { getCompatibilityBadge, getRelationshipLabel, getResidentAccessibility } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

export default function DiscoverScreen() {
  const avatar = useGameStore((state) => state.avatar);
  const stats = useGameStore((state) => state.stats);
  const relationships = useGameStore((state) => state.relationships);
  const startDirectConversation = useGameStore((state) => state.startDirectConversation);
  const sendInvitation = useGameStore((state) => state.sendInvitation);

  return (
    <AppShell>
      <Card accent>
        <Pill>Decouverte</Pill>
        <Title>Profils compatibles et actifs.</Title>
        <Muted>Le matching MVP se base sur les centres d'interet, le style de vie et l'etat des relations deja ouvertes.</Muted>
      </Card>

      {starterResidents.map((resident) => {
        const relationship = relationships.find((item) => item.residentId === resident.id);
        const access = getResidentAccessibility(resident.id, stats);
        const accessColor =
          access.level === "accessible" ? "#38c793" :
          access.level === "receptif"   ? "#fbbf24" : colors.muted;

        return (
          <Card key={resident.id}>
            <ListRow
              title={`${resident.name} · ${resident.role}`}
              subtitle={`${resident.vibe} · ${resident.status}`}
              right={<Pill tone="muted">{resident.socialRank}</Pill>}
            />
            <Muted>{resident.bio}</Muted>
            <Text style={{ color: "#f4f7fb" }}>
              Compatibilite : {getCompatibilityBadge(avatar?.interests ?? [], resident.interests)} · Statut : {getRelationshipLabel(relationship)}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Text style={{ color: accessColor, fontWeight: "700", fontSize: 12 }}>
                {access.level === "accessible" ? "● Accessible" : access.level === "receptif" ? "◑ Receptif" : "○ Ferme"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>{access.hint}</Text>
            </View>
            {relationship && relationship.quality !== "neutre" ? (
              <Text style={{ color: relationship.quality === "inspirante" || relationship.quality === "stable" ? "#38c793" : relationship.quality === "toxique" ? "#f87171" : "#fbbf24", fontSize: 13 }}>
                Lien {relationship.quality} · influence {relationship.influence}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
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
            {resident.lookingFor.includes("relation amoureuse") ? (
              <Button label="Voir l'option date" variant="ghost" onPress={() => router.push("/(app)/dates")} />
            ) : null}
          </Card>
        );
      })}
    </AppShell>
  );
}
