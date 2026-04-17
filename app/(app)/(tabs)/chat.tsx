import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, Easing, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, Text, TextInput, View
} from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getNpcVisual } from "@/lib/avatar-visual";
import { activities, starterResidents } from "@/lib/game-engine";
import { getRelationshipLabel } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import type { Conversation, NpcState } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

// ─── Helper couleur relation ──────────────────────────────────────────────────
function relColor(score: number): string {
  if (score > 60) return "#38c793";
  if (score > 30) return "#f6b94f";
  return "rgba(255,255,255,0.2)";
}

// ─── Avatar conversation ──────────────────────────────────────────────────────
function ConvAvatar({ peerId, action, size = "xs", unread = 0 }: {
  peerId?: string | null; action?: string; size?: "xs" | "sm"; unread?: number;
}) {
  const npc = peerId ? starterResidents.find((r) => r.id === peerId) : null;
  if (!npc || !peerId) {
    return (
      <View style={{ width: size === "sm" ? 44 : 36, height: size === "sm" ? 44 : 36,
        borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)",
        alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="chatbubbles" size={18} color={colors.muted} />
        {unread > 0 && (
          <View style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16,
            borderRadius: 8, backgroundColor: "#e74c3c", alignItems: "center", justifyContent: "center",
            paddingHorizontal: 3 }}>
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        )}
      </View>
    );
  }
  const visual = getNpcVisual(peerId);
  return (
    <View style={{ position: "relative" }}>
      <AvatarSprite visual={visual} action={(action ?? "idle") as never} size={size} />
      {unread > 0 && (
        <View style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16,
          borderRadius: 8, backgroundColor: "#e74c3c", alignItems: "center", justifyContent: "center",
          paddingHorizontal: 3, borderWidth: 1.5, borderColor: colors.bg }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Vue conversation individuelle ───────────────────────────────────────────
function ConversationView({ conv, npc, onBack }: {
  conv: Conversation; npc: NpcState | undefined; onBack: () => void;
}) {
  const sendMessageStore       = useGameStore((s) => s.sendMessage);
  const markConversationRead   = useGameStore((s) => s.markConversationRead);
  const [draft, setDraft]      = useState("");
  const scrollRef              = useRef<ScrollView>(null);
  const slideAnim              = useRef(new Animated.Value(40)).current;
  const fadeAnim               = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    markConversationRead(conv.id);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [conv.id]);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    sendMessageStore(conv.id, t);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const resident = starterResidents.find((r) => r.id === conv.peerId);
  const visual   = conv.peerId ? getNpcVisual(conv.peerId) : null;
  const moodColor = npc ? (npc.mood > 65 ? "#38c793" : npc.mood > 35 ? "#f6b94f" : "#e74c3c") : colors.muted;
  const action = npc?.action ?? "idle";

  const ACTION_LABEL: Record<string, string> = {
    sleeping: "😴 Dort", eating: "🍽️ Mange", chatting: "💬 Bavarde",
    exercising: "💪 S'entraîne", walking: "🚶 Marche", working: "💼 Travaille", idle: "💭 Disponible"
  };

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {/* Header */}
      <View style={{ backgroundColor: "#0b1828", paddingTop: 52, paddingHorizontal: 16,
        paddingBottom: 14, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.07)",
        flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={onBack} style={{ width: 36, height: 36, borderRadius: 18,
          backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        {visual && (
          <View style={{ borderWidth: 2, borderColor: moodColor, borderRadius: 24 }}>
            <AvatarSprite visual={visual} action={action as never} size="sm" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{conv.title}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {resident?.role ? `${resident.role} · ` : ""}
            {npc ? (ACTION_LABEL[action] ?? "Actif") : "Résident"}
          </Text>
        </View>
        <Pressable onPress={() => router.push("/(app)/world-live")}
          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.06)" }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>🗺️</Text>
        </Pressable>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {/* Bio NPC si dispo */}
          {resident?.bio && conv.messages.length <= 3 && (
            <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14,
              padding: 12, marginBottom: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontStyle: "italic" }}>
                {resident.bio}
              </Text>
            </View>
          )}

          {conv.messages.map((msg) => {
            const mine = msg.authorId === "self";
            const time = new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            return (
              <View key={msg.id}
                style={{ flexDirection: mine ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
                {!mine && visual && (
                  <AvatarSprite visual={visual} action="idle" size="xs" />
                )}
                <View style={{ maxWidth: "78%" }}>
                  <View style={{
                    backgroundColor: mine ? colors.accent : "rgba(255,255,255,0.09)",
                    borderRadius: 18,
                    borderBottomRightRadius: mine ? 4 : 18,
                    borderBottomLeftRadius: mine ? 18 : 4,
                    paddingHorizontal: 14, paddingVertical: 10
                  }}>
                    <Text style={{ color: mine ? "#07111f" : colors.text, fontSize: 14, lineHeight: 20,
                      fontWeight: mine ? "600" : "400" }}>
                      {msg.body}
                    </Text>
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 9,
                    marginTop: 3, alignSelf: mine ? "flex-end" : "flex-start",
                    marginHorizontal: 6 }}>
                    {time}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Input */}
        <View style={{ flexDirection: "row", gap: 8, padding: 12, paddingBottom: 20,
          backgroundColor: "rgba(7,17,31,0.98)", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Écrire à ${conv.title.split(" ")[0]}…`}
            placeholderTextColor={colors.muted}
            style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 22,
              paddingHorizontal: 16, paddingVertical: 11, color: colors.text, fontSize: 14 }}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline={false}
          />
          <Pressable onPress={send} style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: draft.trim() ? colors.accent : "rgba(255,255,255,0.08)",
            alignItems: "center", justifyContent: "center"
          }}>
            <Ionicons name="send" size={18} color={draft.trim() ? "#07111f" : colors.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

// ─── Carte contact ─────────────────────────────────────────────────────────────
function ContactCard({ residentId, onChat, onInvite }: {
  residentId: string; onChat: () => void; onInvite: () => void;
}) {
  const resident     = starterResidents.find((r) => r.id === residentId);
  const relationships = useGameStore((s) => s.relationships);
  const npcs          = useGameStore((s) => s.npcs);
  const npc           = npcs.find((n) => n.id === residentId);
  if (!resident) return null;

  const rel    = relationships.find((r) => r.residentId === residentId);
  const score  = rel?.score ?? 0;
  const rc     = relColor(score);
  const visual = getNpcVisual(residentId);
  const action = npc?.action ?? "idle";

  const ACTION_EMOJI: Record<string, string> = {
    sleeping: "😴", eating: "🍽️", chatting: "💬",
    exercising: "💪", walking: "🚶", working: "💼", idle: "🟢"
  };

  return (
    <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      {/* Banner couleur relation */}
      <View style={{ height: 64, backgroundColor: rc + "18", alignItems: "center",
        justifyContent: "center", position: "relative" }}>
        <View style={{ borderWidth: 2.5, borderColor: rc, borderRadius: 26 }}>
          <AvatarSprite visual={visual} action={action as never} size="sm" />
        </View>
        {/* Badge statut action */}
        <View style={{ position: "absolute", top: 6, right: 10,
          backgroundColor: "rgba(7,17,31,0.85)", borderRadius: 10,
          paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11 }}>{ACTION_EMOJI[action] ?? "🟢"}</Text>
        </View>
      </View>

      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{resident.name}</Text>
          {npc && (
            <View style={{ backgroundColor: (npc.level >= 3 ? "#f6b94f" : "#38c793") + "22",
              borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: npc.level >= 3 ? "#f6b94f" : "#38c793", fontSize: 10, fontWeight: "900" }}>
                Nv{npc.level}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{resident.role}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={2}>{resident.bio}</Text>

        {/* Barre relation */}
        <View style={{ gap: 4, marginTop: 4 }}>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <View style={{ height: 5, width: `${Math.min(100, score)}%`, borderRadius: 3, backgroundColor: rc }} />
          </View>
          <Text style={{ color: rc, fontSize: 10, fontWeight: "700" }}>
            {getRelationshipLabel({ score, residentId } as never)}
            {score > 0 ? ` · ${score} pts` : ""}
          </Text>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <Pressable onPress={onChat} style={{ flex: 1, backgroundColor: colors.accent + "18",
            borderRadius: 10, paddingVertical: 10, alignItems: "center",
            borderWidth: 1, borderColor: colors.accent + "40" }}>
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>💬 Chat</Text>
          </Pressable>
          <Pressable onPress={onInvite} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 10, paddingVertical: 10, alignItems: "center",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>☕ Inviter</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Screen principal ─────────────────────────────────────────────────────────
export default function SocialScreen() {
  const conversations           = useGameStore((s) => s.conversations);
  const invitations             = useGameStore((s) => s.invitations);
  const npcs                    = useGameStore((s) => s.npcs);
  const sendInvitation          = useGameStore((s) => s.sendInvitation);
  const respondInvitation       = useGameStore((s) => s.respondInvitation);
  const startDirectConversation = useGameStore((s) => s.startDirectConversation);

  const [tab, setTab]           = useState<"messages" | "contacts" | "invites">("messages");
  const [openConvId, setOpenConvId] = useState<string | null>(null);

  const pendingInvites    = invitations.filter((i) => i.status === "pending");
  const totalUnread       = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const directConvs       = useMemo(() =>
    conversations.filter((c) => c.kind === "direct").sort((a, b) => {
      const at = a.messages.at(-1)?.createdAt ?? a.messages[0]?.createdAt ?? "";
      const bt = b.messages.at(-1)?.createdAt ?? b.messages[0]?.createdAt ?? "";
      return bt.localeCompare(at);
    }),
    [conversations]
  );

  const openConv = openConvId ? conversations.find((c) => c.id === openConvId) : null;
  const openNpc  = openConv?.peerId ? npcs.find((n) => n.id === openConv.peerId) : undefined;

  const openDm = (residentId: string, residentName: string) => {
    startDirectConversation(residentId, residentName);
    const convId = `dm-${residentId}`;
    setOpenConvId(convId);
    setTab("messages");
  };

  // ── Vue conversation ouverte ──────────────────────────────────────────────
  if (openConv) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ConversationView conv={openConv} npc={openNpc} onBack={() => setOpenConvId(null)} />
      </View>
    );
  }

  // ── Vue liste ─────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: "#07111f", paddingTop: 52, paddingHorizontal: 20, paddingBottom: 0 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between",
          alignItems: "center", marginBottom: 14 }}>
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
        <View style={{ flexDirection: "row", gap: 0, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
          {([
            { key: "messages" as const, label: "Messages", badge: totalUnread },
            { key: "contacts" as const, label: "Contacts", badge: 0 },
            { key: "invites"  as const, label: "Invitations", badge: pendingInvites.length },
          ]).map(({ key, label, badge }) => (
            <Pressable key={key} onPress={() => setTab(key)} style={{ flex: 1, paddingVertical: 12,
              alignItems: "center", position: "relative",
              borderBottomWidth: tab === key ? 2 : 0,
              borderColor: colors.accent }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: tab === key ? colors.text : colors.muted,
                  fontWeight: tab === key ? "800" : "500", fontSize: 12 }}>
                  {label}
                </Text>
                {badge > 0 && (
                  <View style={{ minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#e74c3c",
                    alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                    <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{badge}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}>

        {/* ── MESSAGES ─────────────────────────────────────────────────────── */}
        {tab === "messages" && (
          <>
            {directConvs.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 60, gap: 16, paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 56 }}>💬</Text>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Aucun message</Text>
                <Text style={{ color: colors.muted, textAlign: "center" }}>
                  Va dans Contacts pour démarrer une conversation avec un résident.
                </Text>
                <Pressable onPress={() => setTab("contacts")}
                  style={{ backgroundColor: colors.accent, borderRadius: 14,
                    paddingHorizontal: 24, paddingVertical: 12 }}>
                  <Text style={{ color: "#07111f", fontWeight: "800", fontSize: 14 }}>Voir les contacts</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                {directConvs.map((conv) => {
                  const npc    = conv.peerId ? npcs.find((n) => n.id === conv.peerId) : undefined;
                  const last   = conv.messages.at(-1);
                  const time   = last ? new Date(last.createdAt).toLocaleTimeString("fr-FR",
                    { hour: "2-digit", minute: "2-digit" }) : "";
                  const hasUnread = conv.unreadCount > 0;
                  return (
                    <Pressable key={conv.id}
                      onPress={() => setOpenConvId(conv.id)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12,
                        paddingHorizontal: 16, paddingVertical: 14,
                        backgroundColor: hasUnread ? "rgba(139,124,255,0.06)" : "transparent",
                        borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                      <ConvAvatar peerId={conv.peerId} action={npc?.action}
                        size="sm" unread={conv.unreadCount} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors.text, fontWeight: hasUnread ? "800" : "600",
                            fontSize: 14 }}>
                            {conv.title}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 10 }}>{time}</Text>
                        </View>
                        <Text style={{ color: hasUnread ? colors.text : colors.muted,
                          fontSize: 12, fontWeight: hasUnread ? "600" : "400" }}
                          numberOfLines={1}>
                          {last?.body ?? "Démarre la conversation…"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── CONTACTS ─────────────────────────────────────────────────────── */}
        {tab === "contacts" && (
          <View style={{ padding: 16, gap: 14 }}>
            {starterResidents.map((r) => (
              <ContactCard
                key={r.id}
                residentId={r.id}
                onChat={() => openDm(r.id, r.name)}
                onInvite={() => sendInvitation(r.id, "coffee-meetup")}
              />
            ))}
            <Pressable onPress={() => router.push("/(app)/discover")}
              style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 16,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>
                Découvrir plus de profils
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── INVITATIONS ──────────────────────────────────────────────────── */}
        {tab === "invites" && (
          <View style={{ padding: 16, gap: 12 }}>
            {invitations.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 60, gap: 16 }}>
                <Text style={{ fontSize: 56 }}>🎉</Text>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                  Aucune invitation
                </Text>
                <Text style={{ color: colors.muted, textAlign: "center" }}>
                  Les résidents t'enverront des invitations quand ils seront de bonne humeur.
                </Text>
              </View>
            ) : (
              invitations.map((inv) => {
                const act       = activities.find((a) => a.slug === inv.activitySlug);
                const isPending = inv.status === "pending";
                const resident  = starterResidents.find((r) => r.id === inv.residentId);
                const visual    = resident ? getNpcVisual(resident.id) : null;
                const npc       = npcs.find((n) => n.id === inv.residentId);

                const ACT_EMOJIS: Record<string, string> = {
                  "coffee-meetup": "☕", "walk": "🌿", "gym-session": "💪",
                  "cinema-date": "🎬", "market-shop": "🛒", "restaurant-out": "🍽️"
                };
                const emoji = ACT_EMOJIS[inv.activitySlug] ?? "🎯";

                return (
                  <View key={inv.id} style={{
                    backgroundColor: isPending ? "rgba(246,185,79,0.07)" : "rgba(255,255,255,0.03)",
                    borderRadius: 18, overflow: "hidden",
                    borderWidth: 1, borderColor: isPending ? "rgba(246,185,79,0.3)" : "rgba(255,255,255,0.07)"
                  }}>
                    {/* Header invitation */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                      {visual && npc && (
                        <View style={{ borderWidth: 2, borderColor: isPending ? "#f6b94f" : "rgba(255,255,255,0.15)",
                          borderRadius: 24 }}>
                          <AvatarSprite visual={visual} action={(npc.action) as never} size="sm" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                            {inv.residentName}
                          </Text>
                          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
                            backgroundColor: isPending ? "#f6b94f22"
                              : inv.status === "accepted" ? "#38c79322" : "#ff6b6b22" }}>
                            <Text style={{ color: isPending ? "#f6b94f"
                              : inv.status === "accepted" ? "#38c793" : "#ff6b6b",
                              fontWeight: "700", fontSize: 10 }}>
                              {isPending ? "En attente" : inv.status === "accepted" ? "✓ Accepté" : "✗ Refusé"}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {emoji} t'invite à {act?.name ?? inv.activitySlug}
                        </Text>
                      </View>
                    </View>

                    {/* Boutons si pending */}
                    {isPending && (
                      <View style={{ flexDirection: "row", gap: 0, borderTopWidth: 1,
                        borderColor: "rgba(255,255,255,0.07)" }}>
                        <Pressable onPress={() => respondInvitation(inv.id, "accepted")}
                          style={{ flex: 1, paddingVertical: 13, alignItems: "center",
                            backgroundColor: "#38c79314",
                            borderRightWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
                          <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 14 }}>
                            ✓ Accepter
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => respondInvitation(inv.id, "declined")}
                          style={{ flex: 1, paddingVertical: 13, alignItems: "center" }}>
                          <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 14 }}>
                            ✗ Refuser
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}
