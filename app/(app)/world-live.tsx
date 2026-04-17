/**
 * World Live — Neo Paris City Map
 * Carte urbaine immersive plein écran avec map scrollable, néons, NPCs IA
 */
import { Ionicons } from "@expo/vector-icons";
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
const MAP_W  = SW;
const MAP_H  = SH;                // Plein écran
const SX     = MAP_W / 390;
const SY     = MAP_H / 760;       // Référence verticale étendue pour plus d'espace

// ─── Palette de couleurs urbaines ────────────────────────────────────────────
const C = {
  bg:        "#020810",
  sky:       "#040c1c",
  ground:    "#080f1a",
  road:      "#0c1320",
  roadDark:  "#090e18",
  sidewalk:  "#0f1826",
  parkBase:  "#050e05",
  parkGrass: "#081408",
  water:     "#030e18",

  // Couleurs de district
  distHome:   "#0d1e3c",
  distMarket: "#062415",
  distOffice: "#0a1530",
  distCafe:   "#2a1000",
  distPark:   "#050e05",
  distGym:    "#1e0505",
  distCinema: "#030318",
  distClub:   "#0d0020",
  distNight:  "#120020",

  // Néons
  neonTeal:   "#00e5c8",
  neonPurple: "#b060ff",
  neonGold:   "#ffcc44",
  neonPink:   "#ff4488",
  neonBlue:   "#4488ff",
  neonGreen:  "#44ff88",

  lamp:     "#ffd060",
  lampGlow: "rgba(255,200,60,0.08)",
  stars:    "rgba(255,255,255,0.85)",
};

// ─── Rues (référence 390×760) ─────────────────────────────────────────────────
const RAW_STREETS = [
  { x:0,   y:210, w:390, h:28, major:true,  name:"Boulevard Central"        },
  { x:0,   y:390, w:390, h:30, major:true,  name:"Avenue de la République"  },
  { x:0,   y:570, w:390, h:24, major:false, name:"Rue du Parc"              },
  { x:120, y:0,   w:24,  h:760, major:false, name:"Rue Ouest"               },
  { x:265, y:0,   w:28,  h:760, major:true,  name:"Avenue Principale"       },
];

// ─── Bâtiments (référence 390×760) ───────────────────────────────────────────
type Bldg = {
  id:string; label:string; emoji:string; slug?:string;
  x:number; y:number; w:number; h:number;
  color:string; neon?:string; floors:number; winCols:number; deco?:boolean;
};

const RAW_BUILDINGS: Bldg[] = [
  // ── NW — Résidences ─────────────────────────────────────────────────────
  { id:"home",   label:"Résidences",    emoji:"🏠", slug:"home",
    x:6,  y:8,  w:107, h:196, color:"#142d54", floors:6, winCols:4 },

  // ── NM — Commerce ────────────────────────────────────────────────────────
  { id:"market", label:"Marché",        emoji:"🛒", slug:"market",
    x:148, y:8,  w:110, h:120, color:"#0b4d35", neon:C.neonGreen, floors:2, winCols:5 },
  { id:"boulangerie", label:"Boulangerie", emoji:"🥐",
    x:148, y:136, w:52,  h:66, color:"#3a2008", floors:2, winCols:2, deco:true },
  { id:"tabac",       label:"Tabac",       emoji:"📰",
    x:206, y:136, w:52,  h:66, color:"#1a1008", floors:2, winCols:2, deco:true },

  // ── NE — Bureau ──────────────────────────────────────────────────────────
  { id:"office", label:"Tour Affaires", emoji:"💼", slug:"office",
    x:296, y:8, w:88, h:196, color:"#0e2558", neon:C.neonBlue, floors:8, winCols:4 },

  // ── CW — Café ─────────────────────────────────────────────────────────────
  { id:"cafe",   label:"Café Social",   emoji:"☕", slug:"cafe",
    x:6,   y:244, w:107, h:138, color:"#5c2a04", neon:C.neonGold, floors:2, winCols:3 },

  // ── CC-W — Boulangerie/Tabac ──────────────────────────────────────────────
  { id:"resto_deco", label:"Bistrot", emoji:"🍷",
    x:148, y:244, w:52,  h:138, color:"#3a1020", floors:3, winCols:2, deco:true },
  { id:"pharmacie", label:"Pharmacie", emoji:"💊",
    x:206, y:244, w:52,  h:138, color:"#082a18", floors:2, winCols:2, deco:true },

  // ── CE — Restaurant ──────────────────────────────────────────────────────
  { id:"restaurant", label:"Restaurant", emoji:"🍽️", slug:"restaurant",
    x:296, y:244, w:88, h:138, color:"#4a1520", neon:C.neonPink, floors:2, winCols:4 },

  // ── SW — Parc ─────────────────────────────────────────────────────────────
  { id:"park",   label:"Parc Riverside", emoji:"🌳", slug:"park",
    x:6,   y:424, w:107, h:140, color:"#050e05", floors:0, winCols:0 },

  // ── SM — Gym ─────────────────────────────────────────────────────────────
  { id:"gym",    label:"Gym Pulse",     emoji:"💪", slug:"gym",
    x:148, y:424, w:110, h:140, color:"#520808", neon:C.neonTeal, floors:3, winCols:5 },

  // ── SE — Cinéma ──────────────────────────────────────────────────────────
  { id:"cinema", label:"Cinéma Luma",  emoji:"🎬", slug:"cinema",
    x:296, y:424, w:88, h:140, color:"#050520", neon:C.neonPurple, floors:3, winCols:4 },

  // ── Bande nocturne ────────────────────────────────────────────────────────
  { id:"club",   label:"Club Nuit",    emoji:"🎵", slug:"club",
    x:148, y:600, w:110, h:154, color:"#180030", neon:C.neonPurple, floors:3, winCols:4 },
  { id:"hotel",  label:"Hôtel Lumière",emoji:"🏨",
    x:296, y:600, w:88,  h:154, color:"#0c1c30", neon:C.neonBlue, floors:5, winCols:4, deco:true },
  { id:"garage", label:"Parking",      emoji:"🅿️",
    x:6,   y:600, w:107, h:154, color:"#0a1018", floors:2, winCols:5, deco:true },
];

// ─── Lampadaires ─────────────────────────────────────────────────────────────
const RAW_LAMPS = [
  {x:118,y:205},{x:262,y:205},{x:388,y:205},{x:4,y:205},
  {x:118,y:385},{x:262,y:385},{x:388,y:385},{x:4,y:385},
  {x:118,y:565},{x:262,y:565},{x:388,y:565},{x:4,y:565},
  {x:118,y:10 },{x:262,y:10 },{x:118,y:600},{x:262,y:600},
  {x:144,y:210},{x:144,y:390},{x:268,y:210},{x:268,y:390},
];

// ─── Arbres ───────────────────────────────────────────────────────────────────
const RAW_TREES = [
  // Parc
  {x:18, y:435,r:14},{x:46, y:452,r:16},{x:78, y:438,r:13},
  {x:26, y:470,r:12},{x:58, y:488,r:15},{x:88, y:472,r:13},
  {x:14, y:504,r:11},{x:50, y:518,r:14},{x:82, y:502,r:12},
  {x:30, y:536,r:10},{x:65, y:546,r:13},{x:95, y:532,r:10},
  // Bordures
  {x:132,y:14, r:7},{x:132,y:60, r:7},{x:132,y:108,r:7},{x:132,y:158,r:7},
  {x:278,y:14, r:7},{x:278,y:60, r:7},{x:278,y:108,r:7},{x:278,y:158,r:7},
  {x:278,y:250,r:7},{x:278,y:300,r:7},{x:278,y:350,r:7},
  {x:132,y:250,r:7},{x:132,y:300,r:7},{x:132,y:350,r:7},
  {x:132,y:610,r:7},{x:132,y:660,r:7},{x:132,y:710,r:7},
  {x:278,y:610,r:7},{x:278,y:660,r:7},{x:278,y:710,r:7},
];

// ─── Voitures ────────────────────────────────────────────────────────────────
type CarDef = {id:string;axis:"h"|"v";lane:number;dir:1|-1;speed:number;color:string};
const CARS: CarDef[] = [
  {id:"c1",axis:"h",lane:218,dir: 1,speed:8000, color:"#3498db"},
  {id:"c2",axis:"h",lane:230,dir:-1,speed:9500, color:"#e74c3c"},
  {id:"c3",axis:"h",lane:398,dir: 1,speed:7500, color:"#f39c12"},
  {id:"c4",axis:"h",lane:410,dir:-1,speed:11000,color:"#8e44ad"},
  {id:"c5",axis:"v",lane:130,dir: 1,speed:9000, color:"#27ae60"},
  {id:"c6",axis:"v",lane:143,dir:-1,speed:10500,color:"#e67e22"},
  {id:"c7",axis:"v",lane:273,dir: 1,speed:8500, color:"#1abc9c"},
  {id:"c8",axis:"v",lane:286,dir:-1,speed:9800, color:"#c0392b"},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sc(b:Bldg):Bldg { return {...b,x:b.x*SX,y:b.y*SY,w:b.w*SX,h:b.h*SY}; }
function pct(px:number,py:number){return{x:(px/100)*MAP_W,y:(py/100)*MAP_H};}
function npcJitter(id:string):{dx:number;dy:number}{
  const h=id.split("").reduce((a,c)=>a*31+c.charCodeAt(0),0);
  return{dx:((h%24)-12)*SX,dy:(((h*7)%24)-12)*SY};
}

// ─── Étoiles (fond) ───────────────────────────────────────────────────────────
const STARS = Array.from({length:60},(_,i)=>({
  x: (i*137.5%100),
  y: (i*83.3%40),
  s: ((i*11)%3)+1,
  o: 0.3+((i*7)%7)*0.1,
}));

// ─── Lampadaire ───────────────────────────────────────────────────────────────
function Lamp({x,y}:{x:number;y:number}){
  const glow=useRef(new Animated.Value(0.7)).current;
  useEffect(()=>{
    Animated.loop(Animated.sequence([
      Animated.timing(glow,{toValue:1,  duration:2800,useNativeDriver:true}),
      Animated.timing(glow,{toValue:0.5,duration:2800,useNativeDriver:true}),
    ])).start();
  },[]);
  const px=x*SX, py=y*SY;
  return (
    <View style={{position:"absolute",left:px-1,top:py-22*SY}}>
      {/* Cône de lumière */}
      <View style={{
        position:"absolute",left:-14*SX,top:14*SY,
        width:28*SX,height:28*SY,
        borderRadius:4,
        backgroundColor:C.lampGlow,
        transform:[{scaleY:1.5}],
      }}/>
      {/* Tige */}
      <View style={{width:2*SX,height:18*SY,backgroundColor:"#3a4050",alignSelf:"center"}}/>
      {/* Tête */}
      <View style={{width:10*SX,height:4*SY,backgroundColor:"#3a4050",alignSelf:"center",borderRadius:2,marginTop:-1}}/>
      {/* Ampoule avec glow */}
      <Animated.View style={{
        width:8*SX,height:8*SY,borderRadius:4*SX,
        backgroundColor:C.lamp,
        opacity:glow,
        alignSelf:"center",marginTop:-2,
        shadowColor:C.lamp,shadowOpacity:0.9,shadowRadius:8*SX,
      }}/>
    </View>
  );
}

// ─── Arbre ────────────────────────────────────────────────────────────────────
function Tree({x,y,r}:{x:number;y:number;r:number}){
  const sx=x*SX,sy=y*SY,sr=r*Math.min(SX,SY);
  return(
    <View style={{position:"absolute",left:sx-sr*1.2,top:sy-sr*2.2}}>
      {/* Ombre sol */}
      <View style={{
        position:"absolute",left:sr*0.3,top:sr*3.0,
        width:sr*1.8,height:sr*0.5,borderRadius:sr,
        backgroundColor:"rgba(0,0,0,0.4)"
      }}/>
      {/* Tronc */}
      <View style={{
        position:"absolute",left:sr*0.88,top:sr*1.6,
        width:sr*0.28,height:sr*0.9,borderRadius:2,
        backgroundColor:"#2d1a08"
      }}/>
      {/* Feuillage couche 1 (large) */}
      <View style={{
        position:"absolute",left:0,top:sr*0.8,
        width:sr*2.4,height:sr*1.8,borderRadius:sr*1.2,
        backgroundColor:"#071407"
      }}/>
      {/* Couche 2 */}
      <View style={{
        position:"absolute",left:sr*0.25,top:sr*0.3,
        width:sr*1.9,height:sr*1.6,borderRadius:sr,
        backgroundColor:"#0c2208"
      }}/>
      {/* Couche 3 (bright) */}
      <View style={{
        position:"absolute",left:sr*0.5,top:0,
        width:sr*1.4,height:sr*1.2,borderRadius:sr,
        backgroundColor:"#133010"
      }}/>
      {/* Highlight */}
      <View style={{
        position:"absolute",left:sr*0.75,top:sr*0.1,
        width:sr*0.7,height:sr*0.6,borderRadius:sr,
        backgroundColor:"rgba(50,120,40,0.4)"
      }}/>
    </View>
  );
}

// ─── Voiture animée ───────────────────────────────────────────────────────────
function AnimCar({car}:{car:CarDef}){
  const pos=useRef(new Animated.Value(car.dir===1?-20:(car.axis==="h"?MAP_W:MAP_H)+20)).current;
  useEffect(()=>{
    const end=car.dir===1?(car.axis==="h"?MAP_W:MAP_H)+20:-20;
    const start=car.dir===1?-20:(car.axis==="h"?MAP_W:MAP_H)+20;
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(pos,{toValue:end,duration:car.speed,easing:Easing.linear,useNativeDriver:false}),
      Animated.timing(pos,{toValue:start,duration:0,useNativeDriver:false}),
    ]));
    loop.start();
    return()=>loop.stop();
  },[]);
  const y=car.lane*SY, x=car.lane*SX;
  const cW=18*SX,cH=9*SY;
  const carStyle={
    borderRadius:3,
    backgroundColor:car.color,
    shadowColor:car.color,shadowOpacity:0.6,shadowRadius:4,
  };
  return car.axis==="h"?(
    <Animated.View style={{position:"absolute",top:y-cH/2,left:pos,width:cW,height:cH,...carStyle}}>
      <View style={{position:"absolute",right:3,top:2,width:6,height:5,borderRadius:1,backgroundColor:"rgba(200,240,255,0.7)"}}/>
      <View style={{position:"absolute",left:2,top:1,width:3,height:3,borderRadius:1,backgroundColor:"rgba(255,255,180,0.9)"}}/>
    </Animated.View>
  ):(
    <Animated.View style={{position:"absolute",left:x-cH/2,top:pos,width:cH,height:cW,...carStyle}}>
      <View style={{position:"absolute",bottom:3,left:2,width:5,height:6,borderRadius:1,backgroundColor:"rgba(200,240,255,0.7)"}}/>
    </Animated.View>
  );
}

// ─── Fontaine animée ─────────────────────────────────────────────────────────
function Fountain(){
  const p1=useRef(new Animated.Value(0.6)).current;
  const p2=useRef(new Animated.Value(0.3)).current;
  useEffect(()=>{
    Animated.loop(Animated.sequence([
      Animated.timing(p1,{toValue:1.0,duration:1400,useNativeDriver:true}),
      Animated.timing(p1,{toValue:0.6,duration:1400,useNativeDriver:true}),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.timing(p2,{toValue:0.7,duration:1200,useNativeDriver:true}),
      Animated.timing(p2,{toValue:0.2,duration:1200,useNativeDriver:true}),
    ])).start();
  },[]);
  const cx=200*SX, cy=300*SY;
  const r=24*Math.min(SX,SY);
  return(
    <View style={{position:"absolute",left:cx-r*1.6,top:cy-r*1.6}}>
      {/* Bassin extérieur */}
      <View style={{width:r*3.2,height:r*3.2,borderRadius:r*1.6,
        backgroundColor:"#030c14",borderWidth:1.5,borderColor:"#0a2840",
        alignItems:"center",justifyContent:"center"}}>
        {/* Ring 1 */}
        <Animated.View style={{position:"absolute",width:r*2.8,height:r*2.8,borderRadius:r*1.4,
          borderWidth:1,borderColor:"rgba(50,180,255,0.2)",opacity:p2}}/>
        {/* Eau */}
        <View style={{width:r*2.4,height:r*2.4,borderRadius:r*1.2,
          backgroundColor:"#040e1c",alignItems:"center",justifyContent:"center"}}>
          {/* Jet central */}
          <Animated.View style={{width:r*0.6,height:r*0.6,borderRadius:r*0.3,
            backgroundColor:"#1060a0",transform:[{scale:p1}],
            shadowColor:"#4fc3f7",shadowOpacity:0.9,shadowRadius:8}}/>
          {/* Gouttelettes */}
          {[0,60,120,180,240,300].map((deg,i)=>(
            <Animated.View key={i} style={{
              position:"absolute",
              left:r*0.8*Math.cos(deg*Math.PI/180)+r*1.1,
              top:r*0.8*Math.sin(deg*Math.PI/180)+r*1.1,
              width:4,height:4,borderRadius:2,
              backgroundColor:"#3b9bd8",opacity:p2,
            }}/>
          ))}
        </View>
      </View>
      {/* Label */}
      <Text style={{position:"absolute",bottom:-12*SY,left:0,right:0,
        textAlign:"center",color:"#2a6a9a",fontSize:Math.max(6,7*SX),fontWeight:"700"}}>
        ⛲
      </Text>
    </View>
  );
}

// ─── Bâtiment ────────────────────────────────────────────────────────────────
function BuildingView({b,isHere,onPress}:{b:Bldg;isHere:boolean;onPress?:()=>void}){
  const sb=useMemo(()=>sc(b),[b.id]);
  const glow=useRef(new Animated.Value(0.82)).current;

  useEffect(()=>{
    if(isHere){
      Animated.loop(Animated.sequence([
        Animated.timing(glow,{toValue:1,  duration:900,useNativeDriver:true}),
        Animated.timing(glow,{toValue:0.7,duration:900,useNativeDriver:true}),
      ])).start();
    } else { glow.setValue(0.82); }
  },[isHere]);

  // Parc = traitement spécial
  if(b.id==="park"){
    return(
      <Pressable onPress={onPress} style={{
        position:"absolute",left:sb.x,top:sb.y,width:sb.w,height:sb.h,
        backgroundColor:C.parkBase,
        borderRadius:4,
        borderWidth:isHere?2:1,
        borderColor:isHere?"#38c793":"#0a2010",
        overflow:"hidden",
      }}>
        {/* Sol herbe */}
        <View style={{position:"absolute",inset:0,backgroundColor:"#060e06"}}/>
        {/* Allée centrale */}
        <View style={{position:"absolute",left:sb.w*0.42,top:0,width:8*SX,height:sb.h,backgroundColor:"#0c1a0a"}}/>
        <View style={{position:"absolute",top:sb.h*0.5,left:0,width:sb.w,height:6*SY,backgroundColor:"#0c1a0a"}}/>
        {/* Bancs */}
        {[[0.15,0.35],[0.65,0.35],[0.15,0.65],[0.65,0.65]].map(([fx,fy],i)=>(
          <View key={i} style={{position:"absolute",left:sb.w*fx,top:sb.h*fy,width:12*SX,height:5*SY,
            backgroundColor:"#1a3a1a",borderRadius:2}}/>
        ))}
        {isHere&&(
          <View style={{position:"absolute",top:4*SY,right:4*SX,backgroundColor:"#38c793",borderRadius:4,paddingHorizontal:4,paddingVertical:1}}>
            <Text style={{color:"#07111f",fontSize:Math.max(6,7*SX),fontWeight:"900"}}>ICI</Text>
          </View>
        )}
        <View style={{position:"absolute",bottom:4*SY,left:0,right:0,alignItems:"center"}}>
          <Text style={{fontSize:Math.max(7,8*SX),color:"#1a6a1a",fontWeight:"700"}}>🌳 {b.label}</Text>
        </View>
      </Pressable>
    );
  }

  const hash=b.id.split("").reduce((a,c)=>a*31+c.charCodeAt(0),0);
  const roofH=sb.h*0.12;
  const groundH=sb.h*0.16;
  const floorH=b.floors>0?(sb.h-roofH-groundH)/b.floors:0;
  const winW=b.floors>0?(sb.w-8*SX)/b.winCols-2*SX:0;

  return(
    <Animated.View style={{
      position:"absolute",left:sb.x,top:sb.y,width:sb.w,height:sb.h,
      opacity:glow,
      shadowColor:isHere?(b.neon??b.color):b.color,
      shadowOpacity:isHere?0.9:0.35,
      shadowRadius:isHere?18*SX:8*SX,
      elevation:isHere?12:4,
    }}>
      <Pressable onPress={onPress} style={{flex:1}}>
        <View style={{flex:1,backgroundColor:b.color,borderRadius:4,
          borderWidth:isHere?1.5:0.5,
          borderColor:isHere?(b.neon??(b.color+"ff")):"rgba(255,255,255,0.12)",
          overflow:"hidden"}}>

          {/* Piliers coins */}
          <View style={{position:"absolute",left:0,top:0,width:3*SX,height:sb.h,backgroundColor:"rgba(0,0,0,0.25)"}}/>
          <View style={{position:"absolute",right:0,top:0,width:3*SX,height:sb.h,backgroundColor:"rgba(0,0,0,0.25)"}}/>

          {/* Toit */}
          <View style={{height:roofH,backgroundColor:"rgba(0,0,0,0.45)",
            borderBottomWidth:0.5,borderColor:"rgba(255,255,255,0.1)"}}/>

          {/* Enseigne néon (immeubles entertainment) */}
          {b.neon&&(
            <View style={{
              position:"absolute",top:roofH+2*SY,left:4*SX,right:4*SX,
              backgroundColor:"rgba(0,0,0,0.7)",borderRadius:3,
              alignItems:"center",paddingVertical:1.5,
              borderWidth:0.5,borderColor:b.neon+"60",
            }}>
              <Text style={{fontSize:Math.max(5,6*SX),color:b.neon,fontWeight:"900",letterSpacing:0.8}}>
                {b.id==="club"?"◉ OPEN 24H":
                 b.id==="cinema"?"▶ EN COURS":
                 b.id==="cafe"?"OUVERT":
                 b.id==="gym"?"FITNESS":
                 b.id==="office"?"HQ":
                 b.id==="market"?"OUVERT":
                 b.id==="restaurant"?"RÉSERVÉ":"●"}
              </Text>
            </View>
          )}

          {/* Étages + fenêtres */}
          {b.floors>0&&Array.from({length:b.floors},(_,f)=>(
            <View key={f} style={{height:floorH,flexDirection:"row",
              paddingHorizontal:4*SX,paddingVertical:1.5*SY,gap:2*SX,
              borderBottomWidth:0.5,borderColor:"rgba(0,0,0,0.2)"}}>
              {Array.from({length:b.winCols},(_,w)=>{
                const litVal=(hash+f*7+w*3+1)%5;
                const lit=litVal>0;
                const warm=((hash+f*5+w*11)%3)===0;
                const veryLit=litVal>3;
                return(
                  <View key={w} style={{flex:1,borderRadius:1.5,
                    backgroundColor:lit
                      ?(veryLit
                        ?(warm?"rgba(255,200,80,0.95)":"rgba(180,220,255,0.85)")
                        :(warm?"rgba(255,190,60,0.65)":"rgba(160,210,255,0.45)"))
                      :"rgba(0,0,0,0.7)",
                    shadowColor:lit?(warm?"#ffb040":"#80c8ff"):undefined,
                    shadowOpacity:lit?0.4:0,
                    shadowRadius:2,
                  }}/>
                );
              })}
            </View>
          ))}

          {/* Rez-de-chaussée */}
          <View style={{height:groundH,
            backgroundColor:"rgba(0,0,0,0.4)",
            borderTopWidth:0.5,borderColor:"rgba(255,255,255,0.1)",
            flexDirection:"row",alignItems:"center",
            paddingHorizontal:4*SX,gap:3*SX}}>
            {/* Porte */}
            <View style={{width:10*SX,height:groundH*0.75,borderRadius:2,
              backgroundColor:"rgba(0,0,0,0.5)",borderWidth:0.5,borderColor:"rgba(255,255,255,0.2)"}}>
              <View style={{position:"absolute",left:"50%",top:0,width:0.5,height:"100%",backgroundColor:"rgba(255,255,255,0.15)"}}/>
            </View>
            {sb.w>44&&(
              <Text style={{color:"rgba(255,255,255,0.7)",fontSize:Math.max(5,6*SX),
                fontWeight:"700",textTransform:"uppercase",flex:1}}numberOfLines={1}>
                {b.label}
              </Text>
            )}
            <Text style={{fontSize:Math.max(8,10*SX)}}>{b.emoji}</Text>
          </View>

          {/* Badge ICI */}
          {isHere&&(
            <View style={{position:"absolute",top:3*SY,right:3*SX,
              backgroundColor:b.neon??colors.accent,borderRadius:5,
              paddingHorizontal:5,paddingVertical:1,
              shadowColor:b.neon??colors.accent,shadowOpacity:1,shadowRadius:6}}>
              <Text style={{color:"#fff",fontSize:Math.max(6,7*SX),fontWeight:"900"}}>ICI</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Label rue ────────────────────────────────────────────────────────────────
function StreetLabel({name,x,y}:{name:string;x:number;y:number}){
  return(
    <View style={{position:"absolute",left:x*SX,top:y*SY,pointerEvents:"none"}}>
      <Text style={{color:"rgba(255,255,255,0.14)",fontSize:Math.max(5,6*SX),fontWeight:"700",letterSpacing:0.8}}>
        {name.toUpperCase()}
      </Text>
    </View>
  );
}

// ─── NPC animé ────────────────────────────────────────────────────────────────
const ACTION_ICON:Record<string,string>={
  sleeping:"😴",eating:"🍽️",chatting:"💬",exercising:"💪",
  walking:"🚶",working:"💼",idle:"💭",studying:"📚"
};

function LiveNpc({npc,onPress}:{npc:NpcState;onPress:()=>void}){
  const visual=getNpcVisual(npc.id);
  const tgt=useMemo(()=>{
    const base=pct(npc.posX,npc.posY);
    const j=npcJitter(npc.id);
    return{x:base.x+j.dx,y:base.y+j.dy};
  },[npc.locationSlug]);

  const anim=useRef(new Animated.ValueXY({x:tgt.x,y:tgt.y})).current;
  const prev=useRef({x:tgt.x,y:tgt.y});
  const levelAnim=useRef(new Animated.Value(1)).current;
  const bubblePulse=useRef(new Animated.Value(1)).current;
  const prevLevel=useRef(npc.level);

  useEffect(()=>{
    if(Math.abs(prev.current.x-tgt.x)>2||Math.abs(prev.current.y-tgt.y)>2){
      prev.current=tgt;
      Animated.timing(anim,{toValue:tgt,duration:1400,
        easing:Easing.inOut(Easing.cubic),useNativeDriver:false}).start();
    }
  },[tgt.x,tgt.y]);

  useEffect(()=>{
    if(npc.level>prevLevel.current){
      prevLevel.current=npc.level;
      Animated.sequence([
        Animated.spring(levelAnim,{toValue:2,useNativeDriver:true,bounciness:22}),
        Animated.spring(levelAnim,{toValue:1,useNativeDriver:true}),
      ]).start();
    }
  },[npc.level]);

  // Pulse humeur
  useEffect(()=>{
    Animated.loop(Animated.sequence([
      Animated.timing(bubblePulse,{toValue:1.08,duration:1800,useNativeDriver:true}),
      Animated.timing(bubblePulse,{toValue:1,   duration:1800,useNativeDriver:true}),
    ])).start();
  },[]);

  const moodColor=npc.mood>65?"#38c793":npc.mood>35?"#f39c12":"#e74c3c";
  const lvlColor=npc.level>=5?"#c084fc":npc.level>=3?"#f6b94f":"#38c793";
  const icon=ACTION_ICON[npc.action]??"•";

  return(
    <Animated.View style={{
      position:"absolute",
      transform:[
        {translateX:Animated.add(anim.x,new Animated.Value(-18*SX))},
        {translateY:Animated.add(anim.y,new Animated.Value(-46*SY))},
      ],
      zIndex:20,
    }}>
      <Pressable onPress={onPress}>
        {/* Anneau humeur */}
        <Animated.View style={{
          borderWidth:2,borderColor:moodColor,borderRadius:22,
          shadowColor:moodColor,shadowOpacity:0.6,shadowRadius:6,
          transform:[{scale:bubblePulse}],
        }}>
          <AvatarSprite visual={visual} action={npc.action} size="xs"/>
        </Animated.View>
        {/* Badge niveau */}
        <Animated.View style={{
          position:"absolute",top:-5,right:-6,
          backgroundColor:lvlColor,borderRadius:7,paddingHorizontal:3,paddingVertical:0.5,
          transform:[{scale:levelAnim}],
          shadowColor:lvlColor,shadowOpacity:0.8,shadowRadius:4,
          borderWidth:0.5,borderColor:"rgba(0,0,0,0.3)",
        }}>
          <Text style={{color:"#07111f",fontSize:Math.max(6,7*SX),fontWeight:"900"}}>{npc.level}</Text>
        </Animated.View>
        {/* Nom + action */}
        <View style={{
          backgroundColor:"rgba(4,8,15,0.88)",borderRadius:6,
          paddingHorizontal:4,paddingVertical:1.5,
          flexDirection:"row",alignItems:"center",gap:2,
          marginTop:2,
          borderWidth:0.5,borderColor:"rgba(255,255,255,0.1)",
        }}>
          <Text style={{fontSize:Math.max(7,8*SX)}}>{icon}</Text>
          <Text style={{color:"#e8f0fc",fontSize:Math.max(6,7*SX),fontWeight:"700"}}>
            {npc.name.split(" ")[0]}
          </Text>
        </View>
        {/* Barre XP micro */}
        <View style={{height:2,borderRadius:1,backgroundColor:"rgba(255,255,255,0.08)",
          marginTop:1,width:36*SX,overflow:"hidden"}}>
          <View style={{height:2,width:`${npc.xp%100}%`,borderRadius:1,backgroundColor:lvlColor}}/>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Avatar joueur ────────────────────────────────────────────────────────────
function PlayerDot({posX,posY,visual}:{
  posX:number;posY:number;visual:ReturnType<typeof getAvatarVisual>;
}){
  const pos=pct(posX,posY);
  const anim=useRef(new Animated.ValueXY({x:pos.x,y:pos.y})).current;
  const prev=useRef({x:pos.x,y:pos.y});
  const pulse=useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    if(Math.abs(prev.current.x-pos.x)>1||Math.abs(prev.current.y-pos.y)>1){
      prev.current=pos;
      Animated.timing(anim,{toValue:pos,duration:500,easing:Easing.out(Easing.quad),useNativeDriver:false}).start();
    }
  },[posX,posY]);

  useEffect(()=>{
    Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:1.12,duration:900,useNativeDriver:true}),
      Animated.timing(pulse,{toValue:1,   duration:900,useNativeDriver:true}),
    ])).start();
  },[]);

  return(
    <Animated.View style={{
      position:"absolute",zIndex:30,
      transform:[
        {translateX:Animated.add(anim.x,new Animated.Value(-18*SX))},
        {translateY:Animated.add(anim.y,new Animated.Value(-48*SY))},
      ],
    }}>
      {/* Halo de pulsation */}
      <Animated.View style={{
        position:"absolute",top:-4,left:-4,right:-4,bottom:-4,
        borderRadius:26,borderWidth:2,borderColor:"rgba(56,199,147,0.4)",
        transform:[{scale:pulse}],
      }}/>
      <View style={{
        borderWidth:2.5,borderColor:colors.accent,borderRadius:22,
        shadowColor:colors.accent,shadowOpacity:0.9,shadowRadius:14,
      }}>
        <AvatarSprite visual={visual} action="idle" size="xs"/>
      </View>
      <View style={{
        backgroundColor:colors.accent,borderRadius:5,alignItems:"center",
        marginTop:2,paddingHorizontal:5,paddingVertical:1,
        shadowColor:colors.accent,shadowOpacity:0.8,shadowRadius:6,
      }}>
        <Text style={{color:"#07111f",fontSize:Math.max(7,8*SX),fontWeight:"900"}}>TOI</Text>
      </View>
    </Animated.View>
  );
}

// ─── Bulle de dialogue ────────────────────────────────────────────────────────
function Bubble({text,posX,posY}:{text:string;posX:number;posY:number}){
  const fade=useRef(new Animated.Value(0)).current;
  const pos=pct(posX,posY);
  useEffect(()=>{
    Animated.sequence([
      Animated.timing(fade,{toValue:1,duration:200,useNativeDriver:true}),
      Animated.delay(2800),
      Animated.timing(fade,{toValue:0,duration:400,useNativeDriver:true}),
    ]).start();
  },[text]);
  const bx=Math.max(6,Math.min(MAP_W-150,pos.x-60*SX));
  const by=Math.max(60*SY,pos.y-60*SY);
  return(
    <Animated.View pointerEvents="none" style={{
      position:"absolute",left:bx,top:by,opacity:fade,maxWidth:148*SX,zIndex:40,
      backgroundColor:"rgba(255,255,255,0.97)",borderRadius:12,
      paddingHorizontal:10*SX,paddingVertical:7*SY,
      shadowColor:"#000",shadowOpacity:0.3,shadowRadius:8,
    }}>
      <Text style={{color:"#07111f",fontSize:Math.max(10,11*SX),fontWeight:"500",lineHeight:16}}numberOfLines={3}>
        {text}
      </Text>
      <View style={{position:"absolute",bottom:-6,left:16*SX,
        borderLeftWidth:6,borderRightWidth:6,borderTopWidth:7,
        borderLeftColor:"transparent",borderRightColor:"transparent",
        borderTopColor:"rgba(255,255,255,0.97)"}}/>
    </Animated.View>
  );
}

// ─── Toast notification ───────────────────────────────────────────────────────
type ToastItem={id:string;npcName:string;emoji:string;text:string};
function LiveToast({toast}:{toast:ToastItem}){
  const ty=useRef(new Animated.Value(-70)).current;
  const op=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.sequence([
      Animated.parallel([
        Animated.spring(ty,{toValue:0,useNativeDriver:true,tension:90,friction:10}),
        Animated.timing(op,{toValue:1,duration:280,useNativeDriver:true}),
      ]),
      Animated.delay(3500),
      Animated.parallel([
        Animated.timing(ty,{toValue:-70,duration:350,useNativeDriver:true}),
        Animated.timing(op,{toValue:0, duration:350,useNativeDriver:true}),
      ]),
    ]).start();
  },[toast.id]);
  return(
    <Animated.View pointerEvents="none" style={{
      position:"absolute",top:94,left:12,right:12,zIndex:100,
      opacity:op,transform:[{translateY:ty}],
      backgroundColor:"rgba(4,8,15,0.96)",borderRadius:16,
      borderWidth:1,borderColor:colors.accent+"50",
      flexDirection:"row",alignItems:"center",gap:12,
      paddingHorizontal:16,paddingVertical:12,
      shadowColor:colors.accent,shadowOpacity:0.25,shadowRadius:12,
    }}>
      <View style={{width:36,height:36,borderRadius:18,backgroundColor:colors.accent+"20",
        alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.accent+"40"}}>
        <Text style={{fontSize:18}}>{toast.emoji}</Text>
      </View>
      <View style={{flex:1}}>
        <Text style={{color:colors.accent,fontWeight:"800",fontSize:13}}>{toast.npcName}</Text>
        <Text style={{color:colors.textSoft,fontSize:12}}numberOfLines={1}>{toast.text}</Text>
      </View>
      <View style={{width:8,height:8,borderRadius:4,backgroundColor:colors.accent}}/>
    </Animated.View>
  );
}

// ─── Panel NPC (bottom sheet amélioré) ───────────────────────────────────────
type ChatLine={id:string;from:"player"|"npc";text:string};

function NpcPanel({npc,onClose,onBubble}:{
  npc:NpcState;onClose:()=>void;
  onBubble:(id:string,text:string)=>void;
}){
  const visual=getNpcVisual(npc.id);
  const [chat,setChat]=useState<ChatLine[]>([{
    id:"greeting",from:"npc",
    text:getNpcDialogue(npc.id,npc.action,npc.mood,"greeting"),
  }]);
  const [input,setInput]=useState("");
  const [tab,setTab]=useState<"chat"|"stats"|"activités">("chat");
  const scrollRef=useRef<ScrollView>(null);
  const sheetY=useRef(new Animated.Value(600)).current;

  useEffect(()=>{
    Animated.spring(sheetY,{toValue:0,useNativeDriver:true,tension:65,friction:11}).start();
  },[]);

  const moodColor=npc.mood>65?"#38c793":npc.mood>35?"#f39c12":"#e74c3c";
  const lvlColor=npc.level>=5?"#c084fc":npc.level>=3?"#f6b94f":"#38c793";

  const addLine=(from:"player"|"npc",text:string)=>{
    setChat(p=>[...p,{id:`${Date.now()}-${Math.random()}`,from,text}]);
    if(from==="npc")onBubble(npc.id,text);
    setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),80);
  };

  const send=()=>{
    const t=input.trim();if(!t)return;
    setInput("");addLine("player",t);
    setTimeout(()=>{
      const busy=npc.action==="sleeping"||npc.energy<20;
      addLine("npc",getNpcDialogue(npc.id,npc.action,npc.mood,busy?"busy":"topic"));
    },600+Math.random()*500);
  };

  const sendEmote=(e:string)=>{
    addLine("player",e);
    setTimeout(()=>addLine("npc",getNpcEmoteReaction(npc.id,e)),500);
  };

  const propose=(slug:string)=>{
    const act=PROPOSABLE_ACTIVITIES.find(a=>a.slug===slug);if(!act)return;
    setTab("chat");
    addLine("player",`${act.emoji} Je te propose : ${act.label} !`);
    setTimeout(()=>{
      const{accepted,line}=getNpcActivityResponse(npc.id,npc,slug);
      addLine("npc",line);
      if(accepted)setTimeout(()=>addLine("npc",`On se retrouve à ${act.locationSlug} ?`),800);
    },700);
  };

  return(
    <Animated.View style={{
      transform:[{translateY:sheetY}],
      backgroundColor:"#06101e",
      borderTopLeftRadius:24,borderTopRightRadius:24,
      borderTopWidth:1,borderColor:"rgba(255,255,255,0.1)",
      maxHeight:460,
      shadowColor:"#000",shadowOpacity:0.8,shadowRadius:20,
    }}>
      {/* Handle */}
      <View style={{alignItems:"center",paddingTop:12,paddingBottom:4}}>
        <View style={{width:40,height:4,borderRadius:2,backgroundColor:"rgba(255,255,255,0.18)"}}/>
      </View>

      {/* Header NPC */}
      <View style={{flexDirection:"row",alignItems:"center",paddingHorizontal:18,paddingBottom:12,gap:12}}>
        <View style={{position:"relative"}}>
          <View style={{borderWidth:2.5,borderColor:moodColor,borderRadius:24,
            shadowColor:moodColor,shadowOpacity:0.5,shadowRadius:8}}>
            <AvatarSprite visual={visual} action={npc.action} size="sm"/>
          </View>
          <View style={{position:"absolute",top:-5,right:-6,
            backgroundColor:lvlColor,borderRadius:8,paddingHorizontal:5,paddingVertical:1,
            shadowColor:lvlColor,shadowOpacity:0.8,shadowRadius:4}}>
            <Text style={{color:"#07111f",fontSize:9,fontWeight:"900"}}>Nv{npc.level}</Text>
          </View>
        </View>
        <View style={{flex:1,gap:3}}>
          <Text style={{color:colors.text,fontWeight:"800",fontSize:16}}>{npc.name}</Text>
          <Text style={{color:colors.muted,fontSize:11}}>
            {ACTION_ICON[npc.action]} {ACTION_LABELS[npc.action]} · {npc.mood}% humeur
          </Text>
          {/* XP bar */}
          <View style={{height:3,borderRadius:2,backgroundColor:"rgba(255,255,255,0.07)",overflow:"hidden"}}>
            <View style={{height:3,width:`${npc.xp%100}%`,borderRadius:2,
              backgroundColor:lvlColor,shadowColor:lvlColor,shadowOpacity:0.8,shadowRadius:4}}/>
          </View>
        </View>
        {/* Mini stats */}
        <View style={{gap:4}}>
          {[
            {e:"⚡",v:`${npc.energy}%`,c:"#3b82f6"},
            {e:"💰",v:`${npc.money}`,  c:colors.gold},
            {e:"🔥",v:`${npc.streak}j`,c:"#e74c3c"},
          ].map(s=>(
            <View key={s.e} style={{flexDirection:"row",alignItems:"center",gap:3,
              backgroundColor:"rgba(255,255,255,0.05)",borderRadius:8,
              paddingHorizontal:6,paddingVertical:2}}>
              <Text style={{fontSize:9}}>{s.e}</Text>
              <Text style={{color:s.c,fontSize:9,fontWeight:"700"}}>{s.v}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={onClose} style={{padding:10,backgroundColor:"rgba(255,255,255,0.06)",borderRadius:12}}>
          <Ionicons name="close" size={16} color={colors.muted}/>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={{flexDirection:"row",gap:0,paddingHorizontal:18,marginBottom:10}}>
        {(["chat","stats","activités"] as const).map(t=>(
          <Pressable key={t} onPress={()=>setTab(t)} style={{
            flex:1,paddingVertical:9,borderRadius:12,alignItems:"center",
            backgroundColor:tab===t?colors.accent+"20":"transparent",
            borderWidth:tab===t?1:0,
            borderColor:tab===t?colors.accent+"60":"transparent",
            marginHorizontal:2,
          }}>
            <Text style={{color:tab===t?colors.accent:colors.muted,fontWeight:"700",fontSize:12}}>
              {t==="chat"?"💬 Chat":t==="stats"?"📊 Stats":"🎯 Inviter"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Chat */}
      {tab==="chat"&&(
        <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={{paddingHorizontal:18}}>
          <ScrollView ref={scrollRef} style={{maxHeight:120}} showsVerticalScrollIndicator={false}
            onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:true})}>
            {chat.map(e=>(
              <View key={e.id} style={{flexDirection:"row",justifyContent:e.from==="player"?"flex-end":"flex-start",marginBottom:6}}>
                <View style={{
                  backgroundColor:e.from==="player"?colors.accent:"rgba(255,255,255,0.08)",
                  borderRadius:14,
                  borderBottomRightRadius:e.from==="player"?3:14,
                  borderBottomLeftRadius:e.from==="npc"?3:14,
                  paddingHorizontal:12,paddingVertical:8,maxWidth:"82%"
                }}>
                  <Text style={{color:e.from==="player"?"#07111f":colors.text,fontSize:13,lineHeight:18}}>
                    {e.text}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
          {/* Emotes */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:8}}>
            <View style={{flexDirection:"row",gap:8}}>
              {QUICK_EMOTES.map(em=>(
                <Pressable key={em} onPress={()=>sendEmote(em)} style={{
                  width:38,height:38,borderRadius:19,
                  backgroundColor:"rgba(255,255,255,0.06)",
                  alignItems:"center",justifyContent:"center",
                  borderWidth:1,borderColor:"rgba(255,255,255,0.08)",
                }}>
                  <Text style={{fontSize:18}}>{em}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          {/* Input */}
          <View style={{flexDirection:"row",gap:8,alignItems:"center",paddingBottom:14}}>
            <TextInput
              style={{flex:1,backgroundColor:"rgba(255,255,255,0.07)",borderRadius:20,
                paddingHorizontal:16,paddingVertical:11,color:colors.text,fontSize:13,
                borderWidth:1,borderColor:"rgba(255,255,255,0.08)"}}
              value={input} onChangeText={setInput}
              placeholder="Dis quelque chose…" placeholderTextColor={colors.muted}
              onSubmitEditing={send} returnKeyType="send"
            />
            <Pressable onPress={send} style={{
              width:44,height:44,borderRadius:22,
              backgroundColor:input.trim()?colors.accent:"rgba(255,255,255,0.06)",
              alignItems:"center",justifyContent:"center",
            }}>
              <Ionicons name="send" size={18} color={input.trim()?"#07111f":colors.muted}/>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Stats */}
      {tab==="stats"&&(
        <View style={{paddingHorizontal:18,paddingBottom:18,gap:10}}>
          {[
            {l:"😊 Humeur",  v:npc.mood,         c:"#38c793"},
            {l:"⚡ Énergie", v:npc.energy,        c:"#3b82f6"},
            {l:"🍽️ Satiété", v:100-npc.hunger,   c:"#f39c12"},
            {l:"💧 Hygiène", v:npc.hygiene,       c:"#22d3ee"},
            {l:"🧘 Sérénité",v:100-npc.stress,   c:"#a78bfa"},
          ].map(s=>(
            <View key={s.l} style={{gap:4}}>
              <View style={{flexDirection:"row",justifyContent:"space-between"}}>
                <Text style={{color:colors.muted,fontSize:11}}>{s.l}</Text>
                <Text style={{color:s.c,fontWeight:"700",fontSize:11}}>{Math.round(s.v)}%</Text>
              </View>
              <View style={{height:6,borderRadius:3,backgroundColor:"rgba(255,255,255,0.07)",overflow:"hidden"}}>
                <View style={{height:6,width:`${Math.max(0,s.v)}%`,borderRadius:3,
                  backgroundColor:s.c,
                  shadowColor:s.c,shadowOpacity:0.5,shadowRadius:4}}/>
              </View>
            </View>
          ))}
          <View style={{flexDirection:"row",gap:8,marginTop:4}}>
            {[["💰",`${npc.money} cr`],["⭐",`Nv ${npc.level}`],["🔥",`${npc.streak}j`]].map(([e,v])=>(
              <View key={e as string} style={{flex:1,backgroundColor:"rgba(255,255,255,0.05)",
                borderRadius:12,padding:10,alignItems:"center",borderWidth:1,borderColor:"rgba(255,255,255,0.07)"}}>
                <Text style={{fontSize:16}}>{e}</Text>
                <Text style={{color:colors.text,fontWeight:"700",fontSize:12,marginTop:3}}>{v}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Activités */}
      {tab==="activités"&&(
        <ScrollView style={{maxHeight:210,paddingHorizontal:18}}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom:14,gap:8}}>
          <Text style={{color:colors.muted,fontSize:11,marginBottom:6}}>
            Propose à {npc.name.split(" ")[0]}
          </Text>
          {PROPOSABLE_ACTIVITIES.map(act=>(
            <Pressable key={act.slug} onPress={()=>propose(act.slug)} style={{
              flexDirection:"row",alignItems:"center",gap:12,
              backgroundColor:"rgba(255,255,255,0.05)",borderRadius:14,
              paddingHorizontal:14,paddingVertical:12,
              borderWidth:1,borderColor:"rgba(255,255,255,0.07)",
            }}>
              <View style={{width:40,height:40,borderRadius:20,backgroundColor:"rgba(255,255,255,0.07)",
                alignItems:"center",justifyContent:"center"}}>
                <Text style={{fontSize:22}}>{act.emoji}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={{color:colors.text,fontWeight:"700",fontSize:13}}>{act.label}</Text>
                <Text style={{color:colors.muted,fontSize:10,marginTop:2}}>{act.locationSlug}</Text>
              </View>
              <Text style={{color:colors.accent,fontWeight:"700",fontSize:12}}>Proposer →</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

// ─── Carte (canvas principal) ─────────────────────────────────────────────────
function CityMap({currentSlug,npcs,playerPos,playerVisual,onTapMap,onTapNpc,onTapBuilding,bubbles}:{
  currentSlug:string;npcs:NpcState[];
  playerPos:{x:number;y:number};
  playerVisual:ReturnType<typeof getAvatarVisual>;
  onTapMap:(px:number,py:number)=>void;
  onTapNpc:(npc:NpcState)=>void;
  onTapBuilding:(slug:string)=>void;
  bubbles:Record<string,{text:string;key:number}>;
}){
  const scaledBuildings=useMemo(()=>RAW_BUILDINGS.map(sc),[]);

  return(
    <Pressable
      onPress={e=>{
        const{locationX,locationY}=e.nativeEvent;
        onTapMap(
          Math.max(2,Math.min(98,(locationX/MAP_W)*100)),
          Math.max(2,Math.min(98,(locationY/MAP_H)*100))
        );
      }}
      style={{width:MAP_W,height:MAP_H,backgroundColor:C.bg,overflow:"hidden"}}>

      {/* ── Fond atmosphérique ──────────────────────────────────────────────── */}
      {/* Ciel dégradé (simulé) */}
      <View style={{position:"absolute",top:0,left:0,right:0,height:MAP_H*0.28,backgroundColor:"#030810"}}/>
      <View style={{position:"absolute",top:MAP_H*0.12,left:0,right:0,height:MAP_H*0.16,backgroundColor:"rgba(5,15,35,0.6)"}}/>
      <View style={{position:"absolute",top:MAP_H*0.28,left:0,right:0,bottom:0,backgroundColor:C.ground}}/>

      {/* Étoiles */}
      {STARS.map((s,i)=>(
        <View key={i} style={{
          position:"absolute",
          left:`${s.x}%`,top:`${s.y}%`,
          width:s.s,height:s.s,borderRadius:s.s/2,
          backgroundColor:C.stars,opacity:s.o,
        }}/>
      ))}

      {/* ── Zones de district (fond coloré) ────────────────────────────────── */}
      {/* Bloc NW */}
      <View style={{position:"absolute",left:0,top:0,width:144*SX,height:238*SY,backgroundColor:"#060f1e"}}/>
      {/* Bloc NM */}
      <View style={{position:"absolute",left:144*SX,top:0,width:121*SX,height:238*SY,backgroundColor:"#050f0a"}}/>
      {/* Bloc NE */}
      <View style={{position:"absolute",left:293*SX,top:0,width:97*SX,height:238*SY,backgroundColor:"#050a1a"}}/>
      {/* Bloc CW */}
      <View style={{position:"absolute",left:0,top:238*SY,width:144*SX,height:152*SY,backgroundColor:"#0c0700"}}/>
      {/* Bloc CM (place centrale) */}
      <View style={{position:"absolute",left:144*SX,top:238*SY,width:121*SX,height:152*SY,backgroundColor:"#0c0c08"}}/>
      {/* Bloc CE */}
      <View style={{position:"absolute",left:293*SX,top:238*SY,width:97*SX,height:152*SY,backgroundColor:"#0e0306"}}/>
      {/* Bloc SW — Parc */}
      <View style={{position:"absolute",left:0,top:420*SY,width:144*SX,height:180*SY,backgroundColor:C.parkBase}}/>
      {/* Bloc SM */}
      <View style={{position:"absolute",left:144*SX,top:420*SY,width:121*SX,height:180*SY,backgroundColor:"#0e0202"}}/>
      {/* Bloc SE */}
      <View style={{position:"absolute",left:293*SX,top:420*SY,width:97*SX,height:180*SY,backgroundColor:"#020208"}}/>
      {/* Bande nocturne */}
      <View style={{position:"absolute",left:0,top:594*SY,right:0,height:166*SY,backgroundColor:"#050010"}}/>

      {/* ── Rues ──────────────────────────────────────────────────────────── */}
      {RAW_STREETS.map((s,i)=>(
        <React.Fragment key={`street-${i}`}>
          {/* Corps de route */}
          <View style={{
            position:"absolute",
            left:s.x*SX,top:s.y*SY,width:s.w*SX,height:s.h*SY,
            backgroundColor:s.major?C.road:C.roadDark,
          }}/>
          {/* Bordures trottoir */}
          {s.major&&s.w>s.h&&(
            <>
              <View style={{position:"absolute",left:s.x*SX,top:(s.y-3)*SY,width:s.w*SX,height:3*SY,backgroundColor:C.sidewalk}}/>
              <View style={{position:"absolute",left:s.x*SX,top:(s.y+s.h)*SY,width:s.w*SX,height:3*SY,backgroundColor:C.sidewalk}}/>
            </>
          )}
          {s.major&&s.w<s.h&&(
            <>
              <View style={{position:"absolute",left:(s.x-3)*SX,top:s.y*SY,width:3*SX,height:s.h*SY,backgroundColor:C.sidewalk}}/>
              <View style={{position:"absolute",left:(s.x+s.w)*SX,top:s.y*SY,width:3*SX,height:s.h*SY,backgroundColor:C.sidewalk}}/>
            </>
          )}
          {/* Ligne centrale pointillée */}
          {s.major&&s.w>s.h&&[...Array(Math.floor(s.w*SX/18))].map((_,j)=>(
            <View key={j} style={{position:"absolute",
              left:j*18+1,top:(s.y+s.h/2-0.5)*SY,
              width:10,height:1.5,backgroundColor:C.neonGold,opacity:0.35}}/>
          ))}
          {s.major&&s.w<s.h&&[...Array(Math.floor(s.h*SY/18))].map((_,j)=>(
            <View key={j} style={{position:"absolute",
              top:j*18+1,left:(s.x+s.w/2-0.5)*SX,
              width:1.5,height:10,backgroundColor:C.neonGold,opacity:0.35}}/>
          ))}
        </React.Fragment>
      ))}

      {/* ── Passages piétons ──────────────────────────────────────────────── */}
      {[
        {x:118,y:207},{x:261,y:207},
        {x:118,y:387},{x:261,y:387},
        {x:118,y:567},{x:261,y:567},
      ].map((p,i)=>(
        <View key={`cross-${i}`} style={{position:"absolute",
          left:p.x*SX,top:p.y*SY,width:24*SX,height:6*SY}}>
          {[...Array(5)].map((_,j)=>(
            <View key={j} style={{position:"absolute",
              left:j*(24*SX/5),width:3*SX,height:6*SY,
              backgroundColor:"rgba(255,255,255,0.16)"}}/>
          ))}
        </View>
      ))}

      {/* ── Labels rues ──────────────────────────────────────────────────── */}
      <StreetLabel name="Boulevard Central"        x={8}   y={211}/>
      <StreetLabel name="Avenue de la République"  x={8}   y={391}/>
      <StreetLabel name="Rue du Parc"              x={8}   y={571}/>
      <StreetLabel name="Avenue Principale"        x={266} y={12} />

      {/* ── Fontaine place centrale ────────────────────────────────────────── */}
      <Fountain/>

      {/* ── Place centrale (fond) ─────────────────────────────────────────── */}
      <View style={{position:"absolute",left:148*SX,top:244*SY,width:117*SX,height:146*SY,
        borderRadius:4,backgroundColor:"#080c0a"}}/>

      {/* ── Bâtiments ─────────────────────────────────────────────────────── */}
      {scaledBuildings.map(b=>(
        <BuildingView key={b.id} b={b}
          isHere={b.slug===currentSlug}
          onPress={b.deco?undefined:()=>b.slug&&onTapBuilding(b.slug)}/>
      ))}

      {/* ── Arbres ──────────────────────────────────────────────────────────── */}
      {RAW_TREES.map((t,i)=><Tree key={`t${i}`} x={t.x} y={t.y} r={t.r}/>)}

      {/* ── Lampadaires ────────────────────────────────────────────────────── */}
      {RAW_LAMPS.map((l,i)=><Lamp key={`l${i}`} x={l.x} y={l.y}/>)}

      {/* ── Voitures ────────────────────────────────────────────────────────── */}
      {CARS.map(car=><AnimCar key={car.id} car={car}/>)}

      {/* ── Entrées metro ─────────────────────────────────────────────────── */}
      {[{x:116,y:376},{x:260,y:198}].map((m,i)=>(
        <View key={`metro-${i}`} style={{position:"absolute",
          left:m.x*SX-16*SX,top:m.y*SY-8*SY,
          width:32*SX,height:16*SY,borderRadius:5,
          backgroundColor:"#06101e",
          borderWidth:1,borderColor:"#1a44cc",
          alignItems:"center",justifyContent:"center",
          shadowColor:"#3b82f6",shadowOpacity:0.5,shadowRadius:6}}>
          <Text style={{color:"#3b82f6",fontSize:Math.max(8,9*SX),fontWeight:"900"}}>Ⓜ</Text>
        </View>
      ))}

      {/* ── Kiosque ─────────────────────────────────────────────────────────── */}
      <View style={{position:"absolute",left:200*SX,top:266*SY,
        width:18*SX,height:18*SY,borderRadius:3,
        backgroundColor:"#0a1a0a",borderWidth:0.5,borderColor:"#38c793",
        alignItems:"center",justifyContent:"center"}}>
        <Text style={{fontSize:Math.max(7,9*SX)}}>🏪</Text>
      </View>

      {/* ── NPCs ────────────────────────────────────────────────────────────── */}
      {npcs.map(npc=>(
        <LiveNpc key={npc.id} npc={npc} onPress={()=>onTapNpc(npc)}/>
      ))}

      {/* ── Joueur ──────────────────────────────────────────────────────────── */}
      <PlayerDot posX={playerPos.x} posY={playerPos.y} visual={playerVisual}/>

      {/* ── Bulles de dialogue ─────────────────────────────────────────────── */}
      {npcs.map(npc=>{
        const b=bubbles[npc.id];
        if(!b)return null;
        return<Bubble key={`bubble-${npc.id}-${b.key}`} text={b.text} posX={npc.posX} posY={npc.posY}/>;
      })}
    </Pressable>
  );
}

// ─── Screen principal ─────────────────────────────────────────────────────────
export default function WorldLiveScreen(){
  const avatar              =useGameStore(s=>s.avatar);
  const npcs                =useGameStore(s=>s.npcs);
  const tickNpcs            =useGameStore(s=>s.tickNpcs);
  const relationships       =useGameStore(s=>s.relationships);
  const travelTo            =useGameStore(s=>s.travelTo);
  const currentLocationSlug =useGameStore(s=>s.currentLocationSlug);
  const notifications       =useGameStore(s=>s.notifications);

  const [playerPos,setPlayerPos]     =useState({x:50,y:50});
  const [bubbles,setBubbles]         =useState<Record<string,{text:string;key:number}>>({});
  const [selectedNpc,setSelectedNpc] =useState<NpcState|null>(null);
  const [toast,setToast]             =useState<ToastItem|null>(null);
  const [viewMode,setViewMode]       =useState<"map"|"list">("map");

  const visual=avatar?getAvatarVisual(avatar):getNpcVisual("player");

  useEffect(()=>{
    tickNpcs();
    const t=setInterval(()=>tickNpcs(),30_000);
    return()=>clearInterval(t);
  },[]);

  // Toasts
  const prevNotifCount=useRef(notifications.length);
  useEffect(()=>{
    const delta=notifications.length-prevNotifCount.current;
    if(delta>0){
      const newOnes=notifications.slice(0,delta);
      const social=newOnes.filter(n=>n.kind==="social"&&!n.read);
      if(social.length>0){
        const n=social[0];
        setToast({id:`toast-${Date.now()}`,npcName:n.title.replace(/💬 |🎯 /g,""),
          emoji:"💬",text:n.body});
      }
    }
    prevNotifCount.current=notifications.length;
  },[notifications.length]);

  // Toast amis proches
  const prevActions=useRef(npcs.map(n=>n.action).join());
  useEffect(()=>{
    const newSig=npcs.map(n=>n.action).join();
    if(newSig===prevActions.current)return;
    prevActions.current=newSig;
    const close=npcs.filter(n=>{
      const r=relationships.find(r=>r.residentId===n.id);
      return r&&r.score>=45;
    });
    if(close.length===0)return;
    const npc=close[Math.floor(Math.random()*close.length)];
    const bldg=RAW_BUILDINGS.find(b=>b.slug===npc.locationSlug);
    if(!bldg)return;
    setToast({id:`live-${npc.id}-${Date.now()}`,npcName:npc.name,
      emoji:bldg.emoji,
      text:`est ${ACTION_LABELS[npc.action]?.toLowerCase()??"en ligne"} à ${bldg.label}`});
  },[npcs.map(n=>n.action).join()]);

  const showBubble=useCallback((id:string,text:string)=>{
    setBubbles(prev=>({...prev,[id]:{text,key:Date.now()}}));
    setTimeout(()=>setBubbles(prev=>{const n={...prev};delete n[id];return n;}),3400);
  },[]);

  // Salutation auto à proximité
  const playerPx=pct(playerPos.x,playerPos.y);
  useEffect(()=>{
    npcs.forEach(npc=>{
      const np=pct(npc.posX,npc.posY);
      const d=Math.hypot(playerPx.x-np.x,playerPx.y-np.y);
      if(d<40*SX&&!bubbles[npc.id]){
        showBubble(npc.id,getNpcDialogue(npc.id,npc.action,npc.mood,"greeting"));
      }
    });
  },[playerPos]);

  const unreadCount=notifications.filter(n=>!n.read).length;
  const currentBldg=RAW_BUILDINGS.find(b=>b.slug===currentLocationSlug);

  return(
    <View style={{flex:1,backgroundColor:C.bg}}>

      {/* ── Carte (plein écran) ──────────────────────────────────────────────── */}
      {viewMode==="map"&&(
        <CityMap
          currentSlug={currentLocationSlug}
          npcs={npcs}
          playerPos={playerPos}
          playerVisual={visual}
          onTapMap={(px,py)=>{if(!selectedNpc)setPlayerPos({x:px,y:py});}}
          onTapNpc={npc=>setSelectedNpc(npc)}
          onTapBuilding={slug=>{travelTo(slug);}}
          bubbles={bubbles}
        />
      )}

      {/* ── Vue liste ─────────────────────────────────────────────────────────── */}
      {viewMode==="list"&&(
        <ScrollView style={{flex:1,marginTop:90}} contentContainerStyle={{padding:14,gap:10}}>
          <Text style={{color:colors.muted,fontSize:10,fontWeight:"800",letterSpacing:1.5,marginBottom:2}}>
            LIEUX ACTIFS
          </Text>
          {RAW_BUILDINGS.filter(b=>b.slug&&!b.deco).map(bldg=>{
            const present=npcs.filter(n=>n.locationSlug===bldg.slug);
            const isHere=bldg.slug===currentLocationSlug;
            return(
              <View key={bldg.id} style={{
                backgroundColor:present.length>0?bldg.color+"28":"rgba(255,255,255,0.03)",
                borderRadius:16,borderWidth:1,
                borderColor:isHere?(bldg.neon??bldg.color)+"80":present.length>0?bldg.color+"50":"rgba(255,255,255,0.07)",
                padding:14,
                shadowColor:isHere?(bldg.neon??bldg.color):undefined,
                shadowOpacity:isHere?0.3:0,shadowRadius:8,
              }}>
                <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
                  <View style={{width:44,height:44,borderRadius:12,
                    backgroundColor:bldg.color+"50",borderWidth:1,borderColor:bldg.color+"60",
                    alignItems:"center",justifyContent:"center"}}>
                    <Text style={{fontSize:22}}>{bldg.emoji}</Text>
                  </View>
                  <View style={{flex:1}}>
                    <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
                      <Text style={{color:colors.text,fontWeight:"800",fontSize:14}}>{bldg.label}</Text>
                      {isHere&&<View style={{backgroundColor:colors.accent,borderRadius:6,paddingHorizontal:6,paddingVertical:1}}>
                        <Text style={{color:"#07111f",fontSize:9,fontWeight:"900"}}>ICI</Text>
                      </View>}
                    </View>
                    <Text style={{color:colors.muted,fontSize:11,marginTop:1}}>
                      {present.length===0?"Vide":`${present.length} résident${present.length>1?"s":""} présent${present.length>1?"s":""}`}
                    </Text>
                  </View>
                  <Pressable onPress={()=>{bldg.slug&&travelTo(bldg.slug);setViewMode("map");}}
                    style={{backgroundColor:bldg.color+"40",borderRadius:10,paddingHorizontal:12,paddingVertical:7,
                      borderWidth:1,borderColor:(bldg.neon??bldg.color)+"60"}}>
                    <Text style={{color:bldg.neon??colors.accent,fontSize:12,fontWeight:"700"}}>
                      {isHere?"Ici":"Aller →"}
                    </Text>
                  </Pressable>
                </View>
                {present.length>0&&(
                  <View style={{gap:6,marginTop:10}}>
                    {present.map(npc=>{
                      const moodC=npc.mood>65?"#38c793":npc.mood>35?"#f39c12":"#e74c3c";
                      const lvlC=npc.level>=5?"#c084fc":npc.level>=3?"#f6b94f":"#38c793";
                      return(
                        <Pressable key={npc.id} onPress={()=>{setViewMode("map");setSelectedNpc(npc);}}
                          style={{flexDirection:"row",alignItems:"center",gap:10,
                            backgroundColor:"rgba(255,255,255,0.04)",borderRadius:12,padding:10}}>
                          <View style={{width:10,height:10,borderRadius:5,backgroundColor:moodC,
                            shadowColor:moodC,shadowOpacity:0.8,shadowRadius:4}}/>
                          <Text style={{color:colors.text,fontWeight:"700",fontSize:13,flex:1}}>{npc.name}</Text>
                          <View style={{backgroundColor:lvlC+"22",borderRadius:6,paddingHorizontal:5,paddingVertical:2}}>
                            <Text style={{color:lvlC,fontSize:9,fontWeight:"900"}}>Nv{npc.level}</Text>
                          </View>
                          <Text style={{color:colors.muted,fontSize:10}}>{ACTION_ICON[npc.action]} {ACTION_LABELS[npc.action]}</Text>
                          <Ionicons name="chatbubble" size={14} color={colors.accent}/>
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

      {/* ── HUD flottant (top) ─────────────────────────────────────────────── */}
      <View style={{
        position:"absolute",top:0,left:0,right:0,zIndex:50,
        flexDirection:"row",alignItems:"center",
        paddingTop:50,paddingBottom:12,paddingHorizontal:14,
        backgroundColor:"rgba(2,8,16,0.88)",
        borderBottomWidth:1,borderColor:"rgba(255,255,255,0.07)",
      }}>
        <Pressable onPress={()=>router.back()}
          style={{width:34,height:34,borderRadius:17,
            backgroundColor:"rgba(255,255,255,0.08)",borderWidth:1,borderColor:"rgba(255,255,255,0.1)",
            alignItems:"center",justifyContent:"center",marginRight:10}}>
          <Ionicons name="arrow-back" size={16} color={colors.text}/>
        </Pressable>
        <View style={{flex:1}}>
          <Text style={{color:colors.text,fontWeight:"900",fontSize:16}}>🏙️ Neo Paris</Text>
          <Text style={{color:colors.muted,fontSize:10}}>
            {npcs.length} résidents · {npcs.filter(n=>n.mood>60).length} de bonne humeur
          </Text>
        </View>
        {/* Toggle map/list */}
        <View style={{flexDirection:"row",gap:4,marginRight:6}}>
          {(["map","list"] as const).map(m=>(
            <Pressable key={m} onPress={()=>setViewMode(m)} style={{
              width:34,height:34,borderRadius:10,alignItems:"center",justifyContent:"center",
              backgroundColor:viewMode===m?colors.accent+"25":"rgba(255,255,255,0.06)",
              borderWidth:viewMode===m?1:0,borderColor:viewMode===m?colors.accent+"60":"transparent",
            }}>
              <Text style={{color:viewMode===m?colors.accent:colors.muted,fontSize:15}}>
                {m==="map"?"🗺️":"☰"}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* Badge notifs */}
        <Pressable onPress={()=>router.push("/(app)/(tabs)/notifications")}
          style={{width:34,height:34,borderRadius:10,
            backgroundColor:unreadCount>0?"#e74c3c":"rgba(255,255,255,0.06)",
            alignItems:"center",justifyContent:"center",
            borderWidth:1,borderColor:unreadCount>0?"#e74c3c":"rgba(255,255,255,0.1)"}}>
          {unreadCount>0
            ?<Text style={{color:"#fff",fontSize:10,fontWeight:"900"}}>{unreadCount>9?"9+":unreadCount}</Text>
            :<Ionicons name="notifications-outline" size={16} color={colors.muted}/>
          }
        </Pressable>
      </View>

      {/* ── Barre lieu actuel (bas, au-dessus du panel NPC) ─────────────────── */}
      {viewMode==="map"&&!selectedNpc&&(
        <View style={{
          position:"absolute",bottom:0,left:0,right:0,zIndex:45,
          flexDirection:"row",alignItems:"center",gap:10,
          paddingHorizontal:14,paddingVertical:10,paddingBottom:26,
          backgroundColor:"rgba(2,8,16,0.92)",
          borderTopWidth:1,borderColor:"rgba(255,255,255,0.07)",
        }}>
          <View style={{width:38,height:38,borderRadius:11,
            backgroundColor:(currentBldg?.color??"#1a2a3a")+"60",
            borderWidth:1,borderColor:(currentBldg?.neon??currentBldg?.color??"#3a4a5a")+"60",
            alignItems:"center",justifyContent:"center"}}>
            <Text style={{fontSize:20}}>{currentBldg?.emoji??"📍"}</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={{color:colors.text,fontWeight:"700",fontSize:13}}>
              {currentBldg?.label??currentLocationSlug}
            </Text>
            <Text style={{color:colors.muted,fontSize:10}}>
              {npcs.filter(n=>n.locationSlug===currentLocationSlug).length} résidents ici · Tap pour se déplacer
            </Text>
          </View>
          {/* Avatars résidents ici */}
          <View style={{flexDirection:"row",gap:-8}}>
            {npcs.filter(n=>n.locationSlug===currentLocationSlug).slice(0,4).map((n,i)=>{
              const moodC=n.mood>65?"#38c793":n.mood>35?"#f39c12":"#e74c3c";
              return(
                <Pressable key={n.id} onPress={()=>setSelectedNpc(n)}
                  style={{
                    width:30,height:30,borderRadius:15,
                    backgroundColor:moodC+"30",
                    alignItems:"center",justifyContent:"center",
                    borderWidth:1.5,borderColor:moodC,
                    zIndex:4-i,
                  }}>
                  <Text style={{fontSize:13,color:"#fff",fontWeight:"700"}}>
                    {n.name.charAt(0)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Panel NPC (bottom sheet) ────────────────────────────────────────── */}
      {selectedNpc&&(
        <View style={{position:"absolute",bottom:0,left:0,right:0,zIndex:60}}>
          <NpcPanel npc={selectedNpc} onClose={()=>setSelectedNpc(null)} onBubble={showBubble}/>
        </View>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast&&<LiveToast key={toast.id} toast={toast}/>}

    </View>
  );
}
