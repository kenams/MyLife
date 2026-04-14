import { router } from "expo-router";
import { Text, View } from "react-native";

import { AppShell, Button, Card, MetricCard, Muted, Pill, Title } from "@/components/ui";

export default function WelcomeScreen() {
  return (
    <AppShell>
      <Card accent>
        <Pill>MyLife 2026</Pill>
        <Title>Vis ta vie virtuelle avec de vraies personnes.</Title>
        <Muted>
          MyLife melange simulation quotidienne, progression sociale et reseau humain. Tu n'eleves pas juste un
          avatar : tu construis une version gamifiee de ta vie.
        </Muted>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <MetricCard label="Core loop" value="4" hint="manger, recuperer, travailler, socialiser" />
        <MetricCard label="Social" value="live" hint="chat, invites, relations et presence" />
      </View>

      <Card>
        <Text style={{ color: "#f4f7fb", fontSize: 18, fontWeight: "800" }}>Ce que tu ressens dans le MVP</Text>
        <Muted>1. Ton etat corporel compte vraiment.</Muted>
        <Muted>2. Ton argent influence tes choix et ton image.</Muted>
        <Muted>3. Tes relations bougent si tu disparais.</Muted>
        <Muted>4. L'app te donne aussi des conseils applicables a la vraie vie.</Muted>
      </Card>

      <Button label="Commencer" onPress={() => router.push("/(auth)/sign-in")} />
    </AppShell>
  );
}
