import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View, ActivityIndicator } from "react-native";

import { deleteAccount, exportUserData } from "@/lib/safety";
import { useGameStore } from "@/stores/game-store";
import { hapticImpact } from "@/lib/safe-haptics";

const L = {
  bg: "#080808", card: "#111111", cardAlt: "#181818",
  text: "#F5F2E8", textSoft: "#A8A49A", muted: "#4A4844",
  border: "rgba(255,255,255,0.07)",
  primary: "#FFD600", red: "#FF3B3B", green: "#39FF14",
};

function Row({ emoji, label, sublabel, onPress, destructive = false }: {
  emoji: string; label: string; sublabel?: string;
  onPress: () => void; destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 14,
        paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: L.border }}>
      <View style={{ width: 40, height: 40, borderRadius: 12,
        backgroundColor: destructive ? L.red + "15" : L.cardAlt,
        alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: destructive ? L.red : L.text, fontSize: 15, fontWeight: "700" }}>
          {label}
        </Text>
        {sublabel && (
          <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }}>{sublabel}</Text>
        )}
      </View>
      <Text style={{ color: L.muted, fontSize: 16 }}>›</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800",
        letterSpacing: 2, marginBottom: 4 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const session  = useGameStore((s) => s.session);
  const signOut  = useGameStore((s) => s.signOut);
  const resetAll = useGameStore((s) => s.resetAll);

  const [loadingDelete, setLoadingDelete] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [exportDone,    setExportDone]    = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleExport() {
    setLoadingExport(true);
    const data = await exportUserData(session?.id ?? "");
    setLoadingExport(false);
    setExportDone(true);
    Alert.alert(
      "Export RGPD",
      "Tes données ont été préparées. Envoie un email à kahdigital42@gmail.com avec ton ID pour recevoir l'export complet.",
      [{ text: "OK" }]
    );
  }

  async function handleDeleteAccount() {
    setShowDeleteConfirm(false);
    setLoadingDelete(true);
    hapticImpact("heavy");
    const res = await deleteAccount(session?.id ?? "");
    setLoadingDelete(false);
    if (res.ok) {
      resetAll();
      router.replace("/(auth)/welcome");
    } else {
      Alert.alert("Erreur", res.error ?? "Impossible de supprimer le compte.");
    }
  }

  async function handleSignOut() {
    await signOut?.();
    router.replace("/(auth)/sign-in");
  }

  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>
      {/* Header */}
      <View style={{ paddingTop: 54, paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: L.border,
        flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: L.card,
            alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: L.text, fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={{ color: L.text, fontSize: 18, fontWeight: "900" }}>Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

        {/* Compte */}
        <Section title="MON COMPTE">
          <Row emoji="📧" label="Email" sublabel={session?.email ?? "—"} onPress={() => {}} />
          <Row emoji="🔑" label="Changer mon mot de passe"
            sublabel="Un lien te sera envoyé par email" onPress={() => {}} />
          <Row emoji="🔔" label="Notifications" sublabel="Gérer les alertes" onPress={() => {}} />
        </Section>

        {/* Confidentialité */}
        <Section title="CONFIDENTIALITÉ & RGPD">
          <Row emoji="📍" label="Géolocalisation"
            sublabel="Activer / désactiver ta présence sur la map"
            onPress={() => router.push("/(app)/(tabs)/map" as never)} />
          <Row emoji="📤" label="Exporter mes données"
            sublabel="Droit à la portabilité (RGPD art. 20)"
            onPress={handleExport} />
          <Row emoji="📋" label="Lire les CGU"
            onPress={() => router.push("/(auth)/legal?doc=cgu" as never)} />
          <Row emoji="🔒" label="Politique de confidentialité"
            onPress={() => router.push("/(auth)/legal?doc=privacy" as never)} />
        </Section>

        {/* Sécurité */}
        <Section title="SÉCURITÉ">
          <Row emoji="🚫" label="Utilisateurs bloqués"
            sublabel="Gérer la liste des profils bloqués"
            onPress={() => {}} />
          <Row emoji="🚩" label="Mes signalements"
            sublabel="Voir les signalements que tu as envoyés"
            onPress={() => {}} />
        </Section>

        {/* Mentions légales */}
        <Section title="LÉGAL">
          <Row emoji="🏢" label="Mentions légales"
            sublabel="KAH Digital — kahdigital42@gmail.com"
            onPress={() => router.push("/(auth)/legal" as never)} />
          <Row emoji="⚖️" label="CGU — Version 1.0"
            sublabel="En vigueur depuis le 16 juin 2026"
            onPress={() => router.push("/(auth)/legal?doc=cgu" as never)} />
        </Section>

        {/* Danger zone */}
        <Section title="ZONE CRITIQUE">
          <Row emoji="🚪" label="Se déconnecter" onPress={handleSignOut} />
          <Row emoji="🗑️" label="Supprimer mon compte"
            sublabel="Action irréversible — toutes tes données seront effacées"
            onPress={() => setShowDeleteConfirm(true)}
            destructive />
        </Section>

        {loadingExport && (
          <View style={{ alignItems: "center", padding: 20 }}>
            <ActivityIndicator color={L.primary} />
            <Text style={{ color: L.muted, marginTop: 8, fontSize: 12 }}>
              Préparation de l'export...
            </Text>
          </View>
        )}

        <Text style={{ color: L.muted, fontSize: 11, textAlign: "center", lineHeight: 18 }}>
          MyLife — KAH Digital{"\n"}
          contact : kahdigital42@gmail.com{"\n"}
          Version 1.0.0
        </Text>
      </ScrollView>

      {/* Confirmation suppression */}
      <Modal transparent animationType="fade" visible={showDeleteConfirm}
        onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)",
          justifyContent: "center", padding: 28 }}>
          <View style={{ backgroundColor: L.card, borderRadius: 24, padding: 28, gap: 20,
            borderWidth: 1, borderColor: L.red + "25" }}>
            <Text style={{ fontSize: 36, textAlign: "center" }}>⚠️</Text>
            <Text style={{ color: L.text, fontSize: 20, fontWeight: "900", textAlign: "center" }}>
              Supprimer ton compte ?
            </Text>
            <Text style={{ color: L.textSoft, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
              Toutes tes données seront effacées de façon{"\n"}
              définitive et irréversible. Cette action est{"\n"}
              conforme à l'article 17 du RGPD.
            </Text>
            <View style={{ gap: 12 }}>
              <Pressable onPress={handleDeleteAccount} disabled={loadingDelete}
                style={{ backgroundColor: L.red, borderRadius: 14, paddingVertical: 16,
                  alignItems: "center" }}>
                {loadingDelete
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>
                      Oui, supprimer définitivement
                    </Text>
                }
              </Pressable>
              <Pressable onPress={() => setShowDeleteConfirm(false)}
                style={{ backgroundColor: L.cardAlt, borderRadius: 14, paddingVertical: 16,
                  alignItems: "center", borderWidth: 1, borderColor: L.border }}>
                <Text style={{ color: L.text, fontSize: 15, fontWeight: "700" }}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
