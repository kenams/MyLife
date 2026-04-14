import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { AppShell, Button, Card, Input, Muted, Pill, Title } from "@/components/ui";
import { useGameStore } from "@/stores/game-store";

export default function SignInScreen() {
  const signIn = useGameStore((state) => state.signIn);
  const avatar = useGameStore((state) => state.avatar);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleContinue(nextEmail?: string, nextPassword?: string) {
    const resolvedPassword = (nextPassword ?? password) || undefined;
    const result = await signIn(nextEmail ?? email, resolvedPassword);
    if (!result.ok) {
      setError(result.error ?? "Connexion impossible.");
      return;
    }

    router.replace(avatar ? "/(app)/(tabs)/home" : "/(auth)/avatar");
  }

  return (
    <AppShell>
      <Card accent>
        <Pill>Acces</Pill>
        <Title>Entre dans ton espace de vie.</Title>
        <Muted>
          Si Supabase n'est pas configure, MyLife tourne quand meme en mode local pour que la boucle produit reste
          testable sans friction.
        </Muted>
      </Card>

      <Card>
        <Input value={email} onChangeText={setEmail} placeholder="Adresse e-mail" keyboardType="email-address" />
        <Input value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry />
        {error ? <Text style={{ color: "#ff8d8d" }}>{error}</Text> : null}
        <Button label="Continuer" onPress={() => void handleContinue()} />
        <Button label="Mode demo instantane" variant="secondary" onPress={() => void handleContinue("demo@mylife.app", "")} />
      </Card>
    </AppShell>
  );
}
