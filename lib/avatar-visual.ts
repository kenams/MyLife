import type { AvatarProfile } from "@/lib/types";

// ─── Couleurs peau ────────────────────────────────────────────────────────────
const SKIN_TONES: Record<string, string> = {
  "clair":      "#fde8d0",
  "rosé":       "#f5c8ae",
  "doré":       "#e8b48a",
  "ambre":      "#d4956a",
  "caramel":    "#c07d52",
  "brun":       "#8b5e3c",
  "ébène":      "#4a2c1a",
  default:      "#d4956a"
};

// ─── Couleurs cheveux ─────────────────────────────────────────────────────────
const HAIR_COLORS: Record<string, string> = {
  "noir":       "#1a1a1a",
  "brun":       "#5c3d1e",
  "châtain":    "#7b4f2e",
  "blond":      "#e8c97a",
  "roux":       "#c94c2e",
  "gris":       "#9a9a9a",
  "blanc":      "#e8e8e8",
  "rouge":      "#c0392b",
  "bleu":       "#2980b9",
  "violet":     "#8e44ad",
  default:      "#1a1a1a"
};

// ─── Couleurs tenue ───────────────────────────────────────────────────────────
const OUTFIT_COLORS: Record<string, { top: string; bottom: string }> = {
  "business":     { top: "#1a3a5c", bottom: "#2c3e50" },
  "casual":       { top: "#3498db", bottom: "#2c3e50" },
  "sport":        { top: "#e74c3c", bottom: "#2c3e50" },
  "streetwear":   { top: "#2ecc71", bottom: "#1a1a1a" },
  "élégant":      { top: "#8e44ad", bottom: "#2c3e50" },
  "bohème":       { top: "#e67e22", bottom: "#7b4f2e" },
  "minimaliste":  { top: "#ecf0f1", bottom: "#7f8c8d" },
  "street premium":{ top: "#2c3e50", bottom: "#1a1a1a" },
  default:        { top: "#3498db", bottom: "#2c3e50" }
};

// ─── Actions visuelles ────────────────────────────────────────────────────────
export type AvatarAction =
  | "idle"
  | "walking"
  | "working"
  | "eating"
  | "sleeping"
  | "chatting"
  | "exercising"
  | "waving";

export const ACTION_LABELS: Record<AvatarAction, string> = {
  idle:       "inactif",
  walking:    "se déplace",
  working:    "travaille",
  eating:     "mange",
  sleeping:   "dort",
  chatting:   "discute",
  exercising: "s'entraîne",
  waving:     "salue"
};

export const ACTION_COLORS: Record<AvatarAction, string> = {
  idle:       "#7f8c8d",
  walking:    "#3498db",
  working:    "#f39c12",
  eating:     "#e74c3c",
  sleeping:   "#9b59b6",
  chatting:   "#2ecc71",
  exercising: "#e67e22",
  waving:     "#1abc9c"
};

// ─── Visual config extraite du profil ─────────────────────────────────────────
export type AvatarVisual = {
  skinColor: string;
  hairColor: string;
  hairLength: "court" | "mi-long" | "long";
  outfitTop: string;
  outfitBottom: string;
  hasBeard: boolean;
  eyeColor: string;
  gender: "m" | "f" | "n";
  silhouette: "mince" | "normale" | "tonique" | "robuste";
};

function normalize(s: string) {
  return s?.toLowerCase().trim() ?? "";
}

export function getAvatarVisual(avatar: AvatarProfile): AvatarVisual {
  const skinKey = Object.keys(SKIN_TONES).find((k) => normalize(avatar.skinTone).includes(k)) ?? "default";
  const hairKey = Object.keys(HAIR_COLORS).find((k) => normalize(avatar.hairColor).includes(k)) ?? "default";
  const outfitKey = Object.keys(OUTFIT_COLORS).find((k) =>
    normalize(avatar.outfitStyle).includes(k)
  ) ?? "default";

  const hairLengthRaw = normalize(avatar.hairLength);
  const hairLength: AvatarVisual["hairLength"] =
    hairLengthRaw.includes("long") && !hairLengthRaw.includes("mi") ? "long"
    : hairLengthRaw.includes("mi") ? "mi-long"
    : "court";

  const genderRaw = normalize(avatar.gender);
  const gender: AvatarVisual["gender"] =
    genderRaw.includes("femme") || genderRaw.includes("f") ? "f"
    : genderRaw.includes("homme") || genderRaw.includes("m") ? "m"
    : "n";

  const silhouetteRaw = normalize(avatar.silhouette);
  const silhouette: AvatarVisual["silhouette"] =
    silhouetteRaw.includes("mince") ? "mince"
    : silhouetteRaw.includes("toni") ? "tonique"
    : silhouetteRaw.includes("robu") ? "robuste"
    : "normale";

  const eyeKey = normalize(avatar.eyeColor);
  const eyeColor =
    eyeKey.includes("bleu") ? "#3498db"
    : eyeKey.includes("vert") ? "#27ae60"
    : eyeKey.includes("noisette") ? "#8b6914"
    : eyeKey.includes("gris") ? "#7f8c8d"
    : "#5c3d1e";

  return {
    skinColor: SKIN_TONES[skinKey] ?? SKIN_TONES.default,
    hairColor: HAIR_COLORS[hairKey] ?? HAIR_COLORS.default,
    hairLength,
    outfitTop: OUTFIT_COLORS[outfitKey]?.top ?? OUTFIT_COLORS.default.top,
    outfitBottom: OUTFIT_COLORS[outfitKey]?.bottom ?? OUTFIT_COLORS.default.bottom,
    hasBeard: normalize(avatar.facialHair).includes("barbe"),
    eyeColor,
    gender,
    silhouette
  };
}

// ─── Seed visual pour les PNJ ─────────────────────────────────────────────────
const NPC_SKINS   = ["#fde8d0", "#e8b48a", "#d4956a", "#c07d52", "#8b5e3c", "#4a2c1a"];
const NPC_HAIRS   = ["#1a1a1a", "#5c3d1e", "#e8c97a", "#c94c2e", "#9a9a9a"];
const NPC_TOPS    = ["#1a3a5c", "#3498db", "#e74c3c", "#2ecc71", "#8e44ad", "#e67e22"];
const NPC_BOTTOMS = ["#2c3e50", "#1a1a1a", "#7b4f2e", "#2c3e50"];

export function getNpcVisual(npcId: string): AvatarVisual {
  const hash = npcId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    skinColor:    NPC_SKINS[hash % NPC_SKINS.length],
    hairColor:    NPC_HAIRS[(hash + 1) % NPC_HAIRS.length],
    hairLength:   (["court", "mi-long", "long"] as const)[hash % 3],
    outfitTop:    NPC_TOPS[(hash + 2) % NPC_TOPS.length],
    outfitBottom: NPC_BOTTOMS[(hash + 3) % NPC_BOTTOMS.length],
    hasBeard:     hash % 4 === 0,
    eyeColor:     "#5c3d1e",
    gender:       (["m", "f", "n"] as const)[hash % 3],
    silhouette:   (["mince", "normale", "tonique", "robuste"] as const)[hash % 4]
  };
}
