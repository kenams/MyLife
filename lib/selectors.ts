import { neighborhoods, locations, starterResidents } from "@/lib/game-data";
import type { AdviceItem, AvatarStats, GuidanceItem, LifePattern, RelationshipRecord, SocialRank } from "@/lib/types";

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

export type AccessibilityLevel = "accessible" | "receptif" | "ferme";

export type ResidentAccessibility = {
  level: AccessibilityLevel;
  hint: string;
};

const RESIDENT_CRITERIA: Record<
  string,
  (stats: AvatarStats) => ResidentAccessibility
> = {
  ava: (stats) => {
    if (stats.discipline > 30) return { level: "accessible", hint: "Ava est receptive a ta regularite actuelle." };
    if (stats.discipline > 15) return { level: "receptif", hint: "Continue de construire une routine. Ava remarquera." };
    return { level: "ferme", hint: "Ava cherche de la regularite. Stabilise une routine de base d'abord." };
  },
  malik: (stats) => {
    if (stats.discipline > 55 && stats.reputation > 55) return { level: "accessible", hint: "Malik voit des resultats concrets. Tu peux avancer avec lui." };
    if (stats.discipline > 40 || stats.reputation > 40) return { level: "receptif", hint: "Tu es dans le radar de Malik. Renforce discipline et reputation." };
    return { level: "ferme", hint: "Malik regarde les resultats. Travaille ta discipline et ta reputation d'abord." };
  },
  noa: (stats) => {
    if (stats.mood > 55 && stats.hygiene > 50) return { level: "accessible", hint: "Noa est attire par ton energie et ton image actuelles." };
    if (stats.mood > 40 || stats.hygiene > 40) return { level: "receptif", hint: "Noa perçoit quelque chose. Travaille ton image et ton humeur." };
    return { level: "ferme", hint: "Noa suit les profils qui rayonnent. Image et humeur font la difference." };
  },
  leila: (stats) => {
    if (stats.stress < 60 && stats.fitness > 40) return { level: "accessible", hint: "Leila sent un rythme sain en toi. Le lien peut s'approfondir." };
    if (stats.stress < 72 || stats.fitness > 30) return { level: "receptif", hint: "Leila est ouverte. Marche plus, reduis le stress." };
    return { level: "ferme", hint: "Leila valorise le bien-etre actif. Bouge un peu et reduis le stress." };
  },
  yan: (stats) => {
    if (stats.discipline > 65 && stats.motivation > 58) return { level: "accessible", hint: "Yan reconnait un profil solide. Tu peux entrer dans son cercle." };
    if (stats.discipline > 48 || stats.motivation > 45) return { level: "receptif", hint: "Yan t'observe. Discipline et motivation a pousser davantage." };
    return { level: "ferme", hint: "Yan ne se lie qu'avec des profils constants. Discipline et motivation en priorite." };
  },
  sana: (stats) => {
    if (stats.fitness > 55 && stats.hygiene > 50) return { level: "accessible", hint: "Sana voit un profil actif et soigne. Bon terrain pour avancer." };
    if (stats.fitness > 40 || stats.hygiene > 40) return { level: "receptif", hint: "Sana est curieuse. Continue le sport et soigne ton image." };
    return { level: "ferme", hint: "Sana cherche les profils actifs et soignes. Gym et hygiene a travailler." };
  }
};

export function detectLifePattern(stats: AvatarStats): LifePattern {
  const hoursSinceSocial = (Date.now() - new Date(stats.lastSocialAt).getTime()) / (1000 * 60 * 60);

  if (stats.energy < 30 && (stats.hunger < 35 || stats.hydration < 35)) return "recovery_needed";
  if (stats.hygiene < 35 && stats.hunger < 40 && stats.energy < 40) return "neglect";
  if (stats.stress > 72 && (stats.energy < 35 || stats.mood < 35) && stats.discipline < 45) return "burnout";
  if (stats.sociability < 30 && stats.mood < 50 && hoursSinceSocial > 20) return "social_drought";
  if (stats.money > 150 && stats.stress > 65 && stats.fitness < 40) return "grind_mode";
  if (stats.discipline > 65 && stats.streak > 3 && stats.sociability < 40) return "productive_isolated";
  if (stats.socialRankScore > 60 && (stats.hygiene < 45 || stats.fitness < 40)) return "image_gap";
  if (stats.discipline > 60 && stats.mood > 65 && stats.stress < 45 && stats.streak > 2) return "momentum";
  return "equilibre";
}

export function getLifePatternLabel(pattern: LifePattern): string {
  const labels: Record<LifePattern, string> = {
    burnout: "Surcharge — burnout en cours",
    social_drought: "Isolement social detecte",
    grind_mode: "Mode grind sans equilibre",
    productive_isolated: "Productif mais coupe",
    neglect: "Negligence des bases",
    momentum: "Momentum actif",
    recovery_needed: "Recuperation urgente",
    image_gap: "Decalage image / rang vise",
    equilibre: "Mode equilibre"
  };
  return labels[pattern];
}

const GUIDANCE_DATA: Record<LifePattern, GuidanceItem[]> = {
  recovery_needed: [
    {
      id: "rec-1", title: "Besoins primaires en danger",
      body: "Energie critique combinee a la faim ou la deshydratation cree une cascade — humeur, concentration, immunite tombent en chaine. La priorite numero 1 est de manger et boire.",
      action: "Mange et bois quelque chose maintenant",
      category: "energy", urgency: "high"
    },
    {
      id: "rec-2", title: "Le corps envoie un signal clair",
      body: "La fatigue profonde avec la faim n'est pas un manque de volonte. C'est un signal biologique. Ecoute-le avant de penser a produire.",
      action: "Dors apres avoir mange",
      category: "energy", urgency: "high"
    }
  ],
  neglect: [
    {
      id: "neg-1", title: "Reset de base en 3 etapes",
      body: "Quand tout est bas en meme temps, la meilleure approche est le reset minimum : manger quelque chose, boire un verre d'eau, se laver le visage. Dans cet ordre.",
      action: "Mange, hydrate, hygiene — maintenant",
      category: "wellbeing", urgency: "high"
    },
    {
      id: "neg-2", title: "L'etat physique precede tout le reste",
      body: "Tu ne peux pas etre productif, social ou motive si les besoins primaires ne sont pas couverts. Ce n'est pas une metaphore — c'est de la biologie.",
      action: "Commence par un repas simple avant toute tache",
      category: "energy", urgency: "high"
    },
    {
      id: "neg-3", title: "Micro-routine de survie",
      body: "Dans les phases difficiles, une routine de 15 minutes — lever, boire, s'habiller — cree suffisamment d'elan pour la journee. Pas besoin de plus au debut.",
      action: "15 min de routine minimum demain matin",
      category: "discipline", urgency: "medium"
    }
  ],
  burnout: [
    {
      id: "burn-1", title: "Pause forcee, pas optionnelle",
      body: "Ton corps gere un stress chronique. Une pause de 20 minutes sans ecran fait baisser le cortisol mesurable. Pas de scrolling — allonge-toi ou marche.",
      action: "20 min sans ecran maintenant",
      category: "energy", urgency: "high"
    },
    {
      id: "burn-2", title: "Le probleme n'est pas la motivation",
      body: "La motivation basse avec stress eleve est une reponse normale du systeme nerveux. Ce n'est pas un defaut de caractere. Reduis la charge d'abord, ne force pas plus.",
      action: "Elimine une chose de ta to-do d'aujourd'hui",
      category: "discipline", urgency: "high"
    },
    {
      id: "burn-3", title: "Sommeil reparateur en priorite",
      body: "En phase de surcharge, une heure de sommeil recuperee vaut plus que deux heures de travail supplementaires. Couche-toi une heure plus tot ce soir.",
      action: "Fixe une heure de coucher 60 min plus tot",
      category: "energy", urgency: "medium"
    }
  ],
  social_drought: [
    {
      id: "soc-1", title: "L'isolement amplifie tout",
      body: "Le manque de contact social chronique augmente la perception du stress et reduit la dopamine de base. Un seul message ou appel de 5 minutes change physiologiquement l'etat.",
      action: "Envoie un message a quelqu'un maintenant",
      category: "social", urgency: "high"
    },
    {
      id: "soc-2", title: "Presence physique > presence digitale",
      body: "Aller dans un lieu vivant — cafe, bibliotheque, parc — active le systeme nerveux social meme sans interagir directement. C'est la solution la plus simple.",
      action: "Va dans un endroit ou il y a du monde",
      category: "social", urgency: "medium"
    },
    {
      id: "soc-3", title: "Qualite plutot que quantite",
      body: "Reprendre contact avec une personne de qualite vaut mieux que 10 interactions superficielles. Pense a quelqu'un qui te fait progresser.",
      action: "Identifie une personne inspirante a recontacter",
      category: "social", urgency: "low"
    }
  ],
  grind_mode: [
    {
      id: "grd-1", title: "Le rendement diminue apres 6h intenses",
      body: "Le cerveau perd 40% de sa capacite de decision apres une longue session intense. Une pause de 30 minutes recupere plus que 2h de travail mediocre.",
      action: "Bloque 30 min de repos actif aujourd'hui",
      category: "energy", urgency: "high"
    },
    {
      id: "grd-2", title: "Le corps paye ce que l'agenda oublie",
      body: "Un mode de vie tout-travail degrade lentement la forme, l'humeur et au final la productivite elle-meme. 20 minutes de marche par jour changent plus que tu ne le crois.",
      action: "Marche 20 min demain matin avant tout",
      category: "wellbeing", urgency: "medium"
    },
    {
      id: "grd-3", title: "L'argent ne compense pas l'etat interne",
      body: "Atteindre ses objectifs financiers sans equilibre laisse souvent un vide plus grand qu'avant. Integre un moment de plaisir simple cette semaine.",
      action: "Planifie une activite sans lien avec le travail",
      category: "social", urgency: "low"
    }
  ],
  productive_isolated: [
    {
      id: "pi-1", title: "La solitude productive a une limite",
      body: "La discipline sans lien social finit par reduire la motivation profonde. Le cerveau a besoin de validation sociale pour ancrer les progres comme reels.",
      action: "Partage un resultat recent avec quelqu'un",
      category: "social", urgency: "medium"
    },
    {
      id: "pi-2", title: "Ton reseau construit plus que ta routine seule",
      body: "Les personnes que tu cotes directement influencent ta trajectoire plus que tes habitudes isolees. Une sortie hebdomadaire avec les bons profils vaut beaucoup.",
      action: "Organise une sortie cette semaine",
      category: "social", urgency: "medium"
    },
    {
      id: "pi-3", title: "Ancre ta progression dans le reel",
      body: "Parler de ce que tu construis — meme brievement — te connecte a d'autres perspectives et ouvre des opportunites invisibles depuis l'isolement.",
      action: "Rejoins un espace social cette semaine",
      category: "social", urgency: "low"
    }
  ],
  image_gap: [
    {
      id: "img-1", title: "L'image exterieuse doit matcher le rang vise",
      body: "Ton rang social progresse, mais l'image physique reste en retard. Dans la vraie vie, l'hygiene et la posture sont les premiers signaux que les autres lisent avant tout le reste.",
      action: "Routine hygiene complete + tenue soignee aujourd'hui",
      category: "wellbeing", urgency: "medium"
    },
    {
      id: "img-2", title: "La forme physique est une carte sociale",
      body: "La condition physique influence directement la confiance, la posture et la perception des autres. Meme 3 sessions legeres par semaine changent l'equation.",
      action: "Planifie 3 sessions sport cette semaine",
      category: "wellbeing", urgency: "medium"
    }
  ],
  momentum: [
    {
      id: "mom-1", title: "Tu es dans une fenetre de croissance",
      body: "L'etat actuel — discipline haute, humeur stable, stress bas — est exactement le moment ou les nouvelles habitudes s'ancrent le mieux. Ajoute quelque chose de petit et concret.",
      action: "Ajoute une habitude de 5 min a ta routine",
      category: "discipline", urgency: "low"
    },
    {
      id: "mom-2", title: "Etends ton reseau maintenant",
      body: "Avec un mode de vie stable, tu attires naturellement de meilleurs profils. C'est le bon moment pour une sortie plus ambitieuse ou un nouveau lieu.",
      action: "Explore un nouveau lieu ou event cette semaine",
      category: "social", urgency: "low"
    },
    {
      id: "mom-3", title: "Consolide avant d'accelerer",
      body: "Le momentum est precieux. Consolide les acquis avant d'ajouter de la charge. Une base solide dure plus longtemps qu'un sprint court.",
      action: "Continue ta routine actuelle 7 jours de plus",
      category: "discipline", urgency: "low"
    }
  ],
  equilibre: [
    {
      id: "eq-1", title: "Maintenir vaut autant que progresser",
      body: "Un mode de vie stable est une reussite en soi. Continue les routines de base et ajoute quelque chose de nouveau progressivement.",
      action: "Continue ta routine actuelle",
      category: "discipline", urgency: "low"
    },
    {
      id: "eq-2", title: "Explore ton reseau",
      body: "Avec un etat equilibre, tu as la capacite d'approfondir les liens existants ou d'ouvrir de nouvelles relations de qualite.",
      action: "Contacte quelqu'un que tu n'as pas vu depuis longtemps",
      category: "social", urgency: "low"
    }
  ]
};

export function buildGuidanceEngine(stats: AvatarStats): { pattern: LifePattern; items: GuidanceItem[] } {
  const pattern = detectLifePattern(stats);
  return { pattern, items: GUIDANCE_DATA[pattern] };
}

export function getResidentAccessibility(residentId: string, stats: AvatarStats): ResidentAccessibility {
  const check = RESIDENT_CRITERIA[residentId];
  if (!check) return { level: "receptif", hint: "Profil en cours d'evaluation." };
  return check(stats);
}
