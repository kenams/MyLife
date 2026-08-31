import type { LivingCityEvent } from "@/lib/living-city";
import type { NpcState } from "@/lib/types";

/**
 * Le monde vient vers le joueur.
 *
 * Quand le joueur reste sur la Map sans rien toucher, il peut recevoir
 * OCCASIONNELLEMENT une interaction spontanée : un salut, un café proposé, une
 * invitation. Ce module est un pur sélecteur : il transforme un événement
 * Living City pertinent en "moment" joueur, avec cooldown, dédup et priorité.
 *
 * Règle anti-spam : au plus une interaction importante toutes les
 * SPONTANEOUS_COOLDOWN_MS. Le NPC Brain (côté événement) a déjà filtré la
 * pertinence — ici on borne la fréquence côté présentation.
 */

export const SPONTANEOUS_COOLDOWN_MS = 3 * 60_000;

export type SpontaneousMoment = {
  id: string;
  npcId: string | null;
  npcName: string;
  kind: "GREETING" | "COFFEE" | "GYM" | "OUTING" | "CREW" | "QUESTION";
  title: string;
  body: string;
  district: string;
  priority: number;
  createdAt: string;
  /** identité PNJ toujours explicite : ce sont des habitants simulés. */
  simulated: true;
};

type Ctx = {
  playerDistrict: string;
  playerLevel: number;
  lastMomentAt: string | null;
  recentMomentIds: string[];
};

const KIND_BY_EVENT: Partial<Record<LivingCityEvent["kind"], SpontaneousMoment["kind"]>> = {
  FEELING: "OUTING",
  MATCH: "OUTING",
  RELATIONSHIP: "GREETING",
  OUTING: "OUTING",
  EVENT: "OUTING",
  SOCIAL: "COFFEE",
  CREW: "CREW",
};

function firstName(npcName: string): string {
  return npcName.split(".")[0] ?? npcName;
}

function normalizedText(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLocaleLowerCase("fr-FR");
}

/**
 * La nature du moment doit refléter ce que le PNJ est réellement en train de
 * faire, pas uniquement le type abstrait de l'événement. Cela donne davantage
 * l'impression de croiser des habitants avec leur propre journée.
 */
function contextualMomentKind(
  event: LivingCityEvent,
  actor: NpcState | undefined,
): SpontaneousMoment["kind"] | null {
  const fallback = KIND_BY_EVENT[event.kind];
  if (!fallback) return null;

  const activity = normalizedText(actor?.currentActivity, actor?.action, event.title, event.body);
  const personality = normalizedText(actor?.personality, ...(actor?.interests ?? []));

  if (/(salle|gym|fitness|sport|running|course|training|entraînement|entrainement)/.test(activity)) {
    return "GYM";
  }
  if (/(café|cafe|coffee|brunch)/.test(activity)) {
    return "COFFEE";
  }
  if (
    event.kind === "SOCIAL"
    && (/(curieux|curieuse|curiosité|curiosite|discussion|culture|étudiant|etudiant)/.test(personality)
      || /\?|question|avis|conseil/.test(activity))
  ) {
    return "QUESTION";
  }

  return fallback;
}

function templateFor(kind: SpontaneousMoment["kind"], name: string, district: string): { title: string; body: string } {
  switch (kind) {
    case "COFFEE":
      return { title: `${name} te propose un café`, body: `${name} traîne vers ${district} et propose de passer boire un café.` };
    case "GYM":
      return { title: `${name} va à la salle`, body: `${name} cherche quelqu'un pour une séance à ${district}.` };
    case "OUTING":
      return { title: `${name} est dispo ce soir`, body: `${name} monte une sortie du côté de ${district}. Partant ?` };
    case "CREW":
      return { title: `Un crew te remarque`, body: `${name} t'a repéré vers ${district}. Le crew jette un œil sur ton profil.` };
    case "QUESTION":
      return { title: `${name} te capte`, body: `${name} te pose une question sur le quartier de ${district}.` };
    default:
      return { title: `${name} t'a croisé`, body: `${name} t'a croisé à ${district} et te fait signe.` };
  }
}

/**
 * Choisit au plus UN moment spontané pour ce tick. Retourne null si le cooldown
 * n'est pas écoulé ou si aucun événement pertinent.
 */
export function pickSpontaneousNpcMoment(
  events: LivingCityEvent[],
  npcs: NpcState[],
  ctx: Ctx,
  now: Date = new Date(),
): SpontaneousMoment | null {
  if (ctx.lastMomentAt) {
    const elapsed = now.getTime() - new Date(ctx.lastMomentAt).getTime();
    if (elapsed < SPONTANEOUS_COOLDOWN_MS) return null;
  }

  const npcById = new Map(npcs.map((n) => [n.id, n]));
  const recent = new Set(ctx.recentMomentIds);

  const candidates = events
    .filter((event) => KIND_BY_EVENT[event.kind])
    .map((event) => {
      const nearby = event.district === ctx.playerDistrict;
      const actorId = event.actorNpcIds[0] ?? null;
      const actor = actorId ? npcById.get(actorId) : undefined;
      const name = firstName(actor?.name ?? "Quelqu'un");
      let kind = contextualMomentKind(event, actor)!;
      // CREW seulement si le joueur a le niveau (cohérence progression).
      if (kind === "CREW" && ctx.playerLevel < 2) kind = "GREETING";
      const id = `spm:${event.kind}:${actorId ?? "x"}:${event.district}:${kind}`;
      const tpl = templateFor(kind, name, event.district);
      return {
        id,
        npcId: actorId,
        npcName: name,
        kind,
        title: tpl.title,
        body: tpl.body,
        district: event.district,
        priority: event.priority + (nearby ? 25 : 0),
        createdAt: now.toISOString(),
        simulated: true as const,
      } satisfies SpontaneousMoment;
    })
    .filter((moment) => !recent.has(moment.id))
    .sort((a, b) => b.priority - a.priority);

  return candidates[0] ?? null;
}
