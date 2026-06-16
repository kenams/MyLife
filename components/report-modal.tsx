import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";

import { REPORT_REASONS, sendReport } from "@/lib/safety";
import type { ReportReason } from "@/lib/safety";
import { hapticImpact } from "@/lib/safe-haptics";
import { useGameStore } from "@/stores/game-store";

const L = {
  bg: "#080808", card: "#111111", cardAlt: "#181818",
  text: "#F5F2E8", textSoft: "#A8A49A", muted: "#4A4844",
  border: "rgba(255,255,255,0.07)",
  primary: "#FFD600", red: "#FF3B3B", green: "#39FF14",
};

type Props = {
  visible: boolean;
  targetUserId: string;
  targetName: string;
  onClose: () => void;
};

export function ReportModal({ visible, targetUserId, targetName, onClose }: Props) {
  const avatar  = useGameStore((s) => s.avatar);
  const session = useGameStore((s) => s.session);

  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [details,  setDetails]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState("");

  function reset() {
    setSelected(null); setDetails(""); setSent(false); setError(""); setLoading(false);
  }

  async function submit() {
    if (!selected) return;
    setLoading(true); setError("");
    const res = await sendReport({
      reporterUserId: session?.id ?? "anonymous",
      reporterName:   avatar?.displayName ?? "Inconnu",
      targetUserId,
      targetName,
      reason:  selected,
      details: details.trim() || undefined,
    });
    setLoading(false);
    if (!res.ok) { setError(res.error ?? "Erreur"); return; }
    hapticImpact("medium");
    setSent(true);
    setTimeout(() => { reset(); onClose(); }, 2500);
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={() => { reset(); onClose(); }}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)" }}
        onPress={() => { reset(); onClose(); }} />
      <View style={{ backgroundColor: L.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24, paddingBottom: 48, gap: 16,
        borderTopWidth: 1, borderTopColor: L.border }}>

        <View style={{ width: 36, height: 4, borderRadius: 2,
          backgroundColor: L.border, alignSelf: "center" }} />

        {sent ? (
          <View style={{ alignItems: "center", gap: 16, paddingVertical: 20 }}>
            <Text style={{ fontSize: 40 }}>✅</Text>
            <Text style={{ color: L.text, fontSize: 18, fontWeight: "900", textAlign: "center" }}>
              Signalement envoyé
            </Text>
            <Text style={{ color: L.textSoft, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
              Notre équipe examinera le profil de{"\n"}{targetName} sous 72h.
            </Text>
          </View>
        ) : (
          <>
            <View>
              <Text style={{ color: L.red, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 }}>
                SIGNALER
              </Text>
              <Text style={{ color: L.text, fontSize: 18, fontWeight: "900", marginTop: 4 }}>
                {targetName}
              </Text>
              <Text style={{ color: L.textSoft, fontSize: 13, marginTop: 4 }}>
                Quelle est la raison de ton signalement ?
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              {REPORT_REASONS.map((r) => {
                const on = selected === r.id;
                return (
                  <Pressable key={r.id} onPress={() => setSelected(r.id)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 12,
                      padding: 14, borderRadius: 12,
                      backgroundColor: on ? L.red + "15" : L.cardAlt,
                      borderWidth: 1, borderColor: on ? L.red + "40" : L.border,
                    }}>
                    <Text style={{ fontSize: 18 }}>{r.emoji}</Text>
                    <Text style={{ color: on ? L.red : L.text, fontSize: 14, fontWeight: "700", flex: 1 }}>
                      {r.label}
                    </Text>
                    {on && <Text style={{ color: L.red, fontSize: 16 }}>●</Text>}
                  </Pressable>
                );
              })}
            </View>

            {selected && (
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Détails supplémentaires (optionnel)..."
                placeholderTextColor={L.muted}
                multiline
                maxLength={500}
                style={{
                  backgroundColor: L.cardAlt, borderRadius: 12, padding: 14,
                  color: L.text, fontSize: 13, minHeight: 80,
                  borderWidth: 1, borderColor: L.border, textAlignVertical: "top",
                }}
              />
            )}

            {error !== "" && (
              <Text style={{ color: L.red, fontSize: 13, textAlign: "center" }}>{error}</Text>
            )}

            <Pressable onPress={submit} disabled={!selected || loading}
              style={{
                backgroundColor: selected ? L.red : L.cardAlt, borderRadius: 14,
                paddingVertical: 16, alignItems: "center",
                opacity: !selected ? 0.5 : 1,
              }}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>
                    Envoyer le signalement
                  </Text>
              }
            </Pressable>

            <Text style={{ color: L.muted, fontSize: 11, textAlign: "center" }}>
              Les faux signalements peuvent entraîner des sanctions sur ton compte.
            </Text>
          </>
        )}
      </View>
    </Modal>
  );
}
