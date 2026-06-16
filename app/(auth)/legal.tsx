import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

const L = {
  bg: "#080808", card: "#111111",
  text: "#F5F2E8", textSoft: "#A8A49A", muted: "#4A4844",
  border: "rgba(255,255,255,0.07)", primary: "#FFD600",
};

const CGU = `
MyLife est réservée aux personnes de 18 ans ou plus.

En vous inscrivant, vous déclarez avoir 18 ans ou plus et accepter les présentes CGU. Toute fausse déclaration entraîne la suppression du compte.

DONNÉES PERSONNELLES & GÉOLOCALISATION
La géolocalisation est optionnelle et révocable à tout moment via le mode Ghost. Vos données de position sont conservées 72h maximum et ne sont jamais revendues.

VOS DROITS (RGPD)
• Accès, rectification, suppression : kahdigital42@gmail.com
• Réponse garantie sous 30 jours

RÈGLES DE CONDUITE
Sont interdits : harcèlement, usurpation d'identité, contenu illégal, comptes multiples.

MODÉRATION
Tout abus peut être signalé via le bouton "Signaler" sur chaque profil. Réponse sous 72h.

RESPONSABILITÉ
MyLife n'est pas responsable des interactions physiques entre utilisateurs.

CONTACT
kahdigital42@gmail.com — KAH Digital
`;

const PRIVACY = `
DONNÉES COLLECTÉES

• Email — authentification, durée du compte + 30 jours
• Pseudonyme / Avatar — affichage, durée du compte
• Position GPS (opt-in uniquement) — Life Map, 72h max
• Statut relationnel — affichage, durée du compte
• Activités in-app — game loop, 90 jours
• Logs de connexion — sécurité, 30 jours

PARTAGE DES DONNÉES
Tes données ne sont jamais vendues.
Partenaires techniques : Supabase (hébergement UE), Expo (build app).

GÉOLOCALISATION
100% optionnelle. Activable et désactivable à tout moment.
Position affichée au niveau du quartier, jamais l'adresse exacte.

TES DROITS (RGPD)
• Accès · Rectification · Effacement · Portabilité · Opposition
• Contact : kahdigital42@gmail.com (objet : [RGPD MyLife])
• Réponse sous 30 jours, suppression sous 72h

SÉCURITÉ
• Mots de passe hashés (bcrypt)
• Communications chiffrées HTTPS/TLS
• Accès base de données via Row Level Security

MINEURS
MyLife est interdite aux moins de 18 ans.
Signalement : kahdigital42@gmail.com
`;

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const isCgu = doc !== "privacy";
  const title   = isCgu ? "Conditions Générales d'Utilisation" : "Politique de Confidentialité";
  const content = isCgu ? CGU : PRIVACY;

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
        <Text style={{ color: L.text, fontSize: 16, fontWeight: "900", flex: 1 }}>
          {title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <Text style={{ color: L.muted, fontSize: 11, fontWeight: "700",
          letterSpacing: 1, marginBottom: 20 }}>
          VERSION 1.0 · KAH DIGITAL · 16 JUIN 2026
        </Text>

        {content.trim().split("\n\n").map((block, i) => {
          const isTitle = block === block.toUpperCase() && block.length < 60 && !block.includes("•");
          return (
            <View key={i} style={{ marginBottom: 20 }}>
              <Text style={{
                color: isTitle ? L.primary : L.textSoft,
                fontSize: isTitle ? 11 : 14,
                fontWeight: isTitle ? "800" : "400",
                letterSpacing: isTitle ? 1.5 : 0,
                lineHeight: isTitle ? 18 : 22,
              }}>
                {block.trim()}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
