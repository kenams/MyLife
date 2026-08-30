import type { CityPulseSignal } from "@/lib/city-pulse";
import type { MissionProgress } from "@/lib/missions";

export type NewPlayerMapIntent = "explore" | "missions" | "home";

export type NewPlayerMapStep = {
  signal: CityPulseSignal;
  intent: NewPlayerMapIntent;
};

function progressFor(progresses: MissionProgress[], missionId: string): MissionProgress | undefined {
  return progresses.find((progress) => progress.missionId === missionId);
}

function signal(id: string, title: string, body: string, kind: CityPulseSignal["kind"] = "EXPLORATION"): CityPulseSignal {
  return {
    id: `new-player:${id}`,
    kind,
    title,
    body,
    district: "Toulouse",
    priority: 100,
    source: "GAME",
    actionable: true,
  };
}

export function getNewPlayerMapStep(playerLevel: number, progresses: MissionProgress[]): NewPlayerMapStep | null {
  if (playerLevel > 1) return null;

  const exploration = progressFor(progresses, "daily-exercise");
  if (!exploration || exploration.status === "active") {
    return {
      signal: signal("explore", "Découvre ton quartier", "Une première exploration fait progresser ta mission et rapporte de vrais XP."),
      intent: "explore",
    };
  }
  if (exploration.status === "completed") {
    return {
      signal: signal("claim-explore", "Réclame ta mission d'exploration", "+50 XP et +8 Wory sont prêts.", "MISSION"),
      intent: "missions",
    };
  }

  const firstMeal = progressFor(progresses, "story-first-meal");
  if (!firstMeal || firstMeal.status === "active") {
    return {
      signal: signal("first-meal", "Prépare ton premier repas maison", "Une activité niveau 1 disponible depuis l'accueil.", "MISSION"),
      intent: "home",
    };
  }
  if (firstMeal.status === "completed") {
    return {
      signal: signal("claim-meal", "Réclame Premier repas maison", "+100 XP et +15 Wory sont prêts.", "MISSION"),
      intent: "missions",
    };
  }

  const meditation = progressFor(progresses, "daily-meditate");
  if (!meditation || meditation.status === "active") {
    return {
      signal: signal("meditate", "Prends un moment de calme", "Médite une fois pour atteindre le prochain niveau.", "MISSION"),
      intent: "home",
    };
  }
  if (meditation.status === "completed") {
    return {
      signal: signal("claim-meditate", "Réclame Moment de calme", "+35 XP sont prêts.", "MISSION"),
      intent: "missions",
    };
  }

  return {
    signal: signal("continue", "Continue ta progression", "Choisis une activité disponible pour atteindre le niveau 2.", "MISSION"),
    intent: "home",
  };
}

export function isMapOpportunityAvailableAtLevel(signal: CityPulseSignal, playerLevel: number): boolean {
  if (signal.id.startsWith("new-player:")) return playerLevel === 1;
  if (signal.kind === "CREW" || signal.kind === "CHALLENGE") return playerLevel >= 2;
  if (signal.kind === "DATING") return playerLevel >= 4;
  return true;
}

export function playableMapOpportunities(
  rankedSignals: CityPulseSignal[],
  playerLevel: number,
  progresses: MissionProgress[]
): CityPulseSignal[] {
  const starter = getNewPlayerMapStep(playerLevel, progresses)?.signal;
  const candidates = starter ? [starter, ...rankedSignals] : rankedSignals;
  const seen = new Set<string>();
  return candidates.filter((item) => {
    if (seen.has(item.id) || !isMapOpportunityAvailableAtLevel(item, playerLevel)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 3);
}
