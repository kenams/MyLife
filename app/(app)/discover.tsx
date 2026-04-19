import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getNpcVisual } from "@/lib/avatar-visual";
import { starterResidents } from "@/lib/game-engine";
import { getBestProfileMatches, type ResidentMatch } from "@/lib/profile-matching";
import { getRelationshipLabel, getResidentAccessibility } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import type { ResidentSeed } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

type SwipeDecision = "pass" | "like" | "super";

type SwipeOutcome = {
  residentId: string;
  residentName: string;
  kind: "passed" | "liked" | "matched" | "super";
  score: number;
};

const PROFILE_ACCENTS: Record<string, string> = {
  ava: "#38c793",
  malik: "#60a5fa",
  noa: "#f472b6",
  leila: "#84cc16",
  yan: "#f6b94f",
  sana: "#8b7cff"
};

const INTENT_LABEL: Record<ResidentMatch["intent"], string> = {
  friendship: "Amitie",
  romance: "Romance",
  network: "Reseau",
  activity: "Sortie"
};

function scoreColor(score: number) {
  if (score >= 82) return "#38c793";
  if (score >= 68) return "#60a5fa";
  if (score >= 50) return "#f6b94f";
  return colors.muted;
}

function residentAccent(residentId: string) {
  return PROFILE_ACCENTS[residentId] ?? colors.accent;
}

function isInstantMatch(match: ResidentMatch, relationshipScore: number, decision: SwipeDecision) {
  if (decision === "super") return true;
  return match.score >= 70 || relationshipScore >= 42;
}

function MiniProfile({ resident, match }: { resident: ResidentSeed; match: ResidentMatch }) {
  const accent = residentAccent(resident.id);
  return (
    <View style={{
      width: 132,
      minHeight: 92,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.055)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.09)",
      padding: 10,
      gap: 7
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: accent + "22", borderWidth: 1, borderColor: accent + "55", alignItems: "center", justifyContent: "center" }}>
          <AvatarSprite visual={getNpcVisual(resident.id)} action="idle" size="xs" />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "900" }}>{resident.name}</Text>
          <Text style={{ color: scoreColor(match.score), fontSize: 10, fontWeight: "900" }}>{match.score}%</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={{ color: colors.textSoft, fontSize: 10, lineHeight: 13 }}>{match.reasons[0]}</Text>
    </View>
  );
}

function SwipeButton({
  label,
  icon,
  tone,
  onPress,
  size = 58
}: {
  label: string;
  icon: string;
  tone: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", gap: 6 }}>
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone + "18",
        borderWidth: 1.5,
        borderColor: tone + "70",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: tone,
        shadowOpacity: 0.35,
        shadowRadius: 9,
        elevation: 4
      }}>
        <Ionicons name={icon as never} size={size >= 64 ? 30 : 25} color={tone} />
      </View>
      <Text style={{ color: tone, fontSize: 11, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function ActiveProfileCard({
  match,
  relationshipScore
}: {
  match: ResidentMatch;
  relationshipScore: number;
}) {
  const resident = match.resident;
  const accent = residentAccent(resident.id);
  const matchTone = scoreColor(match.score);
  const relLabel = relationshipScore > 0 ? `${relationshipScore} lien` : "nouveau";

  return (
    <View style={{
      minHeight: 520,
      borderRadius: 26,
      overflow: "hidden",
      backgroundColor: "#0d1828",
      borderWidth: 1,
      borderColor: accent + "55",
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 8
    }}>
      <View style={{ height: 300, backgroundColor: accent + "22", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", left: -60, top: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: accent + "22" }} />
        <View style={{ position: "absolute", right: -45, bottom: -65, width: 190, height: 190, borderRadius: 95, backgroundColor: matchTone + "1f" }} />
        <View style={{ position: "absolute", left: 18, right: 18, bottom: 18, height: 66, borderRadius: 20, backgroundColor: "rgba(7,17,31,0.84)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" }} />
        <View style={{ transform: [{ scale: 1.52 }], marginTop: -18 }}>
          <AvatarSprite visual={getNpcVisual(resident.id)} action={resident.status === "online" ? "waving" : "idle"} size="lg" />
        </View>
        <View style={{ position: "absolute", left: 18, top: 18, flexDirection: "row", gap: 8 }}>
          <View style={{ backgroundColor: resident.status === "online" ? "#38c793" : "rgba(255,255,255,0.16)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: resident.status === "online" ? "#07111f" : colors.text, fontSize: 10, fontWeight: "900" }}>
              {resident.status === "online" ? "EN LIGNE" : resident.status.toUpperCase()}
            </Text>
          </View>
          <View style={{ backgroundColor: matchTone, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: "#07111f", fontSize: 10, fontWeight: "900" }}>MATCH {match.score}%</Text>
          </View>
        </View>
        <View style={{ position: "absolute", left: 34, right: 34, bottom: 28 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: "#ffffff", fontSize: 31, fontWeight: "900" }}>
            {resident.name}, {resident.ageRange}
          </Text>
          <Text numberOfLines={1} style={{ color: "rgba(226,232,240,0.84)", fontSize: 13, fontWeight: "700", marginTop: 2 }}>
            {resident.role}
          </Text>
        </View>
      </View>

      <View style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <View style={{ backgroundColor: accent + "18", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: accent + "44" }}>
            <Text style={{ color: accent, fontSize: 11, fontWeight: "900" }}>{INTENT_LABEL[match.intent]}</Text>
          </View>
          <View style={{ backgroundColor: "rgba(255,255,255,0.065)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
            <Text style={{ color: colors.textSoft, fontSize: 11, fontWeight: "800" }}>{relLabel}</Text>
          </View>
          <View style={{ backgroundColor: "rgba(255,255,255,0.065)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
            <Text style={{ color: colors.textSoft, fontSize: 11, fontWeight: "800" }}>{resident.socialRank}</Text>
          </View>
        </View>

        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>{resident.bio}</Text>
        <Text style={{ color: colors.textSoft, fontSize: 12, lineHeight: 17 }}>{resident.vibe}</Text>

        <View style={{ gap: 7 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900" }}>Compatibilite</Text>
            <Text style={{ color: matchTone, fontSize: 11, fontWeight: "900" }}>{match.tier}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <View style={{ width: `${match.score}%`, height: "100%", borderRadius: 999, backgroundColor: matchTone }} />
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {match.reasons.map((reason) => (
            <View key={reason} style={{ backgroundColor: matchTone + "14", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: matchTone + "35" }}>
              <Text style={{ color: matchTone, fontSize: 10, fontWeight: "900" }}>{reason}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {resident.interests.slice(0, 5).map((interest) => (
            <View key={interest} style={{ backgroundColor: "rgba(255,255,255,0.055)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: colors.textSoft, fontSize: 10, fontWeight: "800" }}>{interest}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function DiscoverScreen() {
  const avatar = useGameStore((s) => s.avatar);
  const stats = useGameStore((s) => s.stats);
  const relationships = useGameStore((s) => s.relationships);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);
  const sendInvitation = useGameStore((s) => s.sendInvitation);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(1)).current;
  const [decisions, setDecisions] = useState<Record<string, SwipeDecision>>({});
  const [lastOutcome, setLastOutcome] = useState<SwipeOutcome | null>(null);

  const matches = useMemo(
    () => getBestProfileMatches(avatar, starterResidents, relationships),
    [avatar, relationships]
  );
  const pendingMatches = matches.filter((match) => !decisions[match.resident.id]);
  const activeMatch = pendingMatches[0] ?? null;
  const nextMatch = pendingMatches[1] ?? null;
  const likedCount = Object.values(decisions).filter((decision) => decision === "like" || decision === "super").length;
  const passedCount = Object.values(decisions).filter((decision) => decision === "pass").length;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    cardAnim.setValue(0.96);
    Animated.spring(cardAnim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
  }, [activeMatch?.resident.id, cardAnim]);

  function openChat(residentId: string, residentName: string) {
    startDirectConversation(residentId, residentName);
    router.push("/(app)/(tabs)/chat");
  }

  function decide(decision: SwipeDecision) {
    if (!activeMatch) return;
    const resident = activeMatch.resident;
    const relationship = relationships.find((item) => item.residentId === resident.id);
    const relationshipScore = relationship?.score ?? 0;
    const matched = decision !== "pass" && isInstantMatch(activeMatch, relationshipScore, decision);

    if (decision === "super") {
      startDirectConversation(resident.id, resident.name);
      sendInvitation(resident.id, "coffee-meetup");
    } else if (matched) {
      startDirectConversation(resident.id, resident.name);
    }

    setDecisions((current) => ({ ...current, [resident.id]: decision }));
    setLastOutcome({
      residentId: resident.id,
      residentName: resident.name,
      kind: decision === "pass" ? "passed" : decision === "super" ? "super" : matched ? "matched" : "liked",
      score: activeMatch.score
    });
  }

  function resetDeck() {
    setDecisions({});
    setLastOutcome(null);
  }

  const relationship = activeMatch
    ? relationships.find((item) => item.residentId === activeMatch.resident.id)
    : null;
  const relationshipScore = relationship?.score ?? 0;
  const access = activeMatch ? getResidentAccessibility(activeMatch.resident.id, stats) : null;
  const accessTone = access?.level === "accessible" ? "#38c793" : access?.level === "receptif" ? "#f6b94f" : colors.muted;
  const relLabel = activeMatch ? getRelationshipLabel(relationship ?? undefined) : null;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ backgroundColor: "#060d18", paddingHorizontal: 18, paddingTop: 54, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.065)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>MyLife Match</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Swipe, match, chat, date</Text>
            </View>
            <Pressable onPress={() => router.push("/(app)/dates")} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#f472b620", borderWidth: 1, borderColor: "#f472b655", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="heart" size={18} color="#f472b6" />
            </Pressable>
          </View>

          <View style={{ marginTop: 16, flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { label: "Profils", value: `${matches.length}`, tone: colors.accent },
              { label: "Likes", value: `${likedCount}`, tone: "#f472b6" },
              { label: "Passes", value: `${passedCount}`, tone: colors.muted }
            ].map((item) => (
              <View key={item.label} style={{ minWidth: 92, alignItems: "center", backgroundColor: item.tone + "12", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: item.tone + "35" }}>
                <Text style={{ color: item.tone, fontSize: 15, fontWeight: "900" }}>{item.value}</Text>
                <Text style={{ color: colors.textSoft, fontSize: 10, fontWeight: "800" }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ padding: 18, gap: 16 }}>
          {lastOutcome && (
            <View style={{
              backgroundColor: lastOutcome.kind === "matched" || lastOutcome.kind === "super" ? "#38c79318" : "rgba(255,255,255,0.055)",
              borderRadius: 18,
              borderWidth: 1,
              borderColor: lastOutcome.kind === "matched" || lastOutcome.kind === "super" ? "#38c79355" : "rgba(255,255,255,0.09)",
              padding: 14,
              gap: 10
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons
                  name={lastOutcome.kind === "passed" ? "close-circle" : lastOutcome.kind === "liked" ? "heart-circle" : "sparkles"}
                  size={24}
                  color={lastOutcome.kind === "passed" ? colors.muted : lastOutcome.kind === "liked" ? "#f472b6" : "#38c793"}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>
                    {lastOutcome.kind === "passed"
                      ? `${lastOutcome.residentName} passe`
                      : lastOutcome.kind === "liked"
                        ? `Like envoye a ${lastOutcome.residentName}`
                        : `Nouveau match avec ${lastOutcome.residentName}`}
                  </Text>
                  <Text style={{ color: colors.textSoft, fontSize: 11, marginTop: 2 }}>
                    Compatibilite {lastOutcome.score}%
                  </Text>
                </View>
              </View>
              {(lastOutcome.kind === "matched" || lastOutcome.kind === "super") && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={() => openChat(lastOutcome.residentId, lastOutcome.residentName)} style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
                    <Text style={{ color: "#07111f", fontSize: 12, fontWeight: "900" }}>Ouvrir le chat</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push("/(app)/dates")} style={{ flex: 1, backgroundColor: "#f472b620", borderRadius: 12, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#f472b655" }}>
                    <Text style={{ color: "#f472b6", fontSize: 12, fontWeight: "900" }}>Proposer date</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {activeMatch ? (
            <>
              <View style={{ position: "relative" }}>
                {nextMatch && (
                  <View style={{
                    position: "absolute",
                    left: 16,
                    right: 16,
                    top: 18,
                    height: 500,
                    borderRadius: 26,
                    backgroundColor: residentAccent(nextMatch.resident.id) + "16",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                    transform: [{ rotate: "2deg" }]
                  }} />
                )}
                <Animated.View style={{ transform: [{ scale: cardAnim }] }}>
                  <ActiveProfileCard match={activeMatch} relationshipScore={relationshipScore} />
                </Animated.View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 22, paddingVertical: 6 }}>
                <SwipeButton label="Pass" icon="close" tone="#ff6b6b" onPress={() => decide("pass")} />
                <SwipeButton label="Super" icon="star" tone="#60a5fa" onPress={() => decide("super")} size={52} />
                <SwipeButton label="Like" icon="heart" tone="#f472b6" onPress={() => decide("like")} size={66} />
              </View>

              <View style={{ backgroundColor: "rgba(255,255,255,0.045)", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.075)", gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>Analyse rapide</Text>
                  <View style={{ backgroundColor: accessTone + "18", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: accessTone + "40" }}>
                    <Text style={{ color: accessTone, fontSize: 10, fontWeight: "900" }}>{access?.level ?? "profil"}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.textSoft, fontSize: 12, lineHeight: 17 }}>{access?.hint}</Text>
                {relLabel && (
                  <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "900" }}>{relLabel}</Text>
                )}
              </View>

              {pendingMatches.length > 1 && (
                <View style={{ gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900" }}>PROCHAINS PROFILS</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {pendingMatches.slice(1, 5).map((match) => (
                      <MiniProfile key={match.resident.id} resident={match.resident} match={match} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          ) : (
            <View style={{
              minHeight: 390,
              borderRadius: 24,
              backgroundColor: "rgba(255,255,255,0.045)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              gap: 14
            }}>
              <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accent + "18", borderWidth: 1, borderColor: colors.accent + "45", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="checkmark-done" size={34} color={colors.accent} />
              </View>
              <Text style={{ color: colors.text, fontSize: 21, fontWeight: "900", textAlign: "center" }}>Deck termine</Text>
              <Text style={{ color: colors.textSoft, fontSize: 13, textAlign: "center", lineHeight: 19 }}>
                Tu as traite les profils disponibles. Reviens plus tard ou relance le deck pour refaire un test.
              </Text>
              <Pressable onPress={resetDeck} style={{ marginTop: 6, backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12 }}>
                <Text style={{ color: "#07111f", fontSize: 13, fontWeight: "900" }}>Relancer le deck</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );
}
