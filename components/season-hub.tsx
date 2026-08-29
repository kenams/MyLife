"use client";

import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";

import {
  fetchActiveSeason, fetchDistricts, fetchMyDistrict, chooseDistrict,
  fetchActiveMissions, fetchMyParticipations, joinMission, validateMission, claimMissionReward,
  fetchMySeasonTotals, fetchMyBadges, fetchDistrictLeaderboard,
  fetchTodayChallenges, claimDailyChallenge, fetchMyActivity, setActivityVisibility,
  type SeasonMission, type District, type MissionParticipationStatus, type DailyChallenge, type ActivityEvent,
} from "@/lib/season";
import { requestAndGetLocation } from "@/lib/life-map";
import { joinFlashEvent, checkinFlashEvent } from "@/lib/flash-events";
import { MoveMissionModal } from "@/components/move-mission-modal";

const L = {
  bg:        "#080808",
  card:      "#111111",
  cardAlt:   "#181818",
  text:      "#F5F2E8",
  textSoft:  "#A8A49A",
  muted:     "#4A4844",
  border:    "rgba(255,255,255,0.07)",
  primary:   "#FFD600",
  primaryBg: "#1A1500",
  green:     "#39FF14",
  greenBg:   "#091A03",
  gold:      "#FFD600",
  goldBg:    "#1A1500",
  red:       "#FF3B3B",
  redBg:     "#1A0808",
  blue:      "#00B4FF",
  blueBg:    "#001A2A",
  pink:      "#FF2D78",
  pinkBg:    "#1A0818",
  purple:    "#BF5FFF",
  purpleBg:  "#18082A",
  teal:      "#00FFD1",
  tealBg:    "#001A14",
  orange:    "#FF6B00",
  orangeBg:  "#1A0D00",
};

// ─── Saison 1 — Toulouse s'éveille (missions IRL, distinct des missions
// quotidiennes du life-sim ci-dessus) ────────────────────────────────────────
const MISSION_CATEGORY_LABEL: Record<SeasonMission["category"], { label: string; emoji: string }> = {
  explore: { label: "Explorer", emoji: "🧭" },
  move:    { label: "Bouger",   emoji: "🚶" },
  social:  { label: "Social",   emoji: "🤝" },
};


const SEASON_XP_PER_LEVEL = 200;

function timeRemaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Terminée";
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}j restants`;
  const hours = Math.floor(ms / 3600000);
  return `${hours}h restantes`;
}

export function SeasonHub() {
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState("");
  const [seasonEndsAt, setSeasonEndsAt] = useState<string | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [myDistrictId, setMyDistrictId] = useState<string | null>(null);
  const [missions, setMissions] = useState<SeasonMission[]>([]);
  const [participations, setParticipations] = useState<Record<string, MissionParticipationStatus>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [seasonTotals, setSeasonTotals] = useState({ xp: 0, money: 0, reputation: 0 });
  const [myBadges, setMyBadges] = useState<{ code: string; name: string; icon: string }[]>([]);
  const [districtBoard, setDistrictBoard] = useState<{ district_name: string; xp: number; level: number }[]>([]);
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [claimingChallenge, setClaimingChallenge] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const season = await fetchActiveSeason();
    if (!season) { setLoading(false); return; }
    setSeasonId(season.id);
    setSeasonName(season.name);
    setSeasonEndsAt(season.ends_at);
    const [ds, myD, ms, parts, totals, badges, board, todayChallenges, myActivity] = await Promise.all([
      fetchDistricts(), fetchMyDistrict(), fetchActiveMissions(season.id), fetchMyParticipations(),
      fetchMySeasonTotals(), fetchMyBadges(), fetchDistrictLeaderboard(season.id), fetchTodayChallenges(),
      fetchMyActivity(),
    ]);
    setDistricts(ds);
    setMyDistrictId(myD?.district_id ?? null);
    setMissions(ms);
    setParticipations(parts);
    setSeasonTotals(totals);
    setMyBadges(badges);
    setDistrictBoard(board);
    setChallenges(todayChallenges);
    setActivity(myActivity);
    setLoading(false);
  }

  async function handleToggleVisibility(ev: ActivityEvent) {
    const next: ActivityEvent["visibility"] = ev.visibility === "private" ? "public" : "private";
    const ok = await setActivityVisibility(ev.id, next);
    if (ok) setActivity((evs) => evs.map((e) => e.id === ev.id ? { ...e, visibility: next } : e));
  }

  async function handleClaimChallenge(code: string) {
    setClaimingChallenge(code); setError(null);
    const res = await claimDailyChallenge(code);
    if (res.ok) {
      setChallenges((cs) => cs.map((c) => c.template_code === code ? { ...c, claimed_at: new Date().toISOString() } : c));
      setSeasonTotals((t) => ({ ...t, xp: t.xp + (res.xp ?? 0), money: t.money + (res.money ?? 0) }));
    } else setError(res.error ?? "Erreur");
    setClaimingChallenge(null);
  }

  useEffect(() => { refresh(); }, []);

  async function handleChooseDistrict(id: string) {
    const res = await chooseDistrict(id);
    if (res.ok) { setMyDistrictId(id); setShowDistrictPicker(false); refresh(); }
    else setError(res.error ?? "Erreur");
  }

  async function handleJoin(missionId: string) {
    setBusyId(missionId); setError(null);
    const res = await joinMission(missionId);
    if (res.ok) setParticipations((p) => ({ ...p, [missionId]: "joined" }));
    else setError(res.error ?? "Erreur");
    setBusyId(null);
  }

  const [moveModalMission, setMoveModalMission] = useState<SeasonMission | null>(null);

  async function handleValidate(mission: SeasonMission) {
    setError(null);
    if (mission.category === "move") {
      // Écran dédié : session serveur (start/checkpoint/finish), jamais de
      // distance simulée côté client.
      setMoveModalMission(mission);
      return;
    }
    setBusyId(mission.id);
    if (mission.category === "social") {
      // Réutilise le flux event déjà durci (join + check-in géo-vérifié)
      // plutôt que de dupliquer une logique de présence.
      if (mission.linked_event_id) {
        await joinFlashEvent(mission.linked_event_id);
        const loc = await requestAndGetLocation();
        if (!loc) { setError("Position GPS requise pour le check-in"); setBusyId(null); return; }
        const checkin = await checkinFlashEvent(mission.linked_event_id, loc.lat, loc.lng);
        if (!checkin.ok) { setError(checkin.error ?? "Check-in impossible"); setBusyId(null); return; }
      }
      const res = await validateMission(mission.id);
      if (res.ok) setParticipations((p) => ({ ...p, [mission.id]: "validated" }));
      else setError(res.error ?? "Erreur");
      setBusyId(null);
      return;
    }
    const loc = await requestAndGetLocation();
    if (!loc) { setError("Position GPS requise pour valider"); setBusyId(null); return; }
    const res = await validateMission(mission.id, loc.lat, loc.lng);
    if (res.ok) setParticipations((p) => ({ ...p, [mission.id]: "validated" }));
    else setError(res.error ?? "Erreur");
    setBusyId(null);
  }

  async function handleClaim(missionId: string) {
    setBusyId(missionId); setError(null);
    const res = await claimMissionReward(missionId);
    if (res.ok) {
      setParticipations((p) => ({ ...p, [missionId]: "rewarded" }));
      setError(null);
    } else setError(res.error ?? "Erreur");
    setBusyId(null);
  }

  if (loading) {
    return (
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 24, alignItems: "center" }}>
          <Text style={{ color: L.muted, fontSize: 12 }}>Chargement de la saison...</Text>
        </View>
      </View>
    );
  }
  if (!seasonId) {
    return (
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 20, alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 24 }}>🌆</Text>
          <Text style={{ color: L.text, fontSize: 13, fontWeight: "800" }}>Aucune saison active</Text>
          <Text style={{ color: L.muted, fontSize: 11, textAlign: "center" }}>Reviens bientôt — la prochaine saison arrive.</Text>
        </View>
      </View>
    );
  }
  const myDistrict = districts.find((d) => d.id === myDistrictId);
  const seasonEnded = seasonEndsAt ? new Date(seasonEndsAt) < new Date() : false;

  // Action principale : une seule recommandation, priorisée par étape la
  // plus proche de la récompense (à réclamer > à continuer > à rejoindre).
  const claimable = missions.find((m) => participations[m.id] === "validated");
  const inProgress = missions.find((m) => {
    const s = participations[m.id]; return s === "joined" || s === "in_progress";
  });
  const availableNow = missions.find((m) => !participations[m.id] && new Date(m.ends_at) > new Date());
  const primaryMission = claimable ?? inProgress ?? availableNow ?? null;
  const primaryLabel = claimable ? "Réclamer ta récompense" : inProgress ? "Continuer" : "Rejoindre maintenant";

  const seasonLevel = Math.max(1, Math.floor(seasonTotals.xp / SEASON_XP_PER_LEVEL) + 1);
  const xpInLevel = seasonTotals.xp % SEASON_XP_PER_LEVEL;

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 16, gap: 10 }}>
      {/* ── EN-TÊTE ── */}
      <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: L.primary + "25" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: L.primary, fontSize: 14, fontWeight: "900" }}>🌆 Toulouse s'éveille</Text>
          <Text style={{ color: seasonEnded ? L.red : L.muted, fontSize: 11, fontWeight: "700" }}>
            Saison 1 · {seasonEndsAt ? timeRemaining(seasonEndsAt) : ""}
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
          <Text style={{ color: L.text, fontSize: 12 }}>Niv. {seasonLevel} · {xpInLevel}/{SEASON_XP_PER_LEVEL} XP</Text>
          <Text style={{ color: L.gold, fontSize: 12 }}>{seasonTotals.money} BL</Text>
          <Text style={{ color: L.blue, fontSize: 12 }}>{seasonTotals.reputation} rép</Text>
        </View>
        <Pressable onPress={() => setShowDistrictPicker((s) => !s)}>
          <Text style={{ color: L.textSoft, fontSize: 12 }}>
            📍 {myDistrict ? `${myDistrict.emoji} ${myDistrict.name}` : "Choisir un quartier"}
          </Text>
        </Pressable>

        {showDistrictPicker && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {districts.map((d) => (
              <Pressable key={d.id} onPress={() => handleChooseDistrict(d.id)}
                style={{ backgroundColor: d.id === myDistrictId ? L.primaryBg : L.cardAlt, borderRadius: 12,
                  paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
                  borderWidth: 1, borderColor: d.id === myDistrictId ? L.primary + "50" : L.border }}>
                <Text style={{ color: L.text, fontSize: 12 }}>{d.emoji} {d.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

      </View>

      {/* ── ACTION PRINCIPALE ── */}
      {primaryMission && (
        <View style={{ backgroundColor: L.primaryBg, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: L.primary + "40" }}>
          <Text style={{ color: L.primary, fontSize: 10, fontWeight: "800", marginBottom: 4 }}>MAINTENANT</Text>
          <Text style={{ color: L.text, fontSize: 14, fontWeight: "800" }}>{primaryMission.title}</Text>
          <Text style={{ color: L.muted, fontSize: 11, marginTop: 2, marginBottom: 10 }}>
            +{primaryMission.reward_xp} XP · +{primaryMission.reward_money} BL
          </Text>
          <Pressable
            onPress={() => {
              const status = participations[primaryMission.id];
              if (!status) handleJoin(primaryMission.id);
              else handleValidate(primaryMission);
            }}
            style={{ backgroundColor: L.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: "#04040A", fontWeight: "900", fontSize: 13 }}>{primaryLabel}</Text>
          </Pressable>
        </View>
      )}
      {!primaryMission && seasonEnded && (
        <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 16, alignItems: "center" }}>
          <Text style={{ color: L.muted, fontSize: 12 }}>La saison est terminée — les résultats restent visibles ci-dessous.</Text>
        </View>
      )}
      {!primaryMission && !seasonEnded && missions.length === 0 && (
        <View style={{ backgroundColor: L.card, borderRadius: 18, padding: 16, alignItems: "center" }}>
          <Text style={{ color: L.muted, fontSize: 12 }}>Aucune mission proche pour le moment — reviens plus tard.</Text>
        </View>
      )}

      {/* ── DÉFIS DU JOUR ── */}
      {challenges.length > 0 && (
        <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: L.border }}>
          <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 10 }}>DÉFIS DU JOUR</Text>
          {challenges.map((c) => {
            const done = !!c.completed_at;
            const claimed = !!c.claimed_at;
            const busy = claimingChallenge === c.template_code;
            return (
              <View key={c.template_code} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingVertical: 8, borderTopWidth: 1, borderTopColor: L.border }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: L.text, fontSize: 12, fontWeight: "700" }}>{c.title}</Text>
                  <Text style={{ color: L.muted, fontSize: 10, marginTop: 1 }}>
                    {claimed ? "Récompense reçue" : `${c.progress_count}/${c.target_count} · +${c.reward_xp} XP · +${c.reward_money} BL`}
                  </Text>
                </View>
                {claimed && <Text style={{ color: L.green, fontSize: 11, fontWeight: "800" }}>✓</Text>}
                {!claimed && done && (
                  <Pressable disabled={busy} onPress={() => handleClaimChallenge(c.template_code)}
                    style={{ backgroundColor: L.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ color: "#04040A", fontSize: 11, fontWeight: "900" }}>{busy ? "..." : "Réclamer"}</Text>
                  </Pressable>
                )}
                {!claimed && !done && (
                  <Text style={{ color: L.muted, fontSize: 10 }}>En cours</Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── MISSIONS ── */}
      <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: L.border }}>
        <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 10 }}>MISSIONS</Text>
        {missions.length === 0 && (
          <Text style={{ color: L.muted, fontSize: 12 }}>Aucune mission active pour le moment.</Text>
        )}

        {missions.map((m) => {
          const status = participations[m.id];
          const cat = MISSION_CATEGORY_LABEL[m.category];
          const busy = busyId === m.id;
          return (
            <View key={m.id} style={{ backgroundColor: L.cardAlt, borderRadius: 14, padding: 12, marginBottom: 8,
              borderWidth: 1, borderColor: L.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                <Text style={{ color: L.text, fontSize: 13, fontWeight: "800", flex: 1 }}>{m.title}</Text>
                <Text style={{ color: L.muted, fontSize: 10 }}>{cat.label}</Text>
              </View>
              <Text style={{ color: L.textSoft, fontSize: 11, marginBottom: 8 }} numberOfLines={2}>{m.description}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: L.gold, fontSize: 11, fontWeight: "700" }}>
                  +{m.reward_xp} XP · +{m.reward_money} BL · +{m.reward_reputation} rép
                </Text>
                {!status && (
                  <Pressable disabled={busy} onPress={() => handleJoin(m.id)}
                    style={{ backgroundColor: L.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ color: "#04040A", fontSize: 11, fontWeight: "900" }}>{busy ? "..." : "Rejoindre"}</Text>
                  </Pressable>
                )}
                {(status === "joined" || status === "in_progress") && (
                  <Pressable disabled={busy} onPress={() => handleValidate(m)}
                    style={{ backgroundColor: L.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>{busy ? "..." : "Valider"}</Text>
                  </Pressable>
                )}
                {status === "validated" && (
                  <Pressable disabled={busy} onPress={() => handleClaim(m.id)}
                    style={{ backgroundColor: L.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ color: "#04040A", fontSize: 11, fontWeight: "900" }}>{busy ? "..." : "Réclamer"}</Text>
                  </Pressable>
                )}
                {status === "rewarded" && (
                  <Text style={{ color: L.green, fontSize: 11, fontWeight: "800" }}>✓ Récompensée</Text>
                )}
              </View>
            </View>
          );
        })}

        {error && <Text style={{ color: L.red, fontSize: 11, marginTop: 4 }}>{error}</Text>}
      </View>

      {/* ── BADGES ── */}
      {myBadges.length > 0 && (
        <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: L.border }}>
          <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 10 }}>BADGES</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {myBadges.map((b) => (
              <View key={b.code} style={{ backgroundColor: L.cardAlt, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
                flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: L.border }}>
                <Text style={{ fontSize: 14 }}>{b.icon}</Text>
                <Text style={{ color: L.text, fontSize: 11, fontWeight: "700" }}>{b.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── PROGRESSION DES QUARTIERS ── */}
      {districtBoard.length > 0 && (
        <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: L.border }}>
          <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 10 }}>PROGRESSION DES QUARTIERS</Text>
          {districtBoard.slice(0, 5).map((d, i) => (
            <View key={d.district_name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              paddingVertical: 6, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: L.border }}>
              <Text style={{ color: myDistrict?.name === d.district_name ? L.primary : L.text, fontSize: 12, fontWeight: "700" }}>
                {i + 1}. {d.district_name}
              </Text>
              <Text style={{ color: L.muted, fontSize: 11 }}>Niv. {d.level} · {d.xp} XP</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── ACTIVITÉ RÉCENTE ── */}
      {activity.length > 0 && (
        <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: L.border }}>
          <Text style={{ color: L.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 10 }}>ACTIVITÉ RÉCENTE</Text>
          {activity.map((ev, i) => (
            <View key={ev.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: L.border }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: L.text, fontSize: 12, fontWeight: "700" }}>{ev.title}</Text>
                {ev.body && <Text style={{ color: L.muted, fontSize: 10, marginTop: 1 }}>{ev.body}</Text>}
              </View>
              <Pressable onPress={() => handleToggleVisibility(ev)}
                style={{ backgroundColor: L.cardAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: L.muted, fontSize: 9, fontWeight: "700" }}>
                  {ev.visibility === "private" ? "🔒 Privé" : "🌐 Public"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {moveModalMission && (
        <MoveMissionModal
          mission={moveModalMission}
          onClose={() => setMoveModalMission(null)}
          onClaimed={() => {
            setParticipations((p) => ({ ...p, [moveModalMission.id]: "rewarded" }));
            setMoveModalMission(null);
          }}
        />
      )}
    </View>
  );
}
