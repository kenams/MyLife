import { router } from "expo-router";
import { Text, View } from "react-native";

import { AppShell, Button, Card, ListRow, Muted, Pill, SectionTitle, Title } from "@/components/ui";
import { cityName, neighborhoods } from "@/lib/game-data";
import { getCompatibilityBadge, getLocationName, getResidentsByLocation, getRelationshipLabel } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore, worldLocations } from "@/stores/game-store";

export default function WorldScreen() {
  const avatar = useGameStore((state) => state.avatar);
  const currentLocationSlug = useGameStore((state) => state.currentLocationSlug);
  const currentNeighborhoodSlug = useGameStore((state) => state.currentNeighborhoodSlug);
  const travelTo = useGameStore((state) => state.travelTo);
  const performAction = useGameStore((state) => state.performAction);
  const startDirectConversation = useGameStore((state) => state.startDirectConversation);
  const relationships = useGameStore((state) => state.relationships);

  return (
    <AppShell>
      <Card accent>
        <Pill>{cityName}</Pill>
        <Title>Monde social vivant</Title>
        <Muted>
          Le quartier influence le rythme, les rencontres et le cout de vie. Le MVP reste concentre sur quelques lieux
          tres utiles, plutot qu'un monde vaste mais vide.
        </Muted>
      </Card>

      <Card>
        <SectionTitle>Quartiers actifs</SectionTitle>
        {neighborhoods.map((neighborhood) => (
          <ListRow
            key={neighborhood.slug}
            title={`${neighborhood.name}${neighborhood.slug === currentNeighborhoodSlug ? " · actuel" : ""}`}
            subtitle={`${neighborhood.vibe} · ${neighborhood.lifestyle}`}
            right={<Pill tone={neighborhood.costLevel === "premium" ? "warning" : "muted"}>{neighborhood.costLevel}</Pill>}
          />
        ))}
      </Card>

      {worldLocations.map((location) => {
        const occupants = getResidentsByLocation(location.slug);
        const active = location.slug === currentLocationSlug;

        return (
          <Card key={location.slug}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>{location.name}</Text>
              {active ? <Pill>Actuel</Pill> : <Pill tone="muted">{location.costHint}</Pill>}
            </View>
            <Muted>{location.summary}</Muted>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Profils visibles</Text>
            {occupants.map((resident) => {
              const relationship = relationships.find((item) => item.residentId === resident.id);
              return (
                <View key={resident.id} style={{ gap: 6, paddingVertical: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    {resident.name} · {resident.role}
                  </Text>
                  <Muted>{resident.vibe}</Muted>
                  <Muted>
                    {getRelationshipLabel(relationship)} · {getCompatibilityBadge(avatar?.interests ?? [], resident.interests)}
                  </Muted>
                  <Button label={`Ecrire a ${resident.name}`} variant="secondary" onPress={() => startDirectConversation(resident.id, resident.name)} />
                </View>
              );
            })}
            <Button
              label={active ? "Tu es deja ici" : "S'y rendre"}
              onPress={() => {
                travelTo(location.slug);
                performAction("rest-home");
              }}
              variant={active ? "secondary" : "primary"}
            />
          </Card>
        );
      })}

      <Card>
        <SectionTitle>Exploration sociale</SectionTitle>
        <Muted>
          Si tu veux accelerer les rencontres, passe par l'espace social : profils compatibles, invitations et liens en
          cours y sont regroupes.
        </Muted>
        <Button label="Aller vers l'espace social" variant="secondary" onPress={() => router.push("/(app)/(tabs)/chat")} />
      </Card>
    </AppShell>
  );
}
