/**
 * Wory — helpers purs (aucune dépendance réseau/RN), testables isolément.
 */

export type WoryReason =
  | "mission"
  | "daily"
  | "exploration"
  | "event"
  | "crew"
  | "battle"
  | "season"
  | "achievement"
  | "social"
  | "event_entry"
  | "cosmetic"
  | "treasury_deposit"
  | "treasury_spend"
  | "battle_stake";

/**
 * Construit une clé d'idempotence stable pour un mouvement de Wory.
 * Même (scope, cible, raison, source, sourceId) → même clé → jamais compté deux fois.
 */
export function woryIdempotencyKey(parts: {
  scope: "user" | "crew";
  targetId: string;
  reason: WoryReason;
  source?: string | null;
  sourceId?: string | null;
  /** Discriminant optionnel quand plusieurs mouvements identiques sont légitimes (ex: date du jour). */
  nonce?: string | null;
}): string {
  return [
    "wory",
    parts.scope,
    parts.targetId,
    parts.reason,
    parts.source ?? "-",
    parts.sourceId ?? "-",
    parts.nonce ?? "-",
  ].join(":");
}
