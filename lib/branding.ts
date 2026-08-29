/**
 * Configuration centrale de marque.
 *
 * MyLife est un NOM DE TRAVAIL. Tout ce qui touche à l'identité publique passe
 * par ce fichier pour qu'un futur changement de marque soit une opération de
 * config + assets, pas une refonte. Ne pas hardcoder « MyLife » ni « Wory »
 * ailleurs : importer `BRAND` / `wory()`.
 */

export const BRAND = {
  appName: "MyLife",
  shortName: "MyLife",
  tagline: "Ta ville. Ton crew. Ta vie.",
  supportEmail: "support@mylife.app",
  socialHandles: {
    instagram: "@mylife",
    tiktok: "@mylife",
  },
  /** Monnaie virtuelle interne. Aucune valeur en euros, aucune conversion. */
  currency: {
    name: "Wory",
    /** Pluriel identique (invariable). */
    plural: "Wory",
    symbol: "🪙",
  },
  metadata: {
    title: "MyLife",
    description: "Jeu social IRL : ville, crew, missions, battles et rencontres à Toulouse.",
    themeColor: "#080808",
  },
} as const;

/** Formate un montant de monnaie : `wory(1234)` → `🪙 1 234`. */
export function wory(amount: number, opts?: { symbol?: boolean; sign?: boolean }): string {
  const showSymbol = opts?.symbol ?? true;
  const n = Math.round(amount);
  const body = new Intl.NumberFormat("fr-FR").format(Math.abs(n));
  const sign = opts?.sign && n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${showSymbol ? BRAND.currency.symbol + " " : ""}${body}`;
}

/** Nom court de la monnaie, pour les phrases : `« Il te manque 18 ${woryName()} »`. */
export function woryName(): string {
  return BRAND.currency.name;
}
