import { Pressable, Text, View } from "react-native";

import { populationForPreset, type LivingCityPreset, type LivingCitySpeed } from "@/lib/living-city";
import { useGameStore } from "@/stores/game-store";

const PRESETS: LivingCityPreset[] = ["LOW", "NORMAL", "BUSY", "CHAOS"];
const SPEEDS: LivingCitySpeed[] = [1, 5, 20];

function isDevPanelAllowed() {
  return typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";
}

const L = {
  bg: "#101010",
  border: "rgba(255,255,255,0.12)",
  text: "#F5F2E8",
  soft: "#A8A49A",
  accent: "#00FFD1",
  warn: "#FFD600",
};

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 36,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: L.border,
        justifyContent: "center",
      }}
    >
      <Text style={{ color: L.text, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

export function LivingCityDevPanel() {
  const allowed = isDevPanelAllowed();
  const livingCity = useGameStore((s) => s.livingCity);
  const npcs = useGameStore((s) => s.npcs);
  const configure = useGameStore((s) => s.configureLivingCity);
  const spawnNpc = useGameStore((s) => s.spawnLivingNpc);
  const createCrew = useGameStore((s) => s.createNpcCrew);
  const trigger = useGameStore((s) => s.triggerLivingCityEvent);
  const runTick = useGameStore((s) => s.runLivingCityTick);
  const reset = useGameStore((s) => s.resetLivingCity);

  if (!allowed) return null;

  const active = npcs.filter((npc) => npc.presenceOnline).length;
  const crewCount = livingCity.crews.length;

  return (
    <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: L.border, paddingTop: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View>
          <Text style={{ color: L.warn, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>DEV PANEL</Text>
          <Text style={{ color: L.text, fontSize: 15, fontWeight: "900", marginTop: 2 }}>Living City QA</Text>
        </View>
        <Text style={{ color: L.soft, fontSize: 11 }}>
          tick {livingCity.tick} · {livingCity.avgTickMs}ms
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PRESETS.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => configure({ preset })}
            style={{
              minWidth: 72,
              borderRadius: 8,
              paddingVertical: 8,
              paddingHorizontal: 10,
              backgroundColor: livingCity.preset === preset ? L.accent : L.bg,
              borderWidth: 1,
              borderColor: livingCity.preset === preset ? L.accent : L.border,
            }}
          >
            <Text style={{ color: livingCity.preset === preset ? "#050505" : L.text, fontSize: 11, fontWeight: "900" }}>
              {populationForPreset(preset)}
            </Text>
            <Text style={{ color: livingCity.preset === preset ? "#050505" : L.soft, fontSize: 9 }}>{preset}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {SPEEDS.map((speed) => (
          <DevButton key={speed} label={`x${speed}`} onPress={() => configure({ speed })} />
        ))}
        <DevButton label="Spawn NPC" onPress={spawnNpc} />
        <DevButton label="Create NPC Crew" onPress={createCrew} />
        <DevButton label="Trigger Feeling" onPress={() => trigger("feeling")} />
        <DevButton label="Trigger Crew Invite" onPress={() => trigger("crew")} />
        <DevButton label="Trigger Event" onPress={() => trigger("event")} />
        <DevButton label="Trigger Flash Event" onPress={() => trigger("flash")} />
        <DevButton label="Trigger Territory Activity" onPress={() => trigger("territory")} />
        <DevButton label="Schedule Territory War" onPress={() => trigger("territory")} />
        <DevButton label="Simulate 1 hour" onPress={() => trigger("hour")} />
        <DevButton label="Simulate 1 day" onPress={() => trigger("day")} />
        <DevButton label="Reset NPC World" onPress={() => reset(livingCity.preset)} />
        <DevButton label="Tick" onPress={() => runTick()} />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          ["NPC actifs", active],
          ["NPC total", npcs.length],
          ["Crews NPC", crewCount],
          ["Events", livingCity.events.length],
          ["Notifs/min", livingCity.notificationsLastMinute],
        ].map(([label, value]) => (
          <View key={label} style={{ minWidth: 92, padding: 10, borderRadius: 8, backgroundColor: L.bg, borderWidth: 1, borderColor: L.border }}>
            <Text style={{ color: L.soft, fontSize: 9 }}>{label}</Text>
            <Text style={{ color: L.text, fontSize: 15, fontWeight: "900", marginTop: 2 }}>{value}</Text>
          </View>
        ))}
      </View>

      {livingCity.lastAbsenceSummary.length > 0 && (
        <View style={{ gap: 4 }}>
          <Text style={{ color: L.soft, fontSize: 10, fontWeight: "800" }}>Pendant ton absence</Text>
          {livingCity.lastAbsenceSummary.slice(0, 4).map((line) => (
            <Text key={line} style={{ color: L.text, fontSize: 11 }}>- {line}</Text>
          ))}
        </View>
      )}
    </View>
  );
}
