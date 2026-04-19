import { getResidentialDistrictForHousing } from "@/lib/residential-districts";
import type { HousingTierId } from "@/lib/housing";
import type { AvatarStats, LifeActionId, NpcState, RelationshipRecord, WorldPresenceMember } from "@/lib/types";

export type CityIntelUrgency = "critical" | "high" | "medium" | "low";

export type CityIntelPlan = {
  locationSlug: string;
  action: LifeActionId;
  urgency: CityIntelUrgency;
  title: string;
  body: string;
  actionLabel: string;
  targetName: string | null;
  reason: string;
};

type CityIntelInput = {
  stats: AvatarStats;
  currentLocationSlug: string;
  npcs: NpcState[];
  livePlayers: WorldPresenceMember[];
  relationships: RelationshipRecord[];
  housingTier?: HousingTierId;
};

const LOCATION_ACTION: Record<string, LifeActionId> = {
  home: "sleep",
  "residence-populaire": "rest-home",
  "residence-confort": "rest-home",
  "residence-luxe": "rest-home",
  market: "healthy-meal",
  cafe: "cafe-chat",
  office: "work-shift",
  park: "walk",
  gym: "gym",
  restaurant: "restaurant-outing",
  cinema: "cinema-date"
};

function relationshipScore(relationships: RelationshipRecord[], npcId: string) {
  return relationships.find((relationship) => relationship.residentId === npcId)?.score ?? 0;
}

function bestTargetAt(locationSlug: string, npcs: NpcState[], relationships: RelationshipRecord[]) {
  return npcs
    .filter((npc) => npc.locationSlug === locationSlug)
    .sort((a, b) => {
      const aScore = relationshipScore(relationships, a.id) + (a.presenceOnline ? 25 : 0) + a.mood * 0.2;
      const bScore = relationshipScore(relationships, b.id) + (b.presenceOnline ? 25 : 0) + b.mood * 0.2;
      return bScore - aScore;
    })[0] ?? null;
}

function buildPlan(
  input: CityIntelInput,
  locationSlug: string,
  action: LifeActionId,
  urgency: CityIntelUrgency,
  title: string,
  body: string,
  actionLabel: string,
  reason: string
): CityIntelPlan {
  const target = bestTargetAt(locationSlug, input.npcs, input.relationships);
  const liveCount = input.livePlayers.filter((player) => player.locationSlug === locationSlug).length;
  const targetName = target?.name ?? (liveCount > 0 ? `${liveCount} joueur${liveCount > 1 ? "s" : ""} live` : null);

  return {
    locationSlug,
    action,
    urgency,
    title,
    body: targetName ? `${body} ${targetName} est la meilleure opportunite ici.` : body,
    actionLabel,
    targetName,
    reason
  };
}

export function buildCityIntel(input: CityIntelInput): CityIntelPlan {
  const { stats } = input;
  const homeLocationSlug = getResidentialDistrictForHousing(input.housingTier ?? "squat").locationSlug;

  if (stats.hunger <= 22 || stats.hydration <= 20) {
    return buildPlan(
      input,
      "market",
      "healthy-meal",
      "critical",
      "Priorite vitale",
      "Passe au marche avant de continuer. Tes interactions deviennent moins rentables quand faim ou hydratation chutent.",
      "Manger",
      "faim ou hydratation basse"
    );
  }

  if (stats.energy <= 22) {
    return buildPlan(
      input,
      homeLocationSlug,
      "rest-home",
      "critical",
      "Repos obligatoire",
      "Rentre dans ton quartier residentiel. Le social, le travail et les sorties coutent trop cher avec cette energie.",
      "Rentrer",
      "energie critique"
    );
  }

  if (stats.hygiene <= 24) {
    return buildPlan(
      input,
      homeLocationSlug,
      "shower",
      "high",
      "Image a corriger",
      "Prepare ton avatar chez toi avant une interaction sociale. L'hygiene impacte directement l'attractivite.",
      "Douche",
      "hygiene basse"
    );
  }

  if (stats.money <= 45) {
    return buildPlan(
      input,
      "office",
      "work-shift",
      stats.money <= 20 ? "critical" : "high",
      "Budget a renforcer",
      "Un shift court remet de la marge avant les sorties, invitations et achats.",
      "Travailler",
      "credits faibles"
    );
  }

  if (stats.stress >= 76 || stats.mood <= 34) {
    return buildPlan(
      input,
      "park",
      "walk",
      stats.stress >= 88 ? "critical" : "high",
      "Reset mental",
      "Va au parc pour reduire la pression avant de repartir sur du social ou du travail.",
      "Marcher",
      "stress eleve ou humeur basse"
    );
  }

  const socialTarget = input.npcs
    .filter((npc) => npc.presenceOnline)
    .sort((a, b) => relationshipScore(input.relationships, b.id) - relationshipScore(input.relationships, a.id))[0];

  if (stats.sociability <= 45 || socialTarget) {
    const locationSlug = socialTarget?.locationSlug ?? "cafe";
    return buildPlan(
      input,
      locationSlug,
      "cafe-chat",
      stats.sociability <= 25 ? "high" : "medium",
      "Fenetre sociale",
      "C'est le bon moment pour lancer une conversation courte et faire monter le lien.",
      "Discuter",
      socialTarget ? "resident en ligne" : "sociabilite a relancer"
    );
  }

  if (stats.fitness <= 42) {
    return buildPlan(
      input,
      "gym",
      "gym",
      "medium",
      "Progression physique",
      "Une seance simple ameliore forme, discipline et image sociale.",
      "Salle",
      "forme perfectible"
    );
  }

  const fallbackLocation = input.currentLocationSlug in LOCATION_ACTION ? input.currentLocationSlug : "cafe";
  return buildPlan(
    input,
    fallbackLocation,
    LOCATION_ACTION[fallbackLocation],
    "low",
    "Ville stable",
    "Aucune urgence. Profite du lieu actuel ou cree une interaction sociale.",
    "Agir",
    "aucune urgence"
  );
}
