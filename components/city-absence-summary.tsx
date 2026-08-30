"use client";

// "Pendant ton absence" — résumé de retour minimal. Alimenté UNIQUEMENT par
// un vrai tick long de la Living City (lib/city-consequences.buildCityDigest,
// 3 items max, uniquement de vrais changements). Rien si rien n'a changé.
// Aucun second simulateur offline : on lit l'état déjà calculé par la sim.
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { useGameStore } from "@/stores/game-store";

const C = {
  bg: "rgba(8,8,15,0.94)",
  border: "rgba(255,214,0,0.4)",
  text: "#F5F2E8",
  muted: "#A8A49A",
  accent: "#FFD600",
};

export function CityAbsenceSummary() {
  const digest = useGameStore((s) => s.livingCity?.cityDigest ?? []);
  const dismiss = useGameStore((s) => s.dismissCityDigest);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (digest.length === 0) return;
    Animated.timing(anim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [digest.length, anim]);

  if (digest.length === 0) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute", left: 12, right: 12, top: 54, zIndex: 60,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
      }}
    >
      <View style={{
        alignSelf: "center", width: "100%", maxWidth: 420,
        backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.border,
        paddingHorizontal: 14, paddingVertical: 12, paddingRight: 44,
      }}>
        <Text style={{ color: C.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }}>
          PENDANT TON ABSENCE
        </Text>
        {digest.slice(0, 3).map((item, i) => (
          <Text key={i} style={{ color: C.text, fontSize: 12.5, lineHeight: 18, marginTop: i === 0 ? 5 : 2 }}>
            • {item}
          </Text>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer le résumé"
          hitSlop={8}
          onPress={() => dismiss()}
          style={{ position: "absolute", top: 6, right: 6, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: C.muted, fontSize: 20 }}>×</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
