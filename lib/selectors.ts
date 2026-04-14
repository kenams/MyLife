import { neighborhoods, locations, starterResidents } from "@/lib/game-data";
import type { AdviceItem, AvatarStats, RelationshipRecord, SocialRank } from "@/lib/types";

export function getUrgency(stats: AvatarStats) {
  if (stats.hunger < 18) return "Faim critique";
  if (stats.energy < 18) return "Epuisement";
  if (stats.hygiene < 18) return "Hygiene basse";
  if (stats.sociability < 18) return "Isolement social";
  if (stats.stress > 82) return "Stress eleve";
  return "Routine stable";
}

export function getUrgencyCopy(stats: AvatarStats) {
  if (stats.hunger < 18) {
    return "Ton avatar glisse vers une baisse d'humeur rapide. Mange maintenant avant de chercher du rendement.";
  }
  if (stats.energy < 18) {
    return "Tu es trop bas en energie pour produire une bonne session. Recuperer maintenant vaut plus qu'insister.";
  }
  if (stats.hygiene < 18) {
    return "L'hygiene influence l'image, l'humeur et la confiance. Reprends une base propre avant de sortir.";
  }
  if (stats.sociability < 18) {
    return "Le manque de lien degrade la motivation. Rejoins un lieu vivant ou relance une conversation.";
  }
  if (stats.stress > 82) {
    return "Le stress prend trop de place. Une marche, une douche ou une sortie calme est le meilleur prochain move.";
  }
  return "Tu peux pousser ta progression, ton reseau ou ton niveau de vie.";
}

export function getLocationName(slug: string) {
  return locations.find((item) => item.slug === slug)?.name ?? "Lieu inconnu";
}

export function getNeighborhoodName(slug: string) {
  return neighborhoods.find((item) => item.slug === slug)?.name ?? "Quartier";
}

export function getResidentsByLocation(slug: string) {
  return starterResidents.filter((item) => item.locationSlug === slug);
}

export function getSocialRankLabel(score: number): SocialRank {
  if (score < 20) return "precaire";
  if (score < 40) return "modeste";
  if (score < 58) return "stable";
  if (score < 75) return "confortable";
  if (score < 90) return "influent";
  return "elite";
}

export function getSocialRankCopy(rank: SocialRank) {
  if (rank === "precaire") return "Tu survis plus que tu ne construis. Stabilise les bases.";
  if (rank === "modeste") return "La structure est fragile mais visible. Garde la regularite.";
  if (rank === "stable") return "Tu tiens une routine credible. C'est le socle pour monter.";
  if (rank === "confortable") return "Ton mode de vie inspire deja confiance et fluidite.";
  if (rank === "influent") return "Tu combines reputation, rythme et presence sociale.";
  return "Tu occupes le haut du quartier avec une image tres forte.";
}

export function getWellbeingScore(stats: AvatarStats) {
  const base =
    stats.hunger +
    stats.hydration +
    stats.energy +
    stats.hygiene +
    stats.mood +
    stats.sociability +
    stats.health +
    stats.fitness +
    stats.discipline +
    stats.motivation -
    stats.stress;

  return Math.max(0, Math.min(100, Math.round(base / 9.2)));
}

export function getRecommendedAction(stats: AvatarStats) {
  if (stats.hunger < 42) return "healthy-meal";
  if (stats.energy < 38) return "sleep";
  if (stats.hygiene < 40) return "shower";
  if (stats.sociability < 40) return "cafe-chat";
  if (stats.fitness < 36 || stats.stress > 72) return "walk";
  if (stats.money < 40) return "work-shift";
  return "focus-task";
}

export function buildAdvice(stats: AvatarStats): AdviceItem[] {
  const advice: AdviceItem[] = [];

  if (stats.energy < 45) {
    advice.push({
      id: "energy-reset",
      title: "Recupere avant de forcer",
      body: "Ton avatar manque d'energie. Dans la vraie vie aussi, une meilleure heure de coucher ferait une difference nette.",
      category: "energy"
    });
  }

  if (stats.sociability < 45) {
    advice.push({
      id: "social-reset",
      title: "Relance un lien simple",
      body: "Tu as peu socialise. Un message court ou un cafe peut suffire a remettre ta dynamique en marche.",
      category: "social"
    });
  }

  if (stats.money < 55) {
    advice.push({
      id: "budget-reset",
      title: "Protège ton budget",
      body: "Ton niveau de vie devient fragile. Evite les depenses premium tant que ta prochaine session de travail n'est pas faite.",
      category: "budget"
    });
  }

  if (stats.stress > 60 || stats.hygiene < 50) {
    advice.push({
      id: "wellbeing-reset",
      title: "Reprends une base saine",
      body: "Une douche, un verre d'eau et dix minutes de marche feraient du bien a ton avatar comme a toi.",
      category: "wellbeing"
    });
  }

  if (stats.discipline < 48 || stats.motivation < 45) {
    advice.push({
      id: "discipline-reset",
      title: "Redemarre petit mais net",
      body: "Fais une action simple maintenant : ranger, marcher, ou finir une tache courte. La motivation suit souvent l'action.",
      category: "discipline"
    });
  }

  return advice.slice(0, 3);
}

export function getRelationshipLabel(record?: RelationshipRecord) {
  if (!record) return "nouveau profil";
  if (record.status === "relation") return "relation";
  if (record.status === "crush") return "interet mutuel";
  if (record.status === "cercle-proche") return "cercle proche";
  if (record.status === "ami") return "ami";
  return "contact";
}

export function getCompatibilityBadge(interests: string[], targetInterests: string[]) {
  const shared = interests.filter((item) => targetInterests.includes(item)).length;
  if (shared >= 3) return "tres compatible";
  if (shared >= 2) return "bonne base";
  if (shared >= 1) return "point commun";
  return "a decouvrir";
}
