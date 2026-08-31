import type { Territory } from "./territories";

export type CrewPower = {
  crewId: string;
  name: string;
  tag: string;
  emoji: string;
  color: string | null;
  territories: number;
  influence: number;
  prestige: number;
  defenses: number;
  score: number;
};

export type ToulouseGeopolitics = {
  leader: CrewPower | null;
  challenger: CrewPower | null;
  gap: number;
  contestedTerritories: Territory[];
  neutralTerritories: Territory[];
  powers: CrewPower[];
};

export function crewPowerScore(input: Pick<CrewPower, "territories" | "influence" | "prestige" | "defenses">): number {
  // Territory ownership is the strongest signal. Influence shows how secure the
  // hold is, while prestige/defences reward history without making old crews
  // impossible to catch.
  return Math.round(
    input.territories * 100 +
      input.influence * 0.45 +
      input.prestige * 18 +
      input.defenses * 10
  );
}

export function buildToulouseGeopolitics(territories: Territory[]): ToulouseGeopolitics {
  const byCrew = new Map<string, Omit<CrewPower, "score">>();

  for (const territory of territories) {
    if (!territory.owner_crew_id) continue;
    const current = byCrew.get(territory.owner_crew_id) ?? {
      crewId: territory.owner_crew_id,
      name: territory.owner_name ?? "Crew",
      tag: territory.owner_tag ?? "?",
      emoji: territory.owner_emoji ?? "🏳️",
      color: territory.owner_color,
      territories: 0,
      influence: 0,
      prestige: 0,
      defenses: 0,
    };
    current.territories += 1;
    current.influence += territory.influence;
    current.prestige += territory.prestige;
    current.defenses += territory.defenses_won;
    byCrew.set(territory.owner_crew_id, current);
  }

  const powers = Array.from(byCrew.values())
    .map((crew) => ({ ...crew, score: crewPowerScore(crew) }))
    .sort((a, b) => b.score - a.score || b.territories - a.territories || b.influence - a.influence || a.name.localeCompare(b.name));

  const leader = powers[0] ?? null;
  const challenger = powers[1] ?? null;

  return {
    leader,
    challenger,
    gap: leader && challenger ? leader.score - challenger.score : leader ? leader.score : 0,
    contestedTerritories: territories
      .filter((territory) => Boolean(territory.next_battle_at) || (Boolean(territory.owner_crew_id) && territory.influence < 60))
      .sort((a, b) => a.influence - b.influence || b.prestige - a.prestige),
    neutralTerritories: territories.filter((territory) => !territory.owner_crew_id),
    powers,
  };
}
