import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { AppShell, Button, Card, ListRow, Muted, Pill, SectionTitle, Title } from "@/components/ui";
import { getDateReadiness, getDateVenueOptions, starterResidents } from "@/lib/game-engine";
import { getDateVenueLabel, getRelationshipLabel } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";
import type { AvatarProfile, DateVenueKind } from "@/lib/types";

function getRomanticResidentIds(avatar: AvatarProfile | null): string[] {
  // Tous les résidents qui déclarent chercher une relation amoureuse
  const openToRomance = starterResidents
    .filter((r) => r.lookingFor.includes("relation amoureuse"))
    .map((r) => r.id);

  if (!avatar) return openToRomance;

  // Si l'avatar ne cherche pas de relation, restreindre à la liste de base
  if (!avatar.lookingFor.includes("relation amoureuse")) return ["noa"];

  return openToRomance;
}

export default function DatesScreen() {
  const avatar = useGameStore((state) => state.avatar);
  const stats = useGameStore((state) => state.stats);
  const relationships = useGameStore((state) => state.relationships);
  const datePlans = useGameStore((state) => state.datePlans);
  const proposeDate = useGameStore((state) => state.proposeDate);
  const respondDatePlan = useGameStore((state) => state.respondDatePlan);
  const completeDatePlan = useGameStore((state) => state.completeDatePlan);

  const ROMANTIC_RESIDENT_IDS = useMemo(() => getRomanticResidentIds(avatar), [avatar]);
  const [selectedResidentId, setSelectedResidentId] = useState<string>(ROMANTIC_RESIDENT_IDS[0]);
  const [selectedVenue, setSelectedVenue] = useState<DateVenueKind>("coffee");

  const residents = starterResidents.filter((resident) => ROMANTIC_RESIDENT_IDS.includes(resident.id));
  const selectedResident = residents.find((resident) => resident.id === selectedResidentId) ?? residents[0];
  const relationship = relationships.find((item) => item.residentId === selectedResident?.id);
  const readiness = selectedResident
    ? getDateReadiness(stats, relationship, selectedResident.id)
    : { allowed: false, note: "Aucun profil disponible.", venueOptions: ["coffee"] as DateVenueKind[] };
  const allowedVenues = useMemo(() => getDateVenueOptions(stats), [stats]);

  return (
    <AppShell>
      <Card accent>
        <Pill>Dates</Pill>
        <Title>Rendez-vous sobres et publics.</Title>
        <Muted>
          Ici, un date est une extension logique de ta vie simulée. Le bon timing depend de ton etat, du lien existant
          et d'un contexte public propre.
        </Muted>
      </Card>

      <Card>
        <SectionTitle>Etat actuel</SectionTitle>
        <Muted>Hygiene : {stats.hygiene}% · Humeur : {stats.mood}% · Energie : {stats.energy}% · Budget : {stats.money}</Muted>
        <Muted>{readiness.note}</Muted>
      </Card>

      <Card>
        <SectionTitle>Profil romantic-ready</SectionTitle>
        {residents.map((resident) => {
          const residentRelationship = relationships.find((item) => item.residentId === resident.id);
          const isSelected = resident.id === selectedResidentId;
          return (
            <View key={resident.id} style={{ gap: 6, paddingVertical: 6 }}>
              <ListRow
                title={resident.name}
                subtitle={`${resident.bio} · ${getRelationshipLabel(residentRelationship)}`}
                right={<Pill tone={isSelected ? "accent" : "muted"}>{resident.socialRank}</Pill>}
              />
              <Button
                label={isSelected ? "Profil choisi" : `Choisir ${resident.name}`}
                variant={isSelected ? "secondary" : "ghost"}
                onPress={() => setSelectedResidentId(resident.id)}
              />
            </View>
          );
        })}
      </Card>

      <Card>
        <SectionTitle>Lieu suggere</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {allowedVenues.map((venue) => {
            const active = venue === selectedVenue;
            const blocked = !readiness.venueOptions.includes(venue);
            return (
              <Text
                key={venue}
                onPress={() => {
                  if (!blocked) {
                    setSelectedVenue(venue);
                  }
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? "rgba(88,214,163,0.55)" : colors.border,
                  backgroundColor: active ? "rgba(88,214,163,0.14)" : colors.cardAlt,
                  color: blocked ? colors.muted : colors.text,
                  opacity: blocked ? 0.4 : 1
                }}
              >
                {getDateVenueLabel(venue)}
              </Text>
            );
          })}
        </View>
        <Muted>
          Format recommande : lieu public, duree courte, intention claire. C'est aussi la bonne logique si tu passes
          ensuite dans la vraie vie.
        </Muted>
        {selectedResident ? (
          <Button
            label={`Proposer un date a ${selectedResident.name}`}
            onPress={() => proposeDate(selectedResident.id, selectedResident.name, selectedVenue)}
            variant={readiness.allowed ? "primary" : "secondary"}
          />
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Plans en cours</SectionTitle>
        {datePlans.length === 0 ? <Muted>Aucun date planifie pour le moment.</Muted> : null}
        {datePlans.map((plan) => (
          <View key={plan.id} style={{ gap: 8, paddingVertical: 6 }}>
            <ListRow
              title={`${plan.residentName} · ${plan.venueLabel}`}
              subtitle={`${plan.scheduledMoment} · ${plan.bridgeToRealLife}`}
              right={<Pill tone={plan.status === "completed" ? "accent" : plan.status === "accepted" ? "warning" : "muted"}>{plan.status}</Pill>}
            />
            {plan.status === "proposed" ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Confirmer" onPress={() => respondDatePlan(plan.id, "accepted")} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Refuser" variant="secondary" onPress={() => respondDatePlan(plan.id, "declined")} />
                </View>
              </View>
            ) : null}
            {plan.status === "accepted" ? (
              <Button label="Jouer le date" variant="secondary" onPress={() => completeDatePlan(plan.id)} />
            ) : null}
          </View>
        ))}
      </Card>
    </AppShell>
  );
}
