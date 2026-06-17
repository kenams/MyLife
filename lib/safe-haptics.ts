import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

type ImpactStrength = "light" | "medium" | "heavy";

function canUseHaptics() {
  return Platform.OS !== "web";
}

export function hapticImpact(strength: ImpactStrength = "light") {
  if (!canUseHaptics()) return;

  const style = strength === "heavy"
    ? Haptics.ImpactFeedbackStyle.Heavy
    : strength === "medium"
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Light;

  void Haptics.impactAsync(style).catch(() => undefined);
}

export function hapticSuccess() {
  if (!canUseHaptics()) return;

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
