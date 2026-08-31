"use client";

import { router, usePathname } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  cityPulseRoute,
  livingCityEventsToCityPulse,
  selectCityPulseOpportunities,
  type CityPulseKind,
} from "@/lib/city-pulse";
import { useGameStore } from "@/stores/game-store";

const KIND_LABEL: Record<CityPulseKind, string> = {
  CHALLENGE: "DÉFI",
  SOCIAL: "SOCIAL",
  DATING: "RENCONTRE",
  CREW: "CREW",
  MISSION: "MISSION",
  EXPLORATION: "EXPLORATION",
  EVENT: "ÉVÉNEMENT",
  CITY: "VILLE",
};

export function CityPulseDirector() {
  const pathname = usePathname();
  const session = useGameStore((s) => s.session);
  const avatar = useGameStore((s) => s.avatar);
  const livingCity = useGameStore((s) => s.livingCity);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const opportunity = useMemo(() => {
    if (!livingCity?.events?.length) return null;
    const signals = livingCityEventsToCityPulse(livingCity.events);
    return selectCityPulseOpportunities(
      signals,
      { district: avatar?.homeDistrict ?? null },
      1
    )[0] ?? null;
  }, [avatar?.homeDistrict, livingCity?.events]);

  const onMap = pathname === "/map" || pathname.endsWith("/map");
  if (!session || !avatar || !onMap || !opportunity || dismissedId === opportunity.id) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 12, right: 12, bottom: 86, zIndex: 70, alignItems: "center" }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 430,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "rgba(255,214,0,0.3)",
          backgroundColor: "rgba(7,10,18,0.94)",
          padding: 12,
          paddingRight: 46,
        }}
      >
        <Text style={{ color: "#FFD600", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }}>
          MAINTENANT · {KIND_LABEL[opportunity.kind]}
        </Text>
        <Text style={{ color: "#F5F2E8", fontSize: 14, fontWeight: "800", marginTop: 4 }} numberOfLines={1}>
          {opportunity.title}
        </Text>
        <Text style={{ color: "#B5B1A8", fontSize: 12, lineHeight: 17, marginTop: 2 }} numberOfLines={2}>
          {opportunity.body}
        </Text>

        {opportunity.actionable !== false && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voir ${opportunity.title}`}
            onPress={() => router.push(cityPulseRoute(opportunity) as never)}
            style={{
              alignSelf: "flex-start",
              minHeight: 44,
              justifyContent: "center",
              marginTop: 6,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: "rgba(255,214,0,0.12)",
            }}
          >
            <Text style={{ color: "#FFD600", fontSize: 12, fontWeight: "900" }}>Y ALLER</Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Masquer cette suggestion"
          hitSlop={8}
          onPress={() => setDismissedId(opportunity.id)}
          style={{ position: "absolute", top: 4, right: 4, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: "#AAA79D", fontSize: 21 }}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}
