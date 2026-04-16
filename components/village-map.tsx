/**
 * Village Map — carte SVG vivante avec bâtiments, routes, arbres, NPCs animés
 * Mode jour/nuit automatique basé sur l'heure réelle
 */

import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Pressable, Text, View } from "react-native";
import Svg, {
  Circle, Defs, G, LinearGradient, Line, Path, Polygon,
  Rect, Stop, Text as SvgText, Ellipse,
} from "react-native-svg";

import { useTimeContext } from "@/lib/time-context";

const SCREEN_W = Dimensions.get("window").width;
const MAP_W    = Math.min(SCREEN_W, 420);
const MAP_H    = 480;
const SCALE    = MAP_W / 380;

// ─── Couleurs jour / nuit ─────────────────────────────────────────────────────
function usePalette(isNight: boolean) {
  return {
    sky:        isNight ? "#07111f" : "#e8f4fd",
    skyGrad2:   isNight ? "#0b1a2d" : "#bde0f7",
    ground:     isNight ? "#0e1810" : "#c8e6c2",
    road:       isNight ? "#1a1f2a" : "#8c9aaa",
    roadLine:   isNight ? "#fbbf2460" : "#ffffffaa",
    sidewalk:   isNight ? "#14202a" : "#b0bec5",
    grass:      isNight ? "#0a1e0e" : "#a5d6a7",
    tree:       isNight ? "#0d2e14" : "#388e3c",
    treeTop:    isNight ? "#1a5c28" : "#66bb6a",
    water:      isNight ? "#0a2040" : "#64b5f6",
    light:      isNight ? "#fbbf2440" : "transparent",
    star:       isNight ? "#ffffff" : "transparent",
    sunMoon:    isNight ? "#f0e68c" : "#ffd54f",
  };
}

// ─── Bâtiments ────────────────────────────────────────────────────────────────
type Building = {
  id: string; label: string; emoji: string;
  x: number; y: number; w: number; h: number;
  wallColor: string; roofColor: string; windowColor: string; doorColor: string;
  hasAwning?: boolean; awningColor?: string;
  locationSlug: string;
};

const BUILDINGS: Building[] = [
  // ── NORD ──────────────────────────────────────────────────────────────────
  {
    id: "home", label: "Maison", emoji: "🏠",
    x: 5, y: 55, w: 84, h: 72,
    wallColor: "#1b3a5c", roofColor: "#0d2240", windowColor: "#60a5fa",
    doorColor: "#8b7cff", locationSlug: "home",
  },
  {
    id: "cafe", label: "Café", emoji: "☕",
    x: 98, y: 55, w: 82, h: 72,
    wallColor: "#3b1f0d", roofColor: "#1f0d06", windowColor: "#fb923c",
    doorColor: "#f59e0b", locationSlug: "cafe",
    hasAwning: true, awningColor: "#e67e22",
  },
  {
    id: "office", label: "Bureau", emoji: "💼",
    x: 190, y: 55, w: 84, h: 72,
    wallColor: "#1a2a3a", roofColor: "#0d1a2a", windowColor: "#7dd3fc",
    doorColor: "#38bdf8", locationSlug: "office",
  },
  {
    id: "library", label: "Bibliothèque", emoji: "📚",
    x: 285, y: 55, w: 88, h: 72,
    wallColor: "#2a1040", roofColor: "#150824", windowColor: "#c084fc",
    doorColor: "#a78bfa", locationSlug: "library",
  },

  // ── SUD ───────────────────────────────────────────────────────────────────
  {
    id: "gym", label: "Gym", emoji: "💪",
    x: 5, y: 260, w: 84, h: 78,
    wallColor: "#2a0d0d", roofColor: "#1a0808", windowColor: "#f87171",
    doorColor: "#ef4444", locationSlug: "gym",
  },
  {
    id: "club", label: "Club", emoji: "🎵",
    x: 98, y: 260, w: 82, h: 78,
    wallColor: "#1a0a2e", roofColor: "#0d0518", windowColor: "#e879f9",
    doorColor: "#a21caf", locationSlug: "club",
    hasAwning: true, awningColor: "#7e22ce",
  },
  {
    id: "restaurant", label: "Restaurant", emoji: "🍽️",
    x: 190, y: 260, w: 84, h: 78,
    wallColor: "#1a1208", roofColor: "#0d0a04", windowColor: "#fbbf24",
    doorColor: "#d97706", locationSlug: "restaurant",
    hasAwning: true, awningColor: "#92400e",
  },
  {
    id: "cinema", label: "Cinéma", emoji: "🎬",
    x: 285, y: 260, w: 88, h: 78,
    wallColor: "#0d0d1a", roofColor: "#080810", windowColor: "#818cf8",
    doorColor: "#4338ca", locationSlug: "cinema",
  },
];

// ─── Arbres ───────────────────────────────────────────────────────────────────
const TREES = [
  { x: 170, y: 178 }, { x: 200, y: 165 }, { x: 230, y: 182 }, { x: 255, y: 168 },
  { x: 280, y: 180 }, { x: 310, y: 165 }, { x: 340, y: 178 }, { x: 198, y: 200 },
  { x: 248, y: 205 }, { x: 318, y: 200 }, { x: 360, y: 193 },
  { x: 45, y: 178 }, { x: 65, y: 192 }, { x: 130, y: 178 }, { x: 148, y: 192 },
];

// ─── Positions NPCs (% du map) ────────────────────────────────────────────────
const NPC_SEEDS = [
  { id: "n1", startX: 0.25, startY: 0.42, color: "#38c793", label: "Ava" },
  { id: "n2", startX: 0.55, startY: 0.42, color: "#f472b6", label: "Léa" },
  { id: "n3", startX: 0.78, startY: 0.42, color: "#60a5fa", label: "Noa" },
  { id: "n4", startX: 0.15, startY: 0.78, color: "#fbbf24", label: "Kim" },
  { id: "n5", startX: 0.60, startY: 0.78, color: "#a78bfa", label: "Sam" },
];

// ─── Composant Bâtiment ───────────────────────────────────────────────────────
function BuildingShape({ b, isNight, onPress, isCurrent }: {
  b: Building; isNight: boolean; onPress: () => void; isCurrent: boolean;
}) {
  const s = SCALE;
  const x = b.x * s; const y = b.y * s; const w = b.w * s; const h = b.h * s;
  const roofH = 10 * s;

  // Windows : 2 rangées
  const winW = 12 * s; const winH = 10 * s;
  const wins = [
    [x + w * 0.22, y + h * 0.25],
    [x + w * 0.55, y + h * 0.25],
    [x + w * 0.22, y + h * 0.52],
    [x + w * 0.55, y + h * 0.52],
  ];

  return (
    <G onPress={onPress}>
      {/* Shadow */}
      <Rect x={x + 4*s} y={y + h - 4*s} width={w} height={8*s}
        fill="rgba(0,0,0,0.25)" rx={4*s} />

      {/* Main wall */}
      <Rect x={x} y={y + roofH} width={w} height={h - roofH}
        fill={b.wallColor} rx={4*s} />

      {/* Roof strip */}
      <Rect x={x} y={y} width={w} height={roofH + 4*s}
        fill={b.roofColor} rx={4*s} />

      {/* Awning */}
      {b.hasAwning && (
        <Polygon
          points={`${x},${y + h * 0.35} ${x + w},${y + h * 0.35} ${x + w + 6*s},${y + h * 0.44} ${x - 6*s},${y + h * 0.44}`}
          fill={b.awningColor ?? b.roofColor}
          opacity={0.9}
        />
      )}

      {/* Windows */}
      {wins.map(([wx, wy], i) => (
        <Rect key={i} x={wx} y={wy} width={winW} height={winH}
          fill={isNight ? b.windowColor : b.windowColor + "80"}
          rx={2*s}
          opacity={isNight ? 0.9 : 0.6}
        />
      ))}

      {/* Door */}
      <Rect
        x={x + w * 0.38} y={y + h - 18*s}
        width={16*s} height={18*s}
        fill={b.doorColor} rx={8*s}
        opacity={0.9}
      />

      {/* Glow when current location */}
      {isCurrent && (
        <Rect x={x - 3*s} y={y - 3*s} width={w + 6*s} height={h + 6*s}
          fill="transparent"
          stroke="#38c793"
          strokeWidth={2.5*s}
          rx={6*s}
          opacity={0.8}
        />
      )}

      {/* Night streetlight glow */}
      {isNight && (
        <Ellipse cx={x + w/2} cy={y + h/2} rx={w * 0.6} ry={h * 0.3}
          fill={b.windowColor + "12"} />
      )}

      {/* Label */}
      <SvgText
        x={x + w / 2}
        y={y + h + 14*s}
        textAnchor="middle"
        fill={isCurrent ? "#38c793" : "#94a3b8"}
        fontSize={8.5*s}
        fontWeight="700"
      >
        {b.emoji} {b.label}
      </SvgText>
    </G>
  );
}

// ─── Arbre ────────────────────────────────────────────────────────────────────
function TreeShape({ x, y, palette }: { x: number; y: number; palette: ReturnType<typeof usePalette> }) {
  const s = SCALE;
  const px = x * s; const py = y * s;
  return (
    <G>
      <Rect x={px - 3*s} y={py} width={6*s} height={10*s} fill="#5d4037" />
      <Circle cx={px} cy={py - 4*s} r={10*s} fill={palette.tree} />
      <Circle cx={px} cy={py - 6*s} r={7*s} fill={palette.treeTop} opacity={0.8} />
    </G>
  );
}

// ─── NPC animé ───────────────────────────────────────────────────────────────
function NpcDot({ seed, isNight }: { seed: typeof NPC_SEEDS[0]; isNight: boolean }) {
  const posX = useRef(new Animated.Value(seed.startX * MAP_W)).current;
  const posY = useRef(new Animated.Value(seed.startY * MAP_H)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    function wander() {
      // Se déplace dans la zone centrale (rues)
      const roadY = (MAP_H * 0.38) + (Math.random() - 0.5) * (MAP_H * 0.04);
      const nextX = MAP_W * (0.1 + Math.random() * 0.8);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(posX, { toValue: nextX, duration: 3000 + Math.random() * 4000, useNativeDriver: false }),
          Animated.timing(posY, { toValue: roadY, duration: 2000, useNativeDriver: false }),
        ]),
        Animated.delay(1000 + Math.random() * 2000),
      ]).start(wander);
    }
    const t = setTimeout(wander, Math.random() * 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={{
      position: "absolute",
      left: posX,
      top: posY,
      width: 20,
      height: 24,
      alignItems: "center",
      transform: [{ translateX: -10 }, { translateY: -12 }],
    }}>
      <View style={{
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: seed.color,
        borderWidth: 1.5, borderColor: "#fff3",
        shadowColor: seed.color, shadowOpacity: 0.8, shadowRadius: 4,
        elevation: 4,
      }} />
      <Text style={{
        color: isNight ? "#ffffffcc" : "#334155",
        fontSize: 8, fontWeight: "800",
        backgroundColor: isNight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)",
        paddingHorizontal: 3, paddingVertical: 1, borderRadius: 4,
        marginTop: 1,
      }}>
        {seed.label}
      </Text>
    </Animated.View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function VillageMap({ currentSlug, onLocationPress }: {
  currentSlug: string;
  onLocationPress: (slug: string, label: string) => void;
}) {
  const { hour } = useTimeContext();
  // Nuit = avant 7h ou après 20h
  const isNight = hour < 7 || hour >= 20;
  const pal = usePalette(isNight);
  const s = SCALE;

  // Clignottement lumières nuit
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.9, duration: 2500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={{ width: MAP_W, height: MAP_H, overflow: "hidden", borderRadius: 20 }}>
      {/* ── SVG fond + bâtiments ── */}
      <Svg width={MAP_W} height={MAP_H}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={pal.sky} />
            <Stop offset="1" stopColor={pal.skyGrad2} />
          </LinearGradient>
          <LinearGradient id="road" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={pal.road} />
            <Stop offset="1" stopColor={pal.road} />
          </LinearGradient>
        </Defs>

        {/* Ciel/fond */}
        <Rect x={0} y={0} width={380*s} height={MAP_H} fill="url(#sky)" />

        {/* Sol pelouse nord */}
        <Rect x={0} y={40*s} width={380*s} height={155*s} fill={pal.ground} rx={0} />
        {/* Sol pelouse sud */}
        <Rect x={0} y={250*s} width={380*s} height={180*s} fill={pal.ground} />
        {/* Zone parc centre */}
        <Rect x={165*s} y={155*s} width={210*s} height={90*s} fill={pal.grass} rx={8*s} />
        {/* Zone marché centre */}
        <Rect x={5*s} y={160*s} width={155*s} height={78*s} fill={pal.sidewalk} rx={8*s} />

        {/* ── Routes ─────────────────────────────────────────────── */}
        {/* Route horizontale nord (entre nord et centre) */}
        <Rect x={0} y={140*s} width={380*s} height={18*s} fill={pal.road} />
        {/* Route horizontale sud (entre centre et sud) */}
        <Rect x={0} y={245*s} width={380*s} height={18*s} fill={pal.road} />
        {/* Route verticale 1 */}
        <Rect x={90*s} y={0} width={10*s} height={MAP_H} fill={pal.road} />
        {/* Route verticale 2 */}
        <Rect x={184*s} y={0} width={10*s} height={MAP_H} fill={pal.road} />
        {/* Route verticale 3 */}
        <Rect x={280*s} y={0} width={10*s} height={MAP_H} fill={pal.road} />

        {/* Lignes de route */}
        {[149, 149.5].map((ly, i) => (
          <Line key={`hl-${i}`}
            x1={0} y1={ly*s} x2={380*s} y2={ly*s}
            stroke={pal.roadLine} strokeWidth={1.5*s} strokeDasharray={`${12*s},${8*s}`}
          />
        ))}
        {[254, 254.5].map((ly, i) => (
          <Line key={`hl2-${i}`}
            x1={0} y1={ly*s} x2={380*s} y2={ly*s}
            stroke={pal.roadLine} strokeWidth={1.5*s} strokeDasharray={`${12*s},${8*s}`}
          />
        ))}

        {/* ── Parc : fontaine + allées ─────────────────────────── */}
        {/* Allées */}
        <Rect x={165*s} y={155*s} width={210*s} height={4*s} fill={pal.sidewalk} opacity={0.6} />
        <Rect x={165*s} y={237*s} width={210*s} height={4*s} fill={pal.sidewalk} opacity={0.6} />
        {/* Fontaine */}
        <Circle cx={270*s} cy={200*s} r={20*s} fill={pal.water} opacity={0.85} />
        <Circle cx={270*s} cy={200*s} r={12*s} fill={pal.water} opacity={0.6} />
        <Circle cx={270*s} cy={200*s} r={5*s} fill="#90caf9" opacity={0.9} />
        <SvgText x={270*s} y={224*s} textAnchor="middle" fill="#64b5f6" fontSize={7.5*s} fontWeight="700">
          Fontaine
        </SvgText>

        {/* Marché centre */}
        <SvgText x={82*s} y={175*s} textAnchor="middle" fill="#475569" fontSize={9*s} fontWeight="800">
          🛒 Marché
        </SvgText>
        <Rect x={30*s} y={178*s} width={40*s} height={28*s} fill={pal.sidewalk} rx={4*s} opacity={0.7} />
        <Rect x={80*s} y={178*s} width={40*s} height={28*s} fill={pal.sidewalk} rx={4*s} opacity={0.7} />
        <Rect x={130*s} y={178*s} width={22*s} height={28*s} fill={pal.sidewalk} rx={4*s} opacity={0.7} />

        {/* ── Trottoirs ────────────────────────────────────────── */}
        <Rect x={0} y={128*s} width={380*s} height={12*s} fill={pal.sidewalk} />
        <Rect x={0} y={158*s} width={380*s} height={8*s} fill={pal.sidewalk} />
        <Rect x={0} y={245*s} width={380*s} height={8*s} fill={pal.sidewalk} />
        <Rect x={0} y={338*s} width={380*s} height={12*s} fill={pal.sidewalk} />

        {/* ── Bâtiments ────────────────────────────────────────── */}
        {BUILDINGS.map((b) => (
          <BuildingShape
            key={b.id}
            b={b}
            isNight={isNight}
            isCurrent={currentSlug === b.locationSlug}
            onPress={() => onLocationPress(b.locationSlug, b.label)}
          />
        ))}

        {/* ── Arbres ───────────────────────────────────────────── */}
        {TREES.map((t, i) => (
          <TreeShape key={i} x={t.x} y={t.y} palette={pal} />
        ))}

        {/* ── Lampadaires la nuit ───────────────────────────────── */}
        {isNight && [94, 188, 284].map((lx, i) => (
          <G key={`lamp-${i}`}>
            <Rect x={(lx - 1)*s} y={130*s} width={3*s} height={12*s} fill="#94a3b8" />
            <Circle cx={lx*s} cy={130*s} r={5*s} fill="#fbbf24" opacity={0.9} />
            <Circle cx={lx*s} cy={130*s} r={18*s} fill="#fbbf2420" />
            <Rect x={(lx - 1)*s} y={242*s} width={3*s} height={12*s} fill="#94a3b8" />
            <Circle cx={lx*s} cy={242*s} r={5*s} fill="#fbbf24" opacity={0.9} />
            <Circle cx={lx*s} cy={242*s} r={18*s} fill="#fbbf2420" />
          </G>
        ))}

        {/* ── Soleil / Lune ─────────────────────────────────────── */}
        <Circle cx={340*s} cy={22*s} r={14*s} fill={pal.sunMoon} opacity={0.9} />
        {isNight && (
          <>
            {/* Étoiles */}
            {[30,80,130,180,250,300,20,160,340,210].map((sx, i) => (
              <Circle key={`star-${i}`} cx={sx*s} cy={(6 + (i % 3) * 8)*s} r={1.5*s} fill="#fff" opacity={0.6 + (i % 3) * 0.2} />
            ))}
          </>
        )}

        {/* ── Indicateur position joueur ───────────────────────── */}
        {(() => {
          const cur = BUILDINGS.find((b) => b.locationSlug === currentSlug);
          if (!cur) return null;
          const cx = (cur.x + cur.w / 2) * s;
          const cy = (cur.y + cur.h - 2) * s;
          return (
            <G>
              <Circle cx={cx} cy={cy} r={10*s} fill="#38c79340" />
              <Circle cx={cx} cy={cy} r={6*s} fill="#38c793cc" />
              <Circle cx={cx} cy={cy} r={3*s} fill="#fff" />
              <SvgText x={cx} y={cy - 14*s} textAnchor="middle" fill="#38c793" fontSize={8*s} fontWeight="900">
                TU ES ICI
              </SvgText>
            </G>
          );
        })()}
      </Svg>

      {/* ── NPCs animés (layer au-dessus SVG) ── */}
      {NPC_SEEDS.map((seed) => (
        <NpcDot key={seed.id} seed={seed} isNight={isNight} />
      ))}

      {/* ── Badge heure ── */}
      <View style={{
        position: "absolute", top: 10, left: 12,
        backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 5,
        flexDirection: "row", alignItems: "center", gap: 6,
        borderWidth: 1, borderColor: isNight ? "#fbbf2440" : "#60a5fa40",
      }}>
        <Text style={{ fontSize: 14 }}>{isNight ? "🌙" : "☀️"}</Text>
        <Text style={{ color: isNight ? "#fbbf24" : "#60a5fa", fontSize: 11, fontWeight: "800" }}>
          {`${String(hour).padStart(2, "0")}h · ${isNight ? "Nuit" : "Jour"}`}
        </Text>
      </View>
    </View>
  );
}
