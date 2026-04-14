import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { AppShell, Button, Card, ListRow, Muted, Pill, SectionTitle, Title } from "@/components/ui";
import { useRealtimeLobby } from "@/hooks/use-realtime-lobby";
import { activities, starterResidents } from "@/lib/game-engine";
import { getCompatibilityBadge, getRelationshipLabel } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

export default function SocialScreen() {
  const realtimeLobby = useRealtimeLobby();
  const avatar = useGameStore((state) => state.avatar);
  const conversations = useGameStore((state) => state.conversations);
  const invitations = useGameStore((state) => state.invitations);
  const relationships = useGameStore((state) => state.relationships);
  const sendMessage = useGameStore((state) => state.sendMessage);
  const startDirectConversation = useGameStore((state) => state.startDirectConversation);
  const sendInvitation = useGameStore((state) => state.sendInvitation);
  const respondInvitation = useGameStore((state) => state.respondInvitation);
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? "");
  const [draft, setDraft] = useState("");

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? conversations[0],
    [activeId, conversations]
  );

  return (
    <AppShell>
      <Card accent>
        <Pill tone={realtimeLobby.status === "live" ? "accent" : "warning"}>
          {realtimeLobby.status === "live" ? `${realtimeLobby.members} en ligne` : realtimeLobby.status}
        </Pill>
        <Title>Réseau, messages et sorties.</Title>
        <Muted>
          La progression sociale ne vient pas seulement du chat. Elle vient du rythme, des invites, de la presence et
          de la regularite dans les interactions.
        </Muted>
        <Button label="Ouvrir les dates" variant="secondary" onPress={() => router.push("/(app)/dates")} />
      </Card>

      <Card>
        <SectionTitle>Profils a approcher</SectionTitle>
        {starterResidents.slice(0, 3).map((resident) => {
          const relationship = relationships.find((item) => item.residentId === resident.id);
          return (
            <View key={resident.id} style={{ gap: 6, paddingVertical: 4 }}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>
                {resident.name} · {resident.role}
              </Text>
              <Muted>{resident.bio}</Muted>
              <Muted>
                {getRelationshipLabel(relationship)} · {getCompatibilityBadge(avatar?.interests ?? [], resident.interests)}
              </Muted>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Ouvrir le chat" variant="secondary" onPress={() => startDirectConversation(resident.id, resident.name)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Inviter a un cafe" onPress={() => sendInvitation(resident.id, "coffee-meetup")} />
                </View>
              </View>
            </View>
          );
        })}
        <Button label="Voir plus de profils" variant="ghost" onPress={() => router.push("/(app)/discover")} />
      </Card>

      <Card>
        <SectionTitle>Invitations</SectionTitle>
        {invitations.length === 0 ? <Muted>Aucune invitation en attente pour le moment.</Muted> : null}
        {invitations.map((invitation) => {
          const activity = activities.find((item) => item.slug === invitation.activitySlug);
          return (
            <View key={invitation.id} style={{ gap: 8, paddingVertical: 4 }}>
              <ListRow
                title={`${invitation.residentName} · ${activity?.name ?? invitation.activitySlug}`}
                subtitle={invitation.status === "pending" ? "En attente de reponse" : invitation.status}
                right={<Pill tone={invitation.status === "accepted" ? "accent" : invitation.status === "declined" ? "muted" : "warning"}>{invitation.status}</Pill>}
              />
              {invitation.status === "pending" ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Button label="Accepter" onPress={() => respondInvitation(invitation.id, "accepted")} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Refuser" variant="secondary" onPress={() => respondInvitation(invitation.id, "declined")} />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Card>
        <SectionTitle>Conversations</SectionTitle>
        <View style={{ gap: 8 }}>
          {conversations.map((conversation) => (
            <Button
              key={conversation.id}
              label={`${conversation.title}${conversation.unreadCount ? ` (${conversation.unreadCount})` : ""}`}
              onPress={() => setActiveId(conversation.id)}
              variant={conversation.id === activeConversation?.id ? "primary" : "secondary"}
            />
          ))}
        </View>
      </Card>

      {activeConversation ? (
        <Card>
          <SectionTitle>{activeConversation.title}</SectionTitle>
          <Muted>{activeConversation.subtitle}</Muted>
          <View style={{ gap: 10 }}>
            {activeConversation.messages.slice(-8).map((message) => (
              <View
                key={message.id}
                style={{
                  alignSelf: message.authorId === "self" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  padding: 12,
                  borderRadius: 18,
                  backgroundColor:
                    message.authorId === "self"
                      ? "rgba(88,214,163,0.16)"
                      : message.kind === "invitation"
                        ? "rgba(139,124,255,0.18)"
                        : colors.cardAlt
                }}
              >
                <Text style={{ color: colors.text }}>{message.body}</Text>
              </View>
            ))}
          </View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ecris un message"
            placeholderTextColor={colors.muted}
            style={{
              minHeight: 52,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bgSoft,
              paddingHorizontal: 14,
              color: colors.text
            }}
          />
          <Button
            label="Envoyer"
            onPress={() => {
              sendMessage(activeConversation.id, draft);
              setDraft("");
            }}
          />
        </Card>
      ) : null}
    </AppShell>
  );
}
