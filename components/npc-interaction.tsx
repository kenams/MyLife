"use client";

// Interaction avec un habitant simulé — logique 100 % partagée web/native
// (lib/npc-social + lib/npc-engine + lib/npc-chat). Aucune action réservée
// aux humains n'est proposée ici. L'IA générative reste un bonus facultatif
// côté chat complet (web), jamais requise.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import type { MapPlayer } from "@/lib/life-map";
import {
  resolveNpcApproach,
  resolveOutingProposal,
  districtLine,
  type NpcApproachContext,
  type NpcApproachResult,
  type NpcQuickAction,
} from "@/lib/npc-social";
import {
  loadNpcRelationship,
  noteNpcEncounter,
  npcEncounterCoolingDown,
} from "@/lib/npc-engine";
import { sendNpcMessageLocal } from "@/lib/npc-chat";

type Palette = { surface: string; border: string; text: string; muted: string; accent: string };

export function NpcInteraction({
  player,
  playerId,
  hour = new Date().getHours(),
  nearbyOpportunity,
  palette,
  onFeedback,
  onNavigate,
  onClose,
  onOpenFullChat,
}: {
  player: MapPlayer;
  playerId: string;
  hour?: number;
  nearbyOpportunity?: { label: string; route: string } | null;
  palette: Palette;
  onFeedback: (text: string) => void;
  onNavigate: (route: string) => void;
  onClose: () => void;
  onOpenFullChat?: (opener: string) => void;
}) {
  const [approach, setApproach] = useState<NpcApproachResult | null>(null);
  const [thread, setThread] = useState<{ role: "me" | "npc"; text: string }[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [busyTalk, setBusyTalk] = useState(false);
  const [ended, setEnded] = useState(false);
  const turnsRef = useRef(0);
  const ctxRef = useRef<NpcApproachContext | null>(null);
  const notedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const rel = await loadNpcRelationship(playerId, player.user_id);
      if (!alive) return;
      const ctx: NpcApproachContext = {
        npcId: player.user_id,
        activityLabel: player.last_action,
        status: player.status,
        crewTag: player.crew_tag,
        hour,
        trust: rel.trust,
        encounters: rel.encounters ?? 0,
      };
      ctxRef.current = ctx;
      const res = resolveNpcApproach(ctx);
      // Anti-spam : si on vient de se croiser, l'accroche reste neutre.
      const cooling = npcEncounterCoolingDown(rel);
      setApproach(cooling && !res.guarded ? { ...res, outcome: "SHORT", line: relLine(rel.encounters ?? 0) } : res);
    })();
    return () => { alive = false; };
  }, [player.user_id]);

  function finish(outcome: string, feedback: string) {
    if (!notedRef.current) {
      notedRef.current = true;
      void noteNpcEncounter(playerId, player.user_id, outcome);
    }
    onFeedback(feedback);
    setEnded(true);
  }

  async function localTalk(message: string) {
    if (busyTalk || turnsRef.current >= 3) return;
    setBusyTalk(true);
    setThread((t) => [...t, { role: "me", text: message }]);
    const res = await sendNpcMessageLocal(playerId, player.user_id, player.display_name, message);
    turnsRef.current += 1;
    setThread((t) => [...t, { role: "npc", text: res.reply ?? "…" }]);
    setFollowUps(turnsRef.current >= 3 ? [] : (res.quickReplies ?? []).slice(0, 3));
    setBusyTalk(false);
    if (turnsRef.current >= 3) finish(approach?.outcome ?? "SHORT", "Conversation terminée");
  }

  function runAction(a: NpcQuickAction) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (a.id === "leave") {
      finish(approach?.outcome ?? "SHORT", "Conversation terminée");
      onClose();
      return;
    }
    if (a.id === "talk") {
      const opener = "Tu fais quoi ici ?";
      if (onOpenFullChat) {
        if (!notedRef.current) { notedRef.current = true; void noteNpcEncounter(playerId, player.user_id, approach?.outcome ?? "SHORT"); }
        onOpenFullChat(opener);
        return;
      }
      void localTalk(opener);
      return;
    }
    if (a.id === "outing") {
      const r = resolveOutingProposal(ctx);
      setThread((t) => [...t, { role: "npc", text: r.line }]);
      if (r.accepted) {
        setFollowUps([]);
        finish("OUTING_OK", `${player.display_name} te propose une sortie`);
        setApproach((p) => (p ? { ...p, actions: [{ id: "gameplay", label: "Voir les sorties" }, { id: "leave", label: "Fermer" }] } : p));
      } else {
        finish("OUTING_NO", `${player.display_name} décline pour l'instant`);
      }
      return;
    }
    if (a.id === "district") {
      setThread((t) => [...t, { role: "npc", text: districtLine(ctx) }]);
      if (nearbyOpportunity) {
        setApproach((p) => (p ? { ...p, actions: [{ id: "gameplay", label: nearbyOpportunity.label }, { id: "leave", label: "Fermer" }] } : p));
      } else {
        finish(approach?.outcome ?? "SHORT", "Conversation terminée");
      }
      return;
    }
    if (a.id === "gameplay") {
      const route = nearbyOpportunity?.route ?? "/(app)/(tabs)/map";
      finish(approach?.outcome ?? "SUGGEST", "Nouvelle piste");
      onClose();
      onNavigate(route);
      return;
    }
  }

  if (!approach) {
    return (
      <View style={{ paddingVertical: 14, alignItems: "center" }}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const actions = ended
    ? approach.actions.filter((a) => a.id === "leave" || a.id === "gameplay")
    : approach.actions;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ backgroundColor: palette.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: palette.border, gap: 8 }}>
        <Text style={{ color: palette.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1 }}>
          {player.display_name.toUpperCase()} · HABITANT SIMULÉ
        </Text>
        <Text style={{ color: palette.text, fontSize: 13, lineHeight: 18 }}>{approach.line}</Text>
        {thread.slice(-4).map((m, i) => (
          <Text key={i} style={{ color: m.role === "me" ? palette.muted : palette.text, fontSize: 12.5, lineHeight: 17 }}>
            {m.role === "me" ? "Toi : " : `${player.display_name} : `}{m.text}
          </Text>
        ))}
        {busyTalk && <Text style={{ color: palette.muted, fontSize: 11 }}>{player.display_name} répond…</Text>}
      </View>

      {followUps.length > 0 && !ended && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {followUps.map((qr) => (
            <Pressable key={qr} onPress={() => void localTalk(qr)} disabled={busyTalk}
              style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: palette.text, fontSize: 12, fontWeight: "700" }}>{qr}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ gap: 8 }}>
        {actions.map((a) => (
          <Pressable key={a.id} onPress={() => runAction(a)} disabled={busyTalk}
            style={{
              borderRadius: 12, paddingVertical: 12, alignItems: "center",
              backgroundColor: a.id === "leave" ? "transparent" : palette.accent + "18",
              borderWidth: 1, borderColor: a.id === "leave" ? palette.border : palette.accent + "45",
            }}>
            <Text style={{ color: a.id === "leave" ? palette.muted : palette.accent, fontSize: 13, fontWeight: "900" }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function relLine(encounters: number): string {
  if (encounters <= 0) return "On ne s'est jamais vraiment parlé.";
  if (encounters === 1) return "Tiens, on se recroise.";
  return "Encore toi ici ? On commence à se connaître.";
}
