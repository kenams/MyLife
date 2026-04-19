import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ROOM_H, ROOM_W, RoomTopView } from "@/components/room-top-view";
import { colors } from "@/lib/theme";
import type { Room, RoomKind } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

function goBack() {
  router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/world");
}

const KIND_META: Record<RoomKind, { color: string; emoji: string; label: string }> = {
  public:  { color: "#38c793", emoji: "🌍", label: "Publique"  },
  private: { color: "#8b7cff", emoji: "🔒", label: "Privée"    },
  event:   { color: "#f6b94f", emoji: "🎉", label: "Événement" },
  secret:  { color: "#9b59b6", emoji: "🔐", label: "Secrète"   },
};

// ─── Mini Preview (vue du dessus réduite) ─────────────────────────────────────
const MINI_SCALE = 0.36;
const MINI_W = ROOM_W * MINI_SCALE;
const MINI_H = ROOM_H * MINI_SCALE;

function RoomMiniPreview({ room }: { room: Room }) {
  return (
    <View style={{
      width: MINI_W, height: MINI_H, borderRadius: 12,
      overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
    }}>
      <View style={{
        width: ROOM_W, height: ROOM_H,
        transform: [{ scale: MINI_SCALE }],
        transformOrigin: "top left" as never,
      }}>
        <RoomTopView room={room} members={[]} myUserId="" />
      </View>
    </View>
  );
}

// ─── Carte room améliorée ─────────────────────────────────────────────────────
function RoomCard({ room, onJoin }: { room: Room; onJoin: () => void }) {
  const meta = KIND_META[room.kind];
  const full = room.memberCount >= room.maxMembers;
  const pct  = (room.memberCount / room.maxMembers) * 100;
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={{
        backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 20,
        borderWidth: 1, borderColor: meta.color + "30", overflow: "hidden"
      }}
    >
      {/* Top strip */}
      <View style={{ height: 3, backgroundColor: meta.color }} />

      <View style={{ padding: 14, gap: 12 }}>
        {/* Header row */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>

          {/* Mini preview */}
          <RoomMiniPreview room={room} />

          {/* Infos */}
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                backgroundColor: meta.color + "18", borderWidth: 1, borderColor: meta.color + "40" }}>
                <Text style={{ color: meta.color, fontSize: 10, fontWeight: "800" }}>
                  {meta.emoji} {meta.label}
                </Text>
              </View>
              {!full && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#38c793" }} />
                  <Text style={{ color: "#38c793", fontSize: 10, fontWeight: "700" }}>Live</Text>
                </View>
              )}
            </View>

            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }} numberOfLines={1}>
              {room.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
              {room.description || "Rejoins la conversation."}
            </Text>

            {/* Membres */}
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  👥 {room.memberCount}/{room.maxMembers}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>par {room.ownerName}</Text>
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.07)" }}>
                <View style={{ height: 4, borderRadius: 2, width: `${pct}%`,
                  backgroundColor: full ? "#ff6b6b" : meta.color }} />
              </View>
            </View>

            {/* Code */}
            {room.code && room.kind === "public" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
                backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 7,
                paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" }}>
                <Text style={{ color: colors.muted, fontSize: 10 }}>Code</Text>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12, letterSpacing: 2 }}>
                  {room.code}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Vue du dessus étendue */}
        {expanded && (
          <View style={{ gap: 10 }}>
            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>
              VUE DU DESSUS
            </Text>
            <View style={{ alignSelf: "center" }}>
              <RoomTopView room={room} members={[]} myUserId="" />
            </View>
          </View>
        )}

        {/* Bouton rejoindre */}
        <Pressable onPress={!full ? onJoin : undefined}
          style={{
            backgroundColor: full ? "rgba(255,255,255,0.04)" : meta.color + "20",
            borderRadius: 12, paddingVertical: 11, alignItems: "center",
            borderWidth: 1, borderColor: full ? "rgba(255,255,255,0.06)" : meta.color + "50",
            flexDirection: "row", justifyContent: "center", gap: 6
          }}
        >
          {!full && <Ionicons name="enter-outline" size={15} color={meta.color} />}
          <Text style={{ color: full ? colors.muted : meta.color, fontWeight: "900", fontSize: 13 }}>
            {full ? "Salle complète" : "Rejoindre la room"}
          </Text>
        </Pressable>

        {/* Toggle preview hint */}
        <Pressable onPress={() => setExpanded(!expanded)} style={{ alignItems: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
            {expanded ? "▲ Réduire" : "▼ Voir la pièce"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RoomsScreen() {
  const rooms      = useGameStore((s) => s.rooms);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom   = useGameStore((s) => s.joinRoom);

  const [tab, setTab]           = useState<"browse" | "join" | "create">("browse");
  const [newName, setNewName]   = useState("");
  const [newDesc, setNewDesc]   = useState("");
  const [newKind, setNewKind]   = useState<RoomKind>("public");
  const [joinCode, setJoinCode] = useState("");
  const [createError, setCreateError]     = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [joinError, setJoinError]         = useState("");

  const handleCreate = () => {
    setCreateError(""); setCreateSuccess("");
    if (!newName.trim()) { setCreateError("Donne un nom à ta room."); return; }
    const room = createRoom(newName.trim(), newDesc.trim(), newKind);
    setCreateSuccess(`Room créée ! Code : ${room.code}`);
    setNewName(""); setNewDesc("");
    setTimeout(() => router.push(`/(app)/room/${room.id}`), 700);
  };

  const handleJoin = () => {
    setJoinError("");
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setJoinError("Code trop court (min 4 caractères)."); return; }
    const room = joinRoom(code);
    if (!room) { setJoinError(`Aucune room avec le code « ${code} ».`); return; }
    router.push(`/(app)/room/${room.id}`);
  };

  const openRoom = (room: Room) => {
    const joined = room.code ? joinRoom(room.code) : room;
    router.push(`/(app)/room/${joined?.id ?? room.id}`);
  };

  const publicRooms = rooms.filter((r) => r.kind === "public"  && r.isActive);
  const privateRooms = rooms.filter((r) => r.kind === "private" && r.isActive);
  const eventRooms  = rooms.filter((r) => r.kind === "event"   && r.isActive);

  const inputStyle = {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    color: colors.text, fontSize: 15, fontWeight: "600" as const,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
  };

  const activeCount = rooms.filter((r) => r.isActive).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── HEADER ── */}
      <View style={{ backgroundColor: "#0b1a2d", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Pressable onPress={goBack}
            style={{ flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.07)" }}>
            <Ionicons name="arrow-back" size={15} color={colors.text} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>Retour</Text>
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>🏠 Rooms</Text>
            <Text style={{ color: colors.muted, fontSize: 10, marginTop: 1 }}>
              {activeCount} room{activeCount !== 1 ? "s" : ""} active{activeCount !== 1 ? "s" : ""}
            </Text>
          </View>
          {/* Bouton Secret Room */}
          <Pressable
            onPress={() => router.push("/(app)/secret-room")}
            style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
              backgroundColor: "rgba(155,89,182,0.2)",
              borderWidth: 1, borderColor: "rgba(155,89,182,0.4)",
            }}
          >
            <Text style={{ fontSize: 14 }}>🔐</Text>
            <Text style={{ color: "#bb77ee", fontSize: 12, fontWeight: "700" }}>Secret</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 6 }}>
          {([
            { key: "browse", label: "Parcourir",  icon: "compass-outline"   },
            { key: "join",   label: "Rejoindre",  icon: "enter-outline"     },
            { key: "create", label: "Créer",       icon: "add-circle-outline" }
          ] as const).map(({ key, label, icon }) => (
            <Pressable key={key} onPress={() => setTab(key)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: "center", gap: 3,
                backgroundColor: tab === key ? colors.accent : "rgba(255,255,255,0.06)" }}>
              <Ionicons name={icon} size={15} color={tab === key ? "#07111f" : colors.muted} />
              <Text style={{ color: tab === key ? "#07111f" : colors.text,
                fontWeight: "700", fontSize: 11 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}>

        {/* ── BROWSE ── */}
        {tab === "browse" && (
          rooms.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 60, gap: 14 }}>
              <Text style={{ fontSize: 56 }}>🏠</Text>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Aucune room active</Text>
              <Text style={{ color: colors.muted, textAlign: "center" }}>
                Crée la première ou rejoins via un code.
              </Text>
              <Pressable onPress={() => setTab("create")}
                style={{ backgroundColor: colors.accent, borderRadius: 16,
                  paddingHorizontal: 24, paddingVertical: 12 }}>
                <Text style={{ color: "#07111f", fontWeight: "900", fontSize: 14 }}>Créer une room 🚀</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* CTA rapide rejoindre room test */}
              <Pressable
                onPress={() => {
                  setTab("join");
                  setJoinCode("LIVE");
                  const room = joinRoom("LIVE");
                  if (room) router.push(`/(app)/room/${room.id}`);
                }}
                style={{
                  backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 18, padding: 16,
                  borderWidth: 1.5, borderColor: "#38c79340",
                  flexDirection: "row", alignItems: "center", gap: 14
                }}
              >
                <Text style={{ fontSize: 32 }}>🎮</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#38c793", fontWeight: "900", fontSize: 15 }}>
                    Room Test LIVE
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    Ava, Noa & Leila t'attendent — code LIVE
                  </Text>
                </View>
                <Ionicons name="enter-outline" size={20} color="#38c793" />
              </Pressable>

              {publicRooms.length > 0 && (
                <>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                    ROOMS PUBLIQUES
                  </Text>
                  {publicRooms.map((r) => (
                    <RoomCard key={r.id} room={r} onJoin={() => openRoom(r)} />
                  ))}
                </>
              )}
              {privateRooms.length > 0 && (
                <>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                    ROOMS PRIVÉES
                  </Text>
                  {privateRooms.map((r) => (
                    <RoomCard key={r.id} room={r} onJoin={() => openRoom(r)} />
                  ))}
                </>
              )}
              {eventRooms.length > 0 && (
                <>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                    ÉVÉNEMENTS
                  </Text>
                  {eventRooms.map((r) => (
                    <RoomCard key={r.id} room={r} onJoin={() => openRoom(r)} />
                  ))}
                </>
              )}
            </>
          )
        )}

        {/* ── JOIN ── */}
        {tab === "join" && (
          <View style={{ gap: 16 }}>
            <Pressable
              onPress={() => {
                setJoinCode("LIVE");
                const room = joinRoom("LIVE");
                if (room) router.push(`/(app)/room/${room.id}`);
              }}
              style={{ backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 20, padding: 18,
                borderWidth: 1.5, borderColor: "#38c79340",
                flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <Text style={{ fontSize: 36 }}>🎮</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#38c793", fontWeight: "900", fontSize: 16 }}>Room Test LIVE</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                  Ava, Noa & Leila t'attendent.{" "}
                  <Text style={{ color: colors.text, fontWeight: "800" }}>Code : LIVE</Text>
                </Text>
              </View>
              <Text style={{ color: "#38c793", fontSize: 20 }}>→</Text>
            </Pressable>

            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>
                Ou entre un code de room :
              </Text>
              <TextInput
                style={[inputStyle, {
                  textAlign: "center", letterSpacing: 8, fontSize: 24,
                  fontWeight: "900" as const, textTransform: "uppercase"
                }]}
                value={joinCode}
                onChangeText={(t) => { setJoinCode(t.toUpperCase()); setJoinError(""); }}
                placeholder="CODE"
                placeholderTextColor={colors.muted}
                maxLength={8}
                autoCapitalize="characters"
                onSubmitEditing={handleJoin}
              />
              {joinError ? (
                <View style={{ backgroundColor: "#ff6b6b12", borderRadius: 10, padding: 12,
                  borderWidth: 1, borderColor: "#ff6b6b30" }}>
                  <Text style={{ color: "#ff6b6b", fontWeight: "700" }}>⚠ {joinError}</Text>
                </View>
              ) : null}
              <Pressable onPress={handleJoin} disabled={joinCode.trim().length < 4}
                style={{
                  backgroundColor: joinCode.trim().length >= 4 ? colors.accent : "rgba(255,255,255,0.07)",
                  borderRadius: 16, paddingVertical: 14, alignItems: "center",
                  flexDirection: "row", justifyContent: "center", gap: 8
                }}
              >
                <Ionicons name="enter-outline" size={16}
                  color={joinCode.trim().length >= 4 ? "#07111f" : colors.muted} />
                <Text style={{
                  color: joinCode.trim().length >= 4 ? "#07111f" : colors.muted,
                  fontWeight: "900", fontSize: 15
                }}>
                  Rejoindre
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── CREATE ── */}
        {tab === "create" && (
          <View style={{ gap: 14 }}>
            <TextInput style={inputStyle} value={newName}
              onChangeText={(t) => { setNewName(t); setCreateError(""); setCreateSuccess(""); }}
              placeholder="Nom de la room" placeholderTextColor={colors.muted} maxLength={40} />
            <TextInput
              style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
              value={newDesc} onChangeText={setNewDesc}
              placeholder="Description (optionnel)" placeholderTextColor={colors.muted}
              multiline maxLength={120}
            />

            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>
              TYPE DE ROOM
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["public", "private", "event"] as RoomKind[]).map((k) => {
                const meta = KIND_META[k];
                return (
                  <Pressable key={k} onPress={() => setNewKind(k)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center", gap: 4,
                      backgroundColor: newKind === k ? meta.color + "20" : "rgba(255,255,255,0.04)",
                      borderWidth: 1.5, borderColor: newKind === k ? meta.color : "rgba(255,255,255,0.08)" }}>
                    <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
                    <Text style={{ color: newKind === k ? meta.color : colors.muted,
                      fontWeight: "800", fontSize: 12 }}>{meta.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Prévisualisation du type */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                APERÇU DE LA PIÈCE
              </Text>
              <View style={{ alignSelf: "center" }}>
                <RoomTopView
                  room={{
                    id: "preview", name: newName || "Ma Room", kind: newKind,
                    code: "PREV", ownerId: "", ownerName: "Toi",
                    locationSlug: newKind === "event" ? "event-hall" : newKind === "private" ? "home" : "cafe",
                    memberCount: 1, maxMembers: 20, description: newDesc,
                    createdAt: new Date().toISOString(), isActive: true
                  }}
                  members={[]}
                  myUserId=""
                />
              </View>
            </View>

            {createError ? (
              <View style={{ backgroundColor: "#ff6b6b12", borderRadius: 10, padding: 12,
                borderWidth: 1, borderColor: "#ff6b6b30" }}>
                <Text style={{ color: "#ff6b6b", fontWeight: "700" }}>⚠ {createError}</Text>
              </View>
            ) : null}
            {createSuccess ? (
              <View style={{ backgroundColor: "#38c79312", borderRadius: 10, padding: 12,
                borderWidth: 1, borderColor: "#38c79330" }}>
                <Text style={{ color: "#38c793", fontWeight: "700" }}>✓ {createSuccess}</Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Redirection…</Text>
              </View>
            ) : null}

            <Pressable onPress={handleCreate} disabled={!newName.trim()}
              style={{
                backgroundColor: newName.trim() ? colors.accent : "rgba(255,255,255,0.07)",
                borderRadius: 16, paddingVertical: 14, alignItems: "center",
                flexDirection: "row", justifyContent: "center", gap: 8
              }}
            >
              <Ionicons name="add-circle-outline" size={16}
                color={newName.trim() ? "#07111f" : colors.muted} />
              <Text style={{ color: newName.trim() ? "#07111f" : colors.muted,
                fontWeight: "900", fontSize: 15 }}>
                Créer la room 🚀
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
