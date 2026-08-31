import type { CityPulseSignal } from "@/lib/city-pulse";
import type { ToulouseGeopolitics } from "@/lib/crew-geopolitics";
import type { Territory } from "@/lib/territories";
import type { TerritoryBattle } from "@/lib/territory-wars";

export type CrewContextActionKind = "JOIN_CREW" | "BATTLE" | "DEFEND" | "PRESSURE" | "EXPAND";

export type CrewContextAction = {
  kind: CrewContextActionKind;
  title: string;
  body: string;
  cta: string;
  priority: number;
  crewId: string | null;
  territoryId: string | null;
  districtId: string | null;
  districtName: string | null;
  battleId: string | null;
};

type SelectCrewContextActionInput = {
  geopolitics: ToulouseGeopolitics;
  territories: Territory[];
  battles: TerritoryBattle[];
  myCrewId: string | null;
  playerLevel: number;
  canLaunchBattle?: boolean;
  completedToday?: boolean;
};

function territoryAction(
  kind: Exclude<CrewContextActionKind, "JOIN_CREW">,
  territory: Territory,
  myCrewId: string,
  input?: { battleId?: string; title?: string; body?: string; cta?: string; priority?: number }
): CrewContextAction {
  const defaults = {
    BATTLE: {
      title: `Battle a ${territory.district_name}`,
      body: "Ton Crew est engage. Chaque performance compte dans le score collectif.",
      cta: "REJOINDRE LA BATTLE",
      priority: 100,
    },
    DEFEND: {
      title: `Renforce ${territory.district_name}`,
      body: `Ton Crew tient le quartier a ${territory.influence}% d'influence. Consolide sa position aujourd'hui.`,
      cta: "RENFORCER",
      priority: 94,
    },
    PRESSURE: {
      title: `Mets ${territory.district_name} sous pression`,
      body: `${territory.owner_tag ?? "Un rival"} controle ce quartier a ${territory.influence}%. Fais progresser l'effort collectif.`,
      cta: "CONTRIBUER",
      priority: 92,
    },
    EXPAND: {
      title: `${territory.district_name} est ouvert`,
      body: "Ce territoire neutre est une opportunite pour ton Crew. Une Battle peut lancer la conquete.",
      cta: "PREPARER UNE BATTLE",
      priority: 84,
    },
  }[kind];

  return {
    kind,
    title: input?.title ?? defaults.title,
    body: input?.body ?? defaults.body,
    cta: input?.cta ?? defaults.cta,
    priority: input?.priority ?? defaults.priority,
    crewId: myCrewId,
    territoryId: territory.id,
    districtId: territory.district_id,
    districtName: territory.district_name,
    battleId: input?.battleId ?? null,
  };
}

export function selectCrewContextAction(input: SelectCrewContextActionInput): CrewContextAction | null {
  if (input.completedToday) return null;
  if (!input.myCrewId) {
    if (input.playerLevel < 2) return null;
    return {
      kind: "JOIN_CREW",
      title: "Toulouse se joue en Crew",
      body: "Rejoins une communaute pour participer aux objectifs et aux territoires.",
      cta: "VOIR LES CREWS",
      priority: 76,
      crewId: null,
      territoryId: null,
      districtId: null,
      districtName: null,
      battleId: null,
    };
  }

  const myCrewId = input.myCrewId;
  const myBattle = input.battles.find(
    (battle) => battle.attacker_crew === myCrewId || battle.defender_crew === myCrewId
  );
  const battleTerritory = myBattle
    ? input.territories.find((territory) => territory.district_id === myBattle.district_id)
    : null;
  if (myBattle && battleTerritory) {
    return territoryAction("BATTLE", battleTerritory, myCrewId, { battleId: myBattle.id });
  }

  const ownedHot = input.geopolitics.contestedTerritories.find(
    (territory) => territory.owner_crew_id === myCrewId && territory.influence < 100
  );
  if (ownedHot) return territoryAction("DEFEND", ownedHot, myCrewId);

  if (input.geopolitics.leader?.crewId === myCrewId) {
    const weakestOwned = input.territories
      .filter((territory) => territory.owner_crew_id === myCrewId && territory.influence < 100)
      .sort((a, b) => a.influence - b.influence || b.prestige - a.prestige)[0];
    if (weakestOwned) return territoryAction("DEFEND", weakestOwned, myCrewId);
  }

  const leaderTarget = input.geopolitics.leader?.crewId !== myCrewId
    ? input.territories
        .filter((territory) => territory.owner_crew_id === input.geopolitics.leader?.crewId && territory.influence > 1)
        .sort((a, b) => a.influence - b.influence || b.prestige - a.prestige)[0]
    : null;
  const rivalTarget = leaderTarget ?? input.territories
    .filter((territory) => territory.owner_crew_id && territory.owner_crew_id !== myCrewId && territory.influence > 1)
    .sort((a, b) => a.influence - b.influence || b.prestige - a.prestige)[0];
  if (rivalTarget) return territoryAction("PRESSURE", rivalTarget, myCrewId);

  const neutralTarget = input.geopolitics.neutralTerritories[0];
  if (neutralTarget && input.canLaunchBattle) return territoryAction("EXPAND", neutralTarget, myCrewId);

  return null;
}

export function crewContextActionToCityPulse(action: CrewContextAction, day = new Date().toISOString().slice(0, 10)): CityPulseSignal {
  return {
    id: `crew-context:${day}:${action.kind}:${action.territoryId ?? "none"}`,
    kind: action.kind === "BATTLE" ? "CHALLENGE" : "CREW",
    title: action.title,
    body: action.body,
    district: action.districtName,
    priority: action.priority,
    source: "GAME",
    crewId: action.crewId,
    territoryId: action.territoryId,
    actionable: true,
  };
}
