/**
 * Secret Room — Chat éphémère privé
 * Max 4 personnes · Messages supprimés après 2h · Code secret partageable
 */

import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expiré";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Créer ou rejoindre ───────────────────────────────────────────────────────
function LobbyView({ onEnterRoom }: { onEnterRoom: (roomId: string) => void }) {
  const secretRooms      = useGameStore((s) => s.secretRooms);
  const createSecretRoom = useGameStore((s) => s.createSecretRoom);
  const joinSecretRoom   = useGameStore((s) => s.joinSecretRoom);
  const purge            = useGameStore((s) => s.purgeExpiredSecretRooms);

  const [tab, setTab]        = useState<"create" | "join">("create");
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError]    = useState("");

  useEffect(() => { purge(); }, []);

  const activeRooms = secretRooms.filter((r) => r.isActive && r.expiresAt > new Date().toISOString());

  function handleCreate() {
    const name = roomName.trim() || "Room Secrète";
    const room = createSecretRoom(name);
    setRoomName("");
    onEnterRoom(room.id);
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setError("Entre un code valide."); return; }
    const room = joinSecretRoom(code);
    if (!room) { setError("Code invalide, room expirée ou complète."); return; }
    setJoinCode("");
    setError("");
    onEnterRoom(room.id);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      {/* Intro */}
      <View style={{
        backgroundColor: "rgba(155,89,182,0.12)", borderRadius: 14,
        borderWidth: 1, borderColor: "rgba(155,89,182,0.3)",
        padding: 16, gap: 6,
      }}>
        <Text style={{ color: "#bb77ee", fontWeight: "800", fontSize: 16 }}>🔐 Rooms Secrètes</Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
          Crée une salle privée éphémère. Les messages disparaissent automatiquement après 2h.
          Maximum 4 personnes. Partage le code pour inviter.
        </Text>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["create", "join"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
              backgroundColor: tab === t ? "rgba(155,89,182,0.25)" : "rgba(255,255,255,0.05)",
              borderWidth: 1, borderColor: tab === t ? "rgba(155,89,182,0.5)" : "rgba(255,255,255,0.08)",
            }}
          >
            <Text style={{ color: tab === t ? "#bb77ee" : colors.muted, fontWeight: "700", fontSize: 13 }}>
              {t === "create" ? "✨ Créer" : "🔗 Rejoindre"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Créer */}
      {tab === "create" && (
        <View style={{
          backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16, gap: 12,
        }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Nom de la room (optionnel)</Text>
          <TextInput
            style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10,
              paddingHorizontal: 14, paddingVertical: 12,
              color: colors.text, fontSize: 14,
            }}
            value={roomName}
            onChangeText={setRoomName}
            placeholder="Ex: Discussion confidentielle"
            placeholderTextColor={colors.muted}
            maxLength={40}
          />
          <Pressable
            onPress={handleCreate}
            style={{
              backgroundColor: "#9b59b6", borderRadius: 12,
              paddingVertical: 14, alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>🔐 Créer la Room Secrète</Text>
          </Pressable>
        </View>
      )}

      {/* Rejoindre */}
      {tab === "join" && (
        <View style={{
          backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14,
          borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16, gap: 12,
        }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Code secret (6 caractères)</Text>
          <TextInput
            style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10,
              paddingHorizontal: 14, paddingVertical: 12,
              color: colors.text, fontSize: 18, fontWeight: "800",
              textAlign: "center", letterSpacing: 4,
            }}
            value={joinCode}
            onChangeText={(v) => { setJoinCode(v.toUpperCase()); setError(""); }}
            placeholder="XXXXXX"
            placeholderTextColor={colors.muted}
            maxLength={6}
            autoCapitalize="characters"
          />
          {error ? (
            <Text style={{ color: "#ff8d8d", fontSize: 12, textAlign: "center" }}>{error}</Text>
          ) : null}
          <Pressable
            onPress={handleJoin}
            style={{
              backgroundColor: "#9b59b6", borderRadius: 12,
              paddingVertical: 14, alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>🔗 Rejoindre</Text>
          </Pressable>
        </View>
      )}

      {/* Mes rooms actives */}
      {activeRooms.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
            MES ROOMS ACTIVES
          </Text>
          {activeRooms.map((room) => (
            <Pressable
              key={room.id}
              onPress={() => onEnterRoom(room.id)}
              style={{
                backgroundColor: "rgba(155,89,182,0.1)", borderRadius: 14,
                borderWidth: 1, borderColor: "rgba(155,89,182,0.3)",
                padding: 14, gap: 4,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>🔐 {room.name}</Text>
                <View style={{ backgroundColor: "#9b59b6", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>{room.code}</Text>
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {room.memberIds.length}/{room.maxMembers} membres · Expire dans {timeLeft(room.expiresAt)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Vue chat dans une room ───────────────────────────────────────────────────
function RoomChatView({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const secretRooms       = useGameStore((s) => s.secretRooms);
  const secretMessages    = useGameStore((s) => s.secretMessages);
  const sendSecretMessage = useGameStore((s) => s.sendSecretMessage);
  const leaveSecretRoom   = useGameStore((s) => s.leaveSecretRoom);
  const session           = useGameStore((s) => s.session);

  const room     = secretRooms.find((r) => r.id === roomId);
  const messages = secretMessages[roomId] ?? [];
  const userId   = session?.email ?? "local";

  const [input, setInput] = useState("");
  const [timer, setTimer] = useState("");
  const scrollRef         = useRef<ScrollView>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (room) setTimer(timeLeft(room.expiresAt));
    }, 10_000);
    if (room) setTimer(timeLeft(room.expiresAt));
    return () => clearInterval(interval);
  }, [room]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  if (!room) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.muted }}>Room introuvable ou expirée.</Text>
      <Pressable onPress={onLeave} style={{ marginTop: 12 }}>
        <Text style={{ color: colors.accent }}>← Retour</Text>
      </Pressable>
    </View>
  );

  const isExpired = room.expiresAt <= new Date().toISOString();

  function handleSend() {
    const t = input.trim();
    if (!t || isExpired) return;
    setInput("");
    sendSecretMessage(roomId, t);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Room header */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 10,
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: "rgba(155,89,182,0.12)",
        borderBottomWidth: 1, borderColor: "rgba(155,89,182,0.2)",
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>🔐 {room.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Code : <Text style={{ color: "#bb77ee", fontWeight: "800" }}>{room.code}</Text>
            {" · "}{room.memberIds.length}/{room.maxMembers} · Expire : {timer}
          </Text>
        </View>
        <Pressable
          onPress={() => { leaveSecretRoom(roomId); onLeave(); }}
          style={{
            backgroundColor: "rgba(255,100,100,0.15)", borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 6,
          }}
        >
          <Text style={{ color: "#ff8d8d", fontWeight: "700", fontSize: 12 }}>Quitter</Text>
        </Pressable>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isMe = msg.authorId === userId;
          const isSystem = msg.authorId === "system";
          if (isSystem) {
            return (
              <View key={msg.id} style={{ alignItems: "center", marginVertical: 4 }}>
                <Text style={{
                  color: colors.muted, fontSize: 11,
                  backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8,
                  paddingHorizontal: 10, paddingVertical: 4,
                }}>
                  {msg.body}
                </Text>
              </View>
            );
          }
          return (
            <View key={msg.id} style={{ flexDirection: "row", justifyContent: isMe ? "flex-end" : "flex-start" }}>
              <View style={{ maxWidth: "80%", gap: 2 }}>
                {!isMe && (
                  <Text style={{ color: "#bb77ee", fontSize: 10, fontWeight: "700", marginLeft: 4 }}>
                    {msg.authorName}
                  </Text>
                )}
                <View style={{
                  backgroundColor: isMe ? "#9b59b6" : "rgba(255,255,255,0.09)",
                  borderRadius: 14,
                  borderBottomRightRadius: isMe ? 4 : 14,
                  borderBottomLeftRadius: isMe ? 14 : 4,
                  paddingHorizontal: 12, paddingVertical: 8,
                }}>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{msg.body}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 9, marginHorizontal: 4, textAlign: isMe ? "right" : "left" }}>
                  {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          );
        })}

        {isExpired && (
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <Text style={{ color: "#ff8d8d", fontSize: 12 }}>🔒 Cette room a expiré. Tous les messages ont été supprimés.</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      {!isExpired && (
        <View style={{
          flexDirection: "row", gap: 8, alignItems: "center",
          paddingHorizontal: 16, paddingVertical: 10,
          borderTopWidth: 1, borderColor: "rgba(255,255,255,0.07)",
        }}>
          <TextInput
            style={{
              flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20,
              paddingHorizontal: 16, paddingVertical: 11,
              color: colors.text, fontSize: 13, fontWeight: "600",
            }}
            value={input}
            onChangeText={setInput}
            placeholder="Message éphémère…"
            placeholderTextColor={colors.muted}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={handleSend}
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: input.trim() ? "#9b59b6" : "rgba(255,255,255,0.1)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20 }}>→</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Screen principal ──────────────────────────────────────────────────────────
export default function SecretRoomScreen() {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
        backgroundColor: "rgba(7,17,31,0.97)",
        borderBottomWidth: 1, borderColor: "rgba(155,89,182,0.2)",
      }}>
        <Pressable onPress={() => { if (activeRoomId) setActiveRoomId(null); else router.back(); }} style={{ padding: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>← {activeRoomId ? "Rooms" : "Retour"}</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>🔐 Chat Éphémère</Text>
        <View style={{ width: 50 }} />
      </View>

      {activeRoomId
        ? <RoomChatView roomId={activeRoomId} onLeave={() => setActiveRoomId(null)} />
        : <LobbyView onEnterRoom={setActiveRoomId} />
      }
    </View>
  );
}
