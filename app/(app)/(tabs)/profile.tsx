import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";

import { AppShell, AvatarBadge, Button, Card, MetricCard, Muted, Pill, SectionTitle, Title } from "@/components/ui";
import { getActivePremiumBoost, getBoostMultiplier } from "@/lib/premium";
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
  const session       = useGameStore((s) => s.session);
  const avatar        = useGameStore((s) => s.avatar);
  const stats         = useGameStore((s) => s.stats);
  const relationships = useGameStore((s) => s.relationships);
  const datePlans     = useGameStore((s) => s.datePlans);
  const signOut       = useGameStore((s) => s.signOut);
  const resetAll      = useGameStore((s) => s.resetAll);
  const loadTestAccount = useGameStore((s) => s.loadTestAccount);
  const syncToSupabase = useGameStore((s) => s.syncToSupabase);

  const isPremium        = useGameStore((s) => s.isPremium);
  const premiumTier      = useGameStore((s) => s.premiumTier);
  const premiumExpiresAt = useGameStore((s) => s.premiumExpiresAt);
  const activeBoosts     = useGameStore((s) => s.activeBoosts);
  const equippedCosmetics = useGameStore((s) => s.equippedCosmetics);
  const moneyTransfers   = useGameStore((s) => s.moneyTransfers);

  const momentum      = getMomentumState(stats);
  const activeBoost   = getActivePremiumBoost(activeBoosts);
  const boostMult     = getBoostMultiplier(activeBoosts);

  return (
    <AppShell>
      {/* Identité */}
      <Card accent>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <Pill>{session?.provider === "supabase" ? "Supabase" : "Mode local"}</Pill>
          {isPremium && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(139,124,255,0.2)", borderWidth: 1, borderColor: colors.accent }}>
              <Ionicons name="sparkles" size={12} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "800" }}>
                PREMIUM {premiumTier === "yearly" ? "ANNUEL" : "MENSUEL"}
              </Text>
            </View>
          )}
          {activeBoost && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(251,191,36,0.2)" }}>
              <Ionicons name="flash" size={12} color="#fbbf24" />
              <Text style={{ color: "#fbbf24", fontSize: 11, fontWeight: "800" }}>BOOST x{boostMult}</Text>
            </View>
          )}
        </View>
        <Title>{avatar?.displayName ?? "Avatar"}</Title>
        <Muted>{session?.email ?? "Aucun compte actif"}</Muted>
        {equippedCosmetics.length > 0 && (
          <Muted>{equippedCosmetics.length} cosmétique{equippedCosmetics.length > 1 ? "s" : ""} équipé{equippedCosmetics.length > 1 ? "s" : ""}</Muted>
        )}
        <AvatarBadge
          title={avatar?.displayName ?? "Avatar"}
          subtitle={`${avatar?.photoStyle ?? "Minimal clean"} · ${avatar?.outfitStyle ?? "urbain"} · ${avatar?.ageRange ?? "-"}`}
          tone="violet"
        />
      </Card>

      {/* Métriques */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <MetricCard label="Rang"        value={getSocialRankLabel(stats.socialRankScore)} hint="niveau de vie et image sociale" />
        <MetricCard label="Réputation"  value={`${stats.reputation}`}                    hint="crédibilité sociale" />
        <MetricCard label="Poids"       value={`${stats.weight} kg`}                     hint="évolue selon nutrition et sport" />
        <MetricCard label="Attractivité" value={`${stats.attractiveness}`}               hint="fitness + hygiène + stabilité + discipline" />
        <MetricCard
          label="État mental"
          value={stats.mentalStability === "stable" ? "Stable" : stats.mentalStability === "fragile" ? "Fragile" : "Saturé"}
          hint="dérive du stress, humeur et régularité"
        />
        <MetricCard
          label="Momentum"
          value={momentum.label}
          hint={`série ${stats.streak} j · x${momentum.multiplier.toFixed(2)}`}
        />
        <MetricCard label="Solde"       value={`${stats.money} cr`}                      hint="crédits in-game" />
        <MetricCard label="Transferts"  value={`${moneyTransfers.length}`}               hint="transactions sociales" />
      </View>

      {/* Premium + Economy */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            label={isPremium ? "Gérer Premium" : "Passer Premium"}
            onPress={() => router.push("/(app)/premium")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Portefeuille"
            variant="secondary"
            onPress={() => router.push("/(app)/economy")}
          />
        </View>
      </View>

      {/* Statut social */}
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
                  const isPassed  = i < currentIdx;
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

      {/* Identité et style */}
      <Card>
        <SectionTitle>Identité et style</SectionTitle>
        <Muted>{avatar?.bio ?? "Aucune bio."}</Muted>
        <Muted>Genre : {avatar?.gender ?? "-"}</Muted>
        <Muted>Origine / style : {avatar?.originStyle ?? "-"}</Muted>
        <Muted>Trait principal : {avatar?.personalityTrait ?? "-"}</Muted>
        <Muted>Ambition : {avatar?.ambition ?? "-"}</Muted>
        <Muted>Rythme de vie : {avatar?.lifeRhythm ?? "-"}</Muted>
        <Muted>Objectif : {avatar?.personalGoal ?? "-"}</Muted>
        <Button label="Éditer le profil" variant="secondary" onPress={() => router.push("/(app)/avatar-edit")} />
      </Card>

      {/* Préférences sociales */}
      <Card>
        <SectionTitle>Préférences sociales</SectionTitle>
        <Muted>Recherche : {avatar?.lookingFor.join(", ") ?? "-"}</Muted>
        <Muted>Intérêts : {avatar?.interests.join(", ") ?? "-"}</Muted>
        <Muted>Traits appréciés : {avatar?.appreciatedTraits.join(", ") ?? "-"}</Muted>
        <Muted>Relations actives : {relationships.filter((r) => r.score > 30).length}</Muted>
        <Muted>Dates planifiés : {datePlans.filter((d) => d.status === "accepted" || d.status === "proposed").length}</Muted>
      </Card>

      {/* Sync Supabase (si configuré) */}
      {session?.provider === "supabase" && (
        <Button
          label="Synchroniser avec Supabase"
          variant="secondary"
          onPress={() => { void syncToSupabase(); }}
        />
      )}

      {/* Accès rapide Rooms */}
      <Button
        label="🏠 Rejoindre une Room live"
        onPress={() => router.push("/(app)/rooms")}
      />

      <Card>
        <SectionTitle>Mode test</SectionTitle>
        <Muted>Charge instantanement toutes les donnees de test : premium, boosts, relations, dates, rooms, argent, travail et etudes.</Muted>
        <Button
          label="Activer test live complet"
          onPress={() => {
            loadTestAccount("live");
            router.replace("/(app)/(tabs)/home");
          }}
        />
      </Card>

      {/* Zone danger */}
      <View style={{
        borderWidth: 1, borderColor: "rgba(255,80,80,0.3)", borderRadius: 14,
        padding: 14, gap: 10, backgroundColor: "rgba(255,50,50,0.04)"
      }}>
        <Text style={{ color: "#ff8d8d", fontWeight: "800", fontSize: 13 }}>Zone de session</Text>
        <Button
          label="Se déconnecter"
          variant="secondary"
          onPress={() => { signOut(); router.replace("/(auth)/sign-in"); }}
        />
        <Button
          label="Réinitialiser complètement (refaire profil)"
          variant="ghost"
          onPress={() => { resetAll(); router.replace("/(auth)/welcome"); }}
        />
      </View>
    </AppShell>
  );
}
