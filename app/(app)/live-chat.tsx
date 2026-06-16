import { useEffect, useRef, useState } from "react";
import {
  FlatList, KeyboardAvoidingView, Platform,
  Pressable, Text, TextInput, View,
} from "react-native";

import { hapticImpact } from "@/lib/safe-haptics";
import {
  fetchQuartierMessages, sendQuartierMessage, subscribeQuartier,
  PARIS_QUARTIERS_LIST,
} from "@/lib/live-chat";
import type { QuartierMessage } from "@/lib/live-chat";
import { useGameStore } from "@/stores/game-store";
import { router, useLocalSearchParams } from "expo-router";

const L = {
  bg:      "#080808",
  card:    "#111111",
  text:    "#F5F2E8",
  soft:    "#A8A49A",
  muted:   "#4A4844",
  border:  "rgba(255,255,255,0.07)",
  primary: "#FFD600",
  purple:  "#BF5FFF",
  red:     "#FF3B3B",
  green:   "#39FF14",
};

function Bubble({ msg, isMe }: { msg: QuartierMessage; isMe: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit",
  });

  if (isMe) {
    return (
      <View style={{ alignItems: "flex-end", marginBottom: 10, paddingHorizontal: 16 }}>
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
    <View style={{ marginBottom: 10, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
        <Text style={{ fontSize: 12 }}>{msg.avatar_emoji}</Text>
        <Text style={{ color: msg.is_star ? L.purple : L.soft,
          fontSize: 11, fontWeight: "800" }}>
          {msg.display_name}
        </Text>
        {msg.is_star && (
          <View style={{ backgroundColor: L.purple, borderRadius: 3,
            paddingHorizontal: 4, paddingVertical: 1 }}>
            <Text style={{ color: "#fff", fontSize: 8, fontWeight: "900" }}>STAR</Text>
          </View>
        )}
        <Text style={{ color: L.muted, fontSize: 10, marginLeft: "auto" }}>{time}</Text>
      </View>
      <View style={{ backgroundColor: L.card, borderRadius: 16,
        borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 9,
        maxWidth: "75%",
        borderWidth: msg.is_star ? 1 : 0, borderColor: L.purple + "30" }}>
        <Text style={{ color: L.text, fontSize: 14 }}>{msg.body}</Text>
      </View>
    </View>
  );
}

export default function LiveChatScreen() {
  const { quartier = "Saint-Denis" } = useLocalSearchParams<{ quartier?: string }>();
  const avatar  = useGameStore((s) => s.avatar);
  const session = useGameStore((s) => s.session);
  const myId    = session?.id ?? "local_user";

  const [messages, setMessages] = useState<QuartierMessage[]>([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const listRef = useRef<FlatList>(null);
  const q = PARIS_QUARTIERS_LIST.find((q) => q.id === quartier);

  useEffect(() => {
    fetchQuartierMessages(quartier).then((msgs) => {
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
    });
  }, [quartier]);

  useEffect(() => {
    const sub = subscribeQuartier(quartier, (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return () => { sub?.unsubscribe(); };
  }, [quartier]);

  async function send() {
    const body = input.trim();
    if (!body || sending) return;
    setInput("");
    setSending(true);
    hapticImpact("light");

    const opt: QuartierMessage = {
      id: `opt_${Date.now()}`, quartier,
      user_id: myId, display_name: avatar?.displayName ?? "Moi",
      avatar_emoji: "🧢", body, is_star: false,
      created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, opt]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    await sendQuartierMessage({
      quartier, userId: myId,
      displayName: avatar?.displayName ?? "Moi",
      avatarEmoji: "🧢", body,
    });
    setSending(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: L.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}>

      {/* Header minimal */}
      <View style={{ paddingTop: 54, paddingBottom: 14, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: L.border,
        flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: L.card,
            alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: L.text, fontSize: 16 }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 20 }}>{q?.emoji ?? "💬"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: L.text, fontSize: 16, fontWeight: "900" }}>{quartier}</Text>
          <Text style={{ color: L.muted, fontSize: 11 }}>Live · messages effacés dans 24h</Text>
        </View>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: L.green,
          shadowColor: L.green, shadowOpacity: 1, shadowRadius: 4 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Bubble msg={item} isMe={item.user_id === myId} />}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 100, gap: 10 }}>
            <Text style={{ fontSize: 36 }}>💬</Text>
            <Text style={{ color: L.soft, fontSize: 14 }}>Aucun message encore.</Text>
            <Text style={{ color: L.muted, fontSize: 13 }}>Commence la conv !</Text>
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
          placeholder="Écris quelque chose..."
          placeholderTextColor={L.muted}
          multiline maxLength={500}
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
