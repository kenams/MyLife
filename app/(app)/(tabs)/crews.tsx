"use client";
import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { useGameStore } from "@/stores/game-store";
import {
  type Crew, type LeaveCrewResult, CREW_COLORS,
  createCrew, fetchCrews, joinCrew, getMyCrewId, leaveCrew, getCrewCooldown,
} from "@/lib/crews";

const C = {
  bg:      "#080808", card:    "#111111", cardAlt: "#181818",
  border:  "rgba(255,255,255,0.07)", borderStrong: "rgba(255,255,255,0.13)",
  text:    "#F5F2E8", textSoft: "#A8A49A", muted: "#4A4844",
  gold:    "#FFD600", green: "#39FF14", purple: "#BF5FFF",
  red:     "#FF3B3B", blue: "#00B4FF",
};

function LivePulse({ color = C.green, size = 7 }: { color?: string; size?: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.8, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={{ position: "relative", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: size * 2, height: size * 2,
        borderRadius: size, backgroundColor: color + "30",
        transform: [{ scale: pulse }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

function CrewCard({ crew, isMyCrewId, onJoin }: {
  crew: Crew; isMyCrewId: boolean; onJoin: (id: string) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={{
        backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10,
        borderWidth: 1, borderColor: isMyCrewId ? crew.color + "50" : C.border,
        borderLeftWidth: 3, borderLeftColor: crew.color,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 24 }}>{crew.emoji}</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: "800" }}>{crew.name}</Text>
              <View style={{ backgroundColor: crew.color + "22", paddingHorizontal: 6, paddingVertical: 2,
                borderRadius: 5, borderWidth: 1, borderColor: crew.color + "40" }}>
                <Text style={{ color: crew.color, fontSize: 10, fontWeight: "900" }}>{crew.tag}</Text>
              </View>
              {isMyCrewId && (
                <View style={{ backgroundColor: C.green + "20", paddingHorizontal: 6, paddingVertical: 2,
                  borderRadius: 5, borderWidth: 1, borderColor: C.green + "40" }}>
                  <Text style={{ color: C.green, fontSize: 9, fontWeight: "900" }}>MON CREW</Text>
                </View>
              )}
            </View>
            {crew.description ? (
              <Text style={{ color: C.textSoft, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                {crew.description}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: crew.color, fontSize: 16, fontWeight: "900" }}>{crew.member_count}</Text>
            <Text style={{ color: C.muted, fontSize: 9, letterSpacing: 1 }}>MEMBRES</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: C.gold, fontSize: 16, fontWeight: "900" }}>{crew.reputation}</Text>
            <Text style={{ color: C.muted, fontSize: 9, letterSpacing: 1 }}>REP</Text>
          </View>
          <View style={{ flex: 1 }} />
          {!isMyCrewId && (
            <Pressable
              onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
              onPress={() => onJoin(crew.id)}
              style={{ backgroundColor: crew.color + "15", paddingHorizontal: 14, paddingVertical: 7,
                borderRadius: 8, borderWidth: 1, borderColor: crew.color + "40" }}>
              <Text style={{ color: crew.color, fontSize: 12, fontWeight: "800" }}>REJOINDRE</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function CrewsScreen() {
  const avatar       = useGameStore((s) => s.avatar);
  const playerName   = avatar?.displayName ?? "Joueur";
  const playerEmoji  = "🧢";

  const playerXp         = useGameStore((s) => s.stats?.socialRankScore ?? 0);
  const playerReputation = useGameStore((s) => s.stats?.reputation ?? 0);
  const playerMoney      = useGameStore((s) => s.stats?.money ?? 0);

  const [crews,       setCrews]       = useState<Crew[]>([]);
  const [myCrewId,    setMyCrewId]    = useState<string | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState<string | null>(null);
  const [leaveModal,  setLeaveModal]  = useState(false);
  const [leaveResult, setLeaveResult] = useState<LeaveCrewResult | null>(null);
  const [leaving,     setLeaving]     = useState(false);
  const [cooldown,    setCooldown]    = useState<Date | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // Create form state
  const [crewName,  setCrewName]  = useState("");
  const [crewTag,   setCrewTag]   = useState("");
  const [crewEmoji, setCrewEmoji] = useState("🔥");
  const [crewColor, setCrewColor] = useState(C.red);
  const [crewDesc,  setCrewDesc]  = useState("");

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    fetchCrews().then((data) => { setCrews(data); setLoading(false); });
    getMyCrewId(playerName).then(setMyCrewId);
    getCrewCooldown(playerName).then(setCooldown);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }

  async function handleLeave() {
    if (!myCrewId) return;
    setLeaving(true);
    const result = await leaveCrew(myCrewId, playerName, playerXp, playerReputation, playerMoney);
    setLeaving(false);
    if (result.blocked) {
      showToast(result.error ?? "Impossible de quitter");
      setLeaveModal(false);
      return;
    }
    if (result.ok) {
      setCrews((prev) => prev.map((x) =>
        x.id === myCrewId ? { ...x, member_count: Math.max(0, x.member_count - 1) } : x
      ));
      setMyCrewId(null);
      setLeaveResult(result);
      setLeaveModal(false);
      const until = new Date(Date.now() + result.penalties.cooldownDays * 86400000);
      setCooldown(until);
    } else {
      showToast(result.error ?? "Erreur");
      setLeaveModal(false);
    }
  }

  async function handleJoin(crewId: string) {
    if (myCrewId) { showToast("Tu es déjà dans un crew"); return; }
    if (cooldown && cooldown > new Date()) {
      const days = Math.ceil((cooldown.getTime() - Date.now()) / 86400000);
      showToast(`Cooldown actif — encore ${days}j avant de rejoindre`);
      return;
    }
    const ok = await joinCrew(crewId, playerName, playerEmoji);
    if (ok) {
      setMyCrewId(crewId);
      const c = crews.find((x) => x.id === crewId);
      showToast(`Bienvenue dans ${c?.name ?? "le crew"} ${c?.emoji ?? ""}`);
      setCrews((prev) => prev.map((x) =>
        x.id === crewId ? { ...x, member_count: x.member_count + 1 } : x
      ));
    }
  }

  async function handleCreate() {
    if (!crewName.trim() || !crewTag.trim()) { showToast("Nom et tag requis"); return; }
    if (myCrewId) { showToast("Tu es déjà dans un crew"); return; }
    const crew = await createCrew(
      crewName.trim(), crewTag.trim().toUpperCase(),
      crewEmoji, crewColor, crewDesc.trim(), playerName, playerEmoji
    );
    if (crew) {
      setCrews((prev) => [crew, ...prev]);
      setMyCrewId(crew.id);
      setShowCreate(false);
      showToast(`Crew "${crew.name}" créé ✅`);
      setCrewName(""); setCrewTag(""); setCrewDesc("");
    } else {
      showToast("Nom déjà pris — choisis autre chose");
    }
  }

  return (
    <Animated.View style={{ flex: 1, backgroundColor: C.bg, opacity: fadeAnim }}>
      <ScrollView contentContainerStyle={{ paddingTop: 56, paddingBottom: 120, paddingHorizontal: 20 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <LivePulse color={C.red} size={8} />
          <Text style={{ color: C.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5, flex: 1 }}>
            CREWS
          </Text>
          <View style={{ backgroundColor: C.card, paddingHorizontal: 10, paddingVertical: 5,
            borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.textSoft, fontSize: 11, fontWeight: "700" }}>
              {crews.length} crews actifs
            </Text>
          </View>
        </View>

        {/* Mon crew banner */}
        {myCrewId && (() => {
          const mc = crews.find((c) => c.id === myCrewId);
          if (!mc) return null;
          return (
            <View style={{ backgroundColor: mc.color + "12", borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: mc.color + "35", marginBottom: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 24 }}>{mc.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: mc.color, fontSize: 14, fontWeight: "900" }}>
                    [{mc.tag}] {mc.name}
                  </Text>
                  <Text style={{ color: C.textSoft, fontSize: 11, marginTop: 1 }}>
                    {mc.member_count} membres · {mc.reputation} rep
                  </Text>
                </View>
                <Text style={{ color: C.green, fontSize: 11, fontWeight: "800" }}>✓ MEMBRE</Text>
              </View>
              <Pressable onPress={() => setLeaveModal(true)}
                style={{ marginTop: 12, borderRadius: 10, paddingVertical: 10,
                  alignItems: "center", borderWidth: 1,
                  borderColor: C.red + "40", backgroundColor: C.red + "10" }}>
                <Text style={{ color: C.red, fontSize: 12, fontWeight: "800" }}>
                  Quitter le crew
                </Text>
              </Pressable>
            </View>
          );
        })()}

        {/* Cooldown banner */}
        {!myCrewId && cooldown && cooldown > new Date() && (
          <View style={{ backgroundColor: "#1A0808", borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: C.red + "30", marginBottom: 20 }}>
            <Text style={{ color: C.red, fontSize: 13, fontWeight: "800" }}>⏳ Cooldown actif</Text>
            <Text style={{ color: C.textSoft, fontSize: 12, marginTop: 4 }}>
              Tu as quitté un crew. Tu peux en rejoindre un autre le{" "}
              {cooldown.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.
            </Text>
          </View>
        )}

        {/* Résultat après avoir quitté */}
        {leaveResult?.ok && (
          <View style={{ backgroundColor: "#1A0808", borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: C.red + "30", marginBottom: 20, gap: 6 }}>
            <Text style={{ color: C.red, fontSize: 13, fontWeight: "900" }}>⚠ Crew quitté — pénalités appliquées</Text>
            <Text style={{ color: C.textSoft, fontSize: 12 }}>−{leaveResult.penalties.xpLost} XP</Text>
            <Text style={{ color: C.textSoft, fontSize: 12 }}>−{leaveResult.penalties.reputationLost} réputation (−15%)</Text>
            <Text style={{ color: C.textSoft, fontSize: 12 }}>−{leaveResult.penalties.moneyLost} coins</Text>
            <Text style={{ color: C.textSoft, fontSize: 12 }}>🚫 Cooldown {leaveResult.penalties.cooldownDays} jours</Text>
            <Pressable onPress={() => setLeaveResult(null)} style={{ marginTop: 4 }}>
              <Text style={{ color: C.muted, fontSize: 11 }}>Fermer</Text>
            </Pressable>
          </View>
        )}

        {/* Créer crew CTA */}
        {!myCrewId && (
          <Pressable onPress={() => setShowCreate(true)}
            style={{ backgroundColor: C.gold + "12", borderRadius: 12, padding: 16, marginBottom: 20,
              borderWidth: 1, borderColor: C.gold + "35", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 22 }}>👑</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.gold, fontSize: 14, fontWeight: "900" }}>Fonde ton crew</Text>
              <Text style={{ color: C.textSoft, fontSize: 11 }}>Choisis ton territoire, recrute des membres</Text>
            </View>
            <Text style={{ color: C.gold, fontSize: 16, fontWeight: "800" }}>→</Text>
          </Pressable>
        )}

        {/* Section title */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>CLASSEMENT CREWS</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        </View>

        {/* Liste */}
        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Text style={{ color: C.muted, fontSize: 13 }}>Chargement...</Text>
          </View>
        ) : (
          crews.map((crew) => (
            <CrewCard
              key={crew.id}
              crew={crew}
              isMyCrewId={myCrewId === crew.id}
              onJoin={handleJoin}
            />
          ))
        )}

      </ScrollView>

      {/* Modal créer crew */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 24, paddingBottom: 48 }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "900", marginBottom: 20 }}>
              Créer un crew
            </Text>

            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 }}>NOM DU CREW</Text>
            <TextInput
              value={crewName} onChangeText={setCrewName}
              placeholder="Belleville Kings..."
              placeholderTextColor={C.muted}
              style={{ backgroundColor: C.cardAlt, color: C.text, borderRadius: 10, padding: 12,
                fontSize: 14, fontWeight: "700", marginBottom: 12,
                borderWidth: 1, borderColor: C.border }}
            />

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 }}>TAG (3 lettres)</Text>
                <TextInput
                  value={crewTag} onChangeText={(t) => setCrewTag(t.slice(0, 3).toUpperCase())}
                  placeholder="BVK"
                  placeholderTextColor={C.muted}
                  style={{ backgroundColor: C.cardAlt, color: C.text, borderRadius: 10, padding: 12,
                    fontSize: 14, fontWeight: "900", textAlign: "center",
                    borderWidth: 1, borderColor: C.border }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 }}>EMOJI</Text>
                <TextInput
                  value={crewEmoji} onChangeText={(t) => setCrewEmoji(t.slice(-2) || t)}
                  placeholder="🔥"
                  placeholderTextColor={C.muted}
                  style={{ backgroundColor: C.cardAlt, color: C.text, borderRadius: 10, padding: 12,
                    fontSize: 20, textAlign: "center",
                    borderWidth: 1, borderColor: C.border }}
                />
              </View>
            </View>

            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 }}>COULEUR</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {CREW_COLORS.map((col) => (
                <Pressable key={col} onPress={() => setCrewColor(col)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: col,
                    borderWidth: crewColor === col ? 3 : 1,
                    borderColor: crewColor === col ? C.text : "rgba(255,255,255,0.2)" }} />
              ))}
            </View>

            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 }}>DESCRIPTION (optionnel)</Text>
            <TextInput
              value={crewDesc} onChangeText={setCrewDesc}
              placeholder="Notre crew c'est..."
              placeholderTextColor={C.muted}
              multiline
              style={{ backgroundColor: C.cardAlt, color: C.text, borderRadius: 10, padding: 12,
                fontSize: 13, minHeight: 60, marginBottom: 20,
                borderWidth: 1, borderColor: C.border }}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => setShowCreate(false)}
                style={{ flex: 1, backgroundColor: C.cardAlt, padding: 14, borderRadius: 10,
                  alignItems: "center", borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.textSoft, fontSize: 14, fontWeight: "700" }}>Annuler</Text>
              </Pressable>
              <Pressable onPress={handleCreate}
                style={{ flex: 2, backgroundColor: crewColor + "20", padding: 14, borderRadius: 10,
                  alignItems: "center", borderWidth: 1, borderColor: crewColor + "50" }}>
                <Text style={{ color: crewColor, fontSize: 14, fontWeight: "900" }}>CRÉER LE CREW</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modale quitter crew */}
      <Modal visible={leaveModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "center", padding: 24 }}>
          {(() => {
            const mc = crews.find((c) => c.id === myCrewId);
            if (!mc) return null;
            const repLoss = Math.round(playerReputation * 0.15);
            return (
              <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 24,
                borderWidth: 1, borderColor: C.red + "40" }}>
                <Text style={{ color: C.red, fontSize: 18, fontWeight: "900", textAlign: "center" }}>
                  ⚠ Quitter [{mc.tag}] {mc.name} ?
                </Text>
                <Text style={{ color: C.textSoft, fontSize: 13, textAlign: "center",
                  marginTop: 8, marginBottom: 20, lineHeight: 20 }}>
                  Cette action est définitive. Les pénalités s'appliquent immédiatement.
                </Text>

                {/* Pénalités */}
                <View style={{ backgroundColor: "#1A0808", borderRadius: 12, padding: 14, gap: 8,
                  borderWidth: 1, borderColor: C.red + "25", marginBottom: 20 }}>
                  <Text style={{ color: C.red, fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>PÉNALITÉS</Text>
                  {[
                    ["📉", "−250 XP"],
                    ["💔", `−${repLoss} réputation (−15%)`],
                    ["💸", "−500 coins"],
                    ["🚫", "Cooldown 7 jours (impossible de rejoindre un autre crew)"],
                  ].map(([icon, label]) => (
                    <View key={label} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                      <Text style={{ fontSize: 14 }}>{icon}</Text>
                      <Text style={{ color: C.textSoft, fontSize: 13, flex: 1 }}>{label}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable onPress={() => setLeaveModal(false)}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                      backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ color: C.textSoft, fontWeight: "800" }}>Annuler</Text>
                  </Pressable>
                  <Pressable onPress={() => void handleLeave()} disabled={leaving}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                      backgroundColor: C.red + "20", borderWidth: 1, borderColor: C.red + "50" }}>
                    <Text style={{ color: C.red, fontWeight: "900" }}>
                      {leaving ? "..." : "Confirmer"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* Toast */}
      {toast && (
        <Animated.View pointerEvents="none" style={{
          position: "absolute", bottom: 100, left: 24, right: 24, opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0,1], outputRange: [8,0] }) }],
        }}>
          <View style={{ backgroundColor: C.card, borderRadius: 12,
            paddingHorizontal: 20, paddingVertical: 13, alignItems: "center",
            borderWidth: 1, borderColor: C.gold + "25" }}>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: "800" }}>{toast}</Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
