// ── Directions artistiques ────────────────────────────────────────────────────
export type ThemeId = "urban-premium" | "clean-life" | "social-pulse" | "quartier-life";

export type AppTheme = {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  dark: boolean;

  bg: string;
  card: string;
  card2: string;
  text: string;
  textSoft: string;
  muted: string;
  border: string;

  primary: string;
  primaryBg: string;
  green: string;
  greenBg: string;
  gold: string;
  goldBg: string;
  red: string;
  redBg: string;
  blue: string;
  blueBg: string;
  purple: string;
  purpleBg: string;
  pink: string;
  pinkBg: string;
  teal: string;
  tealBg: string;
  orange: string;
  orangeBg: string;

  tabBg: string;
  tabBorder: string;
  tabActive: string;
  tabInactive: string;
  tabShadow: string;
};

const urbanPremium: AppTheme = {
  id: "urban-premium",
  name: "Urban Premium",
  tagline: "Dark · Violet · Luxe",
  emoji: "🌃",
  dark: true,

  bg:       "#0c0e16",
  card:     "#161924",
  card2:    "#1e2235",
  text:     "#e8edf5",
  textSoft: "#8fa3b8",
  muted:    "#4a5568",
  border:   "#252c3f",

  primary:   "#8b5cf6",
  primaryBg: "#1a1030",
  green:     "#10b981",
  greenBg:   "#0a2010",
  gold:      "#f59e0b",
  goldBg:    "#2a1e00",
  red:       "#ef4444",
  redBg:     "#2a1010",
  blue:      "#3b82f6",
  blueBg:    "#0a1a2e",
  purple:    "#8b5cf6",
  purpleBg:  "#1a1030",
  pink:      "#ec4899",
  pinkBg:    "#2a1020",
  teal:      "#14b8a6",
  tealBg:    "#0a2020",
  orange:    "#f97316",
  orangeBg:  "#2a1500",

  tabBg:       "#161924",
  tabBorder:   "#252c3f",
  tabActive:   "#8b5cf6",
  tabInactive: "#4a5568",
  tabShadow:   "rgba(139,92,246,0.2)",
};

const cleanLife: AppTheme = {
  id: "clean-life",
  name: "Clean Life",
  tagline: "Light · Beige · Teal",
  emoji: "🌿",
  dark: false,

  bg:       "#f2ede8",
  card:     "#ffffff",
  card2:    "#f8f4f0",
  text:     "#1a2030",
  textSoft: "#5c6b7a",
  muted:    "#9aa5b4",
  border:   "#e0d8d0",

  primary:   "#14b8a6",
  primaryBg: "#e6faf8",
  green:     "#10b981",
  greenBg:   "#ecfdf5",
  gold:      "#d97706",
  goldBg:    "#fef3c7",
  red:       "#dc2626",
  redBg:     "#fee2e2",
  blue:      "#2563eb",
  blueBg:    "#eff6ff",
  purple:    "#7c3aed",
  purpleBg:  "#f5f3ff",
  pink:      "#db2777",
  pinkBg:    "#fce7f3",
  teal:      "#0d9488",
  tealBg:    "#ccfbf1",
  orange:    "#ea580c",
  orangeBg:  "#fff7ed",

  tabBg:       "#ffffff",
  tabBorder:   "#e0d8d0",
  tabActive:   "#0d9488",
  tabInactive: "#9aa5b4",
  tabShadow:   "rgba(13,148,136,0.12)",
};

const socialPulse: AppTheme = {
  id: "social-pulse",
  name: "Social Pulse",
  tagline: "Dark · Mauve · Vibrant",
  emoji: "💜",
  dark: true,

  bg:       "#100b1e",
  card:     "#1a1432",
  card2:    "#231c48",
  text:     "#ede8ff",
  textSoft: "#a89ac8",
  muted:    "#5a4d7a",
  border:   "#2c2250",

  primary:   "#c084fc",
  primaryBg: "#1e1040",
  green:     "#4ade80",
  greenBg:   "#0a2010",
  gold:      "#fbbf24",
  goldBg:    "#2a1e00",
  red:       "#f87171",
  redBg:     "#2a1010",
  blue:      "#60a5fa",
  blueBg:    "#0a1030",
  purple:    "#c084fc",
  purpleBg:  "#1e1040",
  pink:      "#f472b6",
  pinkBg:    "#2a1030",
  teal:      "#2dd4bf",
  tealBg:    "#0a2030",
  orange:    "#fb923c",
  orangeBg:  "#2a1500",

  tabBg:       "#1a1432",
  tabBorder:   "#2c2250",
  tabActive:   "#c084fc",
  tabInactive: "#5a4d7a",
  tabShadow:   "rgba(192,132,252,0.25)",
};

const quartierLife: AppTheme = {
  id: "quartier-life",
  name: "Quartier Life",
  tagline: "Asphalte · Néon · Toulouse",
  emoji: "🏙️",
  dark: true,

  bg:       "#080808",
  card:     "#111111",
  card2:    "#181818",
  text:     "#F5F2E8",
  textSoft: "#A8A49A",
  muted:    "#4A4844",
  border:   "rgba(255,255,255,0.07)",

  primary:   "#FFD600",
  primaryBg: "#1A1500",
  green:     "#39FF14",
  greenBg:   "#091A03",
  gold:      "#FFD600",
  goldBg:    "#1A1500",
  red:       "#FF3B3B",
  redBg:     "#1A0808",
  blue:      "#00B4FF",
  blueBg:    "#001A2A",
  purple:    "#BF5FFF",
  purpleBg:  "#18082A",
  pink:      "#FF2D78",
  pinkBg:    "#1A0818",
  teal:      "#00FFD1",
  tealBg:    "#001A14",
  orange:    "#FF6B00",
  orangeBg:  "#1A0D00",

  tabBg:       "#0E0E0E",
  tabBorder:   "rgba(255,214,0,0.12)",
  tabActive:   "#FFD600",
  tabInactive: "#4A4844",
  tabShadow:   "rgba(255,214,0,0.15)",
};

// ThemeId kept at top of file — see type definition above

export const THEMES: Record<string, AppTheme> = {
  "urban-premium":  urbanPremium,
  "clean-life":     cleanLife,
  "social-pulse":   socialPulse,
  "quartier-life":  quartierLife,
};

export const DEFAULT_THEME: ThemeId = "quartier-life";
