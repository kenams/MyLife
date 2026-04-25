/**
 * VillageMap v7 — Neo Paris : ville côtière vivante
 * Inspirée de la référence visuelle : littoral, quartiers, densité, circulation
 * SVG + Animated Views : zéro dépendance supplémentaire
 */

import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, Pressable, Text, View } from "react-native";
import Svg, {
  Circle, ClipPath, Defs, Ellipse, G, Line,
  LinearGradient, Path, Polygon, RadialGradient,
  Rect, Stop, Text as SvgText,
} from "react-native-svg";

import { useTimeContext } from "@/lib/time-context";

const SCREEN_W = Dimensions.get("window").width;
export const MAP_W = Math.min(SCREEN_W - 0, 620);
export const MAP_H = 560;

// World units
const WW = 520;
const WH = 520;
const SX = MAP_W / WW;
const SY = MAP_H / WH;

function wx(x: number) { return x * SX; }
function wy(y: number) { return y * SY; }

// ─── Palette jour/nuit ────────────────────────────────────────────────────────
function mkPal(night: boolean, dawn: boolean) {
  return {
    skyTop:    night ? "#020810" : dawn ? "#FF8C42" : "#1976D2",
    skyBot:    night ? "#0d1a2e" : dawn ? "#FFD580" : "#BBDEFB",
    water:     night ? "#0a2040" : "#1976D2",
    waterSurf: night ? "#1a3a60" : "#42A5F5",
    waterShim: night ? "#2a4a70" : "#90CAF9",
    beach:     night ? "#2a2214" : "#F5DEB3",
    beachEdge: night ? "#1c1808" : "#DEB887",
    ground:    night ? "#0d1a0d" : "#C8E6C9",
    groundMid: night ? "#111f11" : "#A5D6A7",
    park:      night ? "#061206" : "#388E3C",
    parkLight: night ? "#0a1e0a" : "#4CAF50",
    road:      night ? "#151e2a" : "#546E7A",
    roadLine:  night ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.85)",
    sidewalk:  night ? "#1e2a38" : "#B0BEC5",
    treeD:     night ? "#061206" : "#1B5E20",
    treeL:     night ? "#0c2010" : "#2E7D32",
    treeM:     night ? "#102814" : "#388E3C",
    trunk:     night ? "#2a1808" : "#5D4037",
    sand:      night ? "#1c1808" : "#F9E4B7",
    sun:       night ? "#E8DFC8" : "#FDD835",
    cross:     night ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
    lampGlow:  "#FCD34D",
    roofGlow:  night ? "rgba(255,200,100,0.12)" : "rgba(255,255,255,0.08)",
    fog:       night ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0)",
  };
}
type Pal = ReturnType<typeof mkPal>;

// ─── Coordonnées des routes ───────────────────────────────────────────────────
// Horizontales : y = 75, 190, 310, 420
// Verticales   : x = 88, 180, 272, 364, 456 (— routes sont larges de 18 unités)
const RH = [75, 190, 310, 420] as const;   // routes H (milieu)
const RV = [88, 180, 272, 364, 456] as const; // routes V (milieu)
const RW = 18; // largeur route (world units)

// ─── Types bâtiments ──────────────────────────────────────────────────────────
type Bldg = {
  slug: string; label: string; em: string;
  x: number; y: number; w: number; h: number;
  wall: string; wallDark: string; roof: string;
  accentColor: string;
  neon: string | null;
  tall?: boolean;   // immeuble de grande hauteur
  kind: "work" | "social" | "food" | "wellness" | "home" | "leisure" | "premium";
};

// Disposition :
// Zone NORD  (y=90..184)  : library, office, startup, res-luxe
// Zone CENTRE-L (y=205..305): park zone (décoratif)
// Zone CENTRE-M (y=205..305): cafe, market, gym
// Zone SUD   (y=325..415)  : res-pop, restaurant, cinema, nightclub, spa
// Zone BOTTOM (y=430..510) : home, res-confort, rooftop-bar
const BLDGS: Bldg[] = [
  // ── Ligne NORD ───────────────────────────────────────────────────────────
  {
    slug:"library", label:"Bibliothèque", em:"📚",
    x:4, y:90, w:76, h:90,
    wall:"#263258", wallDark:"#141C38", roof:"#1A2240",
    accentColor:"#818CF8", neon:null, kind:"wellness"
  },
  {
    slug:"office", label:"Bureau", em:"💼",
    x:98, y:76, w:74, h:108,
    wall:"#1A3050", wallDark:"#0D1A30", roof:"#0D1A30",
    accentColor:"#38BDF8", neon:null, tall:true, kind:"work"
  },
  {
    slug:"startup", label:"Startup Lab", em:"🚀",
    x:192, y:84, w:72, h:100,
    wall:"#1A2050", wallDark:"#0D1230", roof:"#0D1230",
    accentColor:"#7C3AED", neon:null, tall:true, kind:"work"
  },
  {
    slug:"residence-luxe", label:"Résidence Luxe", em:"👑",
    x:286, y:90, w:76, h:90,
    wall:"#2A1C08", wallDark:"#160E04", roof:"#160E04",
    accentColor:"#F6B94F", neon:null, kind:"premium"
  },
  {
    slug:"rooftop-bar", label:"Sky Lounge", em:"🍸",
    x:380, y:90, w:74, h:90,
    wall:"#1A0A2A", wallDark:"#0D051A", roof:"#0D051A",
    accentColor:"#C084FC", neon:"#C084FC", kind:"premium"
  },
  // ── Ligne CENTRE (droite du parc) ────────────────────────────────────────
  {
    slug:"cafe", label:"Social Café", em:"☕",
    x:194, y:208, w:70, h:90,
    wall:"#3A1C0A", wallDark:"#1E0E04", roof:"#1E0E04",
    accentColor:"#F97316", neon:null, kind:"social"
  },
  {
    slug:"market", label:"Fresh Market", em:"🛒",
    x:286, y:208, w:70, h:90,
    wall:"#0E2A10", wallDark:"#071508", roof:"#071508",
    accentColor:"#22C55E", neon:null, kind:"food"
  },
  {
    slug:"gym", label:"Pulse Gym", em:"💪",
    x:378, y:208, w:76, h:90,
    wall:"#2A0A08", wallDark:"#150504", roof:"#150504",
    accentColor:"#EF4444", neon:"#EF4444", kind:"wellness"
  },
  // ── Ligne SUD ────────────────────────────────────────────────────────────
  {
    slug:"residence-populaire", label:"Bloc Pop", em:"🏘️",
    x:4, y:328, w:78, h:82,
    wall:"#28180E", wallDark:"#140C08", roof:"#140C08",
    accentColor:"#D97706", neon:null, kind:"home"
  },
  {
    slug:"restaurant", label:"Maison Ember", em:"🍽️",
    x:98, y:328, w:74, h:82,
    wall:"#200A04", wallDark:"#100504", roof:"#100504",
    accentColor:"#F59E0B", neon:null, kind:"food"
  },
  {
    slug:"cinema", label:"Luma Cinéma", em:"🎬",
    x:192, y:328, w:74, h:82,
    wall:"#080820", wallDark:"#040410", roof:"#040410",
    accentColor:"#6366F1", neon:"#6366F1", kind:"leisure"
  },
  {
    slug:"nightclub", label:"Neo Club", em:"🎵",
    x:286, y:328, w:72, h:82,
    wall:"#100620", wallDark:"#080310", roof:"#080310",
    accentColor:"#A855F7", neon:"#DD00FF", kind:"leisure"
  },
  {
    slug:"spa", label:"Zenith Spa", em:"🌿",
    x:374, y:328, w:80, h:82,
    wall:"#041818", wallDark:"#020C0C", roof:"#020C0C",
    accentColor:"#2DD4BF", neon:null, kind:"wellness"
  },
  // ── Ligne BOTTOM ─────────────────────────────────────────────────────────
  {
    slug:"home", label:"Home Suite", em:"🏠",
    x:4, y:438, w:90, h:68,
    wall:"#1A3050", wallDark:"#0D1A30", roof:"#0D1A30",
    accentColor:"#60A5FA", neon:null, kind:"home"
  },
  {
    slug:"residence-confort", label:"Résidence", em:"🏢",
    x:106, y:438, w:82, h:68,
    wall:"#1A2240", wallDark:"#0D1220", roof:"#0D1220",
    accentColor:"#8B9CF6", neon:null, kind:"home"
  },
  {
    slug:"park", label:"Riverside Park", em:"🌳",
    x:4, y:208, w:178, h:90,
    wall:"#0E2A0E", wallDark:"#071408", roof:"#071408",
    accentColor:"#4ADE80", neon:null, kind:"wellness"
  },
];

// ─── Bâtiment SVG ─────────────────────────────────────────────────────────────
function Building({ b, night, isCurrent, onPress }: {
  b: Bldg; night: boolean; isCurrent: boolean;
  onPress: () => void;
}) {
  const x   = wx(b.x);
  const y   = wy(b.y);
  const bw  = wx(b.w);
  const bh  = wy(b.h);
  const roofH = wy(b.tall ? 18 : 12);
  const depthW = bw * 0.12;  // faux côté droit pour volume

  // Fenêtres
  const cols = b.tall ? 3 : 2;
  const rows = b.tall ? 4 : 2;
  const wW = wx(b.w / (cols * 3.2));
  const wH = wy(b.h / (rows * 3.8));
  const wins: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      wins.push([
        x + bw * ((c + 0.7) / (cols + 0.4)),
        y + roofH + bh * ((r + 0.5) / (rows + 0.8)),
      ]);
    }
  }

  // Bâtiment spécial : parc (zone verte, pas de fenêtres)
  if (b.slug === "park") {
    return (
      <G onPress={onPress}>
        <Rect x={x} y={y} width={bw} height={bh} fill={night ? "#061206" : "#2E7D32"} rx={wy(8)} />
        <Rect x={x+wx(4)} y={y+wy(4)} width={bw-wx(8)} height={bh-wy(8)}
          fill={night ? "#0a1e0a" : "#388E3C"} rx={wy(6)} />
        {/* Allée circulaire */}
        <Ellipse cx={x+bw/2} cy={y+bh*0.55}
          rx={bw*0.38} ry={bh*0.3}
          fill="transparent" stroke={night?"#1c2c1c":"#81C784"} strokeWidth={wy(4)} />
        {/* Fontaine */}
        <Circle cx={x+bw/2} cy={y+bh*0.55} r={wy(14)} fill={night?"#0c1e30":"#1565C0"} opacity={0.9} />
        <Circle cx={x+bw/2} cy={y+bh*0.55} r={wy(8)}  fill={night?"#1a3a5a":"#1E88E5"} />
        <Circle cx={x+bw/2} cy={y+bh*0.55} r={wy(4)}  fill={night?"#1a4a6a":"#64B5F6"} />
        {/* Jets fontaine */}
        {[0,60,120,180,240,300].map((a,i) => {
          const rd = a * Math.PI / 180;
          return <Line key={`jet${i}`}
            x1={x+bw/2} y1={y+bh*0.55}
            x2={x+bw/2+Math.cos(rd)*wy(9)} y2={y+bh*0.55+Math.sin(rd)*wy(9)}
            stroke={night?"#4a90b0":"#90CAF9"} strokeWidth={wy(1.5)} strokeLinecap="round" opacity={0.85}
          />;
        })}
        {/* Label */}
        <Rect x={x+bw*0.1} y={y+bh*0.82} width={bw*0.8} height={wy(13)}
          fill="rgba(0,0,0,0.55)" rx={wy(4)} />
        <SvgText x={x+bw/2} y={y+bh*0.82+wy(9.5)} textAnchor="middle"
          fill={isCurrent?"#6EE7B7":"#E8F5E9"} fontSize={wy(6.5)} fontWeight="900">
          {b.em} {b.label}
        </SvgText>
        {isCurrent && (
          <Circle cx={x+bw/2} cy={y-wy(6)} r={wy(7)} fill="#34D39955" />
        )}
      </G>
    );
  }

  return (
    <G onPress={onPress}>
      {/* Ombre */}
      <Rect x={x+wy(4)} y={y+roofH+wy(4)} width={bw} height={bh}
        fill="rgba(0,0,0,0.25)" rx={wy(5)} />

      {/* Toit */}
      <Rect x={x} y={y} width={bw} height={roofH+wy(4)}
        fill={b.roof} rx={wy(4)} />
      {b.tall && (
        <Rect x={x+bw*0.2} y={y+wy(2)} width={bw*0.6} height={roofH*0.5}
          fill={b.accentColor} rx={wy(2)} opacity={0.3} />
      )}

      {/* Corps */}
      <Rect x={x} y={y+roofH} width={bw} height={bh}
        fill={b.wall} rx={wy(3)} />

      {/* Face latérale (volume) */}
      <Rect x={x+bw*(1-0.12)} y={y+roofH} width={bw*0.12} height={bh}
        fill={b.wallDark} rx={wy(2)} />

      {/* Bande décorative colorée en haut */}
      <Rect x={x} y={y+roofH} width={bw*(1-0.12)} height={wy(4)}
        fill={b.accentColor} opacity={0.45} rx={wy(1)} />

      {/* Fenêtres */}
      {wins.map(([wx_, wy_], i) => (
        <G key={i}>
          <Rect x={wx_-wy(1)} y={wy_-wy(1)} width={wW+wy(2)} height={wH+wy(2)}
            fill="rgba(0,0,0,0.35)" rx={wy(1.5)} />
          <Rect x={wx_} y={wy_} width={wW} height={wH}
            fill={b.accentColor} rx={wy(1.5)} opacity={night ? 0.9 : 0.45} />
          {night && (
            <Rect x={wx_+wy(1)} y={wy_+wy(1)} width={wy(2)} height={wH*0.5}
              fill="rgba(255,255,255,0.28)" rx={wy(0.5)} />
          )}
        </G>
      ))}

      {/* Porte */}
      <Rect x={x+bw*0.38} y={y+roofH+bh-wy(17)} width={bw*0.22} height={wy(17)}
        fill={b.accentColor} rx={wy(5)} opacity={0.85} />

      {/* Enseigne */}
      <Rect x={x+bw*0.07} y={y+roofH+bh*0.56} width={bw*0.75} height={wy(12)}
        fill="rgba(0,0,0,0.6)" rx={wy(3)}
        stroke={night && b.neon ? b.neon+"66" : "rgba(255,255,255,0.10)"}
        strokeWidth={wy(0.6)} />
      <SvgText x={x+bw*0.07+bw*0.375} y={y+roofH+bh*0.56+wy(9.5)}
        textAnchor="middle"
        fill={night && b.neon ? b.neon : "#E2E8F0"}
        fontSize={wy(6.2)} fontWeight="900">
        {b.em} {b.label}
      </SvgText>

      {/* Néon halo nuit */}
      {night && b.neon && (
        <>
          <Rect x={x-wy(2)} y={y-wy(2)} width={bw+wy(4)} height={bh+roofH+wy(4)}
            fill="transparent" stroke={b.neon} strokeWidth={wy(1.8)} rx={wy(5)} opacity={0.55} />
          <Rect x={x-wy(7)} y={y-wy(7)} width={bw+wy(14)} height={bh+roofH+wy(14)}
            fill="transparent" stroke={b.neon} strokeWidth={wy(0.7)} rx={wy(9)} opacity={0.12} />
        </>
      )}

      {/* Badge "ICI" */}
      {isCurrent && (
        <>
          <Rect x={x-wy(3)} y={y-wy(3)} width={bw+wy(6)} height={bh+roofH+wy(6)}
            fill="rgba(52,211,153,0.07)" stroke="#34D399" strokeWidth={wy(2.2)} rx={wy(6)} />
          <Circle cx={x+bw/2} cy={y-wy(7)} r={wy(9)} fill="#34D39930" />
          <Circle cx={x+bw/2} cy={y-wy(7)} r={wy(6)} fill="#34D399BB" />
          <Circle cx={x+bw/2} cy={y-wy(7)} r={wy(3)} fill="#FFFFFF" />
        </>
      )}
    </G>
  );
}

// ─── Arbre ────────────────────────────────────────────────────────────────────
function Tree({ x, y, r, pal, variant = 0 }: { x: number; y: number; r: number; pal: Pal; variant?: number }) {
  const px = wx(x); const py = wy(y); const pr = wy(r);
  if (variant === 1) {
    // Palmier
    return (
      <G>
        <Rect x={px - wy(1.5)} y={py - pr * 0.8} width={wy(3)} height={pr * 1.2} fill={pal.trunk} rx={wy(1)} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => {
          const rd = a * Math.PI / 180;
          return <Line key={i}
            x1={px} y1={py - pr * 0.7}
            x2={px + Math.cos(rd) * pr * 1.2} y2={py - pr * 0.7 + Math.sin(rd) * pr * 0.6}
            stroke={pal.treeM} strokeWidth={wy(2.5)} strokeLinecap="round" opacity={0.85}
          />;
        })}
      </G>
    );
  }
  return (
    <G>
      <Ellipse cx={px+wy(3)} cy={py+pr*0.6} rx={pr*1.1} ry={pr*0.28} fill="rgba(0,0,0,0.18)" />
      <Rect x={px-wy(1.8)} y={py} width={wy(3.6)} height={pr*0.9} fill={pal.trunk} rx={wy(1)} />
      <Circle cx={px} cy={py-pr*0.3} r={pr}       fill={pal.treeD} />
      <Circle cx={px} cy={py-pr*0.55} r={pr*0.72} fill={pal.treeL} />
      <Circle cx={px-pr*0.3} cy={py-pr*0.35} r={pr*0.45} fill={pal.treeM} opacity={0.6} />
    </G>
  );
}

// ─── Bateau ───────────────────────────────────────────────────────────────────
function Boat({ x, y, color, dir = 1 }: { x: number; y: number; color: string; dir?: 1 | -1 }) {
  const px = wx(x); const py = wy(y);
  return (
    <G>
      <Polygon points={`${px},${py} ${px+dir*wx(22)},${py-wy(4)} ${px+dir*wx(22)},${py+wy(4)} ${px},${py+wy(7)}`}
        fill={color} opacity={0.85} />
      <Line x1={px+dir*wx(8)} y1={py} x2={px+dir*wx(8)} y2={py-wy(14)}
        stroke="rgba(255,255,255,0.6)" strokeWidth={wy(1.2)} />
      <Polygon points={`${px+dir*wx(8)},${py-wy(14)} ${px+dir*wx(18)},${py-wy(6)} ${px+dir*wx(8)},${py-wy(2)}`}
        fill="rgba(255,255,255,0.5)" />
    </G>
  );
}

// ─── Phare ────────────────────────────────────────────────────────────────────
function Lighthouse({ x, y, night }: { x: number; y: number; night: boolean }) {
  const px = wx(x); const py = wy(y);
  return (
    <G>
      {/* Base */}
      <Polygon points={`${px-wx(7)},${py+wy(28)} ${px+wx(7)},${py+wy(28)} ${px+wx(4)},${py} ${px-wx(4)},${py}`}
        fill="#E8E0D0" />
      {/* Bandes rouges */}
      {[0, 2, 4].map((i) => (
        <Rect key={i} x={px-wx(5+i*0.3)} y={py+wy(i*9)} width={wx(10+i*0.6)} height={wy(4)}
          fill="#E53935" opacity={0.7} />
      ))}
      {/* Tête */}
      <Rect x={px-wx(5)} y={py-wy(10)} width={wx(10)} height={wy(12)} fill="#90A4AE" rx={wy(2)} />
      <Rect x={px-wx(6)} y={py-wy(13)} width={wx(12)} height={wy(3)} fill="#546E7A" rx={wy(1)} />
      {/* Lumière */}
      {night && (
        <>
          <Circle cx={px} cy={py-wy(7)} r={wy(6)} fill="#FDD835" opacity={0.95} />
          <Circle cx={px} cy={py-wy(7)} r={wy(18)} fill="#FDD835" opacity={0.08} />
          <Circle cx={px} cy={py-wy(7)} r={wy(35)} fill="#FDD835" opacity={0.03} />
        </>
      )}
    </G>
  );
}

// ─── NPC animé ────────────────────────────────────────────────────────────────
type NpcDef = { nm: string; clr: string; ini: string; zoneY: number; zoneH: number; startX: number };

const NPC_DEFS: NpcDef[] = [
  { nm:"Ava",   clr:"#10B981", ini:"A", zoneY:175, zoneH:12, startX:0.15 },
  { nm:"Malik", clr:"#3B82F6", ini:"M", zoneY:295, zoneH:12, startX:0.35 },
  { nm:"Noa",   clr:"#EC4899", ini:"N", zoneY:175, zoneH:12, startX:0.60 },
  { nm:"Leila", clr:"#F59E0B", ini:"L", zoneY:295, zoneH:12, startX:0.75 },
  { nm:"Yan",   clr:"#8B5CF6", ini:"Y", zoneY:405, zoneH:12, startX:0.25 },
  { nm:"Sana",  clr:"#EF4444", ini:"S", zoneY:405, zoneH:12, startX:0.70 },
  { nm:"Kim",   clr:"#06B6D4", ini:"K", zoneY:175, zoneH:12, startX:0.85 },
  { nm:"Lena",  clr:"#A78BFA", ini:"L", zoneY:295, zoneH:12, startX:0.10 },
];

function NpcWalker({ def, night, delay }: { def: NpcDef; night: boolean; delay: number }) {
  const posX = useRef(new Animated.Value(MAP_W * def.startX)).current;
  const posY = useRef(new Animated.Value(wy(def.zoneY))).current;
  const bob  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -2.5, duration: 360, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(bob, { toValue: 0,    duration: 360, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ])).start();
  }, [bob]);

  useEffect(() => {
    function wander() {
      const nextX = MAP_W * (0.04 + Math.random() * 0.92);
      const nextY = wy(def.zoneY) + (Math.random() - 0.5) * wy(def.zoneH);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(posX, { toValue: nextX, duration: 2800 + Math.random() * 3500, useNativeDriver: false, easing: Easing.inOut(Easing.quad) }),
          Animated.timing(posY, { toValue: nextY, duration: 1200, useNativeDriver: false }),
        ]),
        Animated.delay(1000 + Math.random() * 2500),
      ]).start(wander);
    }
    const t = setTimeout(wander, delay);
    return () => clearTimeout(t);
  }, [def.zoneY, def.zoneH, delay, posX, posY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position:"absolute", left:posX, top:posY, alignItems:"center", width:28, transform:[{translateX:-14},{translateY:bob}], zIndex:30 }}>
      <View style={{ position:"absolute", top:-3, left:-3, width:34, height:34, borderRadius:17, backgroundColor:def.clr, opacity:night?0.22:0.10 }} />
      <View style={{
        width:26, height:26, borderRadius:13, backgroundColor:def.clr,
        alignItems:"center", justifyContent:"center",
        borderWidth:2, borderColor:"rgba(255,255,255,0.5)",
        shadowColor:def.clr, shadowOpacity:night?0.9:0.45, shadowRadius:night?8:4, elevation:5,
      }}>
        <Text style={{ color:"#fff", fontSize:10, fontWeight:"900" }}>{def.ini}</Text>
      </View>
      <View style={{
        marginTop:2, borderRadius:5, paddingHorizontal:5, paddingVertical:1.5,
        backgroundColor:night?"rgba(2,8,20,0.88)":"rgba(255,255,255,0.92)",
        borderWidth:1, borderColor:night?def.clr+"55":"rgba(0,0,0,0.06)",
      }}>
        <Text style={{ fontSize:8, fontWeight:"800", color:night?def.clr:"#0F172A" }}>{def.nm}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Voiture animée ───────────────────────────────────────────────────────────
type CarDef = { color: string; roadY: number; dir: 1 | -1; speed: number };
const CAR_DEFS: CarDef[] = [
  { color:"#3B82F6", roadY:RH[0]-5,  dir:1,  speed:8800  },
  { color:"#EF4444", roadY:RH[0]+5,  dir:-1, speed:10200 },
  { color:"#10B981", roadY:RH[1]-5,  dir:1,  speed:9400  },
  { color:"#F59E0B", roadY:RH[1]+5,  dir:-1, speed:7600  },
  { color:"#8B5CF6", roadY:RH[2]-5,  dir:1,  speed:11000 },
  { color:"#EC4899", roadY:RH[2]+5,  dir:-1, speed:8200  },
  { color:"#06B6D4", roadY:RH[3]-5,  dir:1,  speed:9800  },
];

function MovingCar({ c, night }: { c: CarDef; night: boolean }) {
  const posX = useRef(new Animated.Value(c.dir === 1 ? -40 : MAP_W + 40)).current;

  useEffect(() => {
    function drive() {
      posX.setValue(c.dir === 1 ? -40 : MAP_W + 40);
      Animated.timing(posX, {
        toValue: c.dir === 1 ? MAP_W + 40 : -40,
        duration: c.speed, useNativeDriver: false, easing: Easing.linear
      }).start(() => setTimeout(drive, 800 + Math.random() * 4000));
    }
    const t = setTimeout(drive, Math.random() * c.speed * 0.9);
    return () => clearTimeout(t);
  }, [c.dir, c.speed, posX]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:"absolute", left:posX, top:wy(c.roadY)-7,
        width:34, height:14, borderRadius:5, backgroundColor:c.color,
        shadowColor:c.color, shadowOpacity:night?0.7:0.45, shadowRadius:night?8:4, elevation:4,
        transform:[{scaleX:c.dir}],
      }}>
      {/* Vitre */}
      <View style={{ position:"absolute", right:4, top:2.5, width:10, height:7, backgroundColor:"rgba(200,235,255,0.65)", borderRadius:2 }} />
      {/* Phares */}
      {night && <>
        <View style={{ position:"absolute", left:2, top:3, width:3, height:3, backgroundColor:"#FFFDE7", borderRadius:2 }} />
        <View style={{ position:"absolute", left:2, bottom:3, width:3, height:3, backgroundColor:"#FFFDE7", borderRadius:2 }} />
      </>}
      {/* Roues */}
      <View style={{ position:"absolute", left:5, bottom:-3, width:7, height:5, backgroundColor:"#1a1a1a", borderRadius:2.5 }} />
      <View style={{ position:"absolute", right:5, bottom:-3, width:7, height:5, backgroundColor:"#1a1a1a", borderRadius:2.5 }} />
    </Animated.View>
  );
}

// ─── Composant VillageMap ─────────────────────────────────────────────────────
export function VillageMap({ currentSlug, onLocationPress }: {
  currentSlug: string;
  onLocationPress: (slug: string, label: string) => void;
}) {
  const { hour, minutes } = useTimeContext();
  const isNight = hour < 6 || hour >= 21;
  const isDawn  = (hour >= 6 && hour < 8) || (hour >= 19 && hour < 21);
  const pal = mkPal(isNight, isDawn);
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const waveAnim  = useRef(new Animated.Value(0)).current;
  const lightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue:1,   duration:1800, useNativeDriver:true }),
      Animated.timing(pulseAnim, { toValue:0.6, duration:1800, useNativeDriver:true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(waveAnim,  { toValue:1, duration:3000, useNativeDriver:true }),
      Animated.timing(waveAnim,  { toValue:0, duration:3000, useNativeDriver:true }),
    ])).start();
    if (isNight) {
      Animated.loop(Animated.sequence([
        Animated.timing(lightAnim, { toValue:1, duration:900, useNativeDriver:true }),
        Animated.timing(lightAnim, { toValue:0, duration:900, useNativeDriver:true }),
      ])).start();
    }
  }, [isNight, pulseAnim, waveAnim, lightAnim]);

  const timeStr = `${String(hour).padStart(2,"0")}:${String(minutes).padStart(2,"0")}`;
  const currentBldg = BLDGS.find((b) => b.slug === currentSlug);

  // Arbres dispersés
  const treeList: Array<{ x: number; y: number; r: number; v: number }> = [
    // Zone nord (entre route côtière et route principale)
    {x:4,y:100,r:6,v:0},{x:16,y:94,r:5,v:0},{x:8,y:108,r:4,v:0},
    // Côté des bâtiments nord
    {x:82,y:92,r:5,v:0},{x:172,y:88,r:6,v:0},{x:280,y:100,r:5,v:0},
    {x:462,y:96,r:5,v:0},{x:476,y:106,r:4,v:0},
    // Rangées latérales (bandes de 4px entre routes verticales)
    {x:93,y:220,r:5,v:0},{x:84,y:240,r:4,v:0},{x:90,y:260,r:5,v:0},
    {x:185,y:225,r:5,v:0},{x:182,y:250,r:4,v:0},{x:188,y:275,r:5,v:0},
    {x:277,y:220,r:5,v:0},{x:274,y:248,r:4,v:0},{x:280,y:268,r:5,v:0},
    {x:369,y:222,r:5,v:0},{x:374,y:246,r:4,v:0},{x:368,y:272,r:5,v:0},
    {x:461,y:220,r:6,v:0},{x:466,y:248,r:5,v:0},{x:460,y:270,r:5,v:0},
    // Parc interne (s'ajoute aux éléments SVG du parc)
    {x:12,y:215,r:6,v:0},{x:28,y:228,r:5,v:0},{x:14,y:242,r:6,v:0},
    {x:30,y:255,r:4,v:0},{x:20,y:268,r:5,v:0},{x:44,y:280,r:5,v:0},
    {x:160,y:215,r:6,v:0},{x:170,y:234,r:5,v:0},{x:162,y:252,r:6,v:0},
    {x:168,y:270,r:5,v:0},
    // Zone nuit (row sud extérieur)
    {x:86,y:340,r:5,v:0},{x:92,y:356,r:4,v:0},{x:185,y:338,r:5,v:0},
    {x:368,y:344,r:5,v:0},{x:376,y:360,r:4,v:0},
    // Zone bottom
    {x:200,y:450,r:6,v:0},{x:216,y:464,r:5,v:0},{x:228,y:452,r:6,v:0},
    {x:310,y:448,r:5,v:0},{x:322,y:460,r:6,v:0},{x:400,y:448,r:5,v:0},
    {x:420,y:460,r:6,v:0},{x:440,y:450,r:5,v:0},{x:460,y:464,r:6,v:0},
    {x:480,y:452,r:5,v:0},{x:500,y:448,r:6,v:0},
    // Palmiers côtiers
    {x:22,y:54,r:8,v:1},{x:46,y:46,r:7,v:1},{x:68,y:52,r:8,v:1},
    {x:92,y:44,r:7,v:1},{x:116,y:50,r:8,v:1},
    // Côté eau (droite)
    {x:350,y:30,r:7,v:1},{x:374,y:22,r:6,v:1},{x:400,y:28,r:7,v:1},
    {x:424,y:18,r:6,v:1},{x:450,y:24,r:7,v:1},
  ];

  return (
    <View style={{
      width:MAP_W, height:MAP_H, overflow:"hidden",
      borderRadius:20, alignSelf:"center",
      borderWidth:1.5,
      borderColor: isNight ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.45)",
      shadowColor:"#000", shadowOpacity:0.45, shadowRadius:20, elevation:12,
    }}>
      <Svg width={MAP_W} height={MAP_H}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={pal.skyTop} />
            <Stop offset="1"   stopColor={pal.skyBot} />
          </LinearGradient>
          <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={pal.water} />
            <Stop offset="0.5" stopColor={pal.waterSurf} />
            <Stop offset="1"   stopColor={pal.waterShim} />
          </LinearGradient>
          <LinearGradient id="beach" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={pal.beach} />
            <Stop offset="1"   stopColor={pal.beachEdge} />
          </LinearGradient>
          <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={pal.ground} />
            <Stop offset="1"   stopColor={pal.groundMid} />
          </LinearGradient>
          <RadialGradient id="sunHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0"   stopColor={pal.sun} stopOpacity="0.9" />
            <Stop offset="0.6" stopColor={pal.sun} stopOpacity="0.25" />
            <Stop offset="1"   stopColor="transparent" stopOpacity="0" />
          </RadialGradient>
          <ClipPath id="mapClip">
            <Rect x={0} y={0} width={MAP_W} height={MAP_H} rx={20} />
          </ClipPath>
        </Defs>

        {/* ── Ciel ── */}
        <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#sky)" clipPath="url(#mapClip)" />

        {/* Étoiles nuit */}
        {isNight && [
          [28,8],[75,5],[140,11],[200,4],[258,10],[320,7],[370,9],[60,18],
          [155,3],[290,15],[348,6],[70,14],[230,8],[320,20],[160,24],[400,12],
        ].map(([sx,sy],i) => (
          <Circle key={`star${i}`} cx={wx(sx)} cy={wy(sy)} r={wy(1.1+i%3*0.5)} fill="#fff" opacity={0.18+(i%4)*0.15} />
        ))}

        {/* Nuages jour */}
        {!isNight && [
          {cx:40, cy:16, r:10},{cx:60,cy:10,r:8},{cx:78,cy:16,r:11},
          {cx:210,cy:12,r:9},{cx:228,cy:7,r:6},{cx:246,cy:12,r:8},
          {cx:350,cy:20,r:10},{cx:368,cy:14,r:7},{cx:386,cy:20,r:9},
        ].map((c,i) => (
          <Circle key={`cl${i}`} cx={wx(c.cx)} cy={wy(c.cy)} r={wy(c.r)} fill="rgba(255,255,255,0.48)" />
        ))}

        {/* Soleil / Lune */}
        <Circle cx={wx(490)} cy={wy(22)} r={wy(32)} fill="url(#sunHalo)" opacity={0.55} />
        <Circle cx={wx(490)} cy={wy(22)} r={wy(14)} fill={pal.sun} opacity={0.95} />
        {isNight ? (
          <Circle cx={wx(497)} cy={wy(17)} r={wy(5.5)} fill="rgba(5,10,24,0.25)" />
        ) : (
          [0,45,90,135,180,225,270,315].map((a,i) => {
            const rd = a * Math.PI / 180;
            return <Line key={i}
              x1={wx(490)+Math.cos(rd)*wy(17)} y1={wy(22)+Math.sin(rd)*wy(17)}
              x2={wx(490)+Math.cos(rd)*wy(26)} y2={wy(22)+Math.sin(rd)*wy(26)}
              stroke="#FDD835" strokeWidth={wy(1.8)} strokeLinecap="round" opacity={0.55}
            />;
          })
        )}

        {/* ── Zone EAU (top: y=0..60) ── */}
        <Rect x={0} y={0} width={MAP_W} height={wy(60)} fill="url(#water)" />
        {/* Reflets eau */}
        {[20,60,110,160,220,280,340,390,450,500].map((rx_,i) => (
          <Rect key={`ref${i}`} x={wx(rx_)} y={wy(15+i%3*10)} width={wx(30+i%4*8)} height={wy(2)}
            fill="rgba(255,255,255,0.12)" rx={wy(1)} />
        ))}
        {/* Vagues animées (View overlay) */}

        {/* ── Plage / promenade (y=60..76) ── */}
        <Rect x={0} y={wy(60)} width={MAP_W} height={wy(16)} fill="url(#beach)" />
        <Rect x={0} y={wy(73)} width={MAP_W} height={wy(4)} fill={pal.sidewalk} opacity={0.65} />

        {/* Phare */}
        <Lighthouse x={462} y={28} night={isNight} />

        {/* Bateaux */}
        <Boat x={40}  y={30} color="#E53935" dir={1} />
        <Boat x={150} y={20} color="#1565C0" dir={1} />
        <Boat x={280} y={35} color="#FFFFFF"  dir={-1} />
        <Boat x={360} y={18} color="#F9A825" dir={1} />

        {/* ── Route côtière (y=76..94, route H[0]) ── */}
        <Rect x={0} y={wy(RH[0]-RW/2)} width={MAP_W} height={wy(RW)} fill={pal.road} />
        {/* Tirets médians */}
        {Array.from({length:28},(_,i)=>i*20).map((lx,i)=>(
          <Rect key={`rl0${i}`} x={wx(lx)} y={wy(RH[0])-wy(1.2)} width={wx(12)} height={wy(2.4)}
            fill={pal.roadLine} rx={wy(1.2)} opacity={0.75} />
        ))}

        {/* ── Sol zone nord (y=94..190) ── */}
        <Rect x={0} y={wy(94)} width={MAP_W} height={wy(96)} fill="url(#ground)" />

        {/* ── Route principale (y=190..208, H[1]) ── */}
        <Rect x={0} y={wy(RH[1]-RW/2)} width={MAP_W} height={wy(RW)} fill={pal.road} />
        {Array.from({length:28},(_,i)=>i*20).map((lx,i)=>(
          <Rect key={`rl1${i}`} x={wx(lx)} y={wy(RH[1])-wy(1.2)} width={wx(12)} height={wy(2.4)}
            fill={pal.roadLine} rx={wy(1.2)} opacity={0.75} />
        ))}
        {/* Trottoir */}
        <Rect x={0} y={wy(RH[1]+RW/2)} width={MAP_W} height={wy(5)} fill={pal.sidewalk} opacity={0.5} />

        {/* ── Sol zone centre (y=208..310) ── */}
        <Rect x={0} y={wy(208)} width={MAP_W} height={wy(102)} fill="url(#ground)" />

        {/* ── Route sud (y=310..328, H[2]) ── */}
        <Rect x={0} y={wy(RH[2]-RW/2)} width={MAP_W} height={wy(RW)} fill={pal.road} />
        {Array.from({length:28},(_,i)=>i*20).map((lx,i)=>(
          <Rect key={`rl2${i}`} x={wx(lx)} y={wy(RH[2])-wy(1.2)} width={wx(12)} height={wy(2.4)}
            fill={pal.roadLine} rx={wy(1.2)} opacity={0.75} />
        ))}
        <Rect x={0} y={wy(RH[2]+RW/2)} width={MAP_W} height={wy(5)} fill={pal.sidewalk} opacity={0.5} />

        {/* ── Sol zone sud (y=328..420) ── */}
        <Rect x={0} y={wy(328)} width={MAP_W} height={wy(92)} fill="url(#ground)" />

        {/* ── Boulevard résidentiel (y=420..438, H[3]) ── */}
        <Rect x={0} y={wy(RH[3]-RW/2)} width={MAP_W} height={wy(RW)} fill={pal.road} />
        {Array.from({length:28},(_,i)=>i*20).map((lx,i)=>(
          <Rect key={`rl3${i}`} x={wx(lx)} y={wy(RH[3])-wy(1.2)} width={wx(12)} height={wy(2.4)}
            fill={pal.roadLine} rx={wy(1.2)} opacity={0.75} />
        ))}

        {/* ── Sol zone bottom (y=438..520) ── */}
        <Rect x={0} y={wy(438)} width={MAP_W} height={wy(82)} fill="url(#ground)" />

        {/* ── Routes verticales ── */}
        {RV.map((vx,i) => (
          <G key={`rv${i}`}>
            <Rect x={wx(vx-RW/2)} y={0} width={wx(RW)} height={MAP_H} fill={pal.road} opacity={0.8} />
            {/* Tirets */}
            {Array.from({length:30},(_,j)=>j*20).map((ly,j)=>(
              <Rect key={`rvl${j}`} x={wx(vx)-wy(1.2)} y={wy(ly)} width={wy(2.4)} height={wy(12)}
                fill={pal.roadLine} rx={wy(1.2)} opacity={0.6} />
            ))}
          </G>
        ))}

        {/* ── Passages piétons aux intersections ── */}
        {RV.map((vx,vi) =>
          RH.map((ry,ri) =>
            Array.from({length:5},(_,i)=>i*3.8).map((dy,i) => (
              <Rect key={`cr${vi}-${ri}-${i}`}
                x={wx(vx-RW/2+1)} y={wy(ry-RW/2+dy)} width={wx(RW-2)} height={wy(2.6)}
                fill={pal.cross} rx={wy(0.8)} />
            ))
          )
        )}

        {/* ── Rond-point central (intersection RV[2]×RH[1]) ── */}
        <Circle cx={wx(RV[2])} cy={wy(RH[1])} r={wy(RW*0.78)}
          fill={pal.road} stroke={pal.sidewalk} strokeWidth={wy(2)} opacity={0.95} />
        <Circle cx={wx(RV[2])} cy={wy(RH[1])} r={wy(RW*0.38)}
          fill={isNight?"#061208":"#2E7D32"} />
        <Circle cx={wx(RV[2])} cy={wy(RH[1])} r={wy(RW*0.2)}
          fill={isNight?"#0a1e10":"#388E3C"} opacity={0.7} />

        {/* ── Parking (à droite de row bottom) ── */}
        <Rect x={wx(200)} y={wy(440)} width={wx(100)} height={wy(60)}
          fill={pal.sidewalk} rx={wy(6)} opacity={0.35} />
        {[0,1,2,3].map(i=>(
          <Rect key={`park${i}`} x={wx(207+i*23)} y={wy(444)} width={wx(18)} height={wy(22)}
            fill={pal.road} rx={wy(3)} opacity={0.5} />
        ))}
        <SvgText x={wx(250)} y={wy(484)} textAnchor="middle"
          fill={pal.sidewalk} fontSize={wy(5.5)} fontWeight="700" opacity={0.6}>🅿️ Parking</SvgText>

        {/* ── Lampadaires nuit ── */}
        {isNight && RV.map((vx,i) => (
          <G key={`lamp${i}`}>
            {[RH[0]+RW/2+4, RH[1]+RW/2+4, RH[2]+RW/2+4, RH[3]+RW/2+4].map((ly,j) => (
              <G key={j}>
                <Polygon
                  points={`${wx(vx-8)},${wy(ly+20)} ${wx(vx+8)},${wy(ly+20)} ${wx(vx+1.5)},${wy(ly)} ${wx(vx-1.5)},${wy(ly)}`}
                  fill="rgba(251,191,36,0.14)" />
                <Rect x={wx(vx-1)} y={wy(ly)} width={wx(2)} height={wy(11)} fill="#607D8B" rx={wy(0.8)} />
                <Circle cx={wx(vx)} cy={wy(ly)} r={wy(5)} fill="#fbbf24" opacity={0.95} />
                <Circle cx={wx(vx)} cy={wy(ly)} r={wy(14)} fill="#fbbf2412" />
              </G>
            ))}
          </G>
        ))}

        {/* ── Arbres ── */}
        {treeList.map((t,i) => (
          <Tree key={`tree${i}`} x={t.x} y={t.y} r={t.r} pal={pal} variant={t.v} />
        ))}

        {/* ── Bâtiments ── */}
        {BLDGS.map((b) => (
          <Building
            key={b.slug} b={b} night={isNight}
            isCurrent={currentSlug === b.slug}
            onPress={() => onLocationPress(b.slug, b.label)}
          />
        ))}

        {/* ── Zone brume nuit en bas ── */}
        {isNight && (
          <Rect x={0} y={MAP_H*0.75} width={MAP_W} height={MAP_H*0.25}
            fill="rgba(2,8,20,0.18)" />
        )}
      </Svg>

      {/* ── Vagues animées (overlay View) ── */}
      <Animated.View pointerEvents="none" style={{
        position:"absolute", left:0, right:0, top:wy(40), height:wy(10),
        opacity: waveAnim.interpolate({inputRange:[0,1],outputRange:[0.08,0.22]}),
      }}>
        {[0.1,0.3,0.55,0.75,0.9].map((x_,i) => (
          <View key={i} style={{
            position:"absolute", left:`${x_*100}%`, top:`${i*20}%`,
            width:`${8+i*3}%`, height:wy(2), borderRadius:wy(1),
            backgroundColor:"rgba(255,255,255,0.9)",
          }} />
        ))}
      </Animated.View>

      {/* ── NPCs ── */}
      {NPC_DEFS.map((def,i) => (
        <NpcWalker key={def.nm} def={def} night={isNight} delay={i * 450} />
      ))}

      {/* ── Voitures ── */}
      {CAR_DEFS.map((c,i) => (
        <MovingCar key={i} c={c} night={isNight} />
      ))}

      {/* ── HUD Heure ── */}
      <View style={{
        position:"absolute", top:10, left:10,
        flexDirection:"row", alignItems:"center", gap:8,
        backgroundColor:isNight?"rgba(2,8,20,0.90)":"rgba(255,255,255,0.92)",
        borderRadius:14, paddingHorizontal:12, paddingVertical:8,
        borderWidth:1.5,
        borderColor:isNight?"rgba(251,191,36,0.40)":"rgba(29,78,216,0.3)",
        shadowColor:isNight?"#fbbf24":"#3B82F6", shadowOpacity:0.45, shadowRadius:10, elevation:8,
      }}>
        <Text style={{ fontSize:18 }}>{isNight?"🌙":isDawn?"🌅":"☀️"}</Text>
        <View>
          <Text style={{ color:isNight?"#FCD34D":isDawn?"#F97316":"#1D4ED8", fontSize:15, fontWeight:"900" }}>{timeStr}</Text>
          <Text style={{ color:isNight?"#64748B":"#94A3B8", fontSize:9, fontWeight:"700" }}>
            {isNight?"Nuit":isDawn?"Aube":"Journée"} · Neo Paris
          </Text>
        </View>
      </View>

      {/* ── HUD Position ── */}
      {currentBldg && (
        <Animated.View style={{
          position:"absolute", top:10, right:10,
          flexDirection:"row", alignItems:"center", gap:8,
          backgroundColor:isNight?"rgba(52,211,153,0.14)":"rgba(52,211,153,0.20)",
          borderRadius:14, paddingHorizontal:12, paddingVertical:8,
          borderWidth:1.5, borderColor:"rgba(52,211,153,0.50)",
          shadowColor:"#34D399", shadowOpacity:0.50, shadowRadius:12, elevation:8,
          opacity:pulseAnim,
        }}>
          <Text style={{ fontSize:16 }}>{currentBldg.em}</Text>
          <View>
            <Text style={{ color:"#34D399", fontSize:12, fontWeight:"900" }}>{currentBldg.label}</Text>
            <Text style={{ color:"#6EE7B7", fontSize:9, fontWeight:"700" }}>📍 Position actuelle</Text>
          </View>
        </Animated.View>
      )}

      {/* ── Légende zones ── */}
      <View style={{
        position:"absolute", bottom:0, left:0, right:0,
        flexDirection:"row", justifyContent:"space-around", alignItems:"center",
        backgroundColor:isNight?"rgba(2,8,20,0.80)":"rgba(5,15,40,0.72)",
        paddingVertical:7, paddingHorizontal:8,
        borderTopWidth:1, borderTopColor:"rgba(255,255,255,0.08)",
      }}>
        {[
          {em:"🌊", label:"Côte"},
          {em:"🏙️", label:"Centre"},
          {em:"🌳", label:"Parc"},
          {em:"🛍️", label:"Commerce"},
          {em:"🎭", label:"Nuit"},
          {em:"🏠", label:"Résidences"},
        ].map((z) => (
          <View key={z.label} style={{ flexDirection:"row", alignItems:"center", gap:3 }}>
            <Text style={{ fontSize:11 }}>{z.em}</Text>
            <Text style={{ color:"rgba(248,250,252,0.65)", fontSize:9, fontWeight:"700" }}>{z.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
