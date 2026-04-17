/**
 * World Live — Carte Urbaine Immersive "Neo Paris"
 *
 * Carte plein écran avec :
 * - Grille de rues nommées (3 horizontales × 3 verticales)
 * - 8 lieux jouables + bâtiments décoratifs (18 bâtiments total)
 * - Fenêtres éclairées, enseignes néon, arbres, fontaine, lampadaires
 * - NPCs animés avec badge niveau, barre XP, action icône
 * - Voitures animées sur les grands boulevards
 * - Joueur déplaçable (tap sur la carte)
 * - Bulle de dialogue auto quand proximité NPC
 * - Toast live quand NPC envoie un message
 * - Panel NPC : chat en direct, stats, invitation activités
 */

import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, Dimensions, Easing,
  KeyboardAvoidingView, Platform,
  Pressable, ScrollView, Text, TextInput, View
} from "react-native";

import { AvatarSprite } from "@/components/avatar-sprite";
import { ACTION_LABELS, getAvatarVisual, getNpcVisual } from "@/lib/avatar-visual";
import {
  getNpcActivityResponse, getNpcDialogue, getNpcEmoteReaction,
  PROPOSABLE_ACTIVITIES, QUICK_EMOTES
} from "@/lib/npc-dialogue";
import { colors } from "@/lib/theme";
import type { NpcState } from "@/lib/types";
import { useGameStore } from "@/stores/game-store";

// ─── Dimensions ───────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get("window");
const MAP_W = SW;
const MAP_H = Math.round(SH * 0.68);    // 68% = carte immersive
const SX    = MAP_W / 390;              // scale X depuis la ref 390px
const SY    = MAP_H / 590;              // scale Y depuis la ref 590px

// ─── Couleurs urbaines ────────────────────────────────────────────────────────
const C = {
  sky:      "#050c16",
  road:     "#131c2a",
  roadM:    "#1e2840",
  sidewalk: "#1a2238",
  roadLine: "rgba(251,191,36,0.35)",
  grass:    "#071408",
  water:    "#061824",
  lamp:     "#ffd700",
};

// ─── Grille de rues (référence 390×590) ───────────────────────────────────────
const RAW_STREETS = [
  // horizontales
  { x:0,   y:175, w:390, h:25, major:true,  name:"Boulevard Central" },
  { x:0,   y:300, w:390, h:28, major:true,  name:"Avenue de la République" },
  { x:0,   y:432, w:390, h:22, major:false, name:"Rue du Parc" },
  // verticales
  { x:120, y:0,   w:22,  h:590, major:false, name:"Rue Ouest" },
  { x:260, y:0,   w:25,  h:590, major:true,  name:"Avenue Principale" },
];

// ─── Bâtiments (référence 390×590) ───────────────────────────────────────────
type BuildingDef = {
  id: string; label: string; emoji: string;
  slug?: string;   // lieu jouable
  x:number; y:number; w:number; h:number;
  color: string;
  floors: number; winCols: number;
  deco?: boolean;  // décoratif, non interactif
};

const RAW_BUILDINGS: BuildingDef[] = [
  // ── Bloc NW (0-120 × 0-175) — Résidences ──────────────────────────────────
  { id:"home",   label:"Résidences", emoji:"🏠", slug:"home",
    x:8,  y:8,  w:104, h:159, color:"#1e3a5c", floors:5, winCols:3 },

  // ── Bloc NM (142-260 × 0-175) — Commerce ──────────────────────────────────
  { id:"market", label:"Marché Couvert", emoji:"🛒", slug:"market",
    x:148, y:8, w:104, h:100, color:"#0d5f45", floors:2, winCols:4 },
  { id:"market_deco", label:"Épicerie Fine", emoji:"🧺",
    x:148, y:116, w:104, h:51, color:"#0d4a38", floors:1, winCols:4, deco:true },

  // ── Bloc NE (285-390 × 0-175) — Bureau ────────────────────────────────────
  { id:"office", label:"Tour Affaires", emoji:"💼", slug:"office",
    x:285, y:8, w:97, h:159, color:"#1a3a6a", floors:6, winCols:3 },

  // ── Bloc CW (0-120 × 200-300) — Café ──────────────────────────────────────
  { id:"cafe",   label:"Café Social", emoji:"☕", slug:"cafe",
    x:8,   y:200, w:104, h:92, color:"#7a3a0a", floors:2, winCols:3 },

  // ── Bloc CC (142-260 × 200-300) — Place Centrale ──────────────────────────
  // (fontaine au centre — pas de bâtiment)
  { id:"boulangerie", label:"Boulangerie", emoji:"🥐",
    x:148, y:200, w:50,  h:92, color:"#5c3a10", floors:2, winCols:2, deco:true },
  { id:"tabac",       label:"Tabac Presse", emoji:"📰",
    x:206, y:200, w:46,  h:92, color:"#2a1a0a", floors:2, winCols:2, deco:true },

  // ── Bloc CE (285-390 × 200-300) — Restaurant ──────────────────────────────
  { id:"restaurant", label:"Restaurant", emoji:"🍽️", slug:"restaurant",
    x:285, y:200, w:97, h:92, color:"#5c1a1a", floors:2, winCols:4 },

  // ── Bloc SW (0-120 × 325-432) — Parc ──────────────────────────────────────
  { id:"park",   label:"Parc Riverside", emoji:"🌳", slug:"park",
    x:8,   y:325, w:104, h:99, color:"#071a07", floors:0, winCols:0 },

  // ── Bloc SM (142-260 × 325-432) — Gym ─────────────────────────────────────
  { id:"gym",    label:"Gym Pulse", emoji:"💪", slug:"gym",
    x:148, y:325, w:104, h:99, color:"#6b1515", floors:2, winCols:4 },

  // ── Bloc SE (285-390 × 325-432) — Cinéma ──────────────────────────────────
  { id:"cinema", label:"Cinéma Luma", emoji:"🎬", slug:"cinema",
    x:285, y:325, w:97, h:99, color:"#0d0d2a", floors:3, winCols:5 },

  // ── Bande du bas (0-390 × 454-590) — Vie nocturne ─────────────────────────
  { id:"club",   label:"Club Nuit", emoji:"🎵", slug:"club",
    x:148, y:454, w:104, h:128, color:"#2a0a4a", floors:3, winCols:4 },
  { id:"hotel",  label:"Hôtel Lumière", emoji:"🏨",
    x:285, y:454, w:97,  h:128, color:"#1a3a4a", floors:4, winCols:4, deco:true },
  { id:"garage", label:"Parking Couvert", emoji:"🅿️",
    x:8,   y:454, w:104, h:128, color:"#111a22", floors:2, winCols:5, deco:true },
];

// ─── Lampadaires (référence 390×590) ─────────────────────────────────────────
const RAW_LAMPS = [
  {x:118, y:172}, {x:258, y:172}, {x:388, y:172},
  {x:8,   y:172}, {x:118, y:297}, {x:258, y:297},
  {x:388, y:297}, {x:8,   y:297}, {x:118, y:429},
  {x:258, y:429}, {x:388, y:429}, {x:8,   y:429},
  {x:118, y:8  }, {x:258, y:8  }, {x:118, y:454},
  {x:258, y:454},
];

// ─── Arbres (référence 390×590) ───────────────────────────────────────────────
const RAW_TREES = [
  // Parc
  {x:22,  y:335, r:12}, {x:48,  y:350, r:14}, {x:75,  y:338, r:11},
  {x:30,  y:368, r:10}, {x:62,  y:378, r:13}, {x:90,  y:360, r:11},
  {x:18,  y:395, r:9 }, {x:50,  y:408, r:12}, {x:80,  y:392, r:10},
  // Bordures de rue
  {x:130, y:12,  r:7 }, {x:130, y:55,  r:7 }, {x:130, y:98,  r:7 }, {x:130, y:141, r:7 },
  {x:270, y:12,  r:7 }, {x:270, y:55,  r:7 }, {x:270, y:98,  r:7 }, {x:270, y:141, r:7 },
  {x:270, y:210, r:7 }, {x:270, y:250, r:7 }, {x:270, y:290, r:7 },
  {x:130, y:210, r:7 }, {x:130, y:250, r:7 }, {x:130, y:290, r:7 },
  // Bas de carte
  {x:130, y:465, r:7 }, {x:130, y:510, r:7 }, {x:130, y:555, r:7 },
  {x:270, y:465, r:7 }, {x:270, y:510, r:7 }, {x:270, y:555, r:7 },
];

// ─── Voitures (sens de circulation) ──────────────────────────────────────────
type CarDef = { id:string; axis:"h"|"v"; lane:number; dir:1|-1; speed:number; color:string };
const CARS: CarDef[] = [
  { id:"c1", axis:"h", lane:183, dir: 1, speed:8000, color:"#3498db" },
  { id:"c2", axis:"h", lane:196, dir:-1, speed:9500, color:"#e74c3c" },
  { id:"c3", axis:"h", lane:308, dir: 1, speed:7500, color:"#f39c12" },
  { id:"c4", axis:"h", lane:321, dir:-1, speed:11000,color:"#8e44ad" },
  { id:"c5", axis:"v", lane:128, dir: 1, speed:9000, color:"#27ae60" },
  { id:"c6", axis:"v", lane:142, dir:-1, speed:10500,color:"#e67e22" },
  { id:"c7", axis:"v", lane:268, dir: 1, speed:8500, color:"#1abc9c" },
  { id:"c8", axis:"v", lane:281, dir:-1, speed:9800, color:"#c0392b" },
];

// ─── Helpers de scaling ───────────────────────────────────────────────────────
function sc(b: BuildingDef): BuildingDef {
  return { ...b, x: b.x*SX, y: b.y*SY, w: b.w*SX, h: b.h*SY };
}
function sp(x:number, y:number) { return { x: x*SX, y: y*SY }; }
function pct(px:number, py:number) { return { x:(px/100)*MAP_W, y:(py/100)*MAP_H }; }

// Jitter déterministe par NPC id
function npcJitter(id:string): {dx:number;dy:number} {
  const h = id.split("").reduce((a,c) => a*31 + c.charCodeAt(0), 0);
  return { dx: ((h % 30)-15)*SX, dy: (((h*7)%30)-15)*SY };
}

function shadeHex(hex:string, amt:number): string {
  const n = parseInt(hex.slice(1),16);
  const r = Math.max(0,Math.min(255,(n>>16)+amt));
  const g = Math.max(0,Math.min(255,((n>>8)&0xff)+amt));
  const b = Math.max(0,Math.min(255,(n&0xff)+amt));
  return `rgb(${r},${g},${b})`;
}

// ─── Composant Lampadaire ─────────────────────────────────────────────────────
function Lamp({ x, y }: {x:number; y:number}) {
  const glow = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glow,{toValue:1,  duration:2400, useNativeDriver:true}),
      Animated.timing(glow,{toValue:0.5,duration:2400, useNativeDriver:true}),
    ])).start();
  }, []);
  return (
    <View style={{ position:"absolute", left:x*SX-1, top:y*SY-6 }}>
      <View style={{ width:2, height:8, backgroundColor:"#555", alignSelf:"center" }} />
      <Animated.View style={{
        width:6, height:6, borderRadius:3,
        backgroundColor: C.lamp,
        opacity: glow,
        shadowColor: C.lamp, shadowOpacity:0.9, shadowRadius:8,
      }} />
    </View>
  );
}

// ─── Composant Arbre ──────────────────────────────────────────────────────────
function Tree({ x, y, r }: {x:number;y:number;r:number}) {
  const sx = x*SX, sy = y*SY, sr = r*Math.min(SX,SY);
  return (
    <View style={{ position:"absolute", left:sx-sr*1.1, top:sy-sr*1.1 }}>
      {/* Ombre */}
      <View style={{ position:"absolute", left:sr*0.2, top:sr*1.5,
        width:sr*2, height:sr*0.7, borderRadius:sr, backgroundColor:"rgba(0,0,0,0.3)" }} />
      {/* Tronc */}
      <View style={{ position:"absolute", left:sr*0.85, top:sr*1.3,
        width:sr*0.3, height:sr*0.8, backgroundColor:"#3d2010" }} />
      {/* Feuillage 3 couches */}
      <View style={{ position:"absolute", left:sr*0.1, top:sr*0.5,
        width:sr*2, height:sr*1.6, borderRadius:sr, backgroundColor:"#0c2a0c" }} />
      <View style={{ position:"absolute", left:sr*0.3, top:sr*0.1,
        width:sr*1.6, height:sr*1.4, borderRadius:sr, backgroundColor:"#0f3a0f" }} />
      <View style={{ position:"absolute", left:sr*0.55, top:0,
        width:sr*1.1, height:sr*1.1, borderRadius:sr, backgroundColor:"#163616" }} />
    </View>
  );
}

// ─── Composant Voiture animée ─────────────────────────────────────────────────
function AnimatedCar({ car }: { car: CarDef }) {
  const pos = useRef(new Animated.Value(car.dir === 1 ? -20 : MAP_W + 20)).current;
  const end = car.dir === 1 ? (car.axis==="h" ? MAP_W+20 : MAP_H+20)
                             : -20;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pos, {
        toValue: end,
        duration: car.speed,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      Animated.timing(pos, { toValue: car.dir===1 ? -20 : MAP_W+20, duration: 0, useNativeDriver:false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const y = car.lane * SY;
  const x = car.lane * SX;
  const carW = 12*SX, carH = 7*SY;
  return car.axis === "h" ? (
    <Animated.View style={{
      position:"absolute", top: y-carH/2, left: pos,
      width:carW, height:carH, borderRadius:2, backgroundColor:car.color,
      shadowColor:car.color, shadowOpacity:0.6, shadowRadius:3,
    }} />
  ) : (
    <Animated.View style={{
      position:"absolute", left: x-carH/2, top: pos,
      width:carH, height:carW, borderRadius:2, backgroundColor:car.color,
      shadowColor:car.color, shadowOpacity:0.6, shadowRadius:3,
    }} />
  );
}

// ─── Composant Fontaine centrale ──────────────────────────────────────────────
function Fountain() {
  const pulse = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:1.1,duration:1200,useNativeDriver:true}),
      Animated.timing(pulse,{toValue:0.8,duration:1200,useNativeDriver:true}),
    ])).start();
  }, []);
  const cx = 195*SX, cy = 248*SY;
  const r  = 22*Math.min(SX,SY);
  return (
    <View style={{ position:"absolute", left:cx-r*1.4, top:cy-r*1.4 }}>
      {/* Bassin extérieur */}
      <View style={{ width:r*2.8, height:r*2.8, borderRadius:r*1.4,
        backgroundColor:"#061824", borderWidth:1.5, borderColor:"#0a3a5a",
        alignItems:"center", justifyContent:"center" }}>
        {/* Eau */}
        <View style={{ width:r*2, height:r*2, borderRadius:r,
          backgroundColor:"#061e30", alignItems:"center", justifyContent:"center" }}>
          {/* Jet central animé */}
          <Animated.View style={{ width:r*0.5, height:r*0.5, borderRadius:r*0.25,
            backgroundColor:"#1a6a9a", transform:[{scale:pulse}],
            shadowColor:"#4fc3f7", shadowOpacity:0.8, shadowRadius:6 }} />
        </View>
      </View>
      {/* Label */}
      <Text style={{ position:"absolute", bottom:-12*SY, left:0, right:0,
        textAlign:"center", color:"#4fc3f7", fontSize:6*Math.min(SX,SY), fontWeight:"800" }}>
        ⛲ Place
      </Text>
    </View>
  );
}

// ─── Composant Bâtiment ───────────────────────────────────────────────────────
function BuildingView({ b, isHere, onPress }: {
  b: BuildingDef; isHere: boolean; onPress?: () => void;
}) {
  const sb = sc(b);
  const glow = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    if (isHere) {
      Animated.loop(Animated.sequence([
        Animated.timing(glow,{toValue:1,   duration:900,  useNativeDriver:true}),
        Animated.timing(glow,{toValue:0.7, duration:900,  useNativeDriver:true}),
      ])).start();
    } else {
      glow.setValue(0.75);
    }
  }, [isHere]);

  // Parc = zone verte
  if (b.id === "park") {
    return (
      <Pressable onPress={onPress} style={{ position:"absolute",
        left:sb.x, top:sb.y, width:sb.w, height:sb.h,
        backgroundColor:"#071a07", borderRadius:4,
        borderWidth:isHere?1.5:0.5, borderColor:isHere?"#38c793":"#0f3a0f",
        overflow:"hidden" }}>
        {/* Allée centrale */}
        <View style={{ position:"absolute", left:sb.w*0.4, top:0, width:8*SX, height:sb.h,
          backgroundColor:"#0f2208" }} />
        <View style={{ position:"absolute", top:sb.h*0.5, left:0, width:sb.w, height:6*SY,
          backgroundColor:"#0f2208" }} />
        {/* Label */}
        <View style={{ position:"absolute", bottom:4*SY, left:0, right:0, alignItems:"center" }}>
          <Text style={{ fontSize:7*SX, color:"#38c793", fontWeight:"800" }}>🌳 {b.label}</Text>
        </View>
        {isHere && (
          <View style={{ position:"absolute", top:4*SY, right:4*SX,
            backgroundColor:"#38c793", borderRadius:4, paddingHorizontal:3 }}>
            <Text style={{ color:"#07111f", fontSize:6*SX, fontWeight:"900" }}>ICI</Text>
          </View>
        )}
      </Pressable>
    );
  }

  // Fenêtres éclairées (pattern déterministe par bâtiment)
  const hash = b.id.split("").reduce((a,c)=>a*31+c.charCodeAt(0),0);
  const winW = b.floors > 0 ? (sb.w - 8*SX) / b.winCols - 2*SX : 0;
  const roofH = sb.h * 0.14;
  const groundH = sb.h * 0.18;
  const floorH = b.floors > 0 ? (sb.h - roofH - groundH) / b.floors : 0;

  return (
    <Animated.View style={{ position:"absolute", left:sb.x, top:sb.y,
      width:sb.w, height:sb.h, opacity:glow,
      shadowColor:b.color, shadowOpacity:isHere?0.8:0.3, shadowRadius:isHere?14:6,
      elevation:isHere?10:3 }}>
      <Pressable onPress={onPress} style={{ flex:1 }}>
        <View style={{ flex:1, backgroundColor:b.color, borderRadius:4,
          borderWidth:isHere?1.5:0.5,
          borderColor:isHere?b.color+"ff":b.color+"60",
          overflow:"hidden" }}>

          {/* Toit */}
          <View style={{ height:roofH, backgroundColor:shadeHex(b.color,-20),
            borderBottomWidth:0.5, borderColor:"rgba(255,255,255,0.08)" }} />

          {/* Étages + fenêtres */}
          {b.floors > 0 && Array.from({length:b.floors}, (_,f) => (
            <View key={f} style={{ height:floorH, flexDirection:"row",
              paddingHorizontal:3*SX, paddingVertical:1.5*SY, gap:2*SX,
              borderBottomWidth:0.5, borderColor:"rgba(0,0,0,0.3)" }}>
              {Array.from({length:b.winCols}, (_,w) => {
                const lit = ((hash + f*7 + w*3 + 1) % 5) > 0;
                const warm = ((hash + f*5 + w*11) % 3) === 0;
                return (
                  <View key={w} style={{ flex:1, borderRadius:1,
                    backgroundColor: lit
                      ? (warm ? "rgba(255,190,60,0.75)" : "rgba(200,230,255,0.55)")
                      : "rgba(0,0,0,0.65)" }} />
                );
              })}
            </View>
          ))}

          {/* Rez-de-chaussée */}
          <View style={{ height:groundH, backgroundColor:shadeHex(b.color,-25),
            borderTopWidth:0.5, borderColor:"rgba(255,255,255,0.12)",
            flexDirection:"row", alignItems:"center",
            justifyContent:"center", gap:3*SX, paddingHorizontal:3*SX }}>
            <Text style={{ fontSize:Math.max(7, 9*SX) }}>{b.emoji}</Text>
            {sb.w > 50 && (
              <Text style={{ color:shadeHex(b.color,80), fontSize:Math.max(4,6*SX),
                fontWeight:"800", textTransform:"uppercase" }} numberOfLines={1}>
                {b.label}
              </Text>
            )}
          </View>

          {/* Badge "ICI" */}
          {isHere && (
            <View style={{ position:"absolute", top:3*SY, right:3*SX,
              backgroundColor:b.color, borderRadius:5, paddingHorizontal:4, paddingVertical:1,
              borderWidth:1, borderColor:"rgba(255,255,255,0.5)" }}>
              <Text style={{ color:"#fff", fontSize:6*SX, fontWeight:"900" }}>ICI</Text>
            </View>
          )}

          {/* Enseigne néon sur certains bâtiments */}
          {(b.id==="club" || b.id==="cinema" || b.id==="cafe") && (
            <View style={{ position:"absolute", top:roofH+2*SY, left:3*SX, right:3*SX,
              backgroundColor:"rgba(0,0,0,0.6)", borderRadius:3, alignItems:"center", paddingVertical:1 }}>
              <Text style={{ fontSize:Math.max(5,6*SX), color:
                b.id==="club"?"#c084fc": b.id==="cinema"?"#4fc3f7":"#f6b94f",
                fontWeight:"900", letterSpacing:0.5 }}>
                {b.id==="club"?"◉ OPEN 24H":b.id==="cinema"?"▶ SÉANCE EN COURS":"OUVERT"}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Noms des rues ─────────────────────────────────────────────────────────────
function StreetLabel({ name, x, y, vertical=false }:{name:string;x:number;y:number;vertical?:boolean}) {
  return (
    <View style={{ position:"absolute", left:x*SX, top:y*SY,
      transform: vertical ? [{rotate:"-90deg"}] : [] }}>
      <Text style={{ color:"rgba(255,255,255,0.18)", fontSize:Math.max(5,6*SX),
        fontWeight:"700", letterSpacing:0.5 }}>{name}</Text>
    </View>
  );
}

// ─── NPC animé sur la carte ───────────────────────────────────────────────────
const ACTION_ICON: Record<string,string> = {
  sleeping:"😴", eating:"🍽️", chatting:"💬", exercising:"💪",
  walking:"🚶", working:"💼", idle:"💭"
};

function LiveNpc({ npc, onPress }: { npc:NpcState; onPress:()=>void }) {
  const visual   = getNpcVisual(npc.id);
  const tgt      = useMemo(() => {
    const base = pct(npc.posX, npc.posY);
    const j    = npcJitter(npc.id);
    return { x: base.x + j.dx, y: base.y + j.dy };
  }, [npc.locationSlug]);

  const anim      = useRef(new Animated.ValueXY({ x: tgt.x, y: tgt.y })).current;
  const prev      = useRef({ x: tgt.x, y: tgt.y });
  const levelAnim = useRef(new Animated.Value(1)).current;
  const prevLevel = useRef(npc.level);

  useEffect(() => {
    if (Math.abs(prev.current.x-tgt.x)>2 || Math.abs(prev.current.y-tgt.y)>2) {
      prev.current = tgt;
      Animated.timing(anim, {
        toValue: tgt, duration:1200,
        easing: Easing.inOut(Easing.cubic), useNativeDriver:false,
      }).start();
    }
  }, [tgt.x, tgt.y]);

  useEffect(() => {
    if (npc.level > prevLevel.current) {
      prevLevel.current = npc.level;
      Animated.sequence([
        Animated.spring(levelAnim,{toValue:1.8,useNativeDriver:true,bounciness:20}),
        Animated.spring(levelAnim,{toValue:1,  useNativeDriver:true}),
      ]).start();
    }
  }, [npc.level]);

  const moodColor = npc.mood>65 ? "#38c793" : npc.mood>35 ? "#f39c12" : "#e74c3c";
  const lvlColor  = npc.level>=4 ? "#c084fc" : npc.level>=2 ? "#f6b94f" : "#38c793";
  const icon      = ACTION_ICON[npc.action] ?? "•";

  return (
    <Animated.View style={{ position:"absolute",
      transform:[
        {translateX: Animated.add(anim.x, new Animated.Value(-18*SX))},
        {translateY: Animated.add(anim.y, new Animated.Value(-40*SY))},
      ], zIndex:20 }}>
      <Pressable onPress={onPress}>
        {/* Bordure humeur */}
        <View style={{ borderWidth:2, borderColor:moodColor, borderRadius:20,
          shadowColor:moodColor, shadowOpacity:0.5, shadowRadius:6 }}>
          <AvatarSprite visual={visual} action={npc.action} size="xs" />
        </View>
        {/* Badge niveau */}
        <Animated.View style={{ position:"absolute", top:-5, right:-5,
          backgroundColor:lvlColor, borderRadius:6, paddingHorizontal:3,
          transform:[{scale:levelAnim}], borderWidth:0.5, borderColor:"rgba(0,0,0,0.4)" }}>
          <Text style={{ color:"#07111f", fontSize:Math.max(5,6*SX), fontWeight:"900" }}>
            {npc.level}
          </Text>
        </Animated.View>
        {/* Nom + action */}
        <View style={{ backgroundColor:"rgba(0,0,0,0.78)", borderRadius:5,
          paddingHorizontal:3, paddingVertical:1,
          flexDirection:"row", alignItems:"center", gap:1 }}>
          <Text style={{ fontSize:Math.max(6,7*SX) }}>{icon}</Text>
          <Text style={{ color:"#fff", fontSize:Math.max(6,7*SX), fontWeight:"700" }}>
            {npc.name.split(" ")[0]}
          </Text>
        </View>
        {/* Micro barre XP */}
        <View style={{ height:2, borderRadius:1, backgroundColor:"rgba(255,255,255,0.1)",
          overflow:"hidden", marginTop:1, width:36*SX }}>
          <View style={{ height:2, width:`${npc.xp%100}%`, backgroundColor:lvlColor }} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Avatar joueur ─────────────────────────────────────────────────────────────
function PlayerDot({ posX, posY, visual }: {
  posX:number; posY:number; visual:ReturnType<typeof getAvatarVisual>;
}) {
  const pos  = pct(posX, posY);
  const anim = useRef(new Animated.ValueXY({x:pos.x, y:pos.y})).current;
  const prev = useRef({x:pos.x, y:pos.y});

  useEffect(() => {
    if (Math.abs(prev.current.x-pos.x)>1 || Math.abs(prev.current.y-pos.y)>1) {
      prev.current = pos;
      Animated.timing(anim,{toValue:pos, duration:500,
        easing:Easing.out(Easing.quad), useNativeDriver:false}).start();
    }
  }, [posX, posY]);

  return (
    <Animated.View style={{ position:"absolute", zIndex:30,
      transform:[
        {translateX: Animated.add(anim.x, new Animated.Value(-18*SX))},
        {translateY: Animated.add(anim.y, new Animated.Value(-44*SY))},
      ]}}>
      <View style={{ borderWidth:2.5, borderColor:colors.accent, borderRadius:22,
        shadowColor:colors.accent, shadowOpacity:0.8, shadowRadius:12 }}>
        <AvatarSprite visual={visual} action="idle" size="xs" />
      </View>
      <View style={{ backgroundColor:colors.accent, borderRadius:4, alignItems:"center",
        marginTop:2, paddingHorizontal:4 }}>
        <Text style={{ color:"#07111f", fontSize:7*SX, fontWeight:"900" }}>TOI</Text>
      </View>
    </Animated.View>
  );
}

// ─── Bulle de dialogue ─────────────────────────────────────────────────────────
function Bubble({ text, posX, posY }:{text:string;posX:number;posY:number}) {
  const fade = useRef(new Animated.Value(0)).current;
  const pos  = pct(posX, posY);
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fade,{toValue:1,duration:220,useNativeDriver:true}),
      Animated.delay(2800),
      Animated.timing(fade,{toValue:0,duration:400,useNativeDriver:true}),
    ]).start();
  }, [text]);
  const bx = Math.max(4, Math.min(MAP_W-140, pos.x-55*SX));
  const by = Math.max(2, pos.y-50*SY);
  return (
    <Animated.View pointerEvents="none" style={{
      position:"absolute", left:bx, top:by,
      opacity:fade, maxWidth:140*SX, zIndex:40,
      backgroundColor:"rgba(255,255,255,0.95)", borderRadius:10,
      paddingHorizontal:8*SX, paddingVertical:5*SY,
    }}>
      <Text style={{ color:"#07111f", fontSize:Math.max(9,11*SX), fontWeight:"600" }} numberOfLines={3}>{text}</Text>
      <View style={{ position:"absolute", bottom:-5, left:14*SX,
        borderLeftWidth:5, borderRightWidth:5, borderTopWidth:6,
        borderLeftColor:"transparent", borderRightColor:"transparent",
        borderTopColor:"rgba(255,255,255,0.95)" }} />
    </Animated.View>
  );
}

// ─── Toast notification ────────────────────────────────────────────────────────
type ToastItem = {id:string; npcName:string; emoji:string; text:string};
function LiveToast({ toast }:{toast:ToastItem}) {
  const y   = useRef(new Animated.Value(-60)).current;
  const op  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(y,{toValue:0,useNativeDriver:true,tension:80}),
        Animated.timing(op,{toValue:1,duration:300,useNativeDriver:true}),
      ]),
      Animated.delay(3500),
      Animated.parallel([
        Animated.timing(y,{toValue:-60,duration:400,useNativeDriver:true}),
        Animated.timing(op,{toValue:0,duration:400,useNativeDriver:true}),
      ]),
    ]).start();
  }, [toast.id]);
  return (
    <Animated.View pointerEvents="none" style={{
      position:"absolute", top:8, left:12, right:12, zIndex:100,
      opacity:op, transform:[{translateY:y}],
      backgroundColor:"rgba(7,17,31,0.94)", borderRadius:14,
      borderWidth:1, borderColor:colors.accent+"60",
      flexDirection:"row", alignItems:"center", gap:10,
      paddingHorizontal:14, paddingVertical:11,
    }}>
      <Text style={{fontSize:22}}>{toast.emoji}</Text>
      <View style={{flex:1}}>
        <Text style={{color:colors.accent,fontWeight:"800",fontSize:12}}>{toast.npcName}</Text>
        <Text style={{color:colors.text,fontSize:11}} numberOfLines={1}>{toast.text}</Text>
      </View>
      <View style={{width:8,height:8,borderRadius:4,backgroundColor:"#38c793"}} />
    </Animated.View>
  );
}

// ─── Panel NPC (bottom sheet) ─────────────────────────────────────────────────
type ChatLine = {id:string; from:"player"|"npc"; text:string};

function NpcPanel({ npc, onClose, onBubble }:{
  npc:NpcState; onClose:()=>void;
  onBubble:(id:string,text:string)=>void;
}) {
  const visual = getNpcVisual(npc.id);
  const [chat, setChat] = useState<ChatLine[]>([{
    id:"greeting", from:"npc",
    text: getNpcDialogue(npc.id, npc.action, npc.mood, "greeting"),
  }]);
  const [input, setInput]   = useState("");
  const [tab,   setTab]     = useState<"chat"|"stats"|"activités">("chat");
  const scrollRef           = useRef<ScrollView>(null);
  const sheetY              = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    Animated.spring(sheetY,{toValue:0,useNativeDriver:true,tension:70,friction:12}).start();
  }, []);

  const moodColor = npc.mood>65?"#38c793":npc.mood>35?"#f39c12":"#e74c3c";
  const lvlColor  = npc.level>=4?"#c084fc":npc.level>=2?"#f6b94f":"#38c793";

  const addLine = (from:"player"|"npc", text:string) => {
    setChat(p=>[...p,{id:`${Date.now()}-${Math.random()}`,from,text}]);
    if (from==="npc") onBubble(npc.id, text);
    setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),80);
  };

  const send = () => {
    const t = input.trim(); if (!t) return;
    setInput("");
    addLine("player", t);
    setTimeout(()=>{
      const busy = npc.action==="sleeping" || npc.energy < 20;
      addLine("npc", getNpcDialogue(npc.id, npc.action, npc.mood, busy?"busy":"topic"));
    }, 500+Math.random()*600);
  };

  const sendEmote = (e:string) => {
    addLine("player",e);
    setTimeout(()=>addLine("npc",getNpcEmoteReaction(npc.id,e)), 500);
  };

  const propose = (slug:string) => {
    const act = PROPOSABLE_ACTIVITIES.find(a=>a.slug===slug);
    if (!act) return;
    setTab("chat");
    addLine("player",`${act.emoji} Je te propose : ${act.label} !`);
    setTimeout(()=>{
      const {accepted,line} = getNpcActivityResponse(npc.id,npc,slug);
      addLine("npc",line);
      if (accepted) setTimeout(()=>addLine("npc",`On se retrouve à ${act.locationSlug} ?`),800);
    },700);
  };

  return (
    <Animated.View style={{ transform:[{translateY:sheetY}],
      backgroundColor:"#0b1828", borderTopLeftRadius:22, borderTopRightRadius:22,
      borderTopWidth:1, borderColor:"rgba(255,255,255,0.1)", maxHeight:420 }}>
      {/* Handle */}
      <View style={{alignItems:"center",paddingTop:10,paddingBottom:4}}>
        <View style={{width:36,height:4,borderRadius:2,backgroundColor:"rgba(255,255,255,0.2)"}} />
      </View>

      {/* Header */}
      <View style={{flexDirection:"row",alignItems:"center",paddingHorizontal:16,paddingBottom:10,gap:12}}>
        <View style={{position:"relative"}}>
          <View style={{borderWidth:2,borderColor:moodColor,borderRadius:22}}>
            <AvatarSprite visual={visual} action={npc.action} size="sm" />
          </View>
          <View style={{position:"absolute",top:-4,right:-4,
            backgroundColor:lvlColor,borderRadius:7,paddingHorizontal:4,paddingVertical:1}}>
            <Text style={{color:"#07111f",fontSize:8,fontWeight:"900"}}>Nv{npc.level}</Text>
          </View>
        </View>
        <View style={{flex:1,gap:2}}>
          <Text style={{color:colors.text,fontWeight:"800",fontSize:15}}>{npc.name}</Text>
          <Text style={{color:colors.muted,fontSize:11}}>
            {ACTION_ICON[npc.action]} {ACTION_LABELS[npc.action]} · {npc.mood}% humeur
          </Text>
          {/* XP bar */}
          <View style={{height:3,borderRadius:2,backgroundColor:"rgba(255,255,255,0.08)"}}>
            <View style={{height:3,width:`${npc.xp%100}%`,borderRadius:2,backgroundColor:lvlColor}} />
          </View>
        </View>
        {/* Mini stats */}
        <View style={{gap:3}}>
          {[["⚡",`${npc.energy}%`,"#3498db"],["💰",`${npc.money}cr`,"#f6b94f"],["🔥",`${npc.streak}j`,"#e74c3c"]].map(([e,v,c])=>(
            <View key={e as string} style={{flexDirection:"row",alignItems:"center",gap:3}}>
              <Text style={{fontSize:9}}>{e}</Text>
              <Text style={{color:c as string,fontSize:9,fontWeight:"700"}}>{v}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={onClose} style={{padding:8}}>
          <Text style={{color:colors.muted,fontSize:18}}>✕</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={{flexDirection:"row",gap:6,paddingHorizontal:16,marginBottom:10}}>
        {(["chat","stats","activités"] as const).map(t=>(
          <Pressable key={t} onPress={()=>setTab(t)} style={{
            flex:1, paddingVertical:7, borderRadius:10, alignItems:"center",
            backgroundColor:tab===t ? colors.accent : "rgba(255,255,255,0.06)" }}>
            <Text style={{color:tab===t?"#07111f":colors.text,fontWeight:"700",fontSize:11}}>
              {t==="chat"?"💬 Chat":t==="stats"?"📊 Stats":"🎯 Inviter"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Chat */}
      {tab==="chat" && (
        <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={{paddingHorizontal:16}}>
          <ScrollView ref={scrollRef} style={{maxHeight:130}} showsVerticalScrollIndicator={false}
            onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:true})}>
            {chat.map(entry=>(
              <View key={entry.id} style={{
                flexDirection:"row",
                justifyContent:entry.from==="player"?"flex-end":"flex-start", marginBottom:6}}>
                <View style={{
                  backgroundColor:entry.from==="player"?colors.accent:"rgba(255,255,255,0.1)",
                  borderRadius:12, paddingHorizontal:10, paddingVertical:7, maxWidth:"82%"}}>
                  <Text style={{color:entry.from==="player"?"#07111f":colors.text,fontSize:12,fontWeight:"600"}}>
                    {entry.text}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8,marginTop:4}}>
            <View style={{flexDirection:"row",gap:6}}>
              {QUICK_EMOTES.map(e=>(
                <Pressable key={e} onPress={()=>sendEmote(e)} style={{
                  width:36,height:36,borderRadius:18,
                  backgroundColor:"rgba(255,255,255,0.08)",alignItems:"center",justifyContent:"center"}}>
                  <Text style={{fontSize:18}}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={{flexDirection:"row",gap:8,alignItems:"center",paddingBottom:12}}>
            <TextInput style={{flex:1,backgroundColor:"rgba(255,255,255,0.08)",borderRadius:12,
              paddingHorizontal:14,paddingVertical:10,color:colors.text,fontSize:13}}
              value={input} onChangeText={setInput}
              placeholder="Dis quelque chose…" placeholderTextColor={colors.muted}
              onSubmitEditing={send} returnKeyType="send" />
            <Pressable onPress={send} style={{width:42,height:42,borderRadius:21,
              backgroundColor:input.trim()?colors.accent:"rgba(255,255,255,0.1)",
              alignItems:"center",justifyContent:"center"}}>
              <Text style={{fontSize:18}}>→</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Tab Stats */}
      {tab==="stats" && (
        <View style={{paddingHorizontal:16,paddingBottom:16,gap:10}}>
          {[
            {label:"😊 Humeur",   val:npc.mood,   color:"#38c793"},
            {label:"⚡ Énergie",  val:npc.energy, color:"#3498db"},
            {label:"🍽️ Faim",     val:100-npc.hunger, color:"#e67e22"},
            {label:"💧 Hygiène",  val:npc.hygiene,color:"#1abc9c"},
            {label:"😰 Stress",   val:100-npc.stress, color:"#e74c3c"},
          ].map(s=>(
            <View key={s.label} style={{gap:3}}>
              <View style={{flexDirection:"row",justifyContent:"space-between"}}>
                <Text style={{color:colors.muted,fontSize:11}}>{s.label}</Text>
                <Text style={{color:s.color,fontWeight:"700",fontSize:11}}>{Math.round(s.val)}%</Text>
              </View>
              <View style={{height:5,borderRadius:3,backgroundColor:"rgba(255,255,255,0.08)"}}>
                <View style={{height:5,width:`${s.val}%`,borderRadius:3,backgroundColor:s.color}} />
              </View>
            </View>
          ))}
          <View style={{flexDirection:"row",gap:8,marginTop:4}}>
            {[["💰",`${npc.money} cr`],["⭐",`Nv ${npc.level}`],["🔥",`${npc.streak}j streak`]].map(([e,v])=>(
              <View key={e as string} style={{flex:1,backgroundColor:"rgba(255,255,255,0.06)",
                borderRadius:10,padding:8,alignItems:"center"}}>
                <Text style={{fontSize:14}}>{e}</Text>
                <Text style={{color:colors.text,fontWeight:"700",fontSize:11,marginTop:2}}>{v}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tab Activités */}
      {tab==="activités" && (
        <ScrollView style={{maxHeight:200,paddingHorizontal:16}} showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom:12,gap:8}}>
          <Text style={{color:colors.muted,fontSize:11,marginBottom:4}}>
            Propose une activité à {npc.name.split(" ")[0]}
          </Text>
          {PROPOSABLE_ACTIVITIES.map(act=>(
            <Pressable key={act.slug} onPress={()=>propose(act.slug)} style={{
              flexDirection:"row",alignItems:"center",gap:10,
              backgroundColor:"rgba(255,255,255,0.06)",borderRadius:10,
              paddingHorizontal:12,paddingVertical:10}}>
              <Text style={{fontSize:22}}>{act.emoji}</Text>
              <View style={{flex:1}}>
                <Text style={{color:colors.text,fontWeight:"700",fontSize:13}}>{act.label}</Text>
                <Text style={{color:colors.muted,fontSize:10}}>{act.locationSlug}</Text>
              </View>
              <Text style={{color:colors.accent,fontSize:12}}>Proposer →</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

// ─── Carte Urbaine (canvas principal) ─────────────────────────────────────────
function CityMap({ currentSlug, npcs, playerPos, playerVisual, onTapMap, onTapNpc, onTapBuilding, bubbles }:{
  currentSlug:string; npcs:NpcState[];
  playerPos:{x:number;y:number};
  playerVisual:ReturnType<typeof getAvatarVisual>;
  onTapMap:(px:number,py:number)=>void;
  onTapNpc:(npc:NpcState)=>void;
  onTapBuilding:(slug:string)=>void;
  bubbles:Record<string,{text:string;key:number}>;
}) {
  const scaledBuildings = useMemo(()=>RAW_BUILDINGS.map(sc),[]);

  return (
    <Pressable
      onPress={e=>{
        const {locationX,locationY} = e.nativeEvent;
        onTapMap(
          Math.max(2,Math.min(98,(locationX/MAP_W)*100)),
          Math.max(2,Math.min(98,(locationY/MAP_H)*100))
        );
      }}
      style={{width:MAP_W, height:MAP_H, backgroundColor:C.sky, overflow:"hidden"}}>

      {/* ── Fond herbe / zones vertes ───────────────────────────────────────── */}
      {/* Grand parc */}
      <View style={{position:"absolute",left:0,top:325*SY,width:142*SX,height:199*SY,
        backgroundColor:"#060f06"}} />
      {/* Petites zones vertes au bord */}
      <View style={{position:"absolute",left:0,top:0,width:4*SX,height:MAP_H,backgroundColor:"#050d05"}} />
      <View style={{position:"absolute",left:MAP_W-4*SX,top:0,width:4*SX,height:MAP_H,backgroundColor:"#050d05"}} />

      {/* ── Rues ────────────────────────────────────────────────────────────── */}
      {RAW_STREETS.map((s,i)=>(
        <View key={i} style={{
          position:"absolute",
          left:s.x*SX, top:s.y*SY, width:s.w*SX, height:s.h*SY,
          backgroundColor: s.major ? C.road : C.roadM,
        }}>
          {/* Ligne centrale en pointillés */}
          {s.major && s.w > s.h ? (
            // horizontale
            [...Array(Math.floor(s.w*SX/20))].map((_,j)=>(
              <View key={j} style={{position:"absolute",
                left:j*20, top:s.h*SY/2-1,
                width:10, height:2, backgroundColor:C.roadLine}} />
            ))
          ) : s.major ? (
            // verticale
            [...Array(Math.floor(s.h*SY/20))].map((_,j)=>(
              <View key={j} style={{position:"absolute",
                top:j*20, left:s.w*SX/2-1,
                width:2, height:10, backgroundColor:C.roadLine}} />
            ))
          ) : null}
        </View>
      ))}

      {/* ── Trottoirs ────────────────────────────────────────────────────────── */}
      {RAW_STREETS.filter(s=>s.major).map((s,i)=>(
        <React.Fragment key={`side-${i}`}>
          {/* Trottoir A */}
          <View style={{position:"absolute",
            left:(s.w>s.h?s.x*SX:s.x*SX-4*SX),
            top:(s.w>s.h?s.y*SY-4*SY:s.y*SY),
            width:(s.w>s.h?s.w*SX:4*SX), height:(s.w>s.h?4*SY:s.h*SY),
            backgroundColor:C.sidewalk}} />
          {/* Trottoir B */}
          <View style={{position:"absolute",
            left:(s.w>s.h?s.x*SX:s.x*SX+s.w*SX),
            top:(s.w>s.h?s.y*SY+s.h*SY:s.y*SY),
            width:(s.w>s.h?s.w*SX:4*SX), height:(s.w>s.h?4*SY:s.h*SY),
            backgroundColor:C.sidewalk}} />
        </React.Fragment>
      ))}

      {/* ── Passages piétons aux intersections ──────────────────────────────── */}
      {[{x:118,y:174},{x:258,y:174},{x:118,y:299},{x:258,y:299},{x:118,y:431},{x:258,y:431}].map((p,i)=>(
        <View key={`cross-${i}`} style={{position:"absolute",
          left:p.x*SX, top:p.y*SY, width:22*SX, height:6*SY}}>
          {[...Array(5)].map((_,j)=>(
            <View key={j} style={{position:"absolute",
              left:j*(22*SX/5), width:3*SX, height:6*SY,
              backgroundColor:"rgba(255,255,255,0.18)"}} />
          ))}
        </View>
      ))}

      {/* ── Noms des rues ────────────────────────────────────────────────────── */}
      <StreetLabel name="BOULEVARD CENTRAL"     x={10} y={176} />
      <StreetLabel name="AVENUE DE LA RÉPUBLIQUE" x={10} y={301} />
      <StreetLabel name="RUE DU PARC"             x={10} y={433} />
      <StreetLabel name="AVE PRINCIPALE" x={263} y={12} vertical={false} />

      {/* ── Fontaine place centrale ───────────────────────────────────────────── */}
      <Fountain />

      {/* ── Bâtiments ─────────────────────────────────────────────────────────── */}
      {scaledBuildings.map(b=>(
        <BuildingView key={b.id} b={b}
          isHere={b.slug===currentSlug}
          onPress={b.deco ? undefined : ()=>b.slug && onTapBuilding(b.slug)} />
      ))}

      {/* ── Arbres ────────────────────────────────────────────────────────────── */}
      {RAW_TREES.map((t,i)=><Tree key={`t${i}`} x={t.x} y={t.y} r={t.r} />)}

      {/* ── Lampadaires ──────────────────────────────────────────────────────── */}
      {RAW_LAMPS.map((l,i)=><Lamp key={`l${i}`} x={l.x} y={l.y} />)}

      {/* ── Voitures animées ─────────────────────────────────────────────────── */}
      {CARS.map(car=><AnimatedCar key={car.id} car={car} />)}

      {/* ── Metro entrance ───────────────────────────────────────────────────── */}
      {[{x:118,y:288},{x:258,y:163}].map((m,i)=>(
        <View key={`metro-${i}`} style={{position:"absolute",
          left:m.x*SX-14*SX, top:m.y*SY-7*SY,
          width:28*SX, height:14*SY, borderRadius:4,
          backgroundColor:"#0a1a30",
          borderWidth:1, borderColor:"#3498db",
          alignItems:"center", justifyContent:"center"}}>
          <Text style={{color:"#3498db",fontSize:Math.max(7,8*SX),fontWeight:"900"}}>Ⓜ</Text>
        </View>
      ))}

      {/* ── Kiosque ──────────────────────────────────────────────────────────── */}
      <View style={{position:"absolute",left:194*SX, top:250*SY,
        width:16*SX, height:18*SY, borderRadius:3,
        backgroundColor:"#1a3a1a",
        borderWidth:0.5,borderColor:"#38c793",
        alignItems:"center",justifyContent:"center"}}>
        <Text style={{fontSize:7*SX}}>🏪</Text>
      </View>

      {/* ── NPCs animés ──────────────────────────────────────────────────────── */}
      {npcs.map(npc=>(
        <LiveNpc key={npc.id} npc={npc} onPress={()=>onTapNpc(npc)} />
      ))}

      {/* ── Joueur ───────────────────────────────────────────────────────────── */}
      <PlayerDot posX={playerPos.x} posY={playerPos.y} visual={playerVisual} />

      {/* ── Bulles de dialogue ───────────────────────────────────────────────── */}
      {npcs.map(npc=>{
        const b = bubbles[npc.id];
        if (!b) return null;
        return <Bubble key={`bubble-${npc.id}-${b.key}`} text={b.text}
          posX={npc.posX} posY={npc.posY} />;
      })}
    </Pressable>
  );
}

// ─── Screen principal ──────────────────────────────────────────────────────────
export default function WorldLiveScreen() {
  const avatar              = useGameStore(s=>s.avatar);
  const npcs                = useGameStore(s=>s.npcs);
  const tickNpcs            = useGameStore(s=>s.tickNpcs);
  const relationships       = useGameStore(s=>s.relationships);
  const travelTo            = useGameStore(s=>s.travelTo);
  const currentLocationSlug = useGameStore(s=>s.currentLocationSlug);
  const conversations       = useGameStore(s=>s.conversations);
  const notifications       = useGameStore(s=>s.notifications);

  const [playerPos, setPlayerPos]     = useState({x:50,y:50});
  const [bubbles, setBubbles]         = useState<Record<string,{text:string;key:number}>>({});
  const [selectedNpc, setSelectedNpc] = useState<NpcState|null>(null);
  const [toast, setToast]             = useState<ToastItem|null>(null);
  const [viewMode, setViewMode]       = useState<"map"|"list">("map");
  const [mapKey, setMapKey]           = useState(0);

  const visual = avatar ? getAvatarVisual(avatar) : getNpcVisual("player");

  // Tick 30s
  useEffect(() => {
    tickNpcs();
    const t = setInterval(()=>tickNpcs(), 30_000);
    return ()=>clearInterval(t);
  }, []);

  // Toasts live (NPC messages non lus récents)
  const prevNotifCount = useRef(notifications.length);
  useEffect(() => {
    const newNotifs = notifications.slice(0, notifications.length - prevNotifCount.current);
    prevNotifCount.current = notifications.length;
    const social = newNotifs.filter(n => n.kind==="social" && !n.read);
    if (social.length > 0) {
      const n = social[0];
      const npc = npcs.find(np => n.title.includes(np.name));
      setToast({ id:`toast-${Date.now()}`, npcName:n.title.replace(/💬 |🎯 /g,""),
        emoji: npc ? "💬" : "🔔", text:n.body });
    }
  }, [notifications.length]);

  // Toasts amis proches (action changed)
  useEffect(() => {
    const close = npcs.filter(n=>{
      const r = relationships.find(r=>r.residentId===n.id);
      return r && r.score>=45;
    });
    if (close.length===0) return;
    const npc = close[Math.floor(Math.random()*close.length)];
    const bldg = RAW_BUILDINGS.find(b=>b.slug===npc.locationSlug);
    if (!bldg) return;
    setToast({id:`live-${npc.id}-${Date.now()}`,
      npcName:npc.name,
      emoji: bldg.emoji,
      text: `est ${ACTION_LABELS[npc.action]?.toLowerCase() ?? "en ligne"} à ${bldg.label}`
    });
  }, [npcs.map(n=>n.action).join()]);

  const showBubble = useCallback((id:string,text:string)=>{
    setBubbles(prev=>({...prev,[id]:{text,key:Date.now()}}));
    setTimeout(()=>setBubbles(prev=>{
      const n={...prev}; delete n[id]; return n;
    }),3400);
  },[]);

  // Salutation auto quand joueur proche
  const playerPx = pct(playerPos.x, playerPos.y);
  useEffect(()=>{
    npcs.forEach(npc=>{
      const np = pct(npc.posX, npc.posY);
      const d  = Math.hypot(playerPx.x-np.x, playerPx.y-np.y);
      if (d < 40*SX && !bubbles[npc.id]) {
        showBubble(npc.id, getNpcDialogue(npc.id,npc.action,npc.mood,"greeting"));
      }
    });
  },[playerPos]);

  const handleTapBuilding = (slug:string) => {
    travelTo(slug);
  };

  const unreadCount = notifications.filter(n=>!n.read).length;

  return (
    <View style={{flex:1, backgroundColor:colors.bg}}>

      {/* ── HUD flottant (top) ─────────────────────────────────────────────── */}
      <View style={{
        position:"absolute", top:0, left:0, right:0, zIndex:50,
        flexDirection:"row", alignItems:"center",
        paddingTop:52, paddingBottom:10, paddingHorizontal:14,
        backgroundColor:"rgba(5,12,22,0.82)",
        borderBottomWidth:1, borderColor:"rgba(255,255,255,0.06)",
      }}>
        <Pressable onPress={()=>router.back()}
          style={{width:32, height:32, borderRadius:16, backgroundColor:"rgba(255,255,255,0.1)",
            alignItems:"center", justifyContent:"center", marginRight:10}}>
          <Text style={{color:colors.text,fontSize:14}}>←</Text>
        </Pressable>
        <View style={{flex:1}}>
          <Text style={{color:colors.text,fontWeight:"900",fontSize:16}}>🏙️ Neo Paris</Text>
          <Text style={{color:colors.muted,fontSize:10}}>
            {npcs.length} résidents actifs · {npcs.filter(n=>n.mood>60).length} de bonne humeur
          </Text>
        </View>
        {/* Toggle map/list */}
        <View style={{flexDirection:"row",gap:4}}>
          {(["map","list"] as const).map(m=>(
            <Pressable key={m} onPress={()=>setViewMode(m)} style={{
              paddingHorizontal:10,paddingVertical:7,borderRadius:10,
              backgroundColor:viewMode===m?colors.accent+"28":"rgba(255,255,255,0.07)"}}>
              <Text style={{color:viewMode===m?colors.accent:colors.muted,fontSize:14}}>
                {m==="map"?"🗺️":"☰"}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* Badge notifs */}
        {unreadCount > 0 && (
          <Pressable onPress={()=>router.push("/(app)/(tabs)/notifications")}
            style={{marginLeft:6,width:28,height:28,borderRadius:14,
              backgroundColor:"#e74c3c",alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#fff",fontSize:10,fontWeight:"900"}}>{unreadCount>9?"9+":unreadCount}</Text>
          </Pressable>
        )}
      </View>

      {/* ── Vue Carte ─────────────────────────────────────────────────────────── */}
      {viewMode==="map" && (
        <View style={{flex:1}}>
          {/* Carte en haut */}
          <View style={{marginTop:90}}>
            <CityMap
              key={mapKey}
              currentSlug={currentLocationSlug}
              npcs={npcs}
              playerPos={playerPos}
              playerVisual={visual}
              onTapMap={(px,py)=>{ if(!selectedNpc) setPlayerPos({x:px,y:py}); }}
              onTapNpc={npc=>setSelectedNpc(npc)}
              onTapBuilding={handleTapBuilding}
              bubbles={bubbles}
            />
          </View>

          {/* Bar d'info lieu actuel */}
          <View style={{
            flexDirection:"row", alignItems:"center", gap:8,
            paddingHorizontal:14, paddingVertical:8,
            backgroundColor:"rgba(7,17,31,0.95)",
            borderTopWidth:1, borderColor:"rgba(255,255,255,0.06)" }}>
            <View style={{flex:1}}>
              <Text style={{color:colors.text,fontWeight:"700",fontSize:12}}>
                {RAW_BUILDINGS.find(b=>b.slug===currentLocationSlug)?.emoji ?? "📍"}{" "}
                {RAW_BUILDINGS.find(b=>b.slug===currentLocationSlug)?.label ?? currentLocationSlug}
              </Text>
              <Text style={{color:colors.muted,fontSize:10}}>
                Tap bâtiment pour voyager · Tap carte pour se déplacer
              </Text>
            </View>
            {/* NPCs ici */}
            <View style={{flexDirection:"row",gap:-6}}>
              {npcs.filter(n=>n.locationSlug===currentLocationSlug).slice(0,4).map(n=>(
                <Pressable key={n.id} onPress={()=>setSelectedNpc(n)}
                  style={{width:28,height:28,borderRadius:14,
                    backgroundColor:n.mood>60?"#38c793":"#f39c12",
                    alignItems:"center",justifyContent:"center",
                    borderWidth:1.5,borderColor:colors.bg}}>
                  <Text style={{fontSize:12}}>
                    {n.name.charAt(0)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Liste résidents (si pas de panel NPC) */}
          {!selectedNpc && (
            <ScrollView style={{flex:1,backgroundColor:colors.bg}}
              contentContainerStyle={{padding:12,gap:8}}>
              <Text style={{color:colors.muted,fontSize:10,fontWeight:"800",letterSpacing:1.5,marginBottom:4}}>
                RÉSIDENTS EN LIGNE
              </Text>
              {npcs.map(npc=>{
                const bldg = RAW_BUILDINGS.find(b=>b.slug===npc.locationSlug);
                const rel  = relationships.find(r=>r.residentId===npc.id);
                const lvlColor = npc.level>=4?"#c084fc":npc.level>=2?"#f6b94f":"#38c793";
                const moodColor = npc.mood>65?"#38c793":npc.mood>35?"#f39c12":"#e74c3c";
                return (
                  <Pressable key={npc.id} onPress={()=>setSelectedNpc(npc)} style={{
                    flexDirection:"row",alignItems:"center",gap:10,
                    backgroundColor:rel&&rel.score>=45?"rgba(56,199,147,0.07)":"rgba(255,255,255,0.04)",
                    borderRadius:12,padding:10,
                    borderWidth:1,borderColor:rel&&rel.score>=45?"rgba(56,199,147,0.25)":"rgba(255,255,255,0.07)"}}>
                    <View style={{borderWidth:1.5,borderColor:moodColor,borderRadius:20}}>
                      <AvatarSprite visual={getNpcVisual(npc.id)} action={npc.action} size="xs" />
                    </View>
                    <View style={{flex:1}}>
                      <View style={{flexDirection:"row",alignItems:"center",gap:6}}>
                        <Text style={{color:colors.text,fontWeight:"700",fontSize:13}}>{npc.name}</Text>
                        <View style={{backgroundColor:lvlColor+"22",borderRadius:5,paddingHorizontal:4}}>
                          <Text style={{color:lvlColor,fontSize:8,fontWeight:"900"}}>Nv{npc.level}</Text>
                        </View>
                        {rel&&rel.score>=45 && <Text style={{fontSize:10}}>💚</Text>}
                      </View>
                      <Text style={{color:colors.muted,fontSize:10}}>
                        {bldg?.emoji} {bldg?.label ?? npc.locationSlug} · {ACTION_ICON[npc.action]} {ACTION_LABELS[npc.action]}
                      </Text>
                    </View>
                    <View style={{gap:2,width:44}}>
                      <View style={{height:4,borderRadius:2,backgroundColor:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                        <View style={{width:`${npc.mood}%`,height:"100%",backgroundColor:moodColor,borderRadius:2}} />
                      </View>
                      <View style={{height:4,borderRadius:2,backgroundColor:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                        <View style={{width:`${npc.energy}%`,height:"100%",backgroundColor:"#3498db",borderRadius:2}} />
                      </View>
                      <View style={{height:4,borderRadius:2,backgroundColor:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                        <View style={{width:`${npc.xp%100}%`,height:"100%",backgroundColor:lvlColor,borderRadius:2}} />
                      </View>
                    </View>
                    <Text style={{color:colors.accent,fontSize:14}}>💬</Text>
                  </Pressable>
                );
              })}
              <View style={{gap:8,marginTop:6}}>
                <Pressable onPress={()=>router.push("/(app)/rooms")} style={{
                  flexDirection:"row",alignItems:"center",gap:10,
                  backgroundColor:"rgba(139,124,255,0.08)",borderRadius:14,padding:14,
                  borderWidth:1,borderColor:colors.accent+"44"}}>
                  <Text style={{fontSize:24}}>🔐</Text>
                  <View style={{flex:1}}>
                    <Text style={{color:colors.accent,fontWeight:"800",fontSize:13}}>Rooms & Secret Chat</Text>
                    <Text style={{color:colors.muted,fontSize:11}}>Espaces privés et éphémères</Text>
                  </View>
                  <Text style={{color:colors.accent}}>→</Text>
                </Pressable>
                <Pressable onPress={()=>router.push("/(app)/coach")} style={{
                  flexDirection:"row",alignItems:"center",gap:10,
                  backgroundColor:"rgba(56,199,147,0.06)",borderRadius:14,padding:14,
                  borderWidth:1,borderColor:"#38c79344"}}>
                  <Text style={{fontSize:24}}>🤖</Text>
                  <View style={{flex:1}}>
                    <Text style={{color:"#38c793",fontWeight:"800",fontSize:13}}>Coach ARIA+ — IA personnelle</Text>
                    <Text style={{color:colors.muted,fontSize:11}}>Conseils et analyse de vie</Text>
                  </View>
                  <Text style={{color:"#38c793"}}>→</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* Panel NPC sélectionné */}
          {selectedNpc && (
            <NpcPanel npc={selectedNpc}
              onClose={()=>setSelectedNpc(null)}
              onBubble={showBubble} />
          )}
        </View>
      )}

      {/* ── Vue liste ─────────────────────────────────────────────────────────── */}
      {viewMode==="list" && (
        <ScrollView style={{flex:1,marginTop:90}} contentContainerStyle={{padding:16,gap:10}}>
          <Text style={{color:colors.muted,fontSize:10,fontWeight:"800",letterSpacing:1,marginBottom:4}}>
            LIEUX ACTIFS
          </Text>
          {RAW_BUILDINGS.filter(b=>b.slug&&!b.deco).map(bldg=>{
            const present = npcs.filter(n=>n.locationSlug===bldg.slug);
            return (
              <View key={bldg.id} style={{
                backgroundColor:present.length>0?bldg.color+"18":"rgba(255,255,255,0.03)",
                borderRadius:14,borderWidth:1,
                borderColor:present.length>0?bldg.color+"55":"rgba(255,255,255,0.07)",
                padding:12}}>
                <View style={{flexDirection:"row",alignItems:"center",gap:10,marginBottom:present.length>0?8:0}}>
                  <Text style={{fontSize:26}}>{bldg.emoji}</Text>
                  <View style={{flex:1}}>
                    <Text style={{color:colors.text,fontWeight:"800",fontSize:14}}>{bldg.label}</Text>
                    <Text style={{color:colors.muted,fontSize:11}}>
                      {present.length===0?"Vide":`${present.length} présent${present.length>1?"s":""}`}
                    </Text>
                  </View>
                  <Pressable onPress={()=>{bldg.slug&&travelTo(bldg.slug);setViewMode("map");}}
                    style={{backgroundColor:bldg.color+"33",borderRadius:10,paddingHorizontal:10,paddingVertical:5,
                      borderWidth:1,borderColor:bldg.color+"66"}}>
                    <Text style={{color:bldg.color,fontSize:12,fontWeight:"700"}}>Aller →</Text>
                  </Pressable>
                </View>
                {present.length>0 && (
                  <View style={{gap:6}}>
                    {present.map(npc=>{
                      const moodColor=npc.mood>65?"#38c793":npc.mood>35?"#f39c12":"#e74c3c";
                      return (
                        <Pressable key={npc.id} onPress={()=>{setViewMode("map");setSelectedNpc(npc);}}
                          style={{flexDirection:"row",alignItems:"center",gap:8,
                            backgroundColor:"rgba(255,255,255,0.05)",borderRadius:10,padding:8}}>
                          <View style={{width:8,height:8,borderRadius:4,backgroundColor:moodColor}} />
                          <Text style={{color:colors.text,fontWeight:"700",fontSize:13,flex:1}}>{npc.name}</Text>
                          <Text style={{color:colors.muted,fontSize:10}}>
                            Nv{npc.level} · {ACTION_LABELS[npc.action]}
                          </Text>
                          <Text style={{color:colors.accent,fontSize:13}}>💬</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Toast global ──────────────────────────────────────────────────────── */}
      {toast && <LiveToast key={toast.id} toast={toast} />}
    </View>
  );
}
