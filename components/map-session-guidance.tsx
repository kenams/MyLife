import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";

import type { CityPulseSignal } from "@/lib/city-pulse";
import { mapOpportunityIcon, mapOpportunityKindLabel } from "@/lib/map-opportunity-presentation";

type Palette = {
  background: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
};

export function MapFirstSessionHint({
  visible,
  onDismiss,
  bottom,
  palette,
}: {
  visible: boolean;
  onDismiss: () => void;
  bottom: number;
  palette: Palette;
}) {
  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, bottom, zIndex: 30 }}>
      <View style={{
        maxWidth: 390, alignSelf: "center", width: "100%", minHeight: 76,
        backgroundColor: palette.background, borderRadius: 8, borderWidth: 1,
        borderColor: palette.border, paddingLeft: 13, paddingVertical: 10, paddingRight: 52,
      }}>
        <Text style={{ color: palette.accent, fontSize: 12, fontWeight: "900" }}>Explore la ville</Text>
        <Text style={{ color: palette.text, fontSize: 12, lineHeight: 17, marginTop: 3 }}>
          Touche un habitant, une mission ou ☰ pour voir ce qui se passe.
        </Text>
        <Text style={{ color: palette.muted, fontSize: 10, marginTop: 3 }}>
          Active ta position pour apparaître dans MyLife.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer l'aide de la carte"
          hitSlop={6}
          onPress={onDismiss}
          style={{ position: "absolute", top: 8, right: 8, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: palette.text, fontSize: 22 }}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function MapPrimarySuggestion({
  signal,
  visible,
  onPress,
  onDismiss,
  bottom,
  palette,
}: {
  signal: CityPulseSignal | null;
  visible: boolean;
  onPress: (signal: CityPulseSignal) => void;
  onDismiss: () => void;
  bottom: number;
  palette: Palette;
}) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible || !signal) return;
    const timeout = setTimeout(() => onDismissRef.current(), 7000);
    return () => clearTimeout(timeout);
  }, [signal, visible]);

  if (!visible || !signal) return null;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, bottom, zIndex: 24 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${mapOpportunityKindLabel(signal.kind)} : ${signal.title}`}
        onPress={() => onPress(signal)}
        style={{
          maxWidth: 390, alignSelf: "center", width: "100%", minHeight: 56,
          backgroundColor: palette.background, borderRadius: 8, borderWidth: 1,
          borderColor: palette.border, paddingLeft: 12, paddingVertical: 9, paddingRight: 48,
          flexDirection: "row", alignItems: "center", gap: 10,
        }}>
        <Text style={{ fontSize: 20 }}>{mapOpportunityIcon(signal.kind)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.accent, fontSize: 9, fontWeight: "900" }}>
            {mapOpportunityKindLabel(signal.kind).toUpperCase()}{signal.district ? ` · ${signal.district}` : ""}
          </Text>
          <Text style={{ color: palette.text, fontSize: 12, fontWeight: "800", marginTop: 2 }} numberOfLines={2}>
            {signal.title}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Masquer la suggestion"
        hitSlop={6}
        onPress={onDismiss}
        style={{ position: "absolute", top: 8, right: 8, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: palette.muted, fontSize: 20 }}>×</Text>
      </Pressable>
    </View>
  );
}
