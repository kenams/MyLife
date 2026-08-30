"use client";

/**
 * GainToast — feedback visuel standardisé de chaque gain (Phase C).
 * Écoute `lastGain` du store et fait apparaître une pastille flottante
 * « +X XP · +Y 🪙 · +Z rép » avec haptique. Monté une seule fois, au niveau
 * du layout de l'app, pour flotter au-dessus de tous les écrans.
 */

import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Text, View } from "react-native";
import { useGameStore } from "@/stores/game-store";
import { hapticImpact } from "@/lib/safe-haptics";
import { wory } from "@/lib/branding";

const C = {
  bg: "#141414",
  border: "rgba(255,214,0,0.35)",
  xp: "#FFD600",
  money: "#39FF14",
  rep: "#00B4FF",
  text: "#F5F2E8",
};

export function GainToast() {
  const lastGain = useGameStore((s) => s.lastGain);
  const playerLevel = useGameStore((s) => s.playerLevel ?? 1);
  const [shown, setShown] = useState<typeof lastGain>(null);
  const [shownLevel, setShownLevel] = useState<number | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const seenAt = useRef(0);
  const seenLevel = useRef(playerLevel);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.current = v;
    });
  }, []);

  useEffect(() => {
    if (!lastGain || lastGain.at === seenAt.current) return;
    seenAt.current = lastGain.at;
    setShown(lastGain);
    const leveledUp = playerLevel > seenLevel.current;
    setShownLevel(leveledUp ? playerLevel : null);
    seenLevel.current = Math.max(seenLevel.current, playerLevel);
    hapticImpact("light");

    const inMs = reduceMotion.current ? 0 : 220;
    const outMs = reduceMotion.current ? 0 : 260;
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: inMs, easing: Easing.out(Easing.back(1.4)), useNativeDriver: Platform.OS !== "web" }),
      Animated.delay(1250),
      Animated.timing(anim, { toValue: 0, duration: outMs, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
    ]).start(({ finished }) => {
      if (finished) {
        setShown(null);
        setShownLevel(null);
      }
    });
  }, [lastGain, playerLevel, anim]);

  if (!shown) return null;

  const parts: { label: string; color: string }[] = [];
  if (shownLevel) {
    parts.push({ label: shownLevel === 2 ? "NIVEAU 2 · CREWS DÉBLOQUÉS" : `NIVEAU ${shownLevel}`, color: C.money });
  }
  if (shown.xp > 0) parts.push({ label: `+${shown.xp} XP`, color: C.xp });
  if (shown.money > 0) parts.push({ label: wory(shown.money, { sign: true }), color: C.money });
  if (shown.reputation > 0) parts.push({ label: `+${shown.reputation} rép`, color: C.rep });
  if (parts.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 92, left: 0, right: 0, alignItems: "center", zIndex: 9999 }}
    >
      <Animated.View
        style={{
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: C.bg,
          borderColor: C.border,
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: 16,
          paddingVertical: 8,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        {parts.map((p, i) => (
          <View key={p.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {i > 0 && <View style={{ width: 1, height: 12, backgroundColor: "rgba(255,255,255,0.12)" }} />}
            <Text style={{ color: p.color, fontWeight: "900", fontSize: 14 }}>{p.label}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
