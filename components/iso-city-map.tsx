/**
 * IsoCityMap v3 — Vue isométrique 2.5D de Neo Paris (Ultimate)
 * - Clics via onPress SVG (fixed in v2)
 * - Avatar joueur visible + pulsing marker
 * - Info bulle bâtiment sélectionné
 * - Particules ambiantes par type de bâtiment
 * - NPCs aux emplacements réels
 * - Météo : nuages jour / étoiles filantes nuit
 * - Antennes / châteaux d'eau pour les grands immeubles
 */
import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient, Path,
  Polygon, Rect, Stop, Text as SvgText, RadialGradient, Line,
} from "react-native-svg";
import { Dimensions } from "react-native";
import { useTimeContext } from "@/lib/time-context";
import type { NpcState } from "@/lib/types";

// ── Dimensions ────────────────────────────────────────────────────────────────
const W = Dimensions.get("window").width;
const IS_WIDE = W >= 900;
export const MAP_W = Math.min(IS_WIDE ? 900 : W - 8, 900);
export const MAP_H = IS_WIDE ? 640 : Math.min(W * 0.98, 540);

// ── Grille isométrique ────────────────────────────────────────────────────────
const BLDG  = 72;
const ROAD  = 26;
const STEP  = BLDG + ROAD;   // 98
const HS    = STEP / 2;      // 49
const QS    = STEP / 4;      // 24.5
const FLOOR_H = 16;

const OX = MAP_W / 2 + 4;
const OY = 70;

function bpos(col: number, row: number) {
  return {
    ox: OX + (col - row) * HS,
    oy: OY + (col + row) * QS,
  };
}

function diamond(cx: number, cy: number, hw: number, hh: number) {
  return `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type District = {
  slug: string; label: string; emoji: string;
  col: number; row: number; floors: number;
  wall: string; roof: string; neon: string | null;
  kind: "work" | "social" | "food" | "wellness" | "home" | "premium";
  particle?: string;
  hasAntenna?: boolean;
  hasTank?: boolean;
};

const BLDGS: District[] = [
  { slug: "library",            label: "Bibliothèque",   emoji: "📚", col: 0, row: 0, floors: 2, wall: "#374151", roof: "#1f2937", neon: null,      kind: "work",     particle: "📖" },
  { slug: "startup",            label: "Startup Hub",    emoji: "💡", col: 1, row: 0, floors: 4, wall: "#1e40af", roof: "#1e3a8a", neon: "#60a5fa", kind: "work",     particle: "💡", hasAntenna: true },
  { slug: "office",             label: "Bureau",         emoji: "💼", col: 2, row: 0, floors: 5, wall: "#312e81", roof: "#1e1b4b", neon: "#a78bfa", kind: "work",     particle: "💼", hasAntenna: true, hasTank: true },
  { slug: "rooftop-bar",        label: "Rooftop",        emoji: "🥂", col: 3, row: 0, floors: 5, wall: "#7c3aed", roof: "#4c1d95", neon: "#c084fc", kind: "premium",  particle: "✨" },
  { slug: "residence-luxe",     label: "Résid. Luxe",    emoji: "🏛️", col: 0, row: 1, floors: 3, wall: "#92400e", roof: "#78350f", neon: "#fcd34d", kind: "premium",  particle: "⭐" },
  { slug: "cinema",             label: "Cinéma",         emoji: "🎬", col: 1, row: 1, floors: 3, wall: "#9f1239", roof: "#881337", neon: "#fb7185", kind: "social",   particle: "🎬" },
  { slug: "nightclub",          label: "Nightclub",      emoji: "🎵", col: 2, row: 1, floors: 4, wall: "#6d28d9", roof: "#4c1d95", neon: "#e879f9", kind: "social",   particle: "🎵" },
  { slug: "restaurant",         label: "Restaurant",     emoji: "🍽️", col: 3, row: 1, floors: 3, wall: "#c2410c", roof: "#9a3412", neon: "#fb923c", kind: "food",     particle: "🍽️" },
  { slug: "cafe",               label: "Café",           emoji: "☕", col: 0, row: 2, floors: 2, wall: "#78350f", roof: "#451a03", neon: "#fbbf24", kind: "food",     particle: "☕" },
  { slug: "gym",                label: "Salle Sport",    emoji: "🏋️", col: 1, row: 2, floors: 3, wall: "#075985", roof: "#0c4a6e", neon: "#38bdf8", kind: "wellness", particle: "💪", hasAntenna: false },
  { slug: "spa",                label: "Spa",            emoji: "🧘", col: 2, row: 2, floors: 2, wall: "#6b21a8", roof: "#581c87", neon: "#d8b4fe", kind: "wellness", particle: "✨" },
  { slug: "market",             label: "Marché",         emoji: "🥕", col: 3, row: 2, floors: 1, wall: "#166534", roof: "#14532d", neon: null,      kind: "food",     particle: "🛒" },
  { slug: "park",               label: "Parc",           emoji: "🌳", col: 0, row: 3, floors: 0, wall: "#065f46", roof: "#064e3b", neon: null,      kind: "wellness", particle: "🌿" },
  { slug: "home",               label: "Chez toi",       emoji: "🏡", col: 1, row: 3, floors: 2, wall: "#15803d", roof: "#166534", neon: "#86efac", kind: "home",     particle: "🏡" },
  { slug: "residence-confort",  label: "Résid. Confort", emoji: "🏠", col: 2, row: 3, floors: 2, wall: "#4b5563", roof: "#374151", neon: null,      kind: "home"    },
  { slug: "residence-populaire",label: "Résid. Pop.",    emoji: "🏘️", col: 3, row: 3, floors: 2, wall: "#6b7280", roof: "#4b5563", neon: null,      kind: "home"    },
];

// ── Couleurs utilitaires ───────────────────────────────────────────────────────
function lighten(hex: string, amt: number): string {
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + amt);
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + amt);
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + amt);
  return `rgb(${r},${g},${b})`;
}
function darken(hex: string, amt: number): string {
  const r = Math.max(0, parseInt(hex.slice(1,3),16) - amt);
  const g = Math.max(0, parseInt(hex.slice(3,5),16) - amt);
  const b = Math.max(0, parseInt(hex.slice(5,7),16) - amt);
  return `rgb(${r},${g},${b})`;
}

// ── Faces bâtiment ─────────────────────────────────────────────────────────────
function bldgFaces(col: number, row: number, floors: number) {
  const { ox, oy } = bpos(col, row);
  const hw = BLDG / 2;
  const hh = BLDG / 4;
  const h  = floors * FLOOR_H;
  return {
    ox, oy, hw, hh, h,
    roof:  diamond(ox, oy - h, hw, hh),
    left:  `${ox-hw},${oy-h} ${ox},${oy+hh-h} ${ox},${oy+hh} ${ox-hw},${oy}`,
    right: `${ox+hw},${oy-h} ${ox},${oy+hh-h} ${ox},${oy+hh} ${ox+hw},${oy}`,
    base:  diamond(ox, oy, hw, hh),
  };
}

// ── Arbre isométrique ─────────────────────────────────────────────────────────
function IsoTree({ cx, cy, size = 12, color = "#166534" }: {
  cx: number; cy: number; size?: number; color?: string;
}) {
  return (
    <G>
      <Rect x={cx - 2} y={cy} width={4} height={size * 0.6} fill="#78350f" />
      <Polygon
        points={`${cx},${cy - size} ${cx + size*0.65},${cy + size*0.15} ${cx - size*0.65},${cy + size*0.15}`}
        fill={darken(color, 10)}
      />
      <Polygon
        points={`${cx},${cy - size*1.3} ${cx + size*0.5},${cy - size*0.25} ${cx - size*0.5},${cy - size*0.25}`}
        fill={lighten(color, 25)}
      />
      <Polygon
        points={`${cx},${cy - size*1.55} ${cx + size*0.3},${cy - size*0.7} ${cx - size*0.3},${cy - size*0.7}`}
        fill={lighten(color, 45)}
      />
    </G>
  );
}

// ── Voiture ───────────────────────────────────────────────────────────────────
function Car({ fromCol, fromRow, toCol, toRow, progress, color }: {
  fromCol: number; fromRow: number; toCol: number; toRow: number;
  progress: number; color: string;
}) {
  const from = bpos(fromCol, fromRow);
  const to   = bpos(toCol, toRow);
  const cx = from.ox + (to.ox - from.ox) * progress;
  const cy = from.oy + (to.oy - from.oy) * progress;
  return (
    <G>
      <Ellipse cx={cx} cy={cy + 1} rx={7} ry={3.5} fill="rgba(0,0,0,0.2)" />
      <Ellipse cx={cx} cy={cy} rx={7} ry={4} fill={color} opacity={0.95} />
      <Ellipse cx={cx} cy={cy - 2} rx={4.5} ry={2.5} fill={lighten(color, 40)} opacity={0.75} />
      <Circle  cx={cx - 5} cy={cy + 2} r={2} fill="#1f2937" opacity={0.8} />
      <Circle  cx={cx + 5} cy={cy + 2} r={2} fill="#1f2937" opacity={0.8} />
    </G>
  );
}

// ── Bâtiment SVG ──────────────────────────────────────────────────────────────
function Building({ d, isHere, isSelected, night, npcCount, onPress, tick }: {
  d: District; isHere: boolean; isSelected: boolean; night: boolean;
  npcCount: number; onPress: () => void; tick: number;
}) {
  const f = bldgFaces(d.col, d.row, d.floors);
  const winRows = Math.max(0, d.floors - 1);
  const seed = d.slug.charCodeAt(0);
  const pulse = isHere ? 0.4 + 0.2 * Math.sin(tick * 0.08) : 0;
  const selectedGlow = isSelected ? 0.5 + 0.25 * Math.sin(tick * 0.1) : 0;

  return (
    <G onPress={onPress}>
      {/* Ombre sous le bâtiment */}
      {d.floors > 0 && (
        <Ellipse
          cx={f.ox + 4} cy={f.oy + f.hh - 2}
          rx={f.hw * 0.9} ry={f.hh * 0.55}
          fill="rgba(0,0,0,0.18)"
        />
      )}

      {/* Halo sélection */}
      {isSelected && (
        <Ellipse
          cx={f.ox} cy={f.oy + f.hh - 3}
          rx={f.hw + 10} ry={f.hh + 6}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2}
          opacity={selectedGlow}
        />
      )}

      {/* Base tile (trottoir) */}
      <Polygon
        points={f.base}
        fill={isHere ? lighten(d.wall, 55) : night ? "#111827" : "#d1d5db"}
        stroke={isHere ? (d.neon ?? d.wall) : isSelected ? "#fbbf24" : night ? "#1f2937" : "#9ca3af"}
        strokeWidth={isHere || isSelected ? 1.5 : 0.5}
      />

      {d.floors > 0 && (
        <>
          {/* Face gauche */}
          <Polygon
            points={f.left}
            fill={darken(d.wall, 45)}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={0.5}
          />
          {/* Face droite */}
          <Polygon
            points={f.right}
            fill={darken(d.wall, 22)}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={0.5}
          />
          {/* Toit */}
          <Polygon
            points={f.roof}
            fill={isHere ? lighten(d.roof, 45) : isSelected ? lighten(d.roof, 30) : d.roof}
            stroke={isHere ? (d.neon ?? "#fff") : isSelected ? "#fbbf24" : "rgba(255,255,255,0.12)"}
            strokeWidth={isHere || isSelected ? 1.5 : 0.5}
          />

          {/* Fenêtres face droite */}
          {Array.from({ length: winRows }).map((_, i) =>
            Array.from({ length: 2 }).map((__, j) => {
              const lit = night && (((seed + i * 3 + j * 7) % 5) < 3);
              return (
                <Rect
                  key={`wr-${i}-${j}`}
                  x={f.ox + f.hw * 0.12 + j * f.hw * 0.44}
                  y={f.oy + f.hh - f.h + i * FLOOR_H + 5}
                  width={f.hw * 0.3}
                  height={8}
                  rx={1.5}
                  fill={lit ? "#fef08a" : night ? "#0f172a" : "rgba(255,255,255,0.3)"}
                  opacity={0.9}
                />
              );
            })
          )}

          {/* Fenêtres face gauche */}
          {Array.from({ length: winRows }).map((_, i) => {
            const lit = night && (((seed + i * 5 + 2) % 4) < 2);
            return (
              <Rect
                key={`wl-${i}`}
                x={f.ox - f.hw * 0.6}
                y={f.oy + f.hh - f.h + i * FLOOR_H + 5}
                width={f.hw * 0.3}
                height={8}
                rx={1.5}
                fill={lit ? "#fef08a" : night ? "#0f172a" : "rgba(255,255,255,0.25)"}
                opacity={0.8}
              />
            );
          })}

          {/* Antenne */}
          {d.hasAntenna && (
            <G>
              <Rect x={f.ox - 1} y={f.oy - f.h - 18} width={2} height={18} fill="#6b7280" />
              <Circle cx={f.ox} cy={f.oy - f.h - 20} r={2.5} fill={night ? "#ef4444" : "#9ca3af"} opacity={night ? 0.9 : 0.6} />
              {night && <Ellipse cx={f.ox} cy={f.oy - f.h - 20} rx={5} ry={3} fill="#ef4444" opacity={0.25} />}
            </G>
          )}

          {/* Château d'eau */}
          {d.hasTank && (
            <G>
              <Rect x={f.ox - 10} y={f.oy - f.h - 16} width={10} height={12} rx={2} fill="#4b5563" />
              <Polygon
                points={`${f.ox-10},${f.oy-f.h-16} ${f.ox},${f.oy-f.h-22} ${f.ox},${f.oy-f.h-16}`}
                fill="#374151"
              />
            </G>
          )}

          {/* Néon nuit */}
          {d.neon && night && (
            <>
              <SvgText
                x={f.ox}
                y={f.oy - f.h - 16}
                textAnchor="middle"
                fontSize={13}
                fill={d.neon}
                opacity={0.95}
              >
                {d.emoji}
              </SvgText>
              <Ellipse
                cx={f.ox}
                cy={f.oy - f.h - 8}
                rx={15}
                ry={6}
                fill={d.neon}
                opacity={0.15}
              />
            </>
          )}

          {/* Emoji jour */}
          {!night && d.floors > 0 && (
            <SvgText
              x={f.ox}
              y={f.oy - f.h + 6}
              textAnchor="middle"
              fontSize={13}
              fill="#fff"
              opacity={0.9}
            >
              {d.emoji}
            </SvgText>
          )}

          {/* Fumée / particule ambiante */}
          {d.particle && night && d.neon && (
            <>
              <Circle
                cx={f.ox - 6}
                cy={f.oy - f.h - 28 + ((tick * 0.5) % 12)}
                r={3}
                fill={d.neon}
                opacity={0.15 + 0.1 * Math.sin(tick * 0.05)}
              />
              <Circle
                cx={f.ox + 3}
                cy={f.oy - f.h - 34 + ((tick * 0.4 + 5) % 12)}
                r={2}
                fill={d.neon}
                opacity={0.1 + 0.08 * Math.sin(tick * 0.07)}
              />
            </>
          )}
        </>
      )}

      {/* Arbres pour le parc */}
      {d.slug === "park" && (
        <>
          <IsoTree cx={f.ox - 18} cy={f.oy - 18} size={15} color="#166534" />
          <IsoTree cx={f.ox + 10} cy={f.oy - 22} size={18} color="#15803d" />
          <IsoTree cx={f.ox - 4}  cy={f.oy - 10} size={12} color="#14532d" />
          <IsoTree cx={f.ox + 24} cy={f.oy - 12} size={11} color="#166534" />
          <Circle cx={f.ox - 8}  cy={f.oy - 4}  r={4}  fill="#bbf7d0" opacity={0.5} />
          <Circle cx={f.ox + 14} cy={f.oy - 2}  r={3}  fill="#86efac" opacity={0.4} />
        </>
      )}

      {/* Bulle NPC au-dessus du bâtiment */}
      {npcCount > 0 && (
        <>
          <Circle cx={f.ox + f.hw - 5} cy={f.oy - f.h - 8} r={10} fill={d.neon ?? "#10b981"} opacity={0.92} />
          <SvgText
            x={f.ox + f.hw - 5}
            y={f.oy - f.h - 5}
            textAnchor="middle"
            fontSize={10}
            fill="#fff"
            fontWeight="bold"
          >
            {npcCount}
          </SvgText>
        </>
      )}

      {/* "TU ES ICI" — pulsing ellipse */}
      {isHere && (
        <>
          <Ellipse
            cx={f.ox} cy={f.oy + f.hh - 3}
            rx={24} ry={9}
            fill={d.neon ?? "#6366f1"}
            opacity={pulse}
          />
          <Ellipse
            cx={f.ox} cy={f.oy + f.hh - 3}
            rx={24} ry={9}
            fill="none"
            stroke={d.neon ?? "#6366f1"}
            strokeWidth={1.5}
            opacity={0.7}
          />
          {/* Flèche ▼ pointant vers le bâtiment */}
          <Polygon
            points={`${f.ox},${f.oy - f.h - 28} ${f.ox - 5},${f.oy - f.h - 38} ${f.ox + 5},${f.oy - f.h - 38}`}
            fill="#22d3ee"
            opacity={0.85 + 0.15 * Math.sin(tick * 0.12)}
          />
        </>
      )}

      {/* Hit area transparent (grande zone de clic) — ne propage pas vers G */}
      <Polygon
        points={`${f.ox},${f.oy - f.h - f.hh - 20} ${f.ox + f.hw + 10},${f.oy - f.h + f.hh + 6} ${f.ox},${f.oy + f.hh + 6} ${f.ox - f.hw - 10},${f.oy - f.h + f.hh + 6}`}
        fill="transparent"
        stroke="transparent"
        strokeWidth={0}
      />
    </G>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export type IsoCityMapProps = {
  currentSlug: string;
  npcs: NpcState[];
  onDistrictPress: (slug: string) => void;  // ouvre le panneau détail
  onTravel?: (slug: string) => void;         // voyage direct
};

export function IsoCityMap({ currentSlug, npcs, onDistrictPress, onTravel }: IsoCityMapProps) {
  const timeCtx  = useTimeContext();
  const night    = timeCtx.hour >= 21 || timeCtx.hour < 6;
  const evening  = timeCtx.hour >= 18 && timeCtx.hour < 21;

  const [tick, setTick] = useState(0);
  const [carProgress, setCarProgress] = useState([0, 0.33, 0.66]);
  const [pedProgress, setPedProgress] = useState([0, 0.4, 0.7, 0.2, 0.55]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [cloudX, setCloudX] = useState([40, 180, 340, 520, 700]);

  // Tick principal
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 40);
    return () => clearInterval(id);
  }, []);

  // Voitures
  useEffect(() => {
    const id = setInterval(() => {
      setCarProgress((prev) => prev.map((p) => (p + 0.004) % 1));
    }, 40);
    return () => clearInterval(id);
  }, []);

  // Piétons
  useEffect(() => {
    const id = setInterval(() => {
      setPedProgress((prev) => prev.map((p, i) => (p + 0.002 + i * 0.0003) % 1));
    }, 50);
    return () => clearInterval(id);
  }, []);

  // Nuages (jour seulement)
  useEffect(() => {
    if (night) return;
    const id = setInterval(() => {
      setCloudX((prev) => prev.map((x) => (x + 0.3) % (MAP_W + 80)));
    }, 50);
    return () => clearInterval(id);
  }, [night]);

  // NPCs par lieu
  const npcsByLoc = npcs.reduce<Record<string, number>>((acc, n) => {
    acc[n.locationSlug] = (acc[n.locationSlug] ?? 0) + 1;
    return acc;
  }, {});

  // Z-order
  const sorted = [...BLDGS].sort((a, b) => (a.col + a.row) - (b.col + b.row));

  // Routes voitures
  const carRoutes = [
    { from: [0.5, -0.6], to: [3.6, 3.6] },
    { from: [-0.6, 0.5], to: [3.6, 3.6] },
    { from: [3.6, -0.6], to: [-0.6, 3.6] },
  ] as const;
  const carColors = ["#ef4444", "#3b82f6", "#f59e0b"];

  // Routes piétons
  const npcRoutes = [
    { from: [0.5, 0.5], to: [1.5, 1.5] },
    { from: [2.5, 0.5], to: [3.5, 2.5] },
    { from: [1.5, 3.5], to: [3.5, 1.5] },
    { from: [0.5, 2.5], to: [2.5, 3.5] },
    { from: [3.5, 0.5], to: [0.5, 3.5] },
  ];
  const pedColors = ["#10b981", "#8b5cf6", "#f97316", "#ec4899", "#3b82f6"];

  // Palettes
  const skyTop    = night ? "#020810" : evening ? "#7c2d12" : "#1d4ed8";
  const skyBot    = night ? "#0d1a2e" : evening ? "#fb923c" : "#7dd3fc";
  const roadColor = night ? "#111827" : "#4b5563";
  const pavColor  = night ? "#1e2538" : "#9ca3af";

  // Bâtiment sélectionné
  const selectedBldg = BLDGS.find((b) => b.slug === selectedSlug);

  // ── Tuiles de sol ──────────────────────────────────────────────────────────
  const COLS = 4, ROWS = 4;
  const groundTiles: JSX.Element[] = [];
  for (let col = -1; col <= COLS + 1; col++) {
    for (let row = -1; row <= ROWS + 1; row++) {
      const { ox, oy } = bpos(col, row);
      const isBldg = BLDGS.some((b) => b.col === col && b.row === row);
      groundTiles.push(
        <Polygon
          key={`g-${col}-${row}`}
          points={diamond(ox, oy, BLDG / 2, BLDG / 4)}
          fill={isBldg ? pavColor : roadColor}
          stroke={night ? "rgba(99,102,241,0.07)" : "rgba(0,0,0,0.07)"}
          strokeWidth={0.5}
        />
      );
    }
  }

  // ── Marquages routiers (lignes pointillées centrales) ──────────────────────
  const roadMarkings: JSX.Element[] = [];
  // Voies horizontales (diagonales iso)
  for (let row = -1; row <= ROWS; row++) {
    const p1 = bpos(-1, row + 0.5);
    const p2 = bpos(COLS, row + 0.5);
    for (let t = 0; t < 8; t++) {
      const f = t / 8;
      const e = (t + 0.5) / 8;
      roadMarkings.push(
        <Line
          key={`rm-h-${row}-${t}`}
          x1={p1.ox + (p2.ox - p1.ox) * f}
          y1={p1.oy + (p2.oy - p1.oy) * f}
          x2={p1.ox + (p2.ox - p1.ox) * e}
          y2={p1.oy + (p2.oy - p1.oy) * e}
          stroke={night ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.3)"}
          strokeWidth={1}
        />
      );
    }
  }

  // ── Zèbres carrefours ─────────────────────────────────────────────────────
  const crossings: JSX.Element[] = [];
  for (let col = 0; col <= COLS - 2; col++) {
    for (let row = 0; row <= ROWS - 2; row++) {
      const p1 = bpos(col + 0.5, row);
      const p2 = bpos(col, row + 0.5);
      const ix = (p1.ox + p2.ox) / 2 + HS * 0.5;
      const iy = (p1.oy + p2.oy) / 2;
      for (let z = 0; z < 5; z++) {
        crossings.push(
          <Rect
            key={`zb-${col}-${row}-${z}`}
            x={ix - 10 + z * 4.5}
            y={iy - 2.5}
            width={3}
            height={5}
            rx={0.5}
            fill={night ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.55)"}
          />
        );
      }
    }
  }

  // ── Lampadaires ───────────────────────────────────────────────────────────
  const lamps: JSX.Element[] = [];
  for (let col = 0; col <= COLS - 1; col++) {
    for (let row = 0; row <= ROWS - 1; row++) {
      const { ox, oy } = bpos(col + 0.5, row - 0.5);
      lamps.push(
        <G key={`lamp-${col}-${row}`}>
          <Rect x={ox - 1} y={oy - 14} width={2} height={14} fill="#6b7280" />
          <Rect x={ox} y={oy - 14} width={7} height={1.5} fill="#6b7280" rx={1} />
          <Circle cx={ox + 7} cy={oy - 14} r={4.5} fill={night ? "#fde68a" : "#d1d5db"} opacity={night ? 0.9 : 0.5} />
          {night && <Ellipse cx={ox + 7} cy={oy - 10} rx={10} ry={5} fill="#fde68a" opacity={0.1} />}
        </G>
      );
    }
  }

  // ── Étoiles filantes nuit ─────────────────────────────────────────────────
  const shootingStarX = ((tick * 1.5) % (MAP_W + 80)) - 20;
  const shootingStarY = 25;

  return (
    <View style={{ width: MAP_W, alignSelf: "center" }}>
      <View style={{ width: MAP_W, height: MAP_H, borderRadius: 20, overflow: "hidden",
        shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 4 } }}>
        <Svg width={MAP_W} height={MAP_H}>
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor={skyTop} />
              <Stop offset="100%" stopColor={skyBot} />
            </LinearGradient>
            <RadialGradient id="amb" cx="50%" cy="25%" r="55%">
              <Stop offset="0%"   stopColor={night ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.18)"} />
              <Stop offset="100%" stopColor="transparent" />
            </RadialGradient>
          </Defs>

          {/* Ciel */}
          <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#sky)" />
          <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#amb)" />

          {/* Étoiles nuit */}
          {night && [
            [50,18],[130,12],[220,8],[310,22],[400,10],[480,18],
            [560,8],[640,16],[720,10],[800,20],[860,14],[170,28],
            [390,30],[620,25],[750,8],[90,32],[540,30],[280,15],
            [450,24],[680,11],[830,28],
          ].map(([x, y], i) => (
            <Circle key={`st-${i}`} cx={x} cy={y}
              r={i % 3 === 0 ? 1.3 : 0.85}
              fill="#e2e8f0"
              opacity={(0.3 + (i % 4) * 0.12) * (0.7 + 0.3 * Math.sin(tick * 0.02 + i))}
            />
          ))}

          {/* Étoile filante nuit */}
          {night && tick % 200 < 60 && (
            <Line
              x1={shootingStarX}       y1={shootingStarY}
              x2={shootingStarX - 30}  y2={shootingStarY + 8}
              stroke="#fff"
              strokeWidth={1.5}
              opacity={(1 - (tick % 200) / 60) * 0.8}
            />
          )}

          {/* Lune / Soleil */}
          {night ? (
            <>
              <Circle cx={MAP_W - 55} cy={28} r={18} fill="#fef9c3" opacity={0.85} />
              <Circle cx={MAP_W - 48} cy={22} r={7}  fill={skyTop}  opacity={0.7} />
            </>
          ) : (
            <>
              <Circle cx={MAP_W - 60} cy={26} r={22} fill="#fde047" opacity={0.85} />
              <Circle cx={MAP_W - 60} cy={26} r={28} fill="#fef08a" opacity={0.2} />
            </>
          )}

          {/* Nuages (jour) */}
          {!night && cloudX.map((cx, i) => (
            <G key={`cl-${i}`}>
              <Ellipse cx={cx}      cy={32 + i * 5} rx={22} ry={8}  fill="rgba(255,255,255,0.6)" />
              <Ellipse cx={cx + 15} cy={28 + i * 5} rx={18} ry={7}  fill="rgba(255,255,255,0.5)" />
              <Ellipse cx={cx - 12} cy={30 + i * 5} rx={16} ry={6}  fill="rgba(255,255,255,0.4)" />
            </G>
          ))}

          {/* Sol */}
          {groundTiles}

          {/* Marquages routiers */}
          {roadMarkings}

          {/* Zèbres */}
          {crossings}

          {/* Lampadaires */}
          {lamps}

          {/* Bâtiments (z-sorted) */}
          {sorted.map((d) => (
            <Building
              key={d.slug}
              d={d}
              isHere={d.slug === currentSlug}
              isSelected={d.slug === selectedSlug}
              night={night}
              npcCount={npcsByLoc[d.slug] ?? 0}
              tick={tick}
              onPress={() => {
                setSelectedSlug(d.slug === selectedSlug ? null : d.slug);
              }}
            />
          ))}

          {/* Voitures */}
          {carRoutes.map((route, i) => (
            <Car
              key={`car-${i}`}
              fromCol={route.from[0]} fromRow={route.from[1]}
              toCol={route.to[0]}    toRow={route.to[1]}
              progress={carProgress[i]}
              color={carColors[i]}
            />
          ))}

          {/* Piétons */}
          {npcRoutes.map((route, i) => {
            const from = bpos(route.from[0], route.from[1]);
            const to   = bpos(route.to[0],   route.to[1]);
            const p    = pedProgress[i];
            const fwd  = p < 0.5;
            const pp   = fwd ? p * 2 : (1 - p) * 2;
            const cx   = from.ox + (to.ox - from.ox) * pp;
            const cy   = from.oy + (to.oy - from.oy) * pp;
            const bob  = Math.sin(tick * 0.15 + i) * 1.2;
            return (
              <G key={`ped-${i}`}>
                <Ellipse cx={cx + 1} cy={cy + 3} rx={4} ry={2} fill="rgba(0,0,0,0.2)" />
                <Circle  cx={cx}    cy={cy + bob}     r={4.5} fill={pedColors[i]} opacity={0.92} />
                <Circle  cx={cx}    cy={cy - 6 + bob} r={3}   fill={lighten(pedColors[i], 45)} opacity={0.88} />
              </G>
            );
          })}

          {/* Légende */}
          <Rect x={8} y={MAP_H - 42} width={175} height={34} rx={10} fill="rgba(0,0,0,0.55)" />
          <SvgText x={16} y={MAP_H - 26} fontSize={9.5} fill="rgba(255,255,255,0.75)">
            🏙️ Neo Paris · Tape pour voyager
          </SvgText>
          <SvgText x={16} y={MAP_H - 13} fontSize={8} fill="rgba(255,255,255,0.45)">
            {night ? "🌙 Nuit" : evening ? "🌆 Soirée" : "☀️ Jour"} · {npcs.filter((n) => n.presenceOnline).length} résidents en ligne
          </SvgText>
        </Svg>
      </View>

      {/* Info bulle bâtiment sélectionné */}
      {selectedBldg && (
        <View style={{
          marginTop: 8, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
          backgroundColor: night ? "#1a1d27" : "#f0f4fa",
          borderWidth: 1,
          borderColor: selectedBldg.neon ?? (night ? "#2a3148" : "#ccd4e0"),
          flexDirection: "row", alignItems: "center", gap: 12,
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: (selectedBldg.neon ?? "#6366f1") + "20",
            alignItems: "center", justifyContent: "center",
            borderWidth: 1, borderColor: (selectedBldg.neon ?? "#6366f1") + "50",
          }}>
            <Text style={{ fontSize: 22 }}>{selectedBldg.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: night ? "#e8edf5" : "#1e2a3a",
              fontWeight: "900", fontSize: 15,
            }}>
              {selectedBldg.label}
            </Text>
            <Text style={{ color: night ? "#8fa3b8" : "#4a5568", fontSize: 12, marginTop: 2 }}>
              {npcsByLoc[selectedBldg.slug] ? `${npcsByLoc[selectedBldg.slug]} NPC${npcsByLoc[selectedBldg.slug] > 1 ? "s" : ""} présent${npcsByLoc[selectedBldg.slug] > 1 ? "s" : ""}` : "Lieu vide"}
              {selectedBldg.slug === currentSlug ? " · 📍 Tu es ici" : ""}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            {selectedBldg.slug !== currentSlug && onTravel && (
              <Pressable
                onPress={() => { onTravel(selectedBldg.slug); setSelectedSlug(null); }}
                style={{
                  backgroundColor: selectedBldg.neon ?? "#6366f1",
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>🚶 Aller</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => { onDistrictPress(selectedBldg.slug); setSelectedSlug(null); }}
              style={{
                backgroundColor: night ? "#22263a" : "#e8edf5",
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
                alignItems: "center",
                borderWidth: 1,
                borderColor: selectedBldg.neon ? selectedBldg.neon + "40" : (night ? "#2a3148" : "#ccd4e0"),
              }}
            >
              <Text style={{ color: night ? "#8fa3b8" : "#4a5568", fontWeight: "800", fontSize: 11 }}>
                {selectedBldg.slug === currentSlug ? "📍 Ici" : "🔍 Détail"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
