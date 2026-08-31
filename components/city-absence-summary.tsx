"use client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useGameStore } from "@/stores/game-store";

const DISMISSED_KEY = "mylife:last-dismissed-absence-summary";

export function CityAbsenceSummary() {
  const summary = useGameStore((s) => s.livingCity?.lastAbsenceSummary ?? []);
  const session = useGameStore((s) => s.session);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const items = useMemo(
    () => Array.from(new Set(summary.map((item) => item.trim()).filter(Boolean))).slice(0, 3),
    [summary]
  );
  const key = useMemo(() => items.join("\n"), [items]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((value) => {
        if (mounted) setDismissed(value);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!session || !ready || items.length === 0 || dismissed === key) return null;

  const dismiss = () => {
    setDismissed(key);
    void AsyncStorage.setItem(DISMISSED_KEY, key);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: 58, left: 12, right: 12, zIndex: 80, alignItems: "center" }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 430,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "rgba(255,214,0,0.38)",
          backgroundColor: "rgba(7,10,18,0.95)",
          paddingHorizontal: 14,
          paddingVertical: 12,
          paddingRight: 48,
        }}
      >
        <Text style={{ color: "#FFD600", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }}>
          PENDANT TON ABSENCE
        </Text>
        {items.map((item, index) => (
          <Text
            key={`${index}:${item}`}
            style={{ color: "#F5F2E8", fontSize: 13, lineHeight: 19, marginTop: index === 0 ? 6 : 2 }}
          >
            • {item}
          </Text>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer le résumé"
          hitSlop={8}
          onPress={dismiss}
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#AAA79D", fontSize: 22 }}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}
