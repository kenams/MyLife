"use client";
import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { useGameStore } from "@/stores/game-store";
import {
  type Crew, type CrewMember, type LeaveCrewResult, type CrewWarRecord,
  type CrewAlliance, type PlayerRank, CREW_COLORS,
  createCrew, fetchCrews, joinCrew, getMyCrewId, leaveCrew, getCrewCooldown, isTagAvailable,
  transferLeader, fetchCrewWars, fetchCrewMembers,
  fetchPlayerLeaderboard, fetchAlliances, proposeAlliance, acceptAlliance,
  checkLeaderInactivity, claimBastion, collectBastionPassive, fetchBastions,
  declareSiege, BASTION_MIN_DISTANCE_M,
  depositToTreasury, setVisitorReward, resolveSiege,
} from "@/lib/crews";
import { supabase } from "@/lib/supabase";
import { requestAndGetLocation } from "@/lib/life-map";

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
  const [leaveModal,    setLeaveModal]    = useState(false);
  const [leaveResult,   setLeaveResult]   = useState<LeaveCrewResult | null>(null);
  const [leaving,       setLeaving]       = useState(false);
  const [cooldown,      setCooldown]      = useState<Date | null>(null);
  const [transferModal,  setTransferModal]  = useState(false);
  const [members,        setMembers]        = useState<CrewMember[]>([]);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferring,   setTransferring]   = useState(false);
  const [wars,           setWars]           = useState<CrewWarRecord[]>([]);
  const [showWars,       setShowWars]       = useState(false);
  const [tab,            setTab]            = useState<"crews" | "players">("crews");
  const [playerRanks,    setPlayerRanks]    = useState<PlayerRank[]>([]);
  const [alliances,      setAlliances]      = useState<CrewAlliance[]>([]);
  const [showAlliances,  setShowAlliances]  = useState(false);
  const [inactiveLeader, setInactiveLeader] = useState<string | null>(null);
  const [myBastion,      setMyBastion]      = useState<string | null>(null); // zone id
  const [bastionModal,   setBastionModal]   = useState(false);
  const [bastionName,    setBastionName]    = useState("");
  const [placingBastion, setPlacingBastion] = useState(false);
  const [passiveReward,  setPassiveReward]  = useState<{ xp: number; rep: number } | null>(null);
  const [treasuryModal,  setTreasuryModal]  = useState(false);
  const [depositAmount,  setDepositAmount]  = useState("50");
  const [rewardAmount,   setRewardAmount]   = useState("5");
  const [depositing,     setDepositing]     = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // Create form state
  const [crewName,    setCrewName]    = useState("");
  const [crewTag,     setCrewTag]     = useState("");
  const [crewEmoji,   setCrewEmoji]   = useState("🔥");
  const [crewColor,   setCrewColor]   = useState(C.red);
  const [crewDesc,    setCrewDesc]    = useState("");
  const [tagStatus,   setTagStatus]   = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const tagCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    fetchCrews().then((data) => { setCrews(data); setLoading(false); });
    getMyCrewId(playerName).then(setMyCrewId);
    getCrewCooldown(playerName).then(setCooldown);
  }, [playerName]);

  useEffect(() => {
    fetchPlayerLeaderboard(20).then(setPlayerRanks);
  }, []);

  useEffect(() => {
    if (!myCrewId) { setMembers([]); setWars([]); setAlliances([]); return; }
    fetchCrewMembers(myCrewId).then(setMembers);
    fetchCrewWars(myCrewId).then(setWars);
    fetchAlliances(myCrewId).then(setAlliances);
    checkLeaderInactivity(myCrewId).then(setInactiveLeader);

    // Vérifie si le crew a déjà un bastion
    fetchBastions().then((bastions) => {
      const mine = bastions.find((b) => b.crew_id === myCrewId);
      if (mine) {
        setMyBastion(mine.id);
        // Collecte passif si disponible
        collectBastionPassive(mine.id).then((reward) => {
          if (reward) setPassiveReward(reward);
        });
      }
    });

    // Realtime — notif quand un nouveau membre rejoint
    if (!supabase) return;
    const sub = supabase
      .channel(`crew-members-${myCrewId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "crew_members",
        filter: `crew_id=eq.${myCrewId}`,
      }, (payload) => {
        const name = (payload.new as CrewMember).player_name;
        if (name !== playerName) showToast(`👋 ${name} a rejoint le crew !`);
        fetchCrewMembers(myCrewId).then(setMembers);
        setCrews((prev) => prev.map((x) =>
          x.id === myCrewId ? { ...x, member_count: x.member_count + 1 } : x
        ));
      })
      .subscribe();
    return () => { void sub.unsubscribe(); };
  }, [myCrewId]);

  async function handleResolveSiege(warId: string) {
    if (!myCrewId) return;
    const result = await resolveSiege(warId, myCrewId);
    if (result.ok) {
      showToast("🏰 Bastion conquis !");
      fetchCrewWars(myCrewId).then(setWars);
      fetchBastions().then((b) => {
        const mine = b.find((x) => x.crew_id === myCrewId);
        if (mine) setMyBastion(mine.id);
      });
    } else {
      showToast("Erreur lors de la résolution");
    }
  }

  async function handleDeposit() {
    if (!myCrewId) return;
    const amount = parseInt(depositAmount, 10);
    const reward = parseInt(rewardAmount, 10);
    if (isNaN(amount) || amount < 1) { showToast("Montant invalide"); return; }
    setDepositing(true);
    const { ok, newBalance } = await depositToTreasury(myCrewId, amount);
    if (ok && !isNaN(reward)) await setVisitorReward(myCrewId, reward);
    setDepositing(false);
    if (ok) {
      showToast(`💰 ${amount} BL déposés · Trésorerie : ${newBalance} BL`);
      setTreasuryModal(false);
      fetchCrews().then(setCrews);
    } else {
      showToast("Erreur lors du dépôt");
    }
  }

  async function handleClaimBastion() {
    if (!myCrewId) return;
    setPlacingBastion(true);
    const mc = crews.find((c) => c.id === myCrewId);
    const loc = await requestAndGetLocation();
    const lat = loc?.lat ?? 48.8566;
    const lng = loc?.lng ?? 2.3522;
    const result = await claimBastion(
      myCrewId,
      bastionName.trim() || `Bastion ${mc?.tag ?? ""}`,
      lat,
      lng,
      mc?.member_count ?? 1,
      mc?.reputation ?? 0,
    );
    setPlacingBastion(false);
    if (result.ok) {
      setBastionModal(false);
      setBastionName("");
      showToast("🏰 Bastion posé ! Il génère XP + rep chaque heure.");
      fetchBastions().then((b) => {
        const mine = b.find((x) => x.crew_id === myCrewId);
        if (mine) setMyBastion(mine.id);
      });
      fetchCrews().then(setCrews);
    } else {
      showToast(result.error ?? "Impossible de poser le bastion");
    }
  }

  async function handleTransfer() {
    if (!myCrewId || !transferTarget) return;
    setTransferring(true);
    const result = await transferLeader(myCrewId, playerName, transferTarget);
    setTransferring(false);
    if (result.ok) {
      showToast(`👑 ${transferTarget} est maintenant leader`);
      setTransferModal(false);
      setTransferTarget(null);
      fetchCrewMembers(myCrewId).then(setMembers);
    } else {
      showToast(result.error ?? "Erreur lors du transfert");
    }
  }

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
    const tag = crewTag.trim().toUpperCase().slice(0, 3);
    if (!crewName.trim() || !tag) { showToast("Nom et tag requis"); return; }
    if (tag.length < 2) { showToast("Tag minimum 2 lettres"); return; }
    if (myCrewId) { showToast("Tu es déjà dans un crew"); return; }
    const result = await createCrew(
      crewName.trim(), tag,
      crewEmoji, crewColor, crewDesc.trim(), playerName, playerEmoji
    );
    if (!result) {
      showToast("Erreur réseau — réessaie");
    } else if ("error" in result && result.error === "TAG_TAKEN") {
      showToast(`❌ Tag [${tag}] déjà pris — choisis autre chose`);
    } else if ("id" in result) {
      setCrews((prev) => [result, ...prev]);
      setMyCrewId(result.id);
      setShowCreate(false);
      showToast(`Crew "${result.name}" [${tag}] créé ✅`);
      setCrewName(""); setCrewTag(""); setCrewDesc("");
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
              {/* Récompense passif bastion */}
              {passiveReward && (
                <Pressable onPress={() => setPassiveReward(null)}
                  style={{ flexDirection: "row", gap: 12, backgroundColor: C.gold + "12",
                    borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: C.gold + "30",
                    alignItems: "center" }}>
                  <Text style={{ fontSize: 18 }}>🏰</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.gold, fontSize: 12, fontWeight: "900" }}>Revenus du bastion</Text>
                    <Text style={{ color: C.textSoft, fontSize: 11 }}>+{passiveReward.xp} XP · +{passiveReward.rep} rep collectés</Text>
                  </View>
                  <Text style={{ color: C.muted, fontSize: 18 }}>×</Text>
                </Pressable>
              )}

              <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {/* Bastion */}
                {myBastion ? (
                  <Pressable onPress={() => setTreasuryModal(true)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 5,
                      backgroundColor: C.gold + "10", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
                      borderWidth: 1, borderColor: C.gold + "35" }}>
                    <Text style={{ fontSize: 14 }}>🏰</Text>
                    <View>
                      <Text style={{ color: C.gold, fontSize: 11, fontWeight: "800" }}>Bastion</Text>
                      <Text style={{ color: C.muted, fontSize: 9 }}>
                        💰 {crews.find(c => c.id === myCrewId)?.treasury ?? 0} BL
                        {(crews.find(c => c.id === myCrewId)?.visitor_reward ?? 0) > 0
                          ? ` · +${crews.find(c => c.id === myCrewId)?.visitor_reward} visiteurs`
                          : ""}
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setBastionModal(true)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 5,
                      backgroundColor: C.gold + "10", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
                      borderWidth: 1, borderColor: C.gold + "35" }}>
                    <Text style={{ fontSize: 14 }}>🏰</Text>
                    <Text style={{ color: C.gold, fontSize: 11, fontWeight: "800" }}>Poser bastion</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => { void fetchCrewMembers(mc.id).then(setMembers); setTransferModal(true); }}
                  style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center",
                    borderWidth: 1, borderColor: C.purple + "40", backgroundColor: C.purple + "10" }}>
                  <Text style={{ color: C.purple, fontSize: 11, fontWeight: "800" }}>👑 Transfert leader</Text>
                </Pressable>
                <Pressable onPress={() => setShowWars((p) => !p)}
                  style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center",
                    borderWidth: 1, borderColor: C.blue + "40", backgroundColor: C.blue + "10" }}>
                  <Text style={{ color: C.blue, fontSize: 11, fontWeight: "800" }}>
                    ⚔️ Guerres ({wars.length})
                  </Text>
                </Pressable>
                <Pressable onPress={() => setLeaveModal(true)}
                  style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center",
                    borderWidth: 1, borderColor: C.red + "40", backgroundColor: C.red + "10" }}>
                  <Text style={{ color: C.red, fontSize: 11, fontWeight: "800" }}>Quitter</Text>
                </Pressable>
              </View>

              {/* Historique guerres */}
              {showWars && wars.length > 0 && (
                <View style={{ marginTop: 12, gap: 6 }}>
                  <Text style={{ color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 2 }}>
                    HISTORIQUE GUERRES
                  </Text>
                  {wars.slice(0, 5).map((war) => {
                    const isA = war.crew_a_id === myCrewId;
                    const enemy = isA ? war.crew_b : war.crew_a;
                    const statusColor = war.status === "active" ? C.red : war.status === "won" ? C.green : C.muted;
                    const statusLabel = war.status === "active" ? "EN COURS" : war.status === "won" ? "VICTOIRE" : "DÉFAITE";
                    const isFounder = members.find((m) => m.player_name === playerName && m.role === "founder");
                    return (
                      <View key={war.id} style={{ flexDirection: "row", alignItems: "center", gap: 8,
                        backgroundColor: "#111", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.border }}>
                        <Text style={{ fontSize: 16 }}>{enemy?.emoji ?? "⚔️"}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontSize: 12, fontWeight: "700" }}>
                            vs [{enemy?.tag ?? "?"}] {enemy?.name ?? "Inconnu"}
                          </Text>
                          <Text style={{ color: C.muted, fontSize: 10 }}>
                            {new Date(war.started_at).toLocaleDateString("fr-FR")}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: statusColor + "20", paddingHorizontal: 7, paddingVertical: 3,
                          borderRadius: 5, borderWidth: 1, borderColor: statusColor + "40" }}>
                          <Text style={{ color: statusColor, fontSize: 9, fontWeight: "900" }}>{statusLabel}</Text>
                        </View>
                        {war.status === "active" && isFounder && (
                          <Pressable onPress={() => void handleResolveSiege(war.id)}
                            style={{ backgroundColor: C.red + "20", paddingHorizontal: 8, paddingVertical: 5,
                              borderRadius: 7, borderWidth: 1, borderColor: C.red + "50", marginLeft: 4 }}>
                            <Text style={{ color: C.red, fontSize: 10, fontWeight: "900" }}>Résoudre ⚔️</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                  {wars.length === 0 && (
                    <Text style={{ color: C.muted, fontSize: 12 }}>Aucune guerre enregistrée.</Text>
                  )}
                </View>
              )}
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

        {/* Tabs toggle */}
        <View style={{ flexDirection: "row", backgroundColor: C.card, borderRadius: 12,
          padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
          {(["crews", "players"] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 9,
              alignItems: "center", borderRadius: 9,
              backgroundColor: tab === t ? C.border : "transparent" }}>
              <Text style={{ color: tab === t ? C.text : C.muted, fontSize: 12, fontWeight: "800" }}>
                {t === "crews" ? "🛡 Crews" : "🏆 Joueurs"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Section title */}
        {tab === "crews" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>CLASSEMENT CREWS</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        </View>
        )}

        {/* Alerte leader inactif */}
        {inactiveLeader && tab === "crews" && myCrewId && (
          <View style={{ backgroundColor: "#1A1000", borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: C.gold + "40", marginBottom: 16, gap: 6 }}>
            <Text style={{ color: C.gold, fontSize: 13, fontWeight: "900" }}>
              ⚠️ Leader inactif depuis +30j
            </Text>
            <Text style={{ color: C.textSoft, fontSize: 12 }}>
              {inactiveLeader} n'a pas été actif. Vote pour un nouveau leader.
            </Text>
            <Pressable onPress={() => { void fetchCrewMembers(myCrewId).then(setMembers); setTransferModal(true); }}
              style={{ backgroundColor: C.gold + "15", borderRadius: 8, paddingVertical: 8,
                alignItems: "center", borderWidth: 1, borderColor: C.gold + "40" }}>
              <Text style={{ color: C.gold, fontSize: 12, fontWeight: "800" }}>Proposer un successeur</Text>
            </Pressable>
          </View>
        )}

        {/* Alliances section */}
        {myCrewId && tab === "crews" && (
          <View style={{ marginBottom: 16 }}>
            <Pressable onPress={() => setShowAlliances((p) => !p)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: showAlliances ? 10 : 0 }}>
              <Text style={{ color: C.blue, fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>
                🤝 ALLIANCES ({alliances.filter((a) => a.status === "active").length})
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Text style={{ color: C.muted, fontSize: 12 }}>{showAlliances ? "▲" : "▼"}</Text>
            </Pressable>
            {showAlliances && (
              alliances.length === 0
                ? <Text style={{ color: C.muted, fontSize: 12, paddingVertical: 8 }}>Aucune alliance. Tape sur un crew pour en proposer une.</Text>
                : alliances.map((a) => {
                    const isA = a.crew_a_id === myCrewId;
                    const ally = isA ? a.crew_b : a.crew_a;
                    const statusColor = a.status === "active" ? C.green : a.status === "pending" ? C.gold : C.muted;
                    const isPending = a.status === "pending" && !isA;
                    return (
                      <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 10,
                        backgroundColor: C.card, borderRadius: 10, padding: 10, marginBottom: 6,
                        borderWidth: 1, borderColor: statusColor + "30" }}>
                        <Text style={{ fontSize: 18 }}>{ally?.emoji ?? "🤝"}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontSize: 12, fontWeight: "700" }}>
                            [{ally?.tag ?? "?"}] {ally?.name ?? "Inconnu"}
                          </Text>
                          <Text style={{ color: statusColor, fontSize: 10 }}>
                            {a.status === "active" ? "Alliance active" : a.status === "pending" ? "En attente" : "Rompue"}
                          </Text>
                        </View>
                        {isPending && (
                          <Pressable onPress={() => void acceptAlliance(a.id).then(() => fetchAlliances(myCrewId).then(setAlliances))}
                            style={{ backgroundColor: C.green + "15", paddingHorizontal: 10, paddingVertical: 6,
                              borderRadius: 8, borderWidth: 1, borderColor: C.green + "40" }}>
                            <Text style={{ color: C.green, fontSize: 11, fontWeight: "800" }}>Accepter</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })
            )}
          </View>
        )}

        {/* Liste */}
        {tab === "players" ? (
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>TOP JOUEURS</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>
            {playerRanks.length === 0 ? (
              <Text style={{ color: C.muted, fontSize: 12, textAlign: "center", paddingVertical: 20 }}>
                Aucun joueur actif pour l'instant.
              </Text>
            ) : playerRanks.map((p, i) => (
              <View key={p.display_name} style={{ flexDirection: "row", alignItems: "center", gap: 12,
                backgroundColor: i < 3 ? C.gold + "08" : "transparent",
                borderRadius: 10, padding: 10, marginBottom: 6,
                borderWidth: i < 3 ? 1 : 0, borderColor: C.gold + "20" }}>
                <Text style={{ color: i === 0 ? C.gold : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : C.muted,
                  fontSize: i < 3 ? 16 : 13, fontWeight: "900", width: 24, textAlign: "center" }}>
                  {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                </Text>
                <Text style={{ fontSize: 20 }}>{p.avatar_emoji ?? "🧢"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: i < 3 ? "900" : "700" }}>
                    {p.display_name}
                  </Text>
                  {p.crew_tag && (
                    <Text style={{ color: p.crew_color ?? C.muted, fontSize: 10 }}>
                      [{p.crew_tag}]
                    </Text>
                  )}
                </View>
                <View style={{ backgroundColor: C.purple + "18", borderRadius: 6,
                  paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.purple + "30" }}>
                  <Text style={{ color: C.purple, fontSize: 11, fontWeight: "900" }}>NIV {p.level}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : loading ? (
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
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>TAG (3 LETTRES)</Text>
                  {tagStatus === "checking" && <Text style={{ color: C.muted, fontSize: 9 }}>…</Text>}
                  {tagStatus === "ok"       && <Text style={{ color: "#39FF14", fontSize: 9, fontWeight: "900" }}>✓ DISPO</Text>}
                  {tagStatus === "taken"    && <Text style={{ color: "#FF3B3B", fontSize: 9, fontWeight: "900" }}>✗ PRIS</Text>}
                </View>
                <TextInput
                  value={crewTag}
                  onChangeText={(t) => {
                    const val = t.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "");
                    setCrewTag(val);
                    setTagStatus(val.length >= 2 ? "checking" : "idle");
                    if (tagCheckTimer.current) clearTimeout(tagCheckTimer.current);
                    if (val.length >= 2) {
                      tagCheckTimer.current = setTimeout(async () => {
                        const ok = await isTagAvailable(val);
                        setTagStatus(ok ? "ok" : "taken");
                      }, 500);
                    }
                  }}
                  placeholder="BVK"
                  placeholderTextColor={C.muted}
                  autoCapitalize="characters"
                  style={{ backgroundColor: C.cardAlt, color: C.text, borderRadius: 10, padding: 12,
                    fontSize: 14, fontWeight: "900", textAlign: "center",
                    borderWidth: 1,
                    borderColor: tagStatus === "ok" ? "#39FF14" : tagStatus === "taken" ? "#FF3B3B" : C.border }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 }}>EMOJI</Text>
                <TextInput
                  value={crewEmoji} onChangeText={(t) => setCrewEmoji(t ? [...t].slice(-1)[0] ?? "🔥" : "🔥")}
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

      {/* Modal trésorerie */}
      <Modal visible={treasuryModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 24,
            borderWidth: 1, borderColor: C.gold + "40" }}>
            <Text style={{ color: C.gold, fontSize: 17, fontWeight: "900", textAlign: "center" }}>
              💰 Trésorerie du bastion
            </Text>
            <Text style={{ color: C.textSoft, fontSize: 12, textAlign: "center", marginTop: 6, marginBottom: 20 }}>
              Les BL déposés financent les récompenses des visiteurs qui entrent dans ta zone.
            </Text>

            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 }}>
              DÉPOSER (BL)
            </Text>
            <TextInput value={depositAmount} onChangeText={setDepositAmount}
              keyboardType="numeric" placeholderTextColor={C.muted}
              style={{ backgroundColor: C.cardAlt, color: C.text, borderRadius: 10, padding: 12,
                fontSize: 16, fontWeight: "900", marginBottom: 16,
                borderWidth: 1, borderColor: C.border, textAlign: "center" }} />

            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 }}>
              RÉCOMPENSE PAR VISITEUR (BL · 0 = désactivé)
            </Text>
            <TextInput value={rewardAmount} onChangeText={setRewardAmount}
              keyboardType="numeric" placeholderTextColor={C.muted}
              style={{ backgroundColor: C.cardAlt, color: C.text, borderRadius: 10, padding: 12,
                fontSize: 16, fontWeight: "900", marginBottom: 20,
                borderWidth: 1, borderColor: C.border, textAlign: "center" }} />

            <View style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 12,
              marginBottom: 20, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.textSoft, fontSize: 12, lineHeight: 18 }}>
                💡 Si un joueur entre dans ta zone bastion il verra la récompense et pourra check-in une fois par 24h.
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => setTreasuryModal(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.textSoft, fontWeight: "800" }}>Fermer</Text>
              </Pressable>
              <Pressable onPress={() => void handleDeposit()} disabled={depositing}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                  backgroundColor: C.gold + "20", borderWidth: 1, borderColor: C.gold + "50" }}>
                <Text style={{ color: C.gold, fontWeight: "900" }}>
                  {depositing ? "..." : "Déposer"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal poser bastion */}
      <Modal visible={bastionModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 24,
            borderWidth: 1, borderColor: C.gold + "40" }}>
            <Text style={{ color: C.gold, fontSize: 18, fontWeight: "900", textAlign: "center" }}>
              🏰 Poser le bastion
            </Text>
            <Text style={{ color: C.textSoft, fontSize: 12, textAlign: "center", marginTop: 8, marginBottom: 20, lineHeight: 18 }}>
              Ton QG permanent. Distance min {BASTION_MIN_DISTANCE_M}m de tout autre bastion.
              Génère XP + réputation chaque heure.
            </Text>

            <Text style={{ color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 }}>
              NOM DU BASTION
            </Text>
            <TextInput
              value={bastionName}
              onChangeText={setBastionName}
              placeholder="La Maison Mère..."
              placeholderTextColor={C.muted}
              style={{ backgroundColor: C.cardAlt, color: C.text, borderRadius: 10, padding: 12,
                fontSize: 14, fontWeight: "700", marginBottom: 20,
                borderWidth: 1, borderColor: C.border }}
            />

            <View style={{ backgroundColor: C.gold + "08", borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: C.gold + "20", marginBottom: 20, gap: 4 }}>
              <Text style={{ color: C.gold, fontSize: 11, fontWeight: "800" }}>📍 Position actuelle (GPS)</Text>
              <Text style={{ color: C.textSoft, fontSize: 11 }}>
                Le bastion sera posé à ta localisation GPS actuelle sur la map.
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => setBastionModal(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.textSoft, fontWeight: "800" }}>Annuler</Text>
              </Pressable>
              <Pressable onPress={() => void handleClaimBastion()} disabled={placingBastion}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                  backgroundColor: C.gold + "20", borderWidth: 1, borderColor: C.gold + "50" }}>
                <Text style={{ color: C.gold, fontWeight: "900" }}>
                  {placingBastion ? "..." : "🏰 Poser ici"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal transfer leader */}
      <Modal visible={transferModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 24,
            borderWidth: 1, borderColor: C.purple + "40" }}>
            <Text style={{ color: C.purple, fontSize: 17, fontWeight: "900", textAlign: "center", marginBottom: 6 }}>
              👑 Transfert de leadership
            </Text>
            <Text style={{ color: C.textSoft, fontSize: 12, textAlign: "center", marginBottom: 20 }}>
              Choisis un membre pour lui donner le rôle de leader.
            </Text>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {members.filter((m) => m.player_name !== playerName).map((m) => (
                <Pressable key={m.id} onPress={() => setTransferTarget(m.player_name)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
                    borderRadius: 10, marginBottom: 6,
                    backgroundColor: transferTarget === m.player_name ? C.purple + "20" : C.cardAlt,
                    borderWidth: 1,
                    borderColor: transferTarget === m.player_name ? C.purple + "60" : C.border }}>
                  <Text style={{ fontSize: 20 }}>{m.player_emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>{m.player_name}</Text>
                    <Text style={{ color: C.muted, fontSize: 10 }}>{m.role}</Text>
                  </View>
                  {transferTarget === m.player_name && (
                    <Text style={{ color: C.purple, fontSize: 16 }}>✓</Text>
                  )}
                </Pressable>
              ))}
              {members.filter((m) => m.player_name !== playerName).length === 0 && (
                <Text style={{ color: C.muted, fontSize: 13, textAlign: "center", paddingVertical: 20 }}>
                  Aucun autre membre dans le crew.
                </Text>
              )}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => { setTransferModal(false); setTransferTarget(null); }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.textSoft, fontWeight: "800" }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleTransfer()}
                disabled={!transferTarget || transferring}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
                  backgroundColor: transferTarget ? C.purple + "20" : C.cardAlt,
                  borderWidth: 1, borderColor: transferTarget ? C.purple + "50" : C.border }}>
                <Text style={{ color: transferTarget ? C.purple : C.muted, fontWeight: "900" }}>
                  {transferring ? "..." : "Confirmer"}
                </Text>
              </Pressable>
            </View>
          </View>
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
