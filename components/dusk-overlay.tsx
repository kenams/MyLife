import { useEffect, useRef } from "react";
import { Animated } from "react-native";

export function DuskOverlay() {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    function update() {
      const hour = new Date().getHours();
      const isDusk = hour >= 22 || hour < 7;
      Animated.timing(opacity, {
        toValue: isDusk ? 0.18 : 0,
        duration: 1200,
        useNativeDriver: true,
      }).start();
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "#0d0620",
        opacity,
        zIndex: 9999,
      }}
    />
  );
}
