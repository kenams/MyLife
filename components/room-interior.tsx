/**
 * RoomInterior — Scène SVG intérieure par type de lieu
 * Chaque room a son décor unique : meubles, ambiance, couleurs
 */

import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, View } from "react-native";
import Svg, {
  Circle, Defs, G, LinearGradient,
  Line, Polygon, Rect, Stop, Text as SvgText, Ellipse, Path,
} from "react-native-svg";

const SCREEN_W = Dimensions.get("window").width;
const IW = SCREEN_W;
const IH = 260;

// ─── Détecte le type de room depuis l'ID ─────────────────────────────────────
type RoomKind = "home"|"cafe"|"office"|"library"|"gym"|"club"|"restaurant"|"cinema";

function detectKind(roomId: string): RoomKind {
  const id = roomId.toLowerCase();
  if (id.includes("cafe") || id.includes("café")) return "cafe";
  if (id.includes("gym")  || id.includes("sport"))  return "gym";
  if (id.includes("club") || id.includes("music"))  return "club";
  if (id.includes("cinema")|| id.includes("film"))  return "cinema";
  if (id.includes("restaurant")||id.includes("resto")) return "restaurant";
  if (id.includes("library") ||id.includes("biblio")) return "library";
  if (id.includes("office") || id.includes("bureau")) return "office";
  return "home";
}

// ─── Salon (Maison) ────────────────────────────────────────────────────────────
function HomeScene({ W, H }: { W: number; H: number }) {
  return (
    <G>
      {/* mur */}
      <Rect x={0} y={0} width={W} height={H*0.72} fill="#f5efe8" />
      <Rect x={0} y={H*0.72-3} width={W} height={4} fill="#d4c4b0" />
      {/* parquet */}
      <Rect x={0} y={H*0.72} width={W} height={H*0.28} fill="#c49a5a" />
      {[0.75,0.8,0.85,0.9,0.95].map((r,i) => (
        <Line key={i} x1={0} y1={H*r} x2={W} y2={H*r} stroke="#b08040" strokeWidth={0.7} />
      ))}
      {[0.2,0.45,0.65,0.85].map((r,i) => (
        <Line key={`pk${i}`} x1={W*r} y1={H*0.72} x2={W*r} y2={H} stroke="#b08040" strokeWidth={0.5} />
      ))}

      {/* fenêtre droite */}
      <Rect x={W*0.75} y={H*0.06} width={W*0.22} height={H*0.58} fill="#5d4037" rx={3} />
      <Rect x={W*0.76} y={H*0.08} width={W*0.20} height={H*0.54} fill="#87ceeb" />
      <Rect x={W*0.76} y={H*0.08} width={W*0.20} height={H*0.26} fill="#5ba4cf" />
      <Ellipse cx={W*0.83} cy={H*0.16} rx={W*0.06} ry={H*0.05} fill="rgba(255,255,255,0.8)" />
      <Ellipse cx={W*0.90} cy={H*0.14} rx={W*0.04} ry={H*0.04} fill="rgba(255,255,255,0.8)" />
      <Rect x={W*0.76} y={H*0.34} width={W*0.20} height={3} fill="#5d4037" />
      <Rect x={W*0.855} y={H*0.08} width={3} height={H*0.54} fill="#5d4037" />
      <Rect x={W*0.73} y={H*0.04} width={W*0.03} height={H*0.65} fill="#deb887" rx={2} />
      <Rect x={W*0.97} y={H*0.04} width={W*0.03} height={H*0.65} fill="#deb887" rx={2} />

      {/* TV gauche */}
      <Rect x={W*0.04} y={H*0.08} width={W*0.26} height={H*0.34} fill="#1a1a2e" rx={4} />
      <Rect x={W*0.05} y={H*0.10} width={W*0.24} height={H*0.30} fill="#0d1520" rx={2} />
      <Rect x={W*0.05} y={H*0.10} width={W*0.24} height={H*0.30} fill="#1e3a5f" rx={2} opacity={0.5} />
      <Rect x={W*0.15} y={H*0.42} width={W*0.04} height={H*0.08} fill="#2d2d3a" />
      <Rect x={W*0.10} y={H*0.50} width={W*0.14} height={H*0.03} fill="#2d2d3a" rx={2} />

      {/* lampadaire */}
      <Rect x={W*0.29} y={H*0.26} width={3} height={H*0.46} fill="#64748b" />
      <Polygon points={`${W*0.26},${H*0.26} ${W*0.32},${H*0.26} ${W*0.31},${H*0.18} ${W*0.28},${H*0.18}`} fill="#fef3c7" />
      <Circle cx={W*0.295} cy={H*0.25} r={5} fill="#fbbf24" opacity={0.55} />

      {/* canapé */}
      <Rect x={W*0.33} y={H*0.44} width={W*0.40} height={H*0.17} fill="#2c3e50" rx={5} />
      <Rect x={W*0.31} y={H*0.37} width={W*0.44} height={H*0.14} fill="#34495e" rx={4} />
      <Rect x={W*0.31} y={H*0.37} width={W*0.05} height={H*0.24} fill="#243342" rx={3} />
      <Rect x={W*0.70} y={H*0.37} width={W*0.05} height={H*0.24} fill="#243342" rx={3} />
      {[0,1,2].map(i => (
        <Rect key={i} x={W*(0.34+i*0.13)} y={H*0.45} width={W*0.12} height={H*0.14} fill={i%2===0?"#3d5a7a":"#2e4e6a"} rx={3} />
      ))}

      {/* tapis */}
      <Ellipse cx={W*0.52} cy={H*0.76} rx={W*0.20} ry={H*0.055} fill="#c0392b" opacity={0.65} />

      {/* table basse */}
      <Rect x={W*0.39} y={H*0.70} width={W*0.26} height={H*0.06} fill="#8b6914" rx={3} />
      <Rect x={W*0.41} y={H*0.76} width={4}      height={H*0.08} fill="#7a5c10" />
      <Rect x={W*0.61} y={H*0.76} width={4}      height={H*0.08} fill="#7a5c10" />
      <Rect x={W*0.43} y={H*0.68} width={W*0.06} height={H*0.04} fill="#e8d8c0" rx={1} />
      <Circle cx={W*0.54} cy={H*0.70} r={6} fill="#c0392b" />
      <Circle cx={W*0.54} cy={H*0.69} r={4} fill="#922b21" />

      {/* plante */}
      <Rect x={W*0.95} y={H*0.76} width={W*0.04} height={H*0.13} fill="#8b4513" rx={2} />
      <Rect x={W*0.94} y={H*0.74} width={W*0.06} height={H*0.03} fill="#7a3c12" rx={1} />
      <Circle cx={W*0.97} cy={H*0.64} r={W*0.04}  fill="#27ae60" />
      <Circle cx={W*0.945} cy={H*0.60} r={W*0.03} fill="#2ecc71" opacity={0.9} />
      <Circle cx={W*0.99}  cy={H*0.62} r={W*0.025} fill="#27ae60" opacity={0.8} />
    </G>
  );
}

// ─── Café ─────────────────────────────────────────────────────────────────────
function CafeScene({ W, H }: { W: number; H: number }) {
  return (
    <G>
      {/* mur bois chaud */}
      <Rect x={0} y={0} width={W} height={H*0.70} fill="#3b1f0d" />
      <Rect x={0} y={H*0.70} width={W} height={H*0.30} fill="#5d2d10" />
      {/* sol carrelé */}
      <Rect x={0} y={H*0.70} width={W} height={H*0.30} fill="#8b6914" />
      {[0,0.1,0.2].map((r,i)=>(
        <Line key={i} x1={0} y1={H*(0.70+r)} x2={W} y2={H*(0.70+r)} stroke="#7a5c10" strokeWidth={1.5} />
      ))}
      {[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9].map((r,i)=>(
        <Line key={`tc${i}`} x1={W*r} y1={H*0.70} x2={W*r} y2={H} stroke="#7a5c10" strokeWidth={1} />
      ))}

      {/* enseigne tableau */}
      <Rect x={W*0.06} y={H*0.06} width={W*0.32} height={H*0.30} fill="#1a1008" rx={4} />
      <Rect x={W*0.07} y={H*0.07} width={W*0.30} height={H*0.28} fill="#0d0804" rx={3} />
      <SvgText x={W*0.22} y={H*0.19} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight="900">☕ CAFÉ</SvgText>
      <SvgText x={W*0.22} y={H*0.29} textAnchor="middle" fill="#9ba9bd" fontSize={8}>Espresso · Latte · Crème</SvgText>

      {/* machine à café comptoir */}
      <Rect x={W*0.70} y={H*0.15} width={W*0.26} height={H*0.50} fill="#1a1008" rx={4} />
      <Rect x={W*0.72} y={H*0.18} width={W*0.10} height={H*0.18} fill="#2a2010" rx={3} />
      <Circle cx={W*0.775} cy={H*0.27} r={W*0.03} fill="#f4a261" opacity={0.8} />
      <Rect x={W*0.84} y={H*0.22} width={W*0.09} height={H*0.12} fill="#0d0804" rx={2} />
      <Rect x={W*0.77} y={H*0.38} width={W*0.16} height={4} fill="#e67e22" rx={2} />
      <SvgText x={W*0.83} y={H*0.62} textAnchor="middle" fill="#9ba9bd" fontSize={8} fontWeight="700">COMPTOIR</SvgText>
      <Rect x={W*0.68} y={H*0.60} width={W*0.30} height={H*0.10} fill="#2a1808" rx={2} />

      {/* lampes suspendues */}
      {[0.35, 0.55].map((x,i) => (
        <G key={`lamp${i}`}>
          <Line x1={W*x} y1={0} x2={W*x} y2={H*0.12} stroke="#64748b" strokeWidth={1.5} />
          <Ellipse cx={W*x} cy={H*0.16} rx={W*0.025} ry={H*0.04} fill="#fbbf24" opacity={0.9} />
          <Ellipse cx={W*x} cy={H*0.16} rx={W*0.06}  ry={H*0.09} fill="#fbbf2418" />
        </G>
      ))}

      {/* tables rondes */}
      {[
        {cx:0.30, cy:0.76},
        {cx:0.52, cy:0.76},
      ].map((t,i) => (
        <G key={`tbl${i}`}>
          <Circle cx={W*t.cx} cy={H*t.cy} r={W*0.055} fill="#5d2d10" />
          <Circle cx={W*t.cx} cy={H*t.cy} r={W*0.045} fill="#6b3815" />
          {/* chaises */}
          <Rect x={W*(t.cx-0.06)} y={H*(t.cy-0.03)} width={W*0.03} height={H*0.07} fill="#4a2c0f" rx={2} />
          <Rect x={W*(t.cx+0.03)} y={H*(t.cy-0.03)} width={W*0.03} height={H*0.07} fill="#4a2c0f" rx={2} />
          {/* tasse */}
          <Circle cx={W*t.cx} cy={H*t.cy} r={W*0.012} fill="#f4a261" />
        </G>
      ))}
    </G>
  );
}

// ─── Gym ─────────────────────────────────────────────────────────────────────
function GymScene({ W, H }: { W: number; H: number }) {
  return (
    <G>
      <Rect x={0} y={0} width={W} height={H*0.70} fill="#1a1a2e" />
      {/* miroir mur gauche */}
      <Rect x={W*0.03} y={H*0.05} width={W*0.28} height={H*0.62} fill="#1e2a3a" rx={3} />
      <Rect x={W*0.04} y={H*0.06} width={W*0.26} height={H*0.60} fill="#243040" rx={2} opacity={0.8} />
      <Line x1={W*0.045} y1={H*0.06} x2={W*0.17} y2={H*0.66} stroke="rgba(255,255,255,0.15)" strokeWidth={2} />
      <SvgText x={W*0.17} y={H*0.40} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={9}>MIROIR</SvgText>

      {/* sol rubber */}
      <Rect x={0} y={H*0.70} width={W} height={H*0.30} fill="#1c1010" />
      {[0.1,0.2].map((r,i)=>(
        <Line key={i} x1={0} y1={H*(0.70+r)} x2={W} y2={H*(0.70+r)} stroke="#2a1818" strokeWidth={2} />
      ))}

      {/* poster mur */}
      <Rect x={W*0.38} y={H*0.06} width={W*0.24} height={H*0.28} fill="#3d0f0f" rx={3} />
      <SvgText x={W*0.50} y={H*0.16} textAnchor="middle" fill="#f87171" fontSize={10} fontWeight="900">💪 NO</SvgText>
      <SvgText x={W*0.50} y={H*0.27} textAnchor="middle" fill="#f87171" fontSize={10} fontWeight="900">PAIN</SvgText>
      <SvgText x={W*0.50} y={H*0.38} textAnchor="middle" fill="#f87171" fontSize={10} fontWeight="900">NO GAIN</SvgText>

      {/* barre haltères */}
      <Rect x={W*0.33} y={H*0.52} width={W*0.34} height={H*0.04} fill="#64748b" rx={3} />
      {[{x:0.33},{x:0.63}].map((p,i)=>(
        <G key={i}>
          <Rect x={W*(p.x-0.02)} y={H*0.47} width={W*0.025} height={H*0.12} fill="#475569" rx={2} />
          <Rect x={W*(p.x-0.035)} y={H*0.49} width={W*0.04} height={H*0.05} fill="#334155" rx={4} />
          <Rect x={W*(p.x-0.035)} y={H*0.56} width={W*0.04} height={H*0.05} fill="#334155" rx={4} />
        </G>
      ))}

      {/* tapis sol */}
      <Rect x={W*0.33} y={H*0.65} width={W*0.34} height={H*0.08} fill="#1a0808" rx={3} />

      {/* tapis de course droite */}
      <Rect x={W*0.72} y={H*0.48} width={W*0.24} height={H*0.22} fill="#1e2a3a" rx={4} />
      <Rect x={W*0.73} y={H*0.52} width={W*0.22} height={H*0.12} fill="#0d1520" rx={2} />
      <Rect x={W*0.74} y={H*0.53} width={W*0.20} height={H*0.10} fill="#111827" rx={2} />
      <Rect x={W*0.73} y={H*0.48} width={W*0.22} height={H*0.05} fill="#334155" rx={2} />
      <Rect x={W*0.74} y={H*0.49} width={W*0.06} height={H*0.03} fill="#3b82f6" rx={1} />
      <SvgText x={W*0.84} y={H*0.79} textAnchor="middle" fill="#64748b" fontSize={8}>TREADMILL</SvgText>
    </G>
  );
}

// ─── Club ─────────────────────────────────────────────────────────────────────
function ClubScene({ W, H, discoAnim }: { W: number; H: number; discoAnim: Animated.Value }) {
  const colors = ["#e879f9","#818cf8","#f472b6","#38bdf8","#a78bfa"];
  return (
    <G>
      <Rect x={0} y={0} width={W} height={H*0.70} fill="#080415" />
      <Rect x={0} y={H*0.70} width={W} height={H*0.30} fill="#0d0820" />

      {/* piste de danse */}
      {[0,1,2,3,4].map(row => (
        [0,1,2,3,4,5,6,7,8,9].map(col => (
          <Rect
            key={`tile${row}-${col}`}
            x={W*(0.08 + col*0.085)}
            y={H*(0.55 + row*0.045)}
            width={W*0.078}
            height={H*0.038}
            fill={colors[(row+col)%colors.length]}
            opacity={(row+col)%3 === 0 ? 0.7 : 0.2}
            rx={2}
          />
        ))
      ))}

      {/* boule disco */}
      <Circle cx={W*0.50} cy={H*0.08} r={W*0.045} fill="#c0c0c0" />
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i) => {
        const rd=(a*Math.PI)/180;
        const dist = W*0.06;
        return <Line key={i}
          x1={W*0.50} y1={H*0.08}
          x2={W*0.50+Math.cos(rd)*dist} y2={H*0.08+Math.sin(rd)*dist}
          stroke={colors[i%colors.length]} strokeWidth={2} opacity={0.6}
        />;
      })}

      {/* booth DJ droite */}
      <Rect x={W*0.70} y={H*0.22} width={W*0.26} height={H*0.42} fill="#120826" rx={4} />
      <Rect x={W*0.72} y={H*0.24} width={W*0.22} height={H*0.15} fill="#1a1030" rx={3} />
      <Circle cx={W*0.78} cy={H*0.32} r={W*0.02} fill="#e879f9" opacity={0.8} />
      <Circle cx={W*0.87} cy={H*0.32} r={W*0.02} fill="#818cf8" opacity={0.8} />
      <Rect x={W*0.72} y={H*0.42} width={W*0.22} height={H*0.06} fill="#1a1030" rx={2} />
      <SvgText x={W*0.83} y={H*0.57} textAnchor="middle" fill="#e879f9" fontSize={8} fontWeight="800">DJ BOOTH</SvgText>

      {/* bar gauche */}
      <Rect x={W*0.03} y={H*0.24} width={W*0.15} height={H*0.42} fill="#0d0520" rx={4} />
      <Rect x={W*0.02} y={H*0.40} width={W*0.17} height={H*0.06} fill="#1a0a2e" rx={2} />
      {[0.04,0.09,0.14].map((x,i) => (
        <Rect key={i} x={W*x} y={H*0.27} width={W*0.03} height={H*0.12} fill={colors[i]} rx={2} opacity={0.8} />
      ))}

      {/* faisceaux lumineux */}
      {[
        {ox:0.15,oy:0.05,tx:0.30,ty:0.70,c:"#e879f9"},
        {ox:0.50,oy:0.03,tx:0.65,ty:0.70,c:"#818cf8"},
        {ox:0.80,oy:0.05,tx:0.50,ty:0.70,c:"#f472b6"},
      ].map((b,i) => (
        <Line key={i} x1={W*b.ox} y1={H*b.oy} x2={W*b.tx} y2={H*b.ty}
          stroke={b.c} strokeWidth={3} opacity={0.18} />
      ))}
    </G>
  );
}

// ─── Cinéma ───────────────────────────────────────────────────────────────────
function CinemaScene({ W, H }: { W: number; H: number }) {
  return (
    <G>
      <Rect x={0} y={0} width={W} height={H*0.70} fill="#080810" />
      <Rect x={0} y={H*0.70} width={W} height={H*0.30} fill="#0d0d18" />

      {/* écran */}
      <Rect x={W*0.08} y={H*0.06} width={W*0.84} height={H*0.38} fill="#0d1528" rx={4} />
      <Rect x={W*0.09} y={H*0.07} width={W*0.82} height={H*0.36} fill="#1a2540" rx={3} />
      <Rect x={W*0.09} y={H*0.07} width={W*0.82} height={H*0.36} fill="#1e3a5f" rx={3} opacity={0.6} />
      {/* contenu écran */}
      <Ellipse cx={W*0.50} cy={H*0.25} rx={W*0.15} ry={H*0.10} fill="#fbbf24" opacity={0.3} />
      <SvgText x={W*0.50} y={H*0.26} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={14}>▶</SvgText>
      {/* halo écran */}
      <Rect x={W*0.08} y={H*0.44} width={W*0.84} height={H*0.05} fill="#1e3a5f" opacity={0.3} />

      {/* sièges */}
      {[
        {row:0.56, count:9, color:"#1a1a3a"},
        {row:0.67, count:9, color:"#1e1e40"},
        {row:0.78, count:9, color:"#222244"},
      ].map(({row,count,color},ri) => (
        Array.from({length:count}).map((_,si) => (
          <G key={`seat${ri}-${si}`}>
            <Rect
              x={W*(0.06 + si*0.103)}
              y={H*row}
              width={W*0.085}
              height={H*0.075}
              fill={color} rx={3}
            />
            <Rect
              x={W*(0.06 + si*0.103 + 0.005)}
              y={H*(row-0.02)}
              width={W*0.075}
              height={H*0.025}
              fill="#0d0d20" rx={2}
            />
          </G>
        ))
      ))}

      {/* éclairage allée */}
      {[0.05,0.95].map((x,i) => (
        <Rect key={i} x={W*(x-0.01)} y={H*0.44} width={W*0.02} height={H*0.56} fill="#818cf8" opacity={0.3} />
      ))}
    </G>
  );
}

// ─── Restaurant ────────────────────────────────────────────────────────────────
function RestaurantScene({ W, H }: { W: number; H: number }) {
  return (
    <G>
      {/* mur élégant */}
      <Rect x={0} y={0} width={W} height={H*0.70} fill="#1a1208" />
      <Rect x={0} y={H*0.60} width={W} height={H*0.10} fill="#2a1a0a" />
      {/* sol parquet foncé */}
      <Rect x={0} y={H*0.70} width={W} height={H*0.30} fill="#3d2510" />
      {[0.1,0.2].map((r,i)=>(
        <Line key={i} x1={0} y1={H*(0.70+r)} x2={W} y2={H*(0.70+r)} stroke="#2e1b0c" strokeWidth={1.5} />
      ))}

      {/* casier à vin droite */}
      <Rect x={W*0.82} y={H*0.06} width={W*0.16} height={H*0.58} fill="#1a0d04" rx={3} />
      {[0,1,2,3].map(row => (
        [0,1].map(col => (
          <Ellipse key={`wine${row}-${col}`}
            cx={W*(0.87+col*0.07)}
            cy={H*(0.14+row*0.12)}
            rx={W*0.024} ry={H*0.04}
            fill={col===0?"#7f1d1d":"#4c1d95"}
            opacity={0.85}
          />
        ))
      ))}
      <SvgText x={W*0.90} y={H*0.67} textAnchor="middle" fill="#92400e" fontSize={7} fontWeight="800">CAVE</SvgText>

      {/* lampes suspendues */}
      {[0.25, 0.52].map((x,i) => (
        <G key={i}>
          <Line x1={W*x} y1={0} x2={W*x} y2={H*0.10} stroke="#64748b" strokeWidth={1.5} />
          <Ellipse cx={W*x} cy={H*0.14} rx={W*0.025} ry={H*0.045} fill="#fbbf24" opacity={0.85} />
          <Ellipse cx={W*x} cy={H*0.14} rx={W*0.07}  ry={H*0.10}  fill="#fbbf2415" />
        </G>
      ))}

      {/* tables rondes */}
      {[
        {cx:0.25, cy:0.77},
        {cx:0.52, cy:0.77},
      ].map((t,i) => (
        <G key={i}>
          {/* nappe */}
          <Ellipse cx={W*t.cx} cy={H*t.cy} rx={W*0.10} ry={H*0.07} fill="#f5f5f0" opacity={0.9} />
          <Ellipse cx={W*t.cx} cy={H*t.cy} rx={W*0.085} ry={H*0.06} fill="#ffffff" opacity={0.8} />
          {/* assiettes */}
          <Circle cx={W*(t.cx-0.04)} cy={H*t.cy} r={W*0.022} fill="#e8e0d0" />
          <Circle cx={W*(t.cx+0.04)} cy={H*t.cy} r={W*0.022} fill="#e8e0d0" />
          {/* bougie */}
          <Rect x={W*(t.cx-0.008)} y={H*(t.cy-0.06)} width={W*0.016} height={H*0.04} fill="#fef9c3" rx={2} />
          <Circle cx={W*t.cx} cy={H*(t.cy-0.06)} r={3} fill="#fbbf24" opacity={0.9} />
          <Ellipse cx={W*t.cx} cy={H*(t.cy-0.06)} rx={8} ry={5} fill="#fbbf2420" />
          {/* chaises */}
          {[-0.10, 0.10].map((dx,j) => (
            <Rect key={j}
              x={W*(t.cx+dx-0.02)} y={H*(t.cy+0.02)}
              width={W*0.04} height={H*0.07}
              fill="#2a1a08" rx={3}
            />
          ))}
        </G>
      ))}

      {/* passe plat cuisine */}
      <Rect x={W*0.65} y={H*0.35} width={W*0.15} height={H*0.22} fill="#0d0804" rx={3} />
      <Rect x={W*0.66} y={H*0.36} width={W*0.13} height={H*0.10} fill="#1a1008" rx={2} />
      <SvgText x={W*0.725} y={H*0.62} textAnchor="middle" fill="#92400e" fontSize={7}>CUISINE →</SvgText>
    </G>
  );
}

// ─── Bibliothèque ─────────────────────────────────────────────────────────────
function LibraryScene({ W, H }: { W: number; H: number }) {
  const bookColors = ["#dc2626","#2563eb","#16a34a","#9333ea","#ea580c","#0891b2","#be123c","#4f46e5"];
  return (
    <G>
      <Rect x={0} y={0} width={W} height={H*0.70} fill="#1e1030" />
      <Rect x={0} y={H*0.70} width={W} height={H*0.30} fill="#160c24" />
      {/* parquet bois foncé */}
      {[0.75,0.85,0.95].map((r,i) => (
        <Line key={i} x1={0} y1={H*r} x2={W} y2={H*r} stroke="#120a1e" strokeWidth={1.5} />
      ))}

      {/* étagères gauche */}
      {[0.06,0.24,0.42,0.58].map((sy,shelf) => (
        <G key={`shelfL${shelf}`}>
          <Rect x={W*0.02} y={H*sy}         width={W*0.26} height={H*0.16} fill="#0d0820" rx={2} />
          <Rect x={W*0.02} y={H*(sy+0.15)}  width={W*0.26} height={H*0.02} fill="#2d1356" rx={1} />
          {Array.from({length:8}).map((_,bi) => (
            <Rect key={bi}
              x={W*(0.03+bi*0.03)} y={H*(sy+0.01)}
              width={W*0.025} height={H*0.13}
              fill={bookColors[(shelf*8+bi)%bookColors.length]}
              rx={1} opacity={0.85}
            />
          ))}
        </G>
      ))}

      {/* étagères droite */}
      {[0.06,0.24,0.42,0.58].map((sy,shelf) => (
        <G key={`shelfR${shelf}`}>
          <Rect x={W*0.72} y={H*sy}        width={W*0.26} height={H*0.16} fill="#0d0820" rx={2} />
          <Rect x={W*0.72} y={H*(sy+0.15)} width={W*0.26} height={H*0.02} fill="#2d1356" rx={1} />
          {Array.from({length:8}).map((_,bi) => (
            <Rect key={bi}
              x={W*(0.73+bi*0.03)} y={H*(sy+0.01)}
              width={W*0.025} height={H*0.13}
              fill={bookColors[((shelf+1)*8+bi)%bookColors.length]}
              rx={1} opacity={0.85}
            />
          ))}
        </G>
      ))}

      {/* table de lecture centrale */}
      <Rect x={W*0.33} y={H*0.52} width={W*0.34} height={H*0.16} fill="#2d1356" rx={4} />
      <Rect x={W*0.34} y={H*0.50} width={W*0.32} height={H*0.03} fill="#3d1a6e" rx={2} />
      {/* livre ouvert */}
      <Rect x={W*0.38} y={H*0.54} width={W*0.11} height={H*0.10} fill="#f5f0e8" rx={2} />
      <Rect x={W*0.51} y={H*0.54} width={W*0.11} height={H*0.10} fill="#f0ebe0" rx={2} />
      <Line x1={W*0.495} y1={H*0.54} x2={W*0.505} y2={H*0.64} stroke="#c0a080" strokeWidth={1.5} />
      {/* lampe bureau */}
      <Rect x={W*0.64} y={H*0.42} width={3} height={H*0.18} fill="#64748b" />
      <Ellipse cx={W*0.64} cy={H*0.40} rx={W*0.04} ry={H*0.05} fill="#fbbf24" opacity={0.9} />
      <Ellipse cx={W*0.64} cy={H*0.40} rx={W*0.08} ry={H*0.09} fill="#fbbf2418" />
      {/* chaise */}
      <Rect x={W*0.46} y={H*0.68} width={W*0.08} height={H*0.10} fill="#1a0b2e" rx={3} />
    </G>
  );
}

// ─── Bureau ───────────────────────────────────────────────────────────────────
function OfficeScene({ W, H }: { W: number; H: number }) {
  return (
    <G>
      <Rect x={0} y={0} width={W} height={H*0.70} fill="#f1f5f9" />
      <Rect x={0} y={H*0.70} width={W} height={H*0.30} fill="#e2e8f0" />
      {/* sol */}
      {[0.75,0.85].map((r,i) => (
        <Line key={i} x1={0} y1={H*r} x2={W} y2={H*r} stroke="#cbd5e1" strokeWidth={1} />
      ))}

      {/* fenêtre gauche */}
      <Rect x={W*0.04} y={H*0.06} width={W*0.22} height={H*0.58} fill="#64748b" rx={3} />
      <Rect x={W*0.05} y={H*0.07} width={W*0.20} height={H*0.56} fill="#bde8f7" />
      <Rect x={W*0.05} y={H*0.07} width={W*0.20} height={H*0.28} fill="#87ceeb" />
      <Rect x={W*0.14} y={H*0.07} width={3} height={H*0.56} fill="#64748b" />
      <Rect x={W*0.05} y={H*0.35} width={W*0.20} height={3} fill="#64748b" />

      {/* bureau */}
      <Rect x={W*0.32} y={H*0.50} width={W*0.48} height={H*0.18} fill="#94a3b8" rx={4} />
      <Rect x={W*0.33} y={H*0.48} width={W*0.46} height={H*0.04} fill="#a8b5c2" rx={2} />
      {/* écran */}
      <Rect x={W*0.42} y={H*0.22} width={W*0.26} height={H*0.18} fill="#1e293b" rx={4} />
      <Rect x={W*0.43} y={H*0.23} width={W*0.24} height={H*0.16} fill="#0f172a" rx={3} />
      <Rect x={W*0.43} y={H*0.23} width={W*0.24} height={H*0.16} fill="#1e3a5f" rx={3} opacity={0.5} />
      <Rect x={W*0.53} y={H*0.40} width={3} height={H*0.10} fill="#475569" />
      <Rect x={W*0.48} y={H*0.50} width={W*0.14} height={3} fill="#475569" rx={2} />
      {/* clavier */}
      <Rect x={W*0.44} y={H*0.54} width={W*0.18} height={H*0.06} fill="#cbd5e1" rx={2} />
      {[0,1,2].map(r => (
        [0,1,2,3,4,5].map(c => (
          <Rect key={`key${r}-${c}`}
            x={W*(0.45+c*0.027)} y={H*(0.555+r*0.018)}
            width={W*0.022} height={H*0.014}
            fill="#b0bec5" rx={1}
          />
        ))
      ))}
      {/* souris */}
      <Ellipse cx={W*0.66} cy={H*0.56} rx={W*0.025} ry={H*0.036} fill="#94a3b8" />

      {/* étagère droite */}
      <Rect x={W*0.83} y={H*0.05} width={W*0.15} height={H*0.62} fill="#e2e8f0" rx={3} />
      {[0.10,0.26,0.42].map((sy,i) => (
        <Rect key={i} x={W*0.83} y={H*sy} width={W*0.15} height={3} fill="#cbd5e1" />
      ))}
      {["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"].map((c,i) => (
        <Rect key={i}
          x={W*(0.84+i*0.023)} y={H*(i<3?0.11:0.27)}
          width={W*0.018} height={H*0.13}
          fill={c} rx={1} opacity={0.8}
        />
      ))}

      {/* plante */}
      <Rect x={W*0.29} y={H*0.58} width={W*0.04} height={H*0.12} fill="#92400e" rx={2} />
      <Circle cx={W*0.31} cy={H*0.52} r={W*0.045} fill="#16a34a" />
      <Circle cx={W*0.27} cy={H*0.50} r={W*0.03}  fill="#15803d" opacity={0.9} />
      <Circle cx={W*0.35} cy={H*0.50} r={W*0.028} fill="#16a34a" opacity={0.8} />
    </G>
  );
}

// ─── Scène par défaut (Maison) ────────────────────────────────────────────────
function DefaultScene({ W, H }: { W: number; H: number }) {
  return <HomeScene W={W} H={H} />;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function RoomInterior({ roomId }: { roomId: string }) {
  const kind   = detectKind(roomId);
  const discoA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (kind === "club") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(discoA, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(discoA, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [kind]);

  return (
    <View style={{ width: IW, height: IH, overflow: "hidden" }}>
      <Svg width={IW} height={IH} viewBox={`0 0 ${IW} ${IH}`}>
        {kind === "home"       && <HomeScene       W={IW} H={IH} />}
        {kind === "cafe"       && <CafeScene       W={IW} H={IH} />}
        {kind === "gym"        && <GymScene        W={IW} H={IH} />}
        {kind === "club"       && <ClubScene       W={IW} H={IH} discoAnim={discoA} />}
        {kind === "cinema"     && <CinemaScene     W={IW} H={IH} />}
        {kind === "restaurant" && <RestaurantScene W={IW} H={IH} />}
        {kind === "library"    && <LibraryScene    W={IW} H={IH} />}
        {kind === "office"     && <OfficeScene     W={IW} H={IH} />}
        {!["home","cafe","gym","club","cinema","restaurant","library","office"].includes(kind) && (
          <DefaultScene W={IW} H={IH} />
        )}
      </Svg>

      {/* overlay gradient bottom */}
      <View style={{
        position:"absolute", bottom:0, left:0, right:0, height:60,
      }}>
        <Svg width={IW} height={60}>
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="transparent" stopOpacity="0" />
              <Stop offset="1" stopColor="#07111f"     stopOpacity="0.8" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={IW} height={60} fill="url(#fade)" />
        </Svg>
      </View>
    </View>
  );
}
