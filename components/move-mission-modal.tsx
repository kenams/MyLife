import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import {
  startMoveSession, reportMoveCheckpoint, finishMoveSession, abandonMoveSession,
  validateMission, claimMissionReward,
  type SeasonMission, type MoveSession,
} from "@/lib/season";

const L = {
  card: "#111111", cardAlt: "#181818", text: "#F5F2E8", textSoft: "#A8A49A",
  muted: "#4A4844", primary: "#FFD600", green: "#39FF14", red: "#FF3B3B", redBg: "#1A0808",
};

type MoveModalState =
  | "ready" | "gps-permission" | "in-progress" | "objective-reached" | "claimed" | "failed";

/** Modal Bouger complet — session serveur (start/checkpoint/finish), jamais
 * de distance simulée côté client. Partagé entre l'écran Objectifs et la
 * Life Map pour ne jamais dupliquer cette logique sensible anti-triche. */
export function MoveMissionModal({ mission, onClose, onClaimed }: {
  mission: SeasonMission; onClose: () => void; onClaimed: () => void;
}) {
  const [state, setState] = useState<MoveModalState>("ready");
  const [session, setSession] = useState<MoveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedS, setElapsedS] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const target = (mission.conditions as { target_distance_m?: number })?.target_distance_m ?? 500;

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state !== "in-progress") return;
    const t = setInterval(() => setElapsedS(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [state]);

  async function handleStart() {
    setState("gps-permission");
    setError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Géolocalisation indisponible sur cet appareil");
      setState("failed");
      return;
    }
    const res = await startMoveSession(mission.id);
    if (!res.ok || !res.session) {
      setError(res.error ?? "Impossible de démarrer la session");
      setState("failed");
      return;
    }
    setSession(res.session);
    startedAtRef.current = Date.now();
    setState("in-progress");

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const check = await reportMoveCheckpoint(res.session!.id, pos.coords.latitude, pos.coords.longitude);
        if (check.ok && check.session) {
          setSession(check.session);
          if (check.session.distance_m >= target) {
            if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
            setState("objective-reached");
          }
        }
      },
      () => { setError("Permission GPS refusée ou position indisponible"); setState("failed"); },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }

  async function handleFinishAndValidate() {
    if (!session) return;
    const fin = await finishMoveSession(session.id);
    if (!fin.ok) { setError(fin.error ?? "Erreur"); return; }
    const val = await validateMission(mission.id);
    if (!val.ok) { setError(val.error ?? "Erreur de validation"); return; }
    const claim = await claimMissionReward(mission.id);
    if (!claim.ok) { setError(claim.error ?? "Erreur de réclamation"); return; }
    setState("claimed");
    onClaimed();
  }

  async function handleAbandon() {
    if (watchIdRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchIdRef.current);
    if (session) await abandonMoveSession(session.id);
    onClose();
  }

  const pct = Math.min(100, Math.round(((session?.distance_m ?? 0) / target) * 100));

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} onPress={state === "ready" || state === "failed" ? onClose : undefined} />
      <View style={{ backgroundColor: L.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 }}>
        <Text style={{ color: L.text, fontSize: 16, fontWeight: "900" }}>🚶 {mission.title}</Text>
        <Text style={{ color: L.textSoft, fontSize: 12 }}>{mission.description}</Text>

        <View style={{ backgroundColor: L.cardAlt, borderRadius: 10, padding: 10 }}>
          <Text style={{ color: L.muted, fontSize: 10 }}>
            🔒 Confidentialité : aucun trajet détaillé n'est conservé. Seule la distance parcourue et ta position
            actuelle sont utilisées pendant la mission, puis effacées à la fin. Garde cet écran ouvert : le
            navigateur ne suit pas ta position en arrière-plan de façon fiable.
          </Text>
        </View>

        {state === "ready" && (
          <>
            <Text style={{ color: L.primary, fontSize: 12 }}>Objectif : {target} m à parcourir</Text>
            <Text style={{ color: L.primary, fontSize: 12 }}>
              Récompense : +{mission.reward_xp} XP · +{mission.reward_money} BL · +{mission.reward_reputation} rép
            </Text>
            <Pressable onPress={handleStart} style={{ backgroundColor: L.primary, borderRadius: 14, padding: 14, alignItems: "center" }}>
              <Text style={{ color: "#04040A", fontWeight: "900" }}>Démarrer</Text>
            </Pressable>
          </>
        )}

        {state === "gps-permission" && (
          <Text style={{ color: L.textSoft, fontSize: 13 }}>Demande de permission GPS en cours...</Text>
        )}

        {(state === "in-progress" || state === "objective-reached") && (
          <>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: L.cardAlt, overflow: "hidden" }}>
              <View style={{ height: 10, width: `${pct}%` as `${number}%`, backgroundColor: L.green }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: L.text, fontSize: 12 }}>{Math.round(session?.distance_m ?? 0)} m / {target} m</Text>
              <Text style={{ color: L.muted, fontSize: 12 }}>{elapsedS}s · GPS actif</Text>
            </View>
            {state === "in-progress" && (
              <Pressable onPress={handleAbandon} style={{ backgroundColor: L.redBg, borderRadius: 14, padding: 12, alignItems: "center" }}>
                <Text style={{ color: L.red, fontWeight: "800" }}>Abandonner</Text>
              </Pressable>
            )}
            {state === "objective-reached" && (
              <Pressable onPress={handleFinishAndValidate} style={{ backgroundColor: L.green, borderRadius: 14, padding: 14, alignItems: "center" }}>
                <Text style={{ color: "#04040A", fontWeight: "900" }}>🎯 Objectif atteint — Terminer et réclamer</Text>
              </Pressable>
            )}
          </>
        )}

        {state === "claimed" && (
          <>
            <Text style={{ color: L.green, fontSize: 14, fontWeight: "900" }}>✓ Récompense obtenue !</Text>
            <Pressable onPress={onClose} style={{ backgroundColor: L.cardAlt, borderRadius: 14, padding: 12, alignItems: "center" }}>
              <Text style={{ color: L.text, fontWeight: "800" }}>Fermer</Text>
            </Pressable>
          </>
        )}

        {state === "failed" && (
          <>
            <Text style={{ color: L.red, fontSize: 13 }}>{error ?? "Échec — réessaie."}</Text>
            <Pressable onPress={onClose} style={{ backgroundColor: L.cardAlt, borderRadius: 14, padding: 12, alignItems: "center" }}>
              <Text style={{ color: L.text, fontWeight: "800" }}>Fermer</Text>
            </Pressable>
          </>
        )}

        {error && state !== "failed" && <Text style={{ color: L.red, fontSize: 11 }}>{error}</Text>}
      </View>
    </Modal>
  );
}
