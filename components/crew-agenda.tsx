"use client";

/**
 * Agenda du Crew — sorties IRL : proposer, voter (oui / peut-être / non),
 * confirmer, rappel local 2 h avant. Se branche sur `lib/crew-outings.ts`
 * (dégrade proprement si la migration n'est pas appliquée).
 */

import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchCrewOutings,
  proposeOuting,
  setRsvp,
  setOutingStatus,
  type CrewOuting,
  type RsvpResponse,
} from "@/lib/crew-outings";
import { hapticSuccess } from "@/lib/safe-haptics";
import { parseWhen } from "@/lib/parse-when";

const C = {
  card: "#111111",
  cardAlt: "#181818",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  muted: "#4A4844",
  gold: "#FFD600",
  green: "#39FF14",
  purple: "#BF5FFF",
};

const WHEN = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const RSVP_META: Record<RsvpResponse, { label: string; color: string }> = {
  yes: { label: "J'y suis", color: C.green },
  maybe: { label: "Peut-être", color: C.gold },
  no: { label: "Pas dispo", color: C.muted },
};

export function CrewAgenda({ crewId, isOfficer }: { crewId: string; isOfficer: boolean }) {
  const [outings, setOutings] = useState<CrewOuting[]>([]);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [whenStr, setWhenStr] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setOutings(await fetchCrewOutings(crewId));
  }, [crewId]);

  useEffect(() => {
    load();
  }, [load]);

  async function vote(o: CrewOuting, r: RsvpResponse) {
    hapticSuccess();
    await setRsvp(o.id, r, new Date(o.planned_at));
    load();
  }

  async function confirm(o: CrewOuting) {
    await setOutingStatus(o.id, "confirmed");
    load();
  }

  async function submit() {
    setErr(null);
    // Formats acceptés : "2026-09-05 20:00" ou "05/09 20:00"
    const parsed = parseWhen(whenStr);
    if (!parsed) {
      setErr("Date : ex. « 2026-09-05 20:00 »");
      return;
    }
    setSaving(true);
    const res = await proposeOuting(crewId, { title, place, plannedAt: parsed, note });
    setSaving(false);
    if (!res.ok) {
      setErr(res.error ?? "Échec.");
      return;
    }
    hapticSuccess();
    setTitle("");
    setPlace("");
    setWhenStr("");
    setNote("");
    setModal(false);
    load();
  }

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <Text style={{ color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>SORTIES DU CREW</Text>
        <Pressable
          onPress={() => setModal(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: C.purple,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Ionicons name="add" size={14} color="#080808" />
          <Text style={{ color: "#080808", fontWeight: "900", fontSize: 11.5 }}>Proposer</Text>
        </Pressable>
      </View>

      {outings.length === 0 ? (
        <Text style={{ color: C.textSoft, fontSize: 12.5, lineHeight: 18, marginBottom: 18 }}>
          Aucune sortie prévue. Propose un verre, un foot, une soirée — le crew vote.
        </Text>
      ) : (
        outings.map((o) => (
          <View
            key={o.id}
            style={{
              backgroundColor: C.card,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: o.status === "confirmed" ? C.green + "40" : C.border,
              padding: 14,
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: "800", flex: 1 }}>{o.title}</Text>
              {o.status === "confirmed" && (
                <Text style={{ color: C.green, fontSize: 10, fontWeight: "900" }}>CONFIRMÉE</Text>
              )}
            </View>
            <Text style={{ color: C.purple, fontSize: 12, fontWeight: "700", marginTop: 3 }}>
              {cap(WHEN.format(new Date(o.planned_at)))}
            </Text>
            {!!o.place && <Text style={{ color: C.textSoft, fontSize: 12, marginTop: 1 }}>📍 {o.place}</Text>}
            {!!o.note && (
              <Text style={{ color: C.textSoft, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{o.note}</Text>
            )}

            <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
              {(["yes", "maybe", "no"] as RsvpResponse[]).map((r) => {
                const active = o.my_response === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => vote(o, r)}
                    style={{
                      flex: 1,
                      borderRadius: 8,
                      paddingVertical: 8,
                      alignItems: "center",
                      backgroundColor: active ? RSVP_META[r].color + "22" : C.cardAlt,
                      borderWidth: 1,
                      borderColor: active ? RSVP_META[r].color + "66" : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? RSVP_META[r].color : C.textSoft,
                        fontSize: 11,
                        fontWeight: "800",
                      }}
                    >
                      {RSVP_META[r].label}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 10, marginTop: 1 }}>{o.rsvps[r]}</Text>
                  </Pressable>
                );
              })}
            </View>

            {isOfficer && o.status === "proposed" && (
              <Pressable onPress={() => confirm(o)} style={{ marginTop: 8, alignSelf: "flex-start" }}>
                <Text style={{ color: C.green, fontSize: 11.5, fontWeight: "900" }}>✓ Confirmer la sortie</Text>
              </Pressable>
            )}
          </View>
        ))
      )}

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: C.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: 36,
              gap: 12,
            }}
          >
            <Text style={{ color: C.text, fontSize: 16, fontWeight: "900" }}>Proposer une sortie</Text>
            {[
              { v: title, set: setTitle, ph: "Quoi ? (ex : Verre aux Carmes)", max: 120 },
              { v: place, set: setPlace, ph: "Où ? (optionnel)", max: 120 },
              { v: whenStr, set: setWhenStr, ph: "Quand ? (ex : 2026-09-05 20:00)", max: 20 },
              { v: note, set: setNote, ph: "Une précision ? (optionnel)", max: 500 },
            ].map((f, i) => (
              <TextInput
                key={i}
                placeholder={f.ph}
                placeholderTextColor={C.muted}
                value={f.v}
                onChangeText={f.set}
                maxLength={f.max}
                style={{
                  backgroundColor: C.cardAlt,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  color: C.text,
                  fontSize: 13.5,
                }}
              />
            ))}
            {err && <Text style={{ color: "#FF6B6B", fontSize: 12 }}>{err}</Text>}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setModal(false)}
                style={{ flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: C.border }}
              >
                <Text style={{ color: C.textSoft, fontWeight: "800", fontSize: 13 }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={saving || !title.trim() || !whenStr.trim()}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: C.purple,
                  opacity: saving || !title.trim() || !whenStr.trim() ? 0.5 : 1,
                }}
              >
                <Text style={{ color: "#080808", fontWeight: "900", fontSize: 13 }}>
                  {saving ? "..." : "Proposer"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
