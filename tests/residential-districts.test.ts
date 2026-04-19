import { describe, expect, it } from "vitest";

import { locations, neighborhoods } from "@/lib/game-data";
import { getResidentialDistrictForHousing, getResidentialDistrictForLocation, RESIDENTIAL_DISTRICTS } from "@/lib/residential-districts";

describe("residential-districts", () => {
  it("maps every residential district to an existing location and neighborhood", () => {
    for (const district of RESIDENTIAL_DISTRICTS) {
      expect(locations.some((location) => location.slug === district.locationSlug)).toBe(true);
      expect(neighborhoods.some((neighborhood) => neighborhood.slug === district.neighborhoodSlug)).toBe(true);
    }
  });

  it("separates poor, middle and rich housing tiers", () => {
    expect(getResidentialDistrictForHousing("squat").id).toBe("pauvre");
    expect(getResidentialDistrictForHousing("studio").id).toBe("pauvre");
    expect(getResidentialDistrictForHousing("appartement").id).toBe("moyen");
    expect(getResidentialDistrictForHousing("loft").id).toBe("moyen");
    expect(getResidentialDistrictForHousing("penthouse").id).toBe("riche");
    expect(getResidentialDistrictForHousing("villa").id).toBe("riche");
    expect(getResidentialDistrictForHousing("manoir").id).toBe("riche");
  });

  it("recognizes residential locations on the world map", () => {
    expect(getResidentialDistrictForLocation("residence-populaire")?.label).toBe("Pauvre");
    expect(getResidentialDistrictForLocation("residence-confort")?.label).toBe("Moyen riche");
    expect(getResidentialDistrictForLocation("residence-luxe")?.label).toBe("Riche");
    expect(getResidentialDistrictForLocation("cafe")).toBeNull();
  });
});
