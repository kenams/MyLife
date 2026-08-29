"use client";

/**
 * Territory War — écran live (spec §7). 3 manches de 60 s pilotées serveur :
 * Influence Rush · Challenge Toulouse · Crew Sync. Score et anti-cheat sont
 * calculés côté serveur ; cet écran affiche et envoie les actions.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGameStore } from "@/stores/game-store";
import { getMyCrewId } from "@/lib/crews";
import {
  fetchBattle,
  fetchBattleParticipants,
  joinBattle,
  tickBattle,
  battleTap,
  battleSubmitQuiz,
  battleSyncHit,
  subscribeBattle,
  type TerritoryBattle,
  type BattleParticipant,
} from "@/lib/territory-wars";
import { liveScore } from "@/lib/battle-score";
import { pickQuiz } from "@/lib/battle-quiz";
import { wory } from "@/lib/branding";
import { hapticImpact, hapticSuccess } from "@/lib/safe-haptics";

const C = {
  bg: "#080808",
  card: "#111111",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  muted: "#4A4844",
  gold: "#FFD600",
  green: "#39FF14",
  red: "#FF3B3B",
  blue: "#00B4FF",
};

function mmss(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function BattleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const battleId = String(id);
  const avatar = useGameStore((s) => s.avatar);
  const playerName = avatar?.displayName ?? "Joueur";

  const [loading, setLoading] = useState(true);
  const [battle, setBattle] = useState<TerritoryBattle | null>(null);
  const [participants, setParticipants] = useState<BattleParticipant[]>([]);
  const [myCrew, setMyCrew] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [taps, setTaps] = useState(0);

  const load = useCallback(async () => {
    const [b, p] = await Promise.all([fetchBattle(battleId), fetchBattleParticipants(battleId)]);
    setBattle(b);
    setParticipants(p);
    setLoading(false);
  }, [battleId]);

  useEffect(() => {
    getMyCrewId(playerName).then(setMyCrew);
  }, [playerName]);

  useEffect(() => {
    load();
    const unsub = subscribeBattle(battleId, load);
    const clock = setInterval(() => setNow(Date.now()), 250);
    const ticker = setInterval(() => {
      tickBattle(battleId).then((b) => b && setBattle(b));
    }, 3000);
    return () => {
      unsub();
      clearInterval(clock);
      clearInterval(ticker);
    };
  }, [battleId, load]);

  useEffect(() => {
    if (myCrew && participants.some((p) => p.crew_id === myCrew && p.user_id)) {
      // best-effort : présence détectée
    }
  }, [participants, myCrew]);

  const mine = participants.find((p) => p.crew_id === myCrew);
  const isParticipant = joined || !!mine;

  async function onJoin() {
    const ok = await joinBattle(battleId);
    if (ok) {
      hapticSuccess();
      setJoined(true);
      load();
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  if (!battle) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", gap: 12 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: C.text, fontWeight: "800" }}>Battle introuvable.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: C.gold, fontWeight: "900" }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const attCount = participants.filter((p) => p.crew_id === battle.attacker_crew).length;
  const defCount = participants.filter((p) => p.crew_id === battle.defender_crew).length;
  const score = liveScore(participants, battle.attacker_crew, battle.defender_crew);
  const attColor = battle.attacker_color ?? C.blue;
  const defColor = battle.defender_color ?? C.red;
  const roundEndsIn = battle.round_started_at
    ? new Date(battle.round_started_at).getTime() + 60_000 - now
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          paddingTop: 52,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View>
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>
            BATAILLE POUR {battle.district_name.toUpperCase()}
          </Text>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: "900" }}>
            {battle.attacker_emoji ?? "⚔️"} {battle.attacker_tag ?? "?"} vs{" "}
            {battle.defender_emoji ?? "🏳️"} {battle.defender_tag ?? "neutre"}
          </Text>
        </View>
      </View>

      {/* Barre de score live */}
      {battle.status !== "scheduled" && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden" }}>
            <View style={{ width: `${score.attackerPct}%`, backgroundColor: attColor }} />
            <View style={{ flex: 1, backgroundColor: defColor }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={{ color: attColor, fontSize: 12, fontWeight: "900" }}>
              {battle.attacker_tag} {score.attackerPct.toFixed(1)} %
            </Text>
            <Text style={{ color: defColor, fontSize: 12, fontWeight: "900" }}>
              {score.defenderPct.toFixed(1)} % {battle.defender_tag ?? "neutre"}
            </Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {battle.status === "scheduled" && (
          <Lobby
            battle={battle}
            now={now}
            attCount={attCount}
            defCount={defCount}
            canJoin={!!myCrew && [battle.attacker_crew, battle.defender_crew].includes(myCrew)}
            isParticipant={isParticipant}
            onJoin={onJoin}
          />
        )}

        {battle.status === "live" && !isParticipant && (
          <Text style={{ color: C.textSoft, textAlign: "center", marginTop: 30 }}>
            La Battle est en cours. Ton crew n'y participe pas.
          </Text>
        )}

        {battle.status === "live" && isParticipant && (
          <View>
            <Text style={{ color: C.gold, fontSize: 11, fontWeight: "900", letterSpacing: 2, textAlign: "center" }}>
              MANCHE {battle.current_round}/3 · {mmss(roundEndsIn)}
            </Text>
            {battle.current_round === 1 && (
              <RoundInfluence
                battleId={battleId}
                taps={mine?.r1_taps ?? taps}
                onTap={async () => {
                  hapticImpact("light");
                  const n = await battleTap(battleId);
                  if (n != null) setTaps(n);
                }}
              />
            )}
            {battle.current_round === 2 && (
              <RoundQuiz battleId={battleId} seed={battle.id} done={(mine?.r2_score ?? 0) > 0} />
            )}
            {battle.current_round === 3 && (
              <RoundSync
                battleId={battleId}
                now={now}
                hits={mine?.r3_hits ?? 0}
                onHit={async () => {
                  hapticSuccess();
                  await battleSyncHit(battleId);
                }}
              />
            )}
          </View>
        )}

        {battle.status === "resolved" && <Result battle={battle} myCrew={myCrew} />}
      </ScrollView>
    </View>
  );
}

function Lobby({
  battle,
  now,
  attCount,
  defCount,
  canJoin,
  isParticipant,
  onJoin,
}: {
  battle: TerritoryBattle;
  now: number;
  attCount: number;
  defCount: number;
  canJoin: boolean;
  isParticipant: boolean;
  onJoin: () => void;
}) {
  const startsIn = new Date(battle.scheduled_at).getTime() - now;
  return (
    <View style={{ alignItems: "center", gap: 14, marginTop: 10 }}>
      <Text style={{ color: C.textSoft, fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>LIVE DANS</Text>
      <Text style={{ color: C.gold, fontSize: 44, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
        {startsIn > 0 ? mmss(startsIn) : "00:00"}
      </Text>
      <View style={{ flexDirection: "row", gap: 24, marginTop: 4 }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: battle.attacker_color ?? C.blue, fontSize: 20, fontWeight: "900" }}>{attCount}</Text>
          <Text style={{ color: C.textSoft, fontSize: 11 }}>{battle.attacker_tag} prêts</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: battle.defender_color ?? C.red, fontSize: 20, fontWeight: "900" }}>{defCount}</Text>
          <Text style={{ color: C.textSoft, fontSize: 11 }}>{battle.defender_tag ?? "neutre"} prêts</Text>
        </View>
      </View>

      {canJoin ? (
        isParticipant ? (
          <Text style={{ color: C.green, fontWeight: "900", marginTop: 10 }}>✓ Tu es prêt. Reste connecté.</Text>
        ) : (
          <Pressable
            onPress={onJoin}
            style={{ marginTop: 10, backgroundColor: C.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 }}
          >
            <Text style={{ color: "#080808", fontWeight: "900", fontSize: 15 }}>JE SUIS PRÊT</Text>
          </Pressable>
        )
      ) : (
        <Text style={{ color: C.textSoft, fontSize: 12, marginTop: 10, textAlign: "center" }}>
          Seuls les membres des deux crews peuvent participer.
        </Text>
      )}
    </View>
  );
}

function RoundInfluence({ battleId, taps, onTap }: { battleId: string; taps: number; onTap: () => void }) {
  return (
    <View style={{ alignItems: "center", marginTop: 24, gap: 16 }}>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: "900" }}>⚡ POUSSER L'INFLUENCE</Text>
      <Text style={{ color: C.textSoft, fontSize: 12.5, textAlign: "center" }}>
        Tape aussi vite que tu peux — mais chaque tap compte vraiment (plafond serveur).
      </Text>
      <Pressable
        onPress={onTap}
        style={{
          width: 190,
          height: 190,
          borderRadius: 95,
          backgroundColor: C.gold,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#080808", fontSize: 40, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{taps}</Text>
        <Text style={{ color: "#080808", fontSize: 11, fontWeight: "800" }}>/ 60</Text>
      </Pressable>
    </View>
  );
}

function RoundQuiz({ battleId, seed, done }: { battleId: string; seed: string; done: boolean }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(done);
  const quiz = pickQuiz(seed, 3);

  async function submit() {
    const correct = quiz.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
    await battleSubmitQuiz(battleId, correct);
    hapticSuccess();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Text style={{ color: C.green, fontWeight: "900", textAlign: "center", marginTop: 24 }}>
        ✓ Réponses envoyées. On attend la manche suivante.
      </Text>
    );
  }

  return (
    <View style={{ marginTop: 18, gap: 16 }}>
      <Text style={{ color: C.text, fontSize: 15, fontWeight: "900", textAlign: "center" }}>🧠 CHALLENGE TOULOUSE</Text>
      {quiz.map((q, i) => (
        <View key={i} style={{ backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontSize: 13.5, fontWeight: "800", marginBottom: 8 }}>{q.q}</Text>
          {q.choices.map((c, j) => {
            const sel = answers[i] === j;
            return (
              <Pressable
                key={j}
                onPress={() => setAnswers((a) => ({ ...a, [i]: j }))}
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  marginTop: 6,
                  backgroundColor: sel ? C.gold + "22" : "#181818",
                  borderWidth: 1,
                  borderColor: sel ? C.gold + "66" : "transparent",
                }}
              >
                <Text style={{ color: sel ? C.gold : C.textSoft, fontSize: 12.5, fontWeight: "700" }}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Pressable
        onPress={submit}
        disabled={Object.keys(answers).length < quiz.length}
        style={{
          backgroundColor: C.gold,
          borderRadius: 12,
          paddingVertical: 13,
          alignItems: "center",
          opacity: Object.keys(answers).length < quiz.length ? 0.5 : 1,
        }}
      >
        <Text style={{ color: "#080808", fontWeight: "900", fontSize: 13.5 }}>Valider mes réponses</Text>
      </Pressable>
    </View>
  );
}

function RoundSync({
  battleId,
  now,
  hits,
  onHit,
}: {
  battleId: string;
  now: number;
  hits: number;
  onHit: () => void;
}) {
  // Fenêtre commune : GO pendant 1.2 s toutes les 4 s, calée sur l'horloge.
  const cycle = now % 4000;
  const isGo = cycle >= 2800;
  const countdown = isGo ? "GO" : String(3 - Math.floor(cycle / 933));

  return (
    <View style={{ alignItems: "center", marginTop: 24, gap: 16 }}>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: "900" }}>🤝 CREW SYNC</Text>
      <Text style={{ color: C.textSoft, fontSize: 12.5, textAlign: "center" }}>
        Tape TOUS ensemble au moment du GO. Plus vous êtes synchro, plus le score monte.
      </Text>
      <Pressable
        onPress={() => isGo && onHit()}
        style={{
          width: 190,
          height: 190,
          borderRadius: 95,
          backgroundColor: isGo ? C.green : C.card,
          borderWidth: 2,
          borderColor: isGo ? C.green : C.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: isGo ? "#080808" : C.textSoft, fontSize: 40, fontWeight: "900" }}>{countdown}</Text>
      </Pressable>
      <Text style={{ color: C.green, fontWeight: "900" }}>{hits} sync réussies</Text>
    </View>
  );
}

function Result({ battle, myCrew }: { battle: TerritoryBattle; myCrew: string | null }) {
  const won = myCrew && battle.winner_crew === myCrew;
  const winnerTag = battle.winner_crew === battle.attacker_crew ? battle.attacker_tag : battle.defender_tag;
  const winnerEmoji = battle.winner_crew === battle.attacker_crew ? battle.attacker_emoji : battle.defender_emoji;
  return (
    <View style={{ alignItems: "center", gap: 12, marginTop: 20 }}>
      <Text style={{ fontSize: 40 }}>{won ? "👑" : "🏁"}</Text>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: "900", textAlign: "center" }}>
        {battle.district_name.toUpperCase()} EST {winnerEmoji ?? ""} AUX {winnerTag ?? "?"}
      </Text>
      <Text style={{ color: C.textSoft, fontSize: 14, fontWeight: "800" }}>
        {battle.attacker_pct?.toFixed(1)} % / {battle.defender_pct?.toFixed(1)} %
      </Text>
      {myCrew && [battle.attacker_crew, battle.defender_crew].includes(myCrew) && (
        <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border, marginTop: 6 }}>
          <Text style={{ color: won ? C.green : C.textSoft, fontWeight: "900", fontSize: 13 }}>
            {won ? `+${wory(250)} · +40 réputation · territoire pris` : `+${wory(60)} pour avoir défendu ton crew`}
          </Text>
        </View>
      )}
      <Pressable onPress={() => router.replace("/(app)/territories")} style={{ marginTop: 10 }}>
        <Text style={{ color: C.gold, fontWeight: "900" }}>Voir les territoires →</Text>
      </Pressable>
    </View>
  );
}
