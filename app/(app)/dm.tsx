import { useEffect, useRef, useState } from "react";
import {
  FlatList, KeyboardAvoidingView, Platform,
  Pressable, Text, TextInput, View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { hapticImpact } from "@/lib/safe-haptics";
import { dmRoomId, fetchDmMessages, sendDm, subscribeDm } from "@/lib/live-chat";
import type { DmMessage } from "@/lib/live-chat";
import { useGameStore } from "@/stores/game-store";

const L = {
  bg:      "#080808",
  card:    "#111111",
  text:    "#F5F2E8",
  soft:    "#A8A49A",
  muted:   "#4A4844",
  border:  "rgba(255,255,255,0.07)",
  primary: "#FFD600",
  purple:  "#BF5FFF",
  green:   "#39FF14",
};

function Bubble({ msg, isMe }: { msg: DmMessage; isMe: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit",
  });
  if (isMe) {
    return (
      <View style={{ alignItems: "flex-end", marginBottom: 8, paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: L.primary, borderRadius: 16,
          borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 9,
          maxWidth: "75%" }}>
          <Text style={{ color: "#080808", fontSize: 14, fontWeight: "700" }}>{msg.body}</Text>
        </View>
        <Text style={{ color: L.muted, fontSize: 10, marginTop: 3 }}>{time}</Text>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 8, paddingHorizontal: 16 }}>
      <Text style={{ color: L.soft, fontSize: 11, fontWeight: "700",
        marginBottom: 3, marginLeft: 2 }}>
        {msg.sender_emoji} {msg.sender_name}
      </Text>
      <View style={{ backgroundColor: L.card, borderRadius: 16,
        borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 9,
        maxWidth: "75%", borderWidth: 1, borderColor: L.border }}>
        <Text style={{ color: L.text, fontSize: 14 }}>{msg.body}</Text>
      </View>
      <Text style={{ color: L.muted, fontSize: 10, marginTop: 3, marginLeft: 2 }}>{time}</Text>
    </View>
  );
}

export default function DmScreen() {
  const { targetId, targetName, targetEmoji } =
    useLocalSearchParams<{ targetId: string; targetName: string; targetEmoji: string }>();

  const avatar  = useGameStore((s) => s.avatar);
  const session = useGameStore((s) => s.session);
  const myId    = session?.id ?? "local_user";
  const roomId  = dmRoomId(myId, targetId ?? "unknown");

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchDmMessages(roomId).then((msgs) => {
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
    });
  }, [roomId]);

  useEffect(() => {
    const sub = subscribeDm(roomId, (msg) => {
      // Ignore mes propres messages déjà injectés en optimiste
      if (msg.sender_id === myId) return;
      setMessages((p) => [...p, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return () => { sub?.unsubscribe(); };
  }, [roomId]);

  async function send() {
    const body = input.trim();
    if (!body || sending) return;
    setInput(""); setSending(true);
    hapticImpact("light");

    const opt: DmMessage = {
      id: `opt_${Date.now()}`, room_id: roomId,
      sender_id: myId, sender_name: avatar?.displayName ?? "Moi",
      sender_emoji: "🧢", body, read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, opt]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    await sendDm({
      roomId, senderId: myId,
      senderName: avatar?.displayName ?? "Moi",
      senderEmoji: "🧢", body,
    });
    setSending(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: L.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}>

      {/* Header */}
      <View style={{ paddingTop: 54, paddingBottom: 14, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: L.border,
        flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: L.card,
            alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: L.text, fontSize: 16 }}>←</Text>
        </Pressable>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: L.card,
          borderWidth: 1, borderColor: L.border,
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20 }}>{targetEmoji ?? "🧢"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: L.text, fontSize: 16, fontWeight: "900" }}>
            {targetName ?? "Joueur"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: L.green }} />
            <Text style={{ color: L.muted, fontSize: 11 }}>En ligne · Life Map</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Bubble msg={item} isMe={item.sender_id === myId} />}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 80, gap: 12 }}>
            <Text style={{ fontSize: 36 }}>{targetEmoji ?? "🧢"}</Text>
            <Text style={{ color: L.soft, fontSize: 15, fontWeight: "700" }}>
              {targetName ?? "Joueur"}
            </Text>
            <Text style={{ color: L.muted, fontSize: 13 }}>
              Commence la conversation
            </Text>
          </View>
        }
      />

      {/* Saisie */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10,
        paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32,
        borderTopWidth: 1, borderTopColor: L.border }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={`Message à ${targetName ?? "joueur"}...`}
          placeholderTextColor={L.muted}
          multiline maxLength={1000}
          style={{ flex: 1, backgroundColor: L.card, borderRadius: 20,
            paddingHorizontal: 16, paddingVertical: 10,
            color: L.text, fontSize: 14, maxHeight: 100,
            borderWidth: 1, borderColor: input ? L.primary + "30" : L.border }}
        />
        <Pressable onPress={send} disabled={!input.trim() || sending}
          style={{ width: 42, height: 42, borderRadius: 21,
            backgroundColor: input.trim() ? L.primary : L.card,
            alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 17 }}>{sending ? "⏳" : "➤"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
