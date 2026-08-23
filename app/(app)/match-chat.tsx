import { useEffect, useRef, useState } from "react";
import {
  FlatList, KeyboardAvoidingView, Platform,
  Pressable, Text, TextInput, View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { hapticImpact } from "@/lib/safe-haptics";
import { fetchMessages, sendMatchMessage, subscribeToConversation } from "@/lib/match-chat";
import type { ChatMessage } from "@/lib/match-chat";
import { supabase } from "@/lib/supabase";

const L = {
  bg:      "#080808",
  card:    "#111111",
  text:    "#F5F2E8",
  soft:    "#A8A49A",
  muted:   "#4A4844",
  border:  "rgba(255,255,255,0.07)",
  primary: "#FFD600",
  green:   "#39FF14",
};

function Bubble({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
    <View style={{ alignItems: isMe ? "flex-end" : "flex-start", marginBottom: 8, paddingHorizontal: 16 }}>
      <View style={{
        backgroundColor: isMe ? L.primary : L.card, borderRadius: 16,
        borderBottomRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: isMe ? 16 : 4,
        paddingHorizontal: 14, paddingVertical: 9, maxWidth: "75%",
        borderWidth: isMe ? 0 : 1, borderColor: L.border,
      }}>
        <Text style={{ color: isMe ? "#080808" : L.text, fontSize: 14, fontWeight: isMe ? "700" : "400" }}>
          {msg.body}
        </Text>
      </View>
      <Text style={{ color: L.muted, fontSize: 10, marginTop: 3 }}>{time}</Text>
    </View>
  );
}

export default function MatchChatScreen() {
  const { conversationId, targetName, targetEmoji } =
    useLocalSearchParams<{ conversationId: string; targetName?: string; targetEmoji?: string }>();

  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!conversationId) router.back();
  }, [conversationId]);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    fetchMessages(conversationId).then((msgs) => {
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
    });
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const sub = subscribeToConversation(conversationId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return () => { sub?.unsubscribe(); };
  }, [conversationId]);

  async function send() {
    if (!conversationId) return;
    const body = input.trim();
    if (!body || sending) return;
    setInput(""); setSending(true); setError(null);
    hapticImpact("light");

    const res = await sendMatchMessage(conversationId, body);
    if (!res.ok) setError(res.error ?? "Envoi impossible");
    // Pas d'optimistic update séparé : le realtime INSERT (ou le prochain
    // fetch) rapatrie le message réel, source de vérité unique.
    setSending(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: L.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}>

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
          <Text style={{ fontSize: 20 }}>{targetEmoji ?? "💫"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: L.text, fontSize: 16, fontWeight: "900" }}>
            {targetName ?? "Match"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: L.green }} />
            <Text style={{ color: L.muted, fontSize: 11 }}>Match mutuel</Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Bubble msg={item} isMe={item.sender_id === myId} />}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 80, gap: 12 }}>
            <Text style={{ fontSize: 36 }}>💫</Text>
            <Text style={{ color: L.soft, fontSize: 15, fontWeight: "700" }}>C'est un match !</Text>
            <Text style={{ color: L.muted, fontSize: 13 }}>Lancez la conversation</Text>
          </View>
        }
      />

      {error && (
        <Text style={{ color: "#FF3B3B", fontSize: 12, textAlign: "center", paddingBottom: 6 }}>
          {error}
        </Text>
      )}

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10,
        paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32,
        borderTopWidth: 1, borderTopColor: L.border }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Écris un message..."
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
