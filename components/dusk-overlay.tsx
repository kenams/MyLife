import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

import { useWorldEnvironment } from "@/hooks/use-world-environment";
import { ambientOverlay, weatherOverlay } from "@/lib/world-environment";

/**
 * Voile d'ambiance global (jour/nuit + météo). Piloté par World Environment,
 * transitions douces, pointer-events none. Une seule instance (app/_layout).
 */
export function DuskOverlay() {
  const env = useWorldEnvironment();
  const ambient = ambientOverlay(env);
  const rawWeather = weatherOverlay(env);
  // Voile global = chrome de l'app : encore plus discret que sur la carte.
  const weather = { ...rawWeather, opacity: Math.min(0.14, rawWeather.opacity * 0.5) };

  const ambientOpacity = useRef(new Animated.Value(ambient.opacity)).current;
  const weatherOpacity = useRef(new Animated.Value(weather.opacity)).current;

  useEffect(() => {
    Animated.timing(ambientOpacity, { toValue: ambient.opacity, duration: 1600, useNativeDriver: true }).start();
  }, [ambient.opacity, ambientOpacity]);

  useEffect(() => {
    Animated.timing(weatherOpacity, { toValue: weather.opacity, duration: 1600, useNativeDriver: true }).start();
  }, [weather.opacity, weatherOpacity]);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: ambient.color, opacity: ambientOpacity, zIndex: 9998 }]}
      />
      {weather.kind && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: weather.color, opacity: weatherOpacity, zIndex: 9999 }]}
        />
      )}
    </>
  );
}
