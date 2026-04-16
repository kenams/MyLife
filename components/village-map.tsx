/**
 * VillageMap v4 — Carte jeu top-down : bâtiments 3D, voitures animées, NPCs
 */

import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Text, View } from "react-native";
import Svg, {
  Circle, Defs, G, LinearGradient,
  Line, Polygon, Rect, Stop, Text as SvgText, Ellipse,
} from "react-native-svg";

import { useTimeContext } from "@/lib/time-context";

const SCREEN_W = Dimensions.get("window").width;
const MAP_W    = Math.min(SCREEN_W - 24, 560);
const MAP_H    = 560;
const S        = MAP_W / 380;

// ─── Palette jour / nuit ──────────────────────────────────────────────────────
function mkPal(night: boolean) {
  return {
    skyA:   night ? "#07111f" : "#5ba4cf",
    skyB:   night ? "#0d1f3a" : "#c9e8f5",
    ground: night ? "#0b160b" : "#c4e0b8",
    park:   night ? "#091409" : "#7cb342",
    road:   night ? "#1a2130" : "#6b7888",
    roadL:  night ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.65)",
    swalk:  night ? "#1a2540" : "#adb5bd",
    water:  night ? "#0a2540" : "#42a5f5",
    wshim:  night ? "#1a4a7a" : "#bbdefb",
    treeA:  night ? "#0c2b12" : "#2e7d32",
    treeB:  night ? "#173a20" : "#43a047",
    trunk:  "#5d4037",
    sun:    night ? "#f5f0d0" : "#fdd835",
  };
}
type Pal = ReturnType<typeof mkPal>;

// ─── Bâtiments ────────────────────────────────────────────────────────────────
type Bldg = {
  slug: string; label: string; em: string;
  x: number; y: number; w: number; h: number;
  wall: string; dark: string; roof: string; ra: string;
  win: string; door: string;
  aw: string | null; sign: string | null; neon: string | null;
};

const BLDGS: Bldg[] = [
  // ── Nord ────────────────────────────────────────────────────────────────────
  { slug:"home",       label:"Maison",       em:"🏠", x:5,   y:50,  w:84,  h:82, wall:"#1e3d6e", dark:"#0d1e38", roof:"#0f2d52", ra:"#1a4a7a", win:"#7eb8e8", door:"#8b7cff", aw:null,      sign:null,     neon:null      },
  { slug:"cafe",       label:"Café",          em:"☕", x:100, y:50,  w:80,  h:82, wall:"#4a2c0f", dark:"#2a1808", roof:"#2a1808", ra:"#6b3f15", win:"#f4a261", door:"#e76f51", aw:"#c0392b", sign:"CAFÉ",   neon:null      },
  { slug:"office",     label:"Bureau",        em:"💼", x:192, y:50,  w:84,  h:82, wall:"#1a2744", dark:"#0d1528", roof:"#0d1528", ra:"#2a3d5e", win:"#7dd3fc", door:"#38bdf8", aw:null,      sign:"OFFICE", neon:null      },
  { slug:"library",    label:"Bibliothèque",  em:"📚", x:288, y:50,  w:88,  h:82, wall:"#2d1356", dark:"#1a0b30", roof:"#1a0b30", ra:"#4c2080", win:"#c084fc", door:"#a855f7", aw:null,      sign:"BIBLIO", neon:null      },
  // ── Sud ─────────────────────────────────────────────────────────────────────
  { slug:"gym",        label:"Gym",           em:"💪", x:5,   y:358, w:84,  h:84, wall:"#3d0f0f", dark:"#200808", roof:"#200808", ra:"#5c1a1a", win:"#f87171", door:"#ef4444", aw:null,      sign:"GYM",    neon:"#ff4444" },
  { slug:"club",       label:"Club",          em:"🎵", x:100, y:358, w:80,  h:84, wall:"#120826", dark:"#080415", roof:"#080415", ra:"#2a1050", win:"#e879f9", door:"#a21caf", aw:"#7e22ce", sign:"CLUB",   neon:"#dd00ff" },
  { slug:"restaurant", label:"Restaurant",    em:"🍽️", x:192, y:358, w:84,  h:84, wall:"#2a1a08", dark:"#150d04", roof:"#150d04", ra:"#4a2f10", win:"#fbbf24", door:"#d97706", aw:"#92400e", sign:"RESTO",  neon:null      },
  { slug:"cinema",     label:"Cinéma",        em:"🎬", x:288, y:358, w:88,  h:84, wall:"#0d0d1a", dark:"#080810", roof:"#080810", ra:"#1a1a3a", win:"#818cf8", door:"#4338ca", aw:null,      sign:"CINÉMA", neon:"#6366f1" },
];

// ─── Données NPC ─────────────────────────────────────────────────────────────
const NPCS = [
  { id:"ava", nm:"Ava", clr:"#38c793", ini:"A", ry: 168 },
  { id:"lea", nm:"Léa", clr:"#f472b6", ini:"L", ry: 180 },
  { id:"noa", nm:"Noa", clr:"#60a5fa", ini:"N", ry: 268 },
  { id:"kim", nm:"Kim", clr:"#fbbf24", ini:"K", ry: 345 },
  { id:"sam", nm:"Sam", clr:"#a78bfa", ini:"S", ry: 357 },
] as const;

// ─── Bâtiment 3D ─────────────────────────────────────────────────────────────
function Building({ b, isNight, isCurrent, onPress }: {
  b: Bldg; isNight: boolean; isCurrent: boolean; onPress: () => void;
}) {
  const x  = b.x * S; const y = b.y * S;
  const w  = b.w * S; const h = b.h * S;
  const rH = 16 * S;
  const sd = 6 * S;  // ombre 3D

  // grille de fenêtres : 2 colonnes × 2 rangées
  const winW = 11 * S; const winH = 9 * S;
  const wins: [number,number][] = [
    [x + w*0.20, y + rH + h*0.14],
    [x + w*0.55, y + rH + h*0.14],
    [x + w*0.20, y + rH + h*0.48],
    [x + w*0.55, y + rH + h*0.48],
  ];

  // label centré sous le bâtiment
  const lbW  = (b.label.length * 6.2 + 16) * S;
  const lbH  = 16 * S;
  const lbX  = x + w/2 - lbW/2;
  const lbY  = y + h + 4 * S;

  return (
    <G onPress={onPress}>
      {/* ombre 3D */}
      <Rect x={x+sd} y={y+sd} width={w} height={h} fill="rgba(0,0,0,0.30)" rx={5*S} />

      {/* mur principal */}
      <Rect x={x} y={y+rH} width={w} height={h-rH} fill={b.wall} rx={4*S} />

      {/* toit */}
      <Rect x={x} y={y}      width={w} height={rH+4*S} fill={b.roof} rx={4*S} />
      <Rect x={x+3*S} y={y+3*S} width={w-6*S} height={7*S} fill={b.ra} rx={2*S} opacity={0.7} />

      {/* auvent */}
      {b.aw && (
        <Polygon
          points={`${x-5*S},${y+h*0.36} ${x+w+5*S},${y+h*0.36} ${x+w+10*S},${y+h*0.46} ${x-10*S},${y+h*0.46}`}
          fill={b.aw} opacity={0.92}
        />
      )}

      {/* fenêtres */}
      {wins.map(([wx,wy], i) => (
        <G key={i}>
          <Rect x={wx-S} y={wy-S} width={winW+2*S} height={winH+2*S} fill={b.dark} rx={S} />
          <Rect x={wx} y={wy} width={winW} height={winH}
            fill={isNight ? b.win : b.win+"80"} rx={S}
            opacity={isNight ? 0.95 : 0.65}
          />
          {isNight && (
            <Rect x={wx+S} y={wy+S} width={3*S} height={winH*0.55} fill="rgba(255,255,255,0.22)" rx={S} />
          )}
        </G>
      ))}

      {/* porte arrondie */}
      <Rect x={x+w*0.39} y={y+h-18*S} width={15*S} height={18*S} fill={b.door} rx={7*S} opacity={0.95} />
      <Circle cx={x+w*0.39+12*S} cy={y+h-9*S} r={1.5*S} fill="rgba(255,255,255,0.5)" />

      {/* plaque enseigne */}
      {b.sign && (
        <>
          <Rect x={x+w*0.12} y={y+h*0.62} width={w*0.76} height={11*S} fill="rgba(0,0,0,0.55)" rx={2*S} />
          <SvgText
            x={x+w/2} y={y+h*0.62+8*S}
            textAnchor="middle"
            fill={isNight && b.neon ? b.neon : "#e2e8f0"}
            fontSize={7*S} fontWeight="900"
          >{b.sign}</SvgText>
        </>
      )}

      {/* néon nuit */}
      {isNight && b.neon && (
        <Rect x={x-3*S} y={y-3*S} width={w+6*S} height={h+6*S}
          fill="transparent" stroke={b.neon} strokeWidth={2*S} rx={7*S} opacity={0.45}
        />
      )}

      {/* contour position courante */}
      {isCurrent && (
        <>
          <Rect x={x-4*S} y={y-4*S} width={w+8*S} height={h+8*S}
            fill="transparent" stroke="#38c793" strokeWidth={3*S} rx={8*S} opacity={0.9}
          />
          <Rect x={x-8*S} y={y-8*S} width={w+16*S} height={h+16*S}
            fill="transparent" stroke="#38c793" strokeWidth={1.5*S} rx={11*S} opacity={0.35}
          />
        </>
      )}

      {/* indicateur position joueur */}
      {isCurrent && (
        <>
          <Circle cx={x+w/2} cy={y-2*S} r={9*S} fill="#38c79340" />
          <Circle cx={x+w/2} cy={y-2*S} r={5*S} fill="#38c793cc" />
          <Circle cx={x+w/2} cy={y-2*S} r={2.5*S} fill="#fff" />
          <SvgText x={x+w/2} y={y-14*S} textAnchor="middle"
            fill="#38c793" fontSize={7.5*S} fontWeight="900">TU ES ICI</SvgText>
        </>
      )}

      {/* label bâtiment */}
      <Rect x={lbX} y={lbY} width={lbW} height={lbH}
        fill={isNight ? "rgba(0,0,0,0.72)" : "rgba(15,23,42,0.82)"}
        rx={7*S}
        stroke={isCurrent ? "#38c793" : "rgba(255,255,255,0.22)"}
        strokeWidth={isCurrent ? 1.5*S : 0.8*S}
      />
      <SvgText x={x+w/2} y={lbY+11.5*S}
        textAnchor="middle"
        fill={isCurrent ? "#8ee0bd" : "#fff"}
        fontSize={9.5*S} fontWeight="900"
      >{b.em} {b.label}</SvgText>
    </G>
  );
}

// ─── Arbre ────────────────────────────────────────────────────────────────────
function Tree({ x, y, r, pal }: { x: number; y: number; r: number; pal: Pal }) {
  const px = x*S; const py = y*S; const pr = r*S;
  return (
    <G>
      <Ellipse cx={px+3*S} cy={py+pr*0.5} rx={pr*0.9} ry={pr*0.28} fill="rgba(0,0,0,0.18)" />
      <Rect x={px-2.5*S} y={py-pr*0.1} width={5*S} height={pr*0.9} fill={pal.trunk} />
      <Circle cx={px} cy={py-pr*0.5} r={pr}     fill={pal.treeA} />
      <Circle cx={px} cy={py-pr*0.75} r={pr*0.72} fill={pal.treeB} />
    </G>
  );
}

// ─── NPC animé (corps + badge + bob) ─────────────────────────────────────────
function NpcChar({ nm, clr, ini, roadY, isNight, delay }: {
  nm: string; clr: string; ini: string; roadY: number; isNight: boolean; delay: number;
}) {
  const posX = useRef(new Animated.Value(MAP_W * (0.1 + Math.random() * 0.8))).current;
  const posY = useRef(new Animated.Value(roadY * S - 12)).current;
  const bobY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bobY, { toValue: -3, duration: 360, useNativeDriver: true }),
        Animated.timing(bobY, { toValue: 0,  duration: 360, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    function wander() {
      const nextX  = MAP_W * (0.06 + Math.random() * 0.88);
      const spread = (Math.random() - 0.5) * 18 * S;
      Animated.sequence([
        Animated.parallel([
          Animated.timing(posX, { toValue: nextX,             duration: 3000 + Math.random()*4000, useNativeDriver: false }),
          Animated.timing(posY, { toValue: roadY*S-12+spread, duration: 1400,                       useNativeDriver: false }),
        ]),
        Animated.delay(1200 + Math.random()*2800),
      ]).start(wander);
    }
    const t = setTimeout(wander, delay + Math.random()*1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={{
      position: "absolute", left: posX, top: posY,
      alignItems: "center", width: 24,
      transform: [{ translateX: -12 }, { translateY: bobY }],
      zIndex: 25,
    }}>
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: clr,
        alignItems: "center", justifyContent: "center",
        borderWidth: 2, borderColor: "rgba(255,255,255,0.35)",
        shadowColor: clr, shadowOpacity: isNight ? 0.9 : 0.4, shadowRadius: isNight ? 6 : 3, elevation: 4,
      }}>
        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>{ini}</Text>
      </View>
      <View style={{
        marginTop: 2, borderRadius: 4,
        backgroundColor: isNight ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.88)",
        paddingHorizontal: 4, paddingVertical: 1,
      }}>
        <Text style={{ fontSize: 8, fontWeight: "800", color: isNight ? clr : "#1e293b" }}>{nm}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Voiture animée ───────────────────────────────────────────────────────────
function Car({ color, roadYUnit, dir, speed }: {
  color: string; roadYUnit: number; dir: 1 | -1; speed: number;
}) {
  const posX = useRef(new Animated.Value(dir === 1 ? -32 : MAP_W + 32)).current;

  useEffect(() => {
    function drive() {
      posX.setValue(dir === 1 ? -32 : MAP_W + 32);
      Animated.timing(posX, {
        toValue: dir === 1 ? MAP_W + 32 : -32,
        duration: speed,
        useNativeDriver: false,
      }).start(() => setTimeout(drive, 1000 + Math.random() * 5000));
    }
    const t = setTimeout(drive, Math.random() * speed);
    return () => clearTimeout(t);
  }, []);

  const top = roadYUnit * S - 7;

  return (
    <Animated.View style={{
      position: "absolute", left: posX, top,
      width: 28, height: 14, borderRadius: 4,
      backgroundColor: color,
      shadowColor: color, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3,
      transform: [{ scaleX: dir }],
    }}>
      <View style={{ position:"absolute", right: 3, top: 2.5, width: 9, height: 7, backgroundColor:"rgba(200,235,255,0.6)", borderRadius: 2 }} />
      <View style={{ position:"absolute", left: 2, top: 4, width: 3, height: 3, backgroundColor:"#fffde7", borderRadius: 2 }} />
      <View style={{ position:"absolute", left: 2, bottom: 4, width: 3, height: 3, backgroundColor:"#fffde7", borderRadius: 2 }} />
    </Animated.View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function VillageMap({ currentSlug, onLocationPress }: {
  currentSlug: string;
  onLocationPress: (slug: string, label: string) => void;
}) {
  const { hour, minutes } = useTimeContext();
  const isNight = hour < 7 || hour >= 20;
  const pal = mkPal(isNight);

  const glowAnim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // routes (world units) pour voitures
  const R1 = 150; // route nord
  const R2 = 348; // route sud

  const timeStr = `${String(hour).padStart(2,"0")}:${String(minutes).padStart(2,"0")}`;

  return (
    <View style={{ width: MAP_W, height: MAP_H, overflow:"hidden", borderRadius: 20, alignSelf:"center", borderWidth:1, borderColor:"rgba(255,255,255,0.15)" }}>

      <Svg width={MAP_W} height={MAP_H}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={pal.skyA} />
            <Stop offset="1" stopColor={pal.skyB} />
          </LinearGradient>
          <LinearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={pal.road} stopOpacity="0.7" />
            <Stop offset="0.4" stopColor={pal.road} />
            <Stop offset="0.6" stopColor={pal.road} />
            <Stop offset="1"   stopColor={pal.road} stopOpacity="0.7" />
          </LinearGradient>
        </Defs>

        {/* ciel */}
        <Rect x={0} y={0} width={380*S} height={MAP_H} fill="url(#sky)" />

        {/* étoiles */}
        {isNight && [
          [28,10],[75,7],[128,16],[192,5],[248,13],[308,8],[358,11],
          [55,20],[152,4],[280,18],[342,7],[68,13],[222,9],
        ].map(([sx,sy],i) => (
          <Circle key={`s${i}`} cx={sx*S} cy={sy*S} r={1.3*S} fill="#fff" opacity={0.35 + (i%3)*0.2} />
        ))}

        {/* soleil / lune */}
        <Circle cx={354*S} cy={24*S} r={15*S} fill={pal.sun} opacity={0.92} />
        {isNight ? (
          <>
            <Circle cx={354*S} cy={24*S} r={26*S} fill={pal.sun} opacity={0.07} />
            <Circle cx={359*S} cy={19*S} r={4*S}  fill="rgba(0,0,0,0.12)" />
          </>
        ) : (
          [0,45,90,135].map((a,i) => {
            const rd = (a*Math.PI)/180;
            return <Line key={`ray${i}`}
              x1={354*S + Math.cos(rd)*18*S} y1={24*S + Math.sin(rd)*18*S}
              x2={354*S + Math.cos(rd)*26*S} y2={24*S + Math.sin(rd)*26*S}
              stroke="#fdd835" strokeWidth={2.5*S} strokeLinecap="round" opacity={0.65}
            />;
          })
        )}

        {/* terrain */}
        <Rect x={0} y={42*S}  width={380*S} height={140*S} fill={pal.ground} />
        <Rect x={0} y={200*S} width={380*S} height={130*S} fill={pal.ground} />
        <Rect x={0} y={352*S} width={380*S} height={170*S} fill={pal.ground} />

        {/* parc centre-droit */}
        <Rect x={172*S} y={200*S} width={202*S} height={130*S} fill={pal.park} rx={10*S} />
        {/* allée parc */}
        <Ellipse cx={273*S} cy={265*S} rx={62*S} ry={44*S}
          fill="transparent" stroke={pal.swalk} strokeWidth={4.5*S} />

        {/* marché centre-gauche */}
        <Rect x={5*S} y={200*S} width={162*S} height={130*S} fill={pal.swalk} rx={8*S} opacity={0.45} />

        {/* fontaine */}
        <Circle cx={273*S} cy={265*S} r={22*S} fill={pal.water} />
        <Circle cx={273*S} cy={265*S} r={14*S} fill={pal.wshim} opacity={0.7} />
        <Circle cx={273*S} cy={265*S} r={6*S}  fill={isNight?"#1a5f8a":"#90caf9"} />
        {[0,60,120,180,240,300].map((a,i) => {
          const rd=(a*Math.PI)/180;
          return <Line key={`jet${i}`}
            x1={273*S} y1={265*S}
            x2={273*S+Math.cos(rd)*11*S} y2={265*S+Math.sin(rd)*11*S}
            stroke={pal.wshim} strokeWidth={2*S} strokeLinecap="round" opacity={0.75}
          />;
        })}
        <SvgText x={273*S} y={293*S} textAnchor="middle"
          fill={isNight?"#60a5fa":"#1565c0"} fontSize={7.5*S} fontWeight="700">⛲ Fontaine</SvgText>

        {/* étals marché */}
        {[
          {x:15,y:210,w:44,h:30,c:"#e74c3c",t:"🥦 Légumes"},
          {x:68,y:210,w:44,h:30,c:"#f39c12",t:"🍎 Fruits"},
          {x:121,y:210,w:38,h:30,c:"#27ae60",t:"🌿 Bio"},
          {x:15,y:250,w:44,h:30,c:"#9b59b6",t:"👗 Mode"},
          {x:68,y:250,w:44,h:30,c:"#2980b9",t:"📱 Tech"},
          {x:121,y:250,w:38,h:30,c:"#c0392b",t:"🥖 Pain"},
        ].map((st,i) => (
          <G key={`stall${i}`}>
            <Rect x={st.x*S} y={st.y*S} width={st.w*S} height={st.h*S} fill={st.c+"28"} rx={3*S} />
            <Rect x={st.x*S} y={st.y*S} width={st.w*S} height={5*S}    fill={st.c}      rx={2*S} />
            <SvgText x={(st.x+st.w/2)*S} y={(st.y+st.h/2+5)*S}
              textAnchor="middle"
              fill={isNight?"#e2e8f0":"#1e293b"}
              fontSize={7*S} fontWeight="700">{st.t}</SvgText>
          </G>
        ))}

        {/* routes horizontales */}
        <Rect x={0} y={R1*S} width={380*S} height={26*S} fill="url(#roadGrad)" />
        <Rect x={0} y={R2*S} width={380*S} height={26*S} fill="url(#roadGrad)" />

        {/* lignes centre routes */}
        {[R1+13, R2+13].map((ly,ri) =>
          [0,22,44,66,88,110,132,154,176,198,220,242,264,286,308,330,352].map((lx,i) => (
            <Rect key={`rl${ri}-${i}`} x={lx*S} y={ly*S} width={16*S} height={2.5*S} fill={pal.roadL} opacity={0.7} />
          ))
        )}

        {/* routes verticales */}
        {[93, 185, 279].map((vx,i) => (
          <Rect key={`vr${i}`} x={vx*S} y={0} width={10*S} height={MAP_H} fill={pal.road} opacity={0.8} />
        ))}

        {/* trottoirs */}
        {[139,163,170,200,343,348,376,382].map((sy,i) => (
          <Rect key={`sw${i}`} x={0} y={sy*S} width={380*S} height={6*S} fill={pal.swalk} opacity={0.6} />
        ))}

        {/* arbres */}
        {[
          {x:222,y:215,r:8},{x:244,y:228,r:7},{x:220,y:248,r:8},{x:244,y:262,r:7},
          {x:221,y:276,r:7},{x:244,y:288,r:6},{x:360,y:220,r:7},{x:375,y:240,r:6},
          {x:358,y:260,r:8},{x:374,y:278,r:6},{x:360,y:295,r:7},
          {x:18,y:305,r:6},{x:35,y:316,r:7},{x:145,y:310,r:6},{x:160,y:300,r:7},
          {x:372,y:105,r:6},{x:358,y:118,r:7},{x:374,y:132,r:6},
        ].map((t,i) => (
          <Tree key={`tree${i}`} x={t.x} y={t.y} r={t.r} pal={pal} />
        ))}

        {/* lampadaires nuit */}
        {isNight && [96,188,282].map((lx,i) => (
          <G key={`lamp${i}`}>
            {[142, 340].map((ly,j) => (
              <G key={`lp${j}`}>
                <Rect x={(lx-1.5)*S} y={ly*S} width={3*S} height={14*S} fill="#64748b" />
                <Circle cx={lx*S} cy={ly*S} r={6*S}  fill="#fbbf24" opacity={0.95} />
                <Circle cx={lx*S} cy={ly*S} r={24*S} fill="#fbbf2415" />
              </G>
            ))}
          </G>
        ))}

        {/* bâtiments */}
        {BLDGS.map((b) => (
          <Building
            key={b.slug} b={b}
            isNight={isNight}
            isCurrent={currentSlug === b.slug}
            onPress={() => onLocationPress(b.slug, b.label)}
          />
        ))}
      </Svg>

      {/* NPCs animés */}
      {NPCS.map((n, i) => (
        <NpcChar key={n.id} nm={n.nm} clr={n.clr} ini={n.ini}
          roadY={n.ry} isNight={isNight} delay={i * 400} />
      ))}

      {/* Voitures */}
      <Car color="#3498db" roadYUnit={R1+5}  dir={1}  speed={8500}  />
      <Car color="#e74c3c" roadYUnit={R1+16} dir={-1} speed={10500} />
      <Car color="#2ecc71" roadYUnit={R2+5}  dir={1}  speed={9200}  />
      <Car color="#f39c12" roadYUnit={R2+16} dir={-1} speed={7800}  />

      {/* Badge heure */}
      <View style={{
        position:"absolute", top:10, left:12,
        backgroundColor: isNight ? "rgba(7,17,31,0.88)" : "rgba(255,255,255,0.88)",
        borderRadius:12, paddingHorizontal:12, paddingVertical:7,
        flexDirection:"row", alignItems:"center", gap:8,
        borderWidth:1, borderColor: isNight ? "rgba(251,191,36,0.35)" : "rgba(59,130,246,0.35)",
        shadowColor: isNight ? "#fbbf24" : "#3b82f6", shadowOpacity:0.35, shadowRadius:8, elevation:4,
      }}>
        <Text style={{ fontSize:16 }}>{isNight ? "🌙" : "☀️"}</Text>
        <View>
          <Text style={{ color: isNight ? "#fbbf24" : "#1e40af", fontSize:13, fontWeight:"900" }}>{timeStr}</Text>
          <Text style={{ color: isNight ? "#94a3b8" : "#475569", fontSize:9, fontWeight:"700" }}>
            {isNight ? "Mode nuit" : "Mode jour"}
          </Text>
        </View>
      </View>

      {/* Badge lieu courant */}
      {(() => {
        const b = BLDGS.find(b => b.slug === currentSlug);
        if (!b) return null;
        return (
          <View style={{
            position:"absolute", top:10, right:12,
            backgroundColor:"rgba(56,199,147,0.15)",
            borderRadius:12, paddingHorizontal:10, paddingVertical:7,
            flexDirection:"row", alignItems:"center", gap:6,
            borderWidth:1, borderColor:"rgba(56,199,147,0.45)",
          }}>
            <Text style={{ fontSize:14 }}>{b.em}</Text>
            <Text style={{ color:"#38c793", fontSize:11, fontWeight:"800" }}>{b.label}</Text>
          </View>
        );
      })()}
    </View>
  );
}
