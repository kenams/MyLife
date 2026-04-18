import { getBestProfileMatches, type ResidentMatch } from "@/lib/profile-matching";
import type { AvatarProfile, AvatarStats, NotificationItem, RelationshipRecord, ResidentSeed } from "@/lib/types";

export type SmartNotificationPriority = "critical" | "high" | "medium" | "low";

export type SmartNotification = NotificationItem & {
  priority: SmartNotificationPriority;
  actionLabel: string;
  route: string;
};

type BuildSmartNotificationsInput = {
  avatar: AvatarProfile | null;
  stats: AvatarStats;
  relationships: RelationshipRecord[];
  residents: ResidentSeed[];
  now?: string;
};

function makeNotification(
  id: string,
  kind: NotificationItem["kind"],
  title: string,
  body: string,
  priority: SmartNotificationPriority,
  actionLabel: string,
  route: string,
  createdAt: string
): SmartNotification {
  return {
    id,
    kind,
    title,
    body,
    createdAt,
    read: false,
    priority,
    actionLabel,
    route
  };
}

function topMatchNotification(match: ResidentMatch | undefined, createdAt: string): SmartNotification | null {
  if (!match || match.score < 62) return null;

  const reason = match.reasons[0] ?? "profil compatible";
  const priority: SmartNotificationPriority = match.score >= 82 ? "high" : "medium";

  return makeNotification(
    `smart-match-${match.resident.id}`,
    "social",
    "Match compatible detecte",
    `${match.resident.name} matche a ${match.score}% avec ton profil : ${reason}.`,
    priority,
    "Voir le profil",
    "/(app)/discover",
    createdAt
  );
}

export function buildSmartNotifications({
  avatar,
  stats,
  relationships,
  residents,
  now
}: BuildSmartNotificationsInput): SmartNotification[] {
  const createdAt = now ?? new Date().toISOString();
  const items: SmartNotification[] = [];
  const add = (
    id: string,
    kind: NotificationItem["kind"],
    title: string,
    body: string,
    priority: SmartNotificationPriority,
    actionLabel: string,
    route: string
  ) => items.push(makeNotification(id, kind, title, body, priority, actionLabel, route, createdAt));

  if (stats.hunger <= 18 || stats.hydration <= 18) {
    add(
      "smart-needs-food",
      "needs",
      "Besoin vital prioritaire",
      "Mange ou hydrate-toi avant de socialiser. Tes gains sociaux chutent quand les bases sont basses.",
      "critical",
      "Stabiliser",
      "/(app)/health"
    );
  } else if (stats.hunger <= 35 || stats.hydration <= 35) {
    add(
      "smart-needs-warning",
      "needs",
      "Bases a surveiller",
      "Tu peux encore agir sans penalite forte : repas simple ou boisson maintenant.",
      "high",
      "Corriger",
      "/(app)/health"
    );
  }

  if (stats.energy <= 22) {
    add(
      "smart-energy-critical",
      "needs",
      "Energie critique",
      "Le prochain bon move est le repos. Forcer maintenant coute humeur, discipline et reputation.",
      "critical",
      "Dormir",
      "/(app)/health"
    );
  }

  if (stats.hygiene <= 25) {
    add(
      "smart-hygiene",
      "needs",
      "Image sociale fragile",
      "Ton hygiene bloque une partie de ton attractivite. Une douche rend les interactions plus rentables.",
      stats.hygiene <= 14 ? "critical" : "high",
      "Se preparer",
      "/(app)/health"
    );
  }

  if (stats.stress >= 78) {
    add(
      "smart-stress",
      "tip",
      "Stress trop haut",
      "Redescends avant une sortie importante. Une marche ou une pause evite de perdre du momentum.",
      stats.stress >= 90 ? "critical" : "high",
      "Respirer",
      "/(app)/(tabs)/world"
    );
  }

  if (stats.money <= 45) {
    add(
      "smart-money",
      "work",
      "Budget faible",
      "Travaille avant de lancer des sorties couteuses. Tu gardes le controle sans bloquer le social.",
      stats.money <= 20 ? "critical" : "high",
      "Travailler",
      "/(app)/work"
    );
  }

  if (stats.sociability <= 35) {
    add(
      "smart-social",
      "social",
      "Relance sociale utile",
      "Un message court ou une room publique suffit pour relancer ton profil.",
      stats.sociability <= 18 ? "high" : "medium",
      "Socialiser",
      "/(app)/(tabs)/chat"
    );
  }

  const [bestMatch] = getBestProfileMatches(avatar, residents, relationships);
  const matchItem = topMatchNotification(bestMatch, createdAt);
  if (matchItem) items.push(matchItem);

  if (stats.reputation >= 65 && stats.socialRankScore >= 55) {
    add(
      "smart-rank-window",
      "reward",
      "Fenetre sociale ouverte",
      "Ton profil est assez solide pour viser des residents plus influents aujourd'hui.",
      "medium",
      "Explorer",
      "/(app)/discover"
    );
  }

  return items.sort((a, b) => {
    const weight: Record<SmartNotificationPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return weight[b.priority] - weight[a.priority];
  });
}
