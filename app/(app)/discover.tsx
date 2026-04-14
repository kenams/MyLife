import { Text, View } from "react-native";

import { AppShell, Button, Card, ListRow, Muted, Pill, Title } from "@/components/ui";
import { starterResidents } from "@/lib/game-engine";
import { getCompatibilityBadge, getRelationshipLabel } from "@/lib/selectors";
import { useGameStore } from "@/stores/game-store";

export default function DiscoverScreen() {
  const avatar = useGameStore((state) => state.avatar);
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
                <Button label="Inviter" onPress={() => sendInvitation(resident.id, "coffee-meetup")} />
              </View>
            </View>
          </Card>
        );
      })}
    </AppShell>
  );
}
