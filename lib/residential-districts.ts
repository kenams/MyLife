import type { HousingTierId } from "@/lib/housing";

export type ResidentialClass = "pauvre" | "moyen" | "riche";

export type ResidentialDistrict = {
  id: ResidentialClass;
  locationSlug: string;
  neighborhoodSlug: string;
  name: string;
  label: string;
  color: string;
  housing: HousingTierId[];
  summary: string;
};

export const RESIDENTIAL_DISTRICTS: ResidentialDistrict[] = [
  {
    id: "pauvre",
    locationSlug: "residence-populaire",
    neighborhoodSlug: "old-quarter",
    name: "Bloc Populaire",
    label: "Pauvre",
    color: "#ff7a5c",
    housing: ["squat", "studio"],
    summary: "Loyers tres bas, forte densite, peu de prestige mais beaucoup d'entraide."
  },
  {
    id: "moyen",
    locationSlug: "residence-confort",
    neighborhoodSlug: "midtown-residence",
    name: "Residence Confort",
    label: "Moyen riche",
    color: "#60a5fa",
    housing: ["appartement", "loft"],
    summary: "Zone stable pour progresser : confort, routines et reputation propre."
  },
  {
    id: "riche",
    locationSlug: "residence-luxe",
    neighborhoodSlug: "north-estates",
    name: "North Estates",
    label: "Riche",
    color: "#f6b94f",
    housing: ["penthouse", "villa", "manoir"],
    summary: "Quartier elite : prestige, calme, reseau fort et statut visible."
  }
];

export function getResidentialDistrictForHousing(housingTier: HousingTierId) {
  return RESIDENTIAL_DISTRICTS.find((district) => district.housing.includes(housingTier)) ?? RESIDENTIAL_DISTRICTS[0];
}

export function getResidentialDistrictForLocation(locationSlug: string) {
  return RESIDENTIAL_DISTRICTS.find((district) => district.locationSlug === locationSlug) ?? null;
}
