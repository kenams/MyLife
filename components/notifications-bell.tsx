"use client";
import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useGameStore } from "@/stores/game-store";
import type { NotificationItem } from "@/lib/types";

const C = {
  bg:    "#0E0E16", border: "rgba(255,255,255,0.08)",
  text:  "#E8E4DC", soft:   "#9A968E", muted: "#4A4848",
  gold:  "#FFD600", green:  "#39FF14", red:   "#FF3B3B",
  blue:  "#00B4FF", purple: "#BF5FFF",
};

const KIND_CONFIG: Record<string, { color: string; emoji: string }> = {
  needs:   { color: C.red,    emoji: "⚠️" },
  social:  { color: C.blue,   emoji: "💬" },
  work:    { color: C.gold,   emoji: "💼" },
  reward:  { color: C.green,  emoji: "🎁" },
  tip:     { color: C.purple, emoji: "💡" },
};

export function NotificationsBell({ style }: { style?: object }) {
  const notifications   = useGameStore((s) => s.notifications);
  const markRead        = useGameStore((s) => s.markNotificationRead);
  const [open, setOpen] = useState(false);
  const shake           = useRef(new Animated.Value(0)).current;

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (unread === 0) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [unread]);

  function handleOpen() {
    setOpen(true);
    notifications.filter((n) => !n.read).forEach((n) => markRead(n.id));
  }

  return (
    <>
      <Animated.View style={[style, {
        transform: [{ rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ["-12deg", "12deg"] }) }],
      }]}>
        <Pressable onPress={handleOpen} style={{ position: "relative" }}>
          <Text style={{ fontSize: 22 }}>🔔</Text>
          {unread > 0 && (
            <View style={{
              position: "absolute", top: -4, right: -4,
              backgroundColor: C.red, borderRadius: 8,
              minWidth: 16, height: 16, alignItems: "center", justifyContent: "center",
              paddingHorizontal: 3,
            }}>
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)" }} onPress={() => setOpen(false)}>
          <View style={{ position: "absolute", top: 80, right: 16, left: 16,
            backgroundColor: C.bg, borderRadius: 20, borderWidth: 1, borderColor: C.border,
            maxHeight: 480, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 12,
              borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: "900", flex: 1 }}>🔔 Notifications</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Text style={{ color: C.muted, fontSize: 20 }}>×</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
              {notifications.length === 0 && (
                <Text style={{ color: C.muted, textAlign: "center", padding: 24, fontSize: 13 }}>
                  Aucune notification.
                </Text>
              )}
              {notifications.slice(0, 30).map((n) => {
                const cfg = KIND_CONFIG[n.kind] ?? KIND_CONFIG.tip;
                return (
                  <View key={n.id} style={{
                    flexDirection: "row", alignItems: "flex-start", gap: 12,
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: C.border,
                    backgroundColor: n.read ? "transparent" : cfg.color + "08",
                  }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10,
                      backgroundColor: cfg.color + "18", alignItems: "center", justifyContent: "center",
                      borderWidth: 1, borderColor: cfg.color + "30" }}>
                      <Text style={{ fontSize: 16 }}>{cfg.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: "700", lineHeight: 18 }}>
                        {n.title}
                      </Text>
                      {n.body ? (
                        <Text style={{ color: C.soft, fontSize: 11, marginTop: 1 }}>{n.body}</Text>
                      ) : null}
                      <Text style={{ color: C.muted, fontSize: 10, marginTop: 3 }}>
                        {new Date(n.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                    {!n.read && (
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cfg.color, marginTop: 5 }} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
