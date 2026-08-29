/** Calcul de score de Battle — miroir léger du serveur pour l'affichage live. Pur. */

export type ScoreRow = { crew_id: string; r1_taps: number; r2_score: number; r3_hits: number };

export function liveScore(rows: ScoreRow[], attackerCrew: string, defenderCrew: string | null) {
  const agg = (crew: string | null) => {
    if (!crew) return 0;
    const r = rows.filter((p) => p.crew_id === crew);
    if (!r.length) return 0;
    const r1 = r.reduce((s, p) => s + p.r1_taps, 0) / r.length / 60;
    const r2 = r.reduce((s, p) => s + p.r2_score, 0) / r.length / 3;
    const r3 = r.reduce((s, p) => s + p.r3_hits, 0) / r.length / 8;
    const base = r1 * 0.34 + r2 * 0.33 + r3 * 0.33;
    return base * (1 + Math.min(0.15, (r.length - 1) * 0.02));
  };
  const a = Math.max(agg(attackerCrew), 0.0001);
  const d = Math.max(agg(defenderCrew), 0.0001);
  const total = a + d;
  return { attackerPct: (a / total) * 100, defenderPct: (d / total) * 100 };
}
