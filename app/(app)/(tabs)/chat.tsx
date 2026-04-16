import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { activities, starterResidents } from "@/lib/game-engine";
import { getCompatibilityBadge, getRelationshipLabel } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

// ─── Carte résident ───────────────────────────────────────────────────────────
function ResidentCard({ resident, score, onChat, onInvite }: {
  resident: (typeof starterResidents)[0];
  score: number;
  onChat:   () => void;
  onInvite: () => void;
}) {
  const hearts = score > 60 ? "❤️❤️❤️" : score > 35 ? "❤️❤️🤍" : score > 15 ? "❤️🤍🤍" : "🤍🤍🤍";
  const emoji  = resident.id === "ava" ? "👩" : resident.id === "noa" ? "🧑" : "👩‍🦱";
  const ringColor = score > 50 ? "#38c793" : score > 25 ? "#f6b94f" : "rgba(255,255,255,0.15)";

  return (
    <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      {/* Banner */}
      <View style={{ height: 72, backgroundColor: ringColor + "18", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: ringColor + "30",
          borderWidth: 2, borderColor: ringColor, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 30 }}>{emoji}</Text>
        </View>
      </View>
      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{resident.name}</Text>
          <Text>{hearts}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{resident.role}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={2}>{resident.bio}</Text>
        {/* Barre relation */}
        <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", marginTop: 4 }}>
          <View style={{ height: 4, borderRadius: 2, width: `${Math.min(100, score)}%`, backgroundColor: ringColor }} />
        </View>
        <Text style={{ color: ringColor, fontSize: 10, fontWeight: "700" }}>{getRelationshipLabel({ score, residentId: resident.id } as never)}</Text>
        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <Pressable onPress={onChat} style={{ flex: 1, backgroundColor: colors.accent + "18",
            borderRadius: 10, paddingVertical: 8, alignItems: "center",
            borderWidth: 1, borderColor: colors.accent + "40" }}>
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>💬 Chat</Text>
          </Pressable>
          <Pressable onPress={onInvite} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 10, paddingVertical: 8, alignItems: "center",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>☕ Inviter</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const avatar                  = useGameStore((s) => s.avatar);
  const conversations           = useGameStore((s) => s.conversations);
  const invitations             = useGameStore((s) => s.invitations);
  const relationships           = useGameStore((s) => s.relationships);
  const sendMessageStore        = useGameStore((s) => s.sendMessage);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);
  const sendInvitation          = useGameStore((s) => s.sendInvitation);
  const respondInvitation       = useGameStore((s) => s.respondInvitation);

  const [activeId, setActiveId] = useState(conversations[0]?.id ?? "");
  const [draft, setDraft]       = useState("");
  const [tab, setTab]           = useState<"contacts" | "messages" | "invites">("contacts");

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? conversations[0],
    [activeId, conversations]
  );
  const pendingInvites = invitations.filter((i) => i.status === "pending");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── HEADER ── */}
      <View style={{ backgroundColor: "#0b1a2d", paddingHorizontal: 20,
        paddingTop: 56, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 22 }}>Social</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => router.push("/(app)/dates")}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                backgroundColor: "rgba(255,107,107,0.15)", borderWidth: 1, borderColor: "rgba(255,107,107,0.3)" }}>
              <Text style={{ color: "#ff6b6b", fontWeight: "700", fontSize: 12 }}>💘 Dates</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/rooms")}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                backgroundColor: "rgba(56,199,147,0.15)", borderWidth: 1, borderColor: "rgba(56,199,147,0.3)" }}>
              <Text style={{ color: "#38c793", fontWeight: "700", fontSize: 12 }}>🏠 Rooms</Text>
            </Pressable>
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 6 }}>
          {([
            { key: "contacts", label: "Contacts" },
            { key: "messages", label: `Messages${conversations.some((c) => c.unreadCount) ? " 🔴" : ""}` },
            { key: "invites",  label: `Invitations${pendingInvites.length ? ` (${pendingInvites.length})` : ""}` }
          ] as const).map(({ key, label }) => (
            <Pressable key={key} onPress={() => setTab(key)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center",
                backgroundColor: tab === key ? colors.accent : "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: tab === key ? "#07111f" : colors.text, fontWeight: "700", fontSize: 11 }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}>

        {/* ── CONTACTS ── */}
        {tab === "contacts" && (
          <>
            {starterResidents.map((r) => {
              const rel = relationships.find((x) => x.residentId === r.id);
              return (
                <ResidentCard
                  key={r.id}
                  resident={r}
                  score={rel?.score ?? 0}
                  onChat={() => { startDirectConversation(r.id, r.name); setActiveId(r.id); setTab("messages"); }}
                  onInvite={() => sendInvitation(r.id, "coffee-meetup")}
                />
              );
            })}
            <Pressable onPress={() => router.push("/(app)/discover")}
              style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 14,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>🔍 Découvrir plus de profils</Text>
            </Pressable>
          </>
        )}

        {/* ── MESSAGES ── */}
        {tab === "messages" && (
          <>
            {conversations.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40, gap: 12 }}>
                <Text style={{ fontSize: 48 }}>💬</Text>
                <Text style={{ color: colors.muted }}>Commence une conversation !</Text>
                <Pressable onPress={() => setTab("contacts")}
                  style={{ backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10 }}>
                  <Text style={{ color: "#07111f", fontWeight: "800" }}>Voir les contacts</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Liste conversations */}
                <View style={{ gap: 2 }}>
                  {conversations.map((c) => (
                    <Pressable key={c.id} onPress={() => setActiveId(c.id)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12,
                        padding: 14, borderRadius: 14,
                        backgroundColor: c.id === activeId ? colors.accent + "12" : "transparent",
                        borderWidth: 1,
                        borderColor: c.id === activeId ? colors.accent + "40" : "transparent" }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22,
                        backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 22 }}>
                          {c.title.includes("Ava") ? "👩" : c.title.includes("Noa") ? "🧑" : c.title.includes("Leila") ? "👩‍🦱" : "👤"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                          {c.title}
                          {c.unreadCount ? <Text style={{ color: "#ff6b6b" }}> ({c.unreadCount})</Text> : ""}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                          {c.messages.at(-1)?.body ?? "Démarre la conversation…"}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                {/* Conversation active */}
                {activeConv && (
                  <View style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 18,
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    <View style={{ padding: 14, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                        {activeConv.title}
                      </Text>
                    </View>
                    <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ padding: 14, gap: 8 }}>
                      {activeConv.messages.slice(-10).map((msg) => (
                        <View key={msg.id} style={{
                          alignSelf: msg.authorId === "self" ? "flex-end" : "flex-start",
                          maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 9,
                          borderRadius: 16,
                          backgroundColor: msg.authorId === "self"
                            ? colors.accent + "20" : "rgba(255,255,255,0.07)"
                        }}>
                          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>{msg.body}</Text>
                        </View>
                      ))}
                    </ScrollView>
                    <View style={{ flexDirection: "row", gap: 8, padding: 12,
                      borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
                      <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="Écrire…"
                        placeholderTextColor={colors.muted}
                        style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20,
                          paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: 14 }}
                        onSubmitEditing={() => { sendMessageStore(activeConv.id, draft); setDraft(""); }}
                      />
                      <Pressable
                        onPress={() => { sendMessageStore(activeConv.id, draft); setDraft(""); }}
                        style={{ width: 40, height: 40, borderRadius: 20,
                          backgroundColor: draft.trim() ? colors.accent : "rgba(255,255,255,0.07)",
                          alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 18 }}>→</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ── INVITATIONS ── */}
        {tab === "invites" && (
          <>
            {invitations.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40, gap: 12 }}>
                <Text style={{ fontSize: 48 }}>🎉</Text>
                <Text style={{ color: colors.muted }}>Aucune invitation pour le moment.</Text>
              </View>
            ) : (
              invitations.map((inv) => {
                const act = activities.find((a) => a.slug === inv.activitySlug);
                const isPending = inv.status === "pending";
                return (
                  <View key={inv.id} style={{
                    backgroundColor: isPending ? "rgba(246,185,79,0.08)" : "rgba(255,255,255,0.04)",
                    borderRadius: 16, padding: 16, gap: 12,
                    borderWidth: 1, borderColor: isPending ? "rgba(246,185,79,0.25)" : "rgba(255,255,255,0.07)"
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Text style={{ fontSize: 28 }}>☕</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>
                          {inv.residentName} t'invite
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{act?.name ?? inv.activitySlug}</Text>
                      </View>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
                        backgroundColor: isPending ? "#f6b94f22" : inv.status === "accepted" ? "#38c79322" : "#ff6b6b22" }}>
                        <Text style={{ color: isPending ? "#f6b94f" : inv.status === "accepted" ? "#38c793" : "#ff6b6b",
                          fontWeight: "700", fontSize: 11 }}>
                          {isPending ? "En attente" : inv.status === "accepted" ? "Accepté" : "Refusé"}
                        </Text>
                      </View>
                    </View>
                    {isPending && (
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable onPress={() => respondInvitation(inv.id, "accepted")}
                          style={{ flex: 1, backgroundColor: "#38c793", borderRadius: 12,
                            paddingVertical: 10, alignItems: "center" }}>
                          <Text style={{ color: "#07111f", fontWeight: "800" }}>✓ Accepter</Text>
                        </Pressable>
                        <Pressable onPress={() => respondInvitation(inv.id, "declined")}
                          style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
                            paddingVertical: 10, alignItems: "center" }}>
                          <Text style={{ color: colors.muted, fontWeight: "700" }}>✗ Refuser</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

      </ScrollView>
    </View>
  );
}
