"use client";

/**
 * Paliers de ville (Phase C) — ce que la progression du joueur ouvre dans
 * Toulouse. Rend visible le prochain déblocage (« pourquoi je continue »)
 * et la liste complète (débloqués / à venir). Lit uniquement le store.
 */

import { Text, View } from "react-native";
import { useGameStore } from "@/stores/game-store";
import { CITY_UNLOCKS, nextCityUnlock } from "@/lib/progression";

const L = {
  card: "#101010",
  border: "rgba(255,255,255,0.08)",
  text: "#F5F2E8",
  textSoft: "#A8A49A",
  muted: "#4A4844",
  gold: "#FFD600",
  green: "#39FF14",
};

export function CityUnlocks() {
  const level = useGameStore((s) => s.playerLevel);
  const next = nextCityUnlock(level);

  return (
    <View
      style={{
        margin: 16,
        marginTop: 0,
        backgroundColor: L.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: L.border,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: L.border }}>
        <Text style={{ color: L.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>PALIERS DE VILLE</Text>
        {next ? (
          <>
            <Text style={{ color: L.text, fontSize: 15.5, fontWeight: "900", marginTop: 6 }}>
              {next.emoji} {next.name}
            </Text>
            <Text style={{ color: L.textSoft, fontSize: 12.5, marginTop: 2 }}>{next.hint}</Text>
            <Text style={{ color: L.gold, fontSize: 11.5, fontWeight: "900", marginTop: 6 }}>
              Niveau {next.unlockLevel} · encore {next.unlockLevel - level} niveau
              {next.unlockLevel - level > 1 ? "x" : ""}
            </Text>
          </>
        ) : (
          <Text style={{ color: L.green, fontSize: 13.5, fontWeight: "800", marginTop: 6 }}>
            Toute la ville est ouverte. 👑
          </Text>
        )}
      </View>

      <View style={{ padding: 12 }}>
        {CITY_UNLOCKS.map((u) => {
          const open = level >= u.unlockLevel;
          return (
            <View
              key={u.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 8,
                paddingHorizontal: 6,
                opacity: open ? 1 : 0.5,
              }}
            >
              <Text style={{ fontSize: 15 }}>{open ? u.emoji : "🔒"}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: L.text,
                    fontSize: 13,
                    fontWeight: "700",
                    textDecorationLine: open ? "none" : "none",
                  }}
                >
                  {u.name}
                </Text>
                <Text style={{ color: L.textSoft, fontSize: 11 }}>{u.hint}</Text>
              </View>
              <Text style={{ color: open ? L.green : L.muted, fontSize: 10.5, fontWeight: "900" }}>
                {open ? "OK" : `Nv ${u.unlockLevel}`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
