"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, Modal, Pressable, ScrollView,
  Text, View, ActivityIndicator, TextInput, useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Supercluster from "supercluster";

import { hapticImpact } from "@/lib/safe-haptics";
import {
  goGhost, MOCK_PLAYERS, fetchAllPlayers,
  publishPosition, requestAndGetLocation, STATUS_CONFIG, subscribeToMap,
  heartbeatPresence, isPresenceFresh, PRESENCE_HEARTBEAT_MS,
} from "@/lib/life-map";
import type { MapPlayer, MapStatus } from "@/lib/life-map";
import {
  fetchCrewZones, checkAndTriggerWars,
  computeGlowIntensity, bastionCheckin,
  subscribeToBastionTakeovers, fetchRoiDeToulouse,
  getMyOfficerCrewId, inviteToCrew,
  type CrewZoneRich, type TakeoverNotif, type RoiDeToulouse,
} from "@/lib/crews";
import { startNpcMapEngine, stopNpcMapEngine } from "@/lib/npc-map-engine";
import { sendLocalNotification } from "@/lib/push-notifications";
import { blockUser } from "@/lib/safety";
import { requestFriend, blockRelation } from "@/lib/relationships";
import { sendFeeling } from "@/lib/match-chat";
import { claimTravelReward } from "@/lib/travel";
import { sendNpcMessage } from "@/lib/npc-chat";
import type { NpcChatTurn } from "@/lib/npc-chat";
import { ReportModal } from "@/components/report-modal";
import { useGameStore } from "@/stores/game-store";
import { supabase } from "@/lib/supabase";
import {
  fetchActiveSeason, fetchAllSeasonMissions, fetchDistricts, fetchMyParticipations,
  fetchMissionParticipantCounts, subscribeToSeasonUpdates,
  joinMission, validateMission, claimMissionReward,
  type SeasonMission, type District, type MissionParticipationStatus,
} from "@/lib/season";
import { joinFlashEvent, checkinFlashEvent } from "@/lib/flash-events";
import { ACTIVE_CITY } from "@/lib/city-config";
import { useWorldEnvironment } from "@/hooks/use-world-environment";
import { mapCanvasFilter, weatherOverlay, environmentHudLabel, crewOverlayBoost } from "@/lib/world-environment";
import { MoveMissionModal } from "@/components/move-mission-modal";
import { MapFirstSessionHint, MapPrimarySuggestion } from "@/components/map-session-guidance";
import { NpcInteraction } from "@/components/npc-interaction";
import { npcActivityShort } from "@/lib/npc-social";
import {
  groupMapOpportunities,
  MAP_OPPORTUNITY_SECTION_LABELS,
  mapOpportunityKindLabel,
  mapOpportunityIcon,
  type MapOpportunitySection,
} from "@/lib/map-opportunity-presentation";
import {
  cityPulseRoute,
  crewDominanceByDistrict,
  livingCityEventsToCityPulse,
  selectCityPulseOpportunities,
  type CityPulseSignal,
  type DistrictCrewDominance,
} from "@/lib/city-pulse";

// ── Échappement HTML — tags/noms de crew et pseudos viennent de la DB (donc
// potentiellement saisis par un joueur) et sont injectés dans des popups/SVG
// via innerHTML : sans ça, un pseudo ou un tag de crew malveillant serait une
// XSS stockée exécutée dans le navigateur de tous les autres joueurs.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// ── Matchmaking helpers ───────────────────────────────────────────────────────
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const aa = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  void:   "#04040A",
  card:   "#0E0E16",
  glass:  "rgba(8,8,15,0.88)",
  border: "rgba(255,255,255,0.07)",
  text:   "#E8E4DC",
  soft:   "#9A968E",
  muted:  "#4A4848",
  gold:   "#FFD600",
  green:  "#39FF14",
  red:    "#FF3B3B",
  blue:   "#00B4FF",
  purple: "#BF5FFF",
};

function playerKind(player: MapPlayer): { label: string; color: string } {
  if (!player.is_npc) return { label: "JOUEUR RÉEL", color: C.green };
  if (player.is_star) return { label: "OFFICIEL", color: C.gold };
  return { label: "HABITANT SIMULÉ", color: C.purple };
}

// ── MapLibre GL loader (injection dynamique dans le DOM) ──────────────────────
// Moteur : MapLibre GL JS (open-source, licence BSD-3, gratuit, pas de clé API).
// Tuiles : OpenFreeMap (https://openfreemap.org) — vecteur, gratuit, sans clé,
// sans quota. Choisi après comparaison avec Mapbox (payant au-delà d'un seuil)
// et MapTiler (quota gratuit limité) : OpenFreeMap est financé pour rester
// gratuit indéfiniment et ne nécessite aucune inscription/API key à gérer.
//
// DÉPENDANCE ÉPINGLÉE : version exacte 4.7.1 dans les deux URLs ci-dessous
// (CSS + JS), jamais de version flottante (@latest). CSP du projet : aucune
// (vérifié, ne bloque pas les Web Workers).
//
// Piste évaluée : `npm install maplibre-gl@4.7.1` + import ES au lieu du
// <script> CDN. Testé le 2026-08-24 — le bundling via Metro/Expo Web
// réussit sans erreur (+0.8 Mo sur le bundle web, cohérent). Non adopté ce
// tour faute de temps pour revalider en conditions réelles (création du
// worker, getClusterExpansionZoom — voir le contournement Supercluster
// plus bas, dont on ignore si le bug qu'il contourne existe aussi côté
// bundle npm) : re-tester l'intégralité clustering/3D/zoom d'expansion
// avant un éventuel remplacement. Ne jamais faire cohabiter CDN et bundle
// npm en même temps.
let maplibreLoaded = false;
let maplibreLoading = false;
const maplibreCallbacks: Array<() => void> = [];

function loadMaplibre(cb: () => void) {
  if (maplibreLoaded) { cb(); return; }
  maplibreCallbacks.push(cb);
  if (maplibreLoading) return;
  maplibreLoading = true;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
  document.head.appendChild(link);

  const script = document.createElement("script");
  script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
  script.onload = () => {
    maplibreLoaded = true;
    maplibreCallbacks.forEach((fn) => fn());
    maplibreCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

// ── Cercle géographique → polygone (pas de dépendance turf) ───────────────────
function circlePolygon(lat: number, lng: number, radiusMeters: number, steps = 48): number[][] {
  const coords: number[][] = [];
  const distX = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distY = radiusMeters / 110540;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    coords.push([lng + distX * Math.cos(theta), lat + distY * Math.sin(theta)]);
  }
  return coords;
}

// ── Styles Leaflet overrides (injectés une fois) ──────────────────────────────
let stylesInjected = false;
function injectMapStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .mylife-map-container .maplibregl-canvas { outline: none; }
    .mylife-map-container .maplibregl-map { background: #04040A !important; }
    .mylife-map-container .mylife-map-vignette {
      position: absolute; inset: 0; pointer-events: none; z-index: 2;
      background: radial-gradient(130% 90% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%);
    }
    .mylife-map-container .mylife-map-scanlines { display: none; }
    .mylife-map-container .mylife-map-weather {
      position: absolute; inset: 0; pointer-events: none; z-index: 3;
      opacity: 0; transition: opacity 1600ms ease, background-color 1600ms ease;
      mix-blend-mode: multiply;
    }
    .mylife-map-container .mylife-map-weather.rain {
      background-image: repeating-linear-gradient(74deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 1px, transparent 7px);
      background-size: 100% 100%;
    }
    @keyframes mylifeRainDrift { to { background-position: 0 220px; } }
    .mylife-map-container .mylife-map-weather.rain.animate { animation: mylifeRainDrift 1.1s linear infinite; }
    .mylife-map-container .mylife-map-weather.haze { backdrop-filter: blur(1px); }
    .mylife-map-container .maplibregl-ctrl-group {
      border: 1px solid rgba(255,255,255,.08) !important;
      background: rgba(8,8,15,.92) !important;
      border-radius: 10px !important; overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,.6) !important;
    }
    .mylife-map-container .maplibregl-ctrl-group button {
      background: transparent !important;
      border-bottom: 1px solid rgba(255,255,255,.06) !important;
    }
    .mylife-map-container .maplibregl-ctrl-icon { filter: invert(1) brightness(1.6); }
    .mylife-map-container .maplibregl-ctrl-attrib {
      background: rgba(4,4,10,.75) !important; color: rgba(255,255,255,.35) !important;
      font-size: 9px !important; border-radius: 4px 0 0 0 !important;
    }
    .mylife-map-container .maplibregl-ctrl-attrib a { color: rgba(255,255,255,.5) !important; }
    .mylife-tooltip .maplibregl-popup-content {
      background: rgba(4,4,10,0.92) !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      border-radius: 6px !important;
      color: #E8E4DC !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      padding: 4px 8px !important;
      box-shadow: none !important;
    }
    .mylife-tooltip .maplibregl-popup-tip { display: none !important; }

    /* Glow pulsé pour les grosses zones crew */
    @keyframes crewGlowPulse {
      0%   { opacity: 0.55; }
      50%  { opacity: 1; }
      100% { opacity: 0.55; }
    }
    .crew-zone-glow, .crew-zone-mega, .crew-zone-war {
      animation: crewGlowPulse 2.4s ease-in-out infinite;
    }
    @media (max-width: 640px) {
      .mylife-map-container .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ── Build SVG marker ──────────────────────────────────────────────────────────
function buildMarkerSvg(emoji: string, color: string, name: string, star: boolean): string {
  const size = star ? 48 : 38;
  const w = size + 16;
  const h = size + 30;
  const cx = w / 2;
  const cy = size / 2 + 8;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`,
    star ? `<circle cx="${cx}" cy="${cy}" r="${size / 2 + 7}" fill="${color}" opacity="0.18"/>` : "",
    `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="#0E0E16" stroke="${color}" stroke-width="${star ? 3.5 : 2.5}"/>`,
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${Math.round(size * 0.44)}">${emoji}</text>`,
    `<polygon points="${cx - 5},${size + 8} ${cx + 5},${size + 8} ${cx},${size + 20}" fill="${color}"/>`,
    `<rect x="${cx - name.length * 3.5 - 4}" y="${size + 20}" width="${name.length * 7 + 8}" height="11" rx="3" fill="#0E0E16" opacity="0.8"/>`,
    `<text x="${cx}" y="${size + 29}" text-anchor="middle" font-size="9" fill="${color}" font-weight="800" font-family="system-ui,sans-serif">${name}</text>`,
    `</svg>`,
  ].join("");
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// ── MapLibreMap (composant DOM pur, moteur vectoriel 3D) ──────────────────────
interface LeafletMapProps {
  players: MapPlayer[];
  myLat?: number;
  myLng?: number;
  onPlayerClick: (id: string) => void;
  onReady: () => void;
  onMapReady?: (flyFn: (lat: number, lng: number, zoom?: number, pitch?: number, bearing?: number) => void) => void;
  onError?: () => void;
  crewZones?: CrewZoneRich[];
  missions?: MissionMapFeatureSource[];
  onMissionClick?: (missionId: string) => void;
  env?: MapEnv;
  districts?: MapDistrict[];
}

type MapEnv = {
  filter: string;
  weatherKind: "haze" | "rain" | "storm" | null;
  weatherColor: string;
  weatherOpacity: number;
  animate: boolean;
};
type MapDistrict = {
  name: string; lat: number; lng: number; radius: number;
  color: string; contested: boolean; opacity: number;
};

function applyWeatherEl(el: HTMLElement | null, env: MapEnv | undefined) {
  if (!el) return;
  const kind = env?.weatherKind ?? null;
  el.className = "mylife-map-weather" + (kind ? ` ${kind}` : "") + (kind === "rain" && env?.animate ? " animate" : "");
  el.style.backgroundColor = kind ? (env?.weatherColor ?? "transparent") : "transparent";
  el.style.opacity = kind ? String(env?.weatherOpacity ?? 0) : "0";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

// ── Clustering natif MapLibre (source GeoJSON) ──────────────────────────────
// Remplace l'ancien rendu (un maplibregl.Marker DOM par joueur — un noeud DOM
// + listeners par joueur, aucun regroupement visuel à faible zoom) par une
// source GeoJSON clusterisée nativement (doc :
// maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters).
// Migration validée en prod le 2026-08-23 : clustering, zoom d'expansion,
// clic point individuel, filtres, 1000 points synthétiques — voir rapport.
const PLAYERS_SOURCE_ID = "mylife-players";
const CLUSTER_LAYER = "mylife-players-clusters";
const CLUSTER_COUNT_LAYER = "mylife-players-cluster-count";
const POINT_LAYER = "mylife-players-point";

/** Rayon/zoom max de clustering — valeurs UNIQUES partagées entre la source
 * MapLibre (rendu) et l'index Supercluster local (calcul du zoom d'expansion,
 * voir plus bas pourquoi). Toute divergence entre les deux ferait diverger
 * les cluster_id et casserait le clic sur cluster. */
function clusterOptions() {
  return { radius: typeof window !== "undefined" && window.innerWidth < 480 ? 60 : 50, maxZoom: 15 };
}

// ── Couche missions — source GeoJSON séparée, clusterisée indépendamment
// des joueurs (compteurs jamais mélangés). Réutilise le même mécanisme que
// les joueurs (setData, Supercluster local pour le zoom d'expansion — le
// worker MapLibre reste cassé pour getClusterExpansionZoom, cf. plus haut). ─
const MISSIONS_SOURCE_ID = "mylife-missions";
const MISSION_CLUSTER_LAYER = "mylife-missions-clusters";
const MISSION_CLUSTER_COUNT_LAYER = "mylife-missions-cluster-count";
const MISSION_POINT_LAYER = "mylife-missions-point";

export type MissionMapFeatureSource = {
  id: string; category: "explore" | "move" | "social"; title: string;
  userStatus: string | null; district: string | null; difficulty: string;
  starts_at: string; ends_at: string;
  reward_xp: number; reward_money: number; reward_reputation: number;
  capacity: number | null; participant_count: number;
  lat: number; lng: number; is_demo: boolean; is_qa: boolean;
};

type MissionFeatureProps = {
  mission_id: string; category: string; title: string; userStatus: string | null;
  district: string | null; difficulty: string; ends_at: string;
  reward_xp: number; participant_count: number; capacity: number | null;
  dotColor: string; is_demo: boolean; is_qa: boolean;
};

const MISSION_CATEGORY_COLOR: Record<string, string> = { explore: "#00B4FF", move: "#39FF14", social: "#FF2D78" };

function buildMissionsGeoJson(missions: MissionMapFeatureSource[]): GeoJSON.FeatureCollection<GeoJSON.Point, MissionFeatureProps> {
  const features: GeoJSON.Feature<GeoJSON.Point, MissionFeatureProps>[] = [];
  for (const m of missions) {
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
    if (m.lat < -90 || m.lat > 90 || m.lng < -180 || m.lng > 180) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [m.lng, m.lat] },
      properties: {
        mission_id: m.id, category: m.category, title: m.title, userStatus: m.userStatus,
        district: m.district, difficulty: m.difficulty, ends_at: m.ends_at,
        reward_xp: m.reward_xp, participant_count: m.participant_count, capacity: m.capacity,
        dotColor: MISSION_CATEGORY_COLOR[m.category] ?? "#FFD600",
        is_demo: m.is_demo, is_qa: m.is_qa,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function syncMissionsSource(
  map: any, missions: MissionMapFeatureSource[],
  superclusterRef: React.MutableRefObject<Supercluster<MissionFeatureProps> | null>
) {
  const source = map.getSource(MISSIONS_SOURCE_ID);
  if (!source) return;
  const geojson = buildMissionsGeoJson(missions);
  source.setData(geojson);
  const { radius, maxZoom } = clusterOptions();
  superclusterRef.current = new Supercluster<MissionFeatureProps>({ radius, maxZoom }).load(geojson.features as any);
}

type PlayerFeatureProps = {
  id: string; user_id: string; entity_type: "real_player" | "npc";
  is_real: boolean; is_npc: boolean; is_demo: boolean; is_qa: boolean;
  visibility: MapStatus; status: MapStatus; district: string | null;
  crew_id: string | null; event_id: null;
  dotColor: string; isStar: boolean; label: string; crewTag: string | null;
};

/** Construit la FeatureCollection normalisée. Une entrée invalide (coord.
 * hors plage, NaN) est simplement écartée — elle ne doit jamais faire planter
 * toute la carte. */
function buildPlayersGeoJson(players: MapPlayer[]): GeoJSON.FeatureCollection<GeoJSON.Point, PlayerFeatureProps> {
  const features: GeoJSON.Feature<GeoJSON.Point, PlayerFeatureProps>[] = [];
  for (const p of players) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id, user_id: p.user_id,
        entity_type: p.is_npc ? "npc" : "real_player",
        is_real: !p.is_npc, is_npc: p.is_npc,
        is_demo: p.is_npc, is_qa: false,
        visibility: p.status, status: p.status,
        district: p.location_name ?? null,
        crew_id: null, event_id: null,
        dotColor: p.crew_color ?? STATUS_CONFIG[p.status]?.color ?? "#FFD600",
        isStar: p.is_star, label: p.display_name.split(" ")[0],
        crewTag: p.crew_tag ?? null,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Met à jour la source MapLibre (setData, pas de recréation) ET reconstruit
 * l'index Supercluster local en parallèle avec les mêmes données/paramètres
 * — nécessaire pour que getClusterExpansionZoom (voir plus haut, worker
 * MapLibre cassé) reste synchronisé avec ce que la carte affiche réellement. */
function syncPlayersSource(
  map: any, players: MapPlayer[],
  superclusterRef: React.MutableRefObject<Supercluster<PlayerFeatureProps> | null>
) {
  const source = map.getSource(PLAYERS_SOURCE_ID);
  if (!source) return;
  const geojson = buildPlayersGeoJson(players);
  source.setData(geojson);
  const { radius, maxZoom } = clusterOptions();
  superclusterRef.current = new Supercluster<PlayerFeatureProps>({ radius, maxZoom }).load(geojson.features as any);
}

function LeafletMap({ players, myLat, myLng, onPlayerClick, onReady, onMapReady, onError, crewZones = [], missions = [], onMissionClick, env, districts = [] }: LeafletMapProps) {
  const containerRef = useRef<View>(null);
  const mapRef        = useRef<unknown>(null);
  const glRef         = useRef<unknown>(null);
  const myMarkerRef   = useRef<{ remove: () => void } | null>(null);
  const clusterReadyRef = useRef(false);
  const playersRef = useRef(players);
  playersRef.current = players;
  const missionsRef = useRef(missions);
  missionsRef.current = missions;
  const superclusterRef = useRef<Supercluster<PlayerFeatureProps> | null>(null);
  const missionSuperclusterRef = useRef<Supercluster<MissionFeatureProps> | null>(null);
  const envRef = useRef<MapEnv | undefined>(env);
  envRef.current = env;
  const weatherElRef = useRef<HTMLElement | null>(null);
  const districtsRef = useRef<MapDistrict[]>(districts);
  districtsRef.current = districts;
  // Le click handler des layers est enregistré une seule fois (map.on("load"),
  // effet mount-only) : sans ref, il resterait figé sur la version
  // d'onPlayerClick capturée au tout premier rendu (souvent avec players=[]
  // avant la fin du chargement initial) et ne trouverait plus jamais le
  // joueur correspondant à l'id cliqué. Bug réel trouvé en testant le clic
  // réel sur un point après la migration clustering.
  const onPlayerClickRef = useRef(onPlayerClick);
  onPlayerClickRef.current = onPlayerClick;
  const onMissionClickRef = useRef(onMissionClick);
  onMissionClickRef.current = onMissionClick;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const readyFiredRef = useRef(false);

  // Init carte — une seule fois
  useEffect(() => {
    injectMapStyles();
    readyFiredRef.current = false;

    // Filet de sécurité : si la carte ne charge pas (tuiles injoignables,
    // perte réseau, style cassé) sous 12s, on prévient l'UI au lieu de
    // laisser un écran gris silencieux indéfiniment.
    const loadTimeout = setTimeout(() => {
      if (!readyFiredRef.current) onErrorRef.current?.();
    }, 12_000);

    loadMaplibre(() => {
      const gl = (window as unknown as { maplibregl: unknown }).maplibregl as any;
      glRef.current = gl;
      if (!gl) { onErrorRef.current?.(); return; }

      const domNode = (containerRef.current as unknown as { _nativeTag?: HTMLElement } | null)?._nativeTag
        ?? (containerRef.current as unknown as HTMLElement | null);
      if (!domNode || !(domNode instanceof HTMLElement)) { onErrorRef.current?.(); return; }
      const mapEl = domNode;
      mapEl.classList.add("mylife-map-container");
      mapEl.style.cssText = "width:100%;height:100%;position:absolute;top:0;left:0;right:0;bottom:0;";

      // OpenFreeMap "liberty" — vecteur, gratuit, sans clé, sans quota.
      // Grading sombre appliqué en filtre CSS sur le canvas (même technique
      // qu'avec les tuiles raster précédentes) car "liberty" est un style clair.
      const map = new gl.Map({
        container: mapEl,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [1.4442, 43.6047], // Toulouse
        zoom: 11,
        pitch: 0,
        bearing: 0,
        attributionControl: { compact: true },
        antialias: true,
      });
      mapRef.current = map;

      map.addControl(new gl.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.addControl(new gl.FullscreenControl(), "bottom-right");

      map.on("load", async () => {
        const canvasContainer = map.getCanvasContainer?.() as HTMLElement | undefined;
        if (canvasContainer) {
          // Grading naturel piloté par World Environment (jamais néon).
          canvasContainer.style.transition = "filter 1600ms ease";
          canvasContainer.style.filter =
            envRef.current?.filter ??
            "invert(1) hue-rotate(215deg) brightness(1.12) contrast(0.99) saturate(1.12) sepia(0)";
        }

        // Extrusion 3D des bâtiments si la source vectorielle les expose
        // (couche "building" — présente sur les styles OpenFreeMap/OSM standards).
        // BUG CORRIGÉ : prenait Object.keys(style.sources)[0] à l'aveugle, qui
        // n'est pas forcément la source vectorielle (peut être une source
        // raster/geojson selon le style) — provoquait une erreur de style
        // MapLibre au chargement ("requires a vector source"), silencieuse
        // dans l'UI mais qui cassait ensuite tout le pipeline worker de la
        // carte : les opérations async des sources GeoJSON (dont le calcul du
        // zoom d'expansion des clusters) ne recevaient plus jamais de réponse.
        try {
          const style = map.getStyle();
          const vectorSourceId = style?.sources
            ? Object.keys(style.sources).find((k) => style.sources[k]?.type === "vector")
            : undefined;
          if (vectorSourceId) {
            map.addLayer({
              id: "mylife-3d-buildings",
              source: vectorSourceId,
              "source-layer": "building",
              type: "fill-extrusion",
              minzoom: 14,
              paint: {
                "fill-extrusion-color": "#1a1830",
                "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                "fill-extrusion-opacity": 0.75,
              },
            });
          }
        } catch {
          // Style sans couche "building" exploitable : pas bloquant, la carte reste 2D à cet endroit
        }

        // Overlays d'ambiance
        const vignetteEl = document.createElement("div");
        vignetteEl.className = "mylife-map-vignette";
        mapEl.appendChild(vignetteEl);
        const weatherEl = document.createElement("div");
        weatherEl.className = "mylife-map-weather";
        weatherEl.setAttribute("aria-hidden", "true");
        mapEl.appendChild(weatherEl);
        weatherElRef.current = weatherEl;
        applyWeatherEl(weatherEl, envRef.current);

        // ── Zones crew (polygones GeoJSON — pas de géométrie "circle" native) ──
        const features = crewZones.map((zone) => {
          const isBastion = (zone as CrewZoneRich & { is_bastion?: boolean }).is_bastion ?? false;
          const col       = zone.crew?.color ?? "#FFD600";
          const members   = zone.crew?.member_count ?? 1;
          const glow      = computeGlowIntensity(members);
          return {
            type: "Feature",
            properties: {
              color: col,
              fillOpacity: isBastion ? 0.16 : 0.05 + glow * 0.12,
              lineOpacity: isBastion ? 1.0 : 0.35 + glow * 0.5,
              lineWidth: isBastion ? 3 : 1 + glow * 2.5,
            },
            geometry: { type: "Polygon", coordinates: [circlePolygon(zone.lat, zone.lng, zone.radius)] },
          };
        });
        map.addSource("crew-zones", { type: "geojson", data: { type: "FeatureCollection", features } });
        map.addLayer({
          id: "crew-zones-fill", type: "fill", source: "crew-zones",
          paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "fillOpacity"] },
        });
        map.addLayer({
          id: "crew-zones-line", type: "line", source: "crew-zones",
          paint: { "line-color": ["get", "color"], "line-opacity": ["get", "lineOpacity"], "line-width": ["get", "lineWidth"] },
        });

        // Labels de zone (HTML markers, réutilise le style de badge existant)
        crewZones.forEach((zone) => {
          const isBastion = (zone as CrewZoneRich & { is_bastion?: boolean }).is_bastion ?? false;
          const col       = zone.crew?.color ?? "#FFD600";
          const members   = zone.crew?.member_count ?? 1;
          const rep       = zone.crew?.reputation ?? 0;
          const isBig     = members >= 10;
          const labelW    = isBastion ? 88 : 72 + (isBig ? 8 : 0);
          const tagSvg = [
            `<svg xmlns="http://www.w3.org/2000/svg" width="${labelW}" height="28">`,
            `<rect x="0" y="0" width="${labelW}" height="28" rx="7" fill="#04040A" stroke="${col}" stroke-width="${isBig ? 1.5 : 1}" opacity="${isBig ? 0.92 : 0.78}"/>`,
            isBig ? `<circle cx="14" cy="14" r="4" fill="${col}" opacity="0.85"/>` : `<circle cx="14" cy="14" r="3" fill="${col}" opacity="0.5"/>`,
            `<text x="${labelW / 2}" y="18" text-anchor="middle" font-size="${isBastion ? 12 : isBig ? 11 : 10}" fill="${col}" font-weight="900" font-family="system-ui,sans-serif">${isBastion ? "🏰 " : escapeHtml(zone.crew?.emoji ?? "") + " "}${escapeHtml(zone.crew?.tag ?? "")} · ${isBastion ? "BASE" : members}</text>`,
            `</svg>`,
          ].join("");
          const el = document.createElement("div");
          el.innerHTML = `<img src="data:image/svg+xml,${encodeURIComponent(tagSvg)}" width="${labelW}" height="28" />`;
          const popup = new gl.Popup({ closeButton: false, offset: 18, className: "mylife-tooltip" }).setHTML(
            `<b style="color:${col}">${isBastion ? "🏰 " : ""}${escapeHtml(zone.crew?.emoji ?? "")} ${escapeHtml(zone.crew?.tag ?? "CREW")}</b><br/>
             <span style="opacity:.7">${escapeHtml(zone.name)}</span><br/>👥 ${members} · ⭐ ${rep} rep`
          );
          new gl.Marker({ element: el }).setLngLat([zone.lng, zone.lat]).setPopup(popup).addTo(map);
        });

        // ── Clustering natif joueurs+PNJ (source GeoJSON, MapLibre gère le
        // regroupement lui-même — pas de calcul de cluster côté React) ──────
        {
          const { radius, maxZoom } = clusterOptions();
          map.addSource(PLAYERS_SOURCE_ID, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            cluster: true,
            clusterMaxZoom: maxZoom,
            clusterRadius: radius, // rayon plus large sur mobile (cible tactile)
          });

          map.addLayer({
            id: CLUSTER_LAYER, type: "circle", source: PLAYERS_SOURCE_ID,
            filter: ["has", "point_count"],
            paint: {
              "circle-color": [
                "step", ["get", "point_count"],
                "#BF5FFF", 10, "#00B4FF", 30, "#FFD600",
              ],
              "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 30, 26],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#04040A",
              "circle-opacity": 0.9,
            },
          });
          map.addLayer({
            id: CLUSTER_COUNT_LAYER, type: "symbol", source: PLAYERS_SOURCE_ID,
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 13,
            },
            paint: { "text-color": "#04040A" },
          });
          map.addLayer({
            id: POINT_LAYER, type: "circle", source: PLAYERS_SOURCE_ID,
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ["get", "dotColor"],
              "circle-radius": ["case", ["get", "isStar"], 9, 6],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#04040A",
            },
          });

          // Zoom d'expansion réel — calculé par un index Supercluster tenu en
          // local (voir superclusterRef), pas un zoom+2 arbitraire.
          // NOTE TECHNIQUE : source.getClusterExpansionZoom() (l'API MapLibre
          // qui délègue au worker) ne répond jamais dans ce build CDN — testé
          // et confirmé en prod (le callback reste pending indéfiniment, sans
          // erreur, cause du bug non identifiée précisément malgré
          // investigation — possiblement un souci d'appariement Actor/worker
          // propre au chargement MapLibre via <script> CDN plutôt qu'un bundle
          // npm). Contournement robuste : Supercluster est LE moteur que
          // MapLibre utilise en interne pour ses sources GeoJSON clusterisées ;
          // en faisant tourner la même lib avec les mêmes paramètres
          // (clusterOptions()) sur les mêmes données côté client, le zoom
          // d'expansion obtenu est mathématiquement identique à celui que le
          // worker aurait renvoyé — ce n'est pas une approximation.
          map.on("click", CLUSTER_LAYER, (e: any) => {
            const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
            const clusterId = features[0]?.properties?.cluster_id;
            if (clusterId == null || !superclusterRef.current) return;
            try {
              const zoom = superclusterRef.current.getClusterExpansionZoom(clusterId);
              map.easeTo({ center: features[0].geometry.coordinates, zoom, duration: 500 });
            } catch {
              // cluster_id inconnu de l'index local (désync momentanée pendant
              // un setData concurrent) — pas grave, le joueur re-clique.
            }
          });
          map.on("click", POINT_LAYER, (e: any) => {
            const id = e.features?.[0]?.properties?.id;
            if (id) onPlayerClickRef.current(id);
          });
          map.on("mouseenter", CLUSTER_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", CLUSTER_LAYER, () => { map.getCanvas().style.cursor = ""; });
          map.on("mouseenter", POINT_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", POINT_LAYER, () => { map.getCanvas().style.cursor = ""; });

          // Hover : un seul popup réutilisé (pas un par joueur) — évite de
          // recréer des noeuds DOM en boucle au survol.
          const hoverPopup = new gl.Popup({ closeButton: false, offset: 14, className: "mylife-tooltip" });
          map.on("mousemove", POINT_LAYER, (e: any) => {
            const f = e.features?.[0];
            if (!f) return;
            const props = f.properties as PlayerFeatureProps;
            hoverPopup
              .setLngLat(f.geometry.coordinates)
              .setHTML(
                `<b style="color:${props.dotColor}">${escapeHtml(props.label)}</b>${props.crewTag ? ` <span style="opacity:.6">[${escapeHtml(props.crewTag)}]</span>` : ""}`
              )
              .addTo(map);
          });
          map.on("mouseleave", POINT_LAYER, () => hoverPopup.remove());

          clusterReadyRef.current = true;
          syncPlayersSource(map, playersRef.current, superclusterRef);

          // ── Couche missions — source séparée, jamais mélangée aux
          // compteurs joueurs (has/["!",has] filtrent uniquement dans cette
          // source, aucune interférence avec PLAYERS_SOURCE_ID). ───────────
          map.addSource(MISSIONS_SOURCE_ID, {
            type: "geojson", data: { type: "FeatureCollection", features: [] },
            cluster: true, clusterMaxZoom: maxZoom, clusterRadius: radius,
          });
          map.addLayer({
            id: MISSION_CLUSTER_LAYER, type: "circle", source: MISSIONS_SOURCE_ID,
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#FFD600",
              "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 15, 24],
              "circle-stroke-width": 2, "circle-stroke-color": "#04040A", "circle-opacity": 0.85,
            },
          });
          map.addLayer({
            id: MISSION_CLUSTER_COUNT_LAYER, type: "symbol", source: MISSIONS_SOURCE_ID,
            filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 12 },
            paint: { "text-color": "#04040A" },
          });
          // Icônes cohérentes DA MyLife (pas d'emoji brut) — glyphes SVG
          // vectoriels, un cercle coloré par catégorie + symbole distinctif :
          // boussole (Explorer), chevrons (Bouger), deux points reliés (Social).
          const MISSION_ICON_SVG: Record<string, string> = {
            explore: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="15" fill="#00B4FF" stroke="#04040A" stroke-width="2"/><path d="M17 9 L20 17 L17 25 L14 17 Z" fill="#04040A"/></svg>`,
            move: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="15" fill="#39FF14" stroke="#04040A" stroke-width="2"/><path d="M10 13 L17 9 L24 13 M10 21 L17 25 L24 21" stroke="#04040A" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            social: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="15" fill="#FF2D78" stroke="#04040A" stroke-width="2"/><circle cx="12" cy="15" r="3.2" fill="#04040A"/><circle cx="22" cy="15" r="3.2" fill="#04040A"/><path d="M8 24c0-4 3-6 4-6h10c1 0 4 2 4 6" stroke="#04040A" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
          };
          await Promise.all(Object.entries(MISSION_ICON_SVG).map(([key, svg]) => new Promise<void>((resolve) => {
            if (map.hasImage(`mylife-mission-${key}`)) { resolve(); return; }
            const img = new Image();
            img.onload = () => { map.addImage(`mylife-mission-${key}`, img); resolve(); };
            img.onerror = () => resolve();
            img.src = "data:image/svg+xml," + encodeURIComponent(svg);
          })));

          map.addLayer({
            id: MISSION_POINT_LAYER, type: "symbol", source: MISSIONS_SOURCE_ID,
            filter: ["!", ["has", "point_count"]],
            layout: {
              "icon-image": ["case", ["==", ["get", "category"], "explore"], "mylife-mission-explore",
                ["==", ["get", "category"], "move"], "mylife-mission-move", "mylife-mission-social"],
              "icon-size": 1, "icon-allow-overlap": true,
            },
          });

          map.on("click", MISSION_CLUSTER_LAYER, (e: any) => {
            const features = map.queryRenderedFeatures(e.point, { layers: [MISSION_CLUSTER_LAYER] });
            const clusterId = features[0]?.properties?.cluster_id;
            if (clusterId == null || !missionSuperclusterRef.current) return;
            try {
              const zoom = missionSuperclusterRef.current.getClusterExpansionZoom(clusterId);
              map.easeTo({ center: features[0].geometry.coordinates, zoom, duration: 500 });
            } catch { /* désync momentanée, le joueur re-clique */ }
          });
          map.on("click", MISSION_POINT_LAYER, (e: any) => {
            const id = e.features?.[0]?.properties?.mission_id;
            if (id) onMissionClickRef.current?.(id);
          });
          map.on("mouseenter", MISSION_CLUSTER_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", MISSION_CLUSTER_LAYER, () => { map.getCanvas().style.cursor = ""; });
          map.on("mouseenter", MISSION_POINT_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", MISSION_POINT_LAYER, () => { map.getCanvas().style.cursor = ""; });

          const missionHoverPopup = new gl.Popup({ closeButton: false, offset: 14, className: "mylife-tooltip" });
          map.on("mousemove", MISSION_POINT_LAYER, (e: any) => {
            const f = e.features?.[0];
            if (!f) return;
            const props = f.properties as MissionFeatureProps;
            missionHoverPopup
              .setLngLat(f.geometry.coordinates)
              .setHTML(`<b style="color:${props.dotColor}">${escapeHtml(props.title)}</b>${props.district ? ` <span style="opacity:.6">· ${escapeHtml(props.district)}</span>` : ""}`)
              .addTo(map);
          });
          map.on("mouseleave", MISSION_POINT_LAYER, () => missionHoverPopup.remove());

          syncMissionsSource(map, missionsRef.current, missionSuperclusterRef);

          // Hook QA — expose l'instance map pour des tests d'intégration
          // stables (attendre map.idle, projeter les coordonnées réelles
          // d'une feature, cliquer au centre exact). Ne renvoie rien de
          // sensible (pas de données joueur), gardé en permanence plutôt
          // que retiré/réajouté à chaque test.
          (window as any).__mylifeMapDebug = { map, sourceId: PLAYERS_SOURCE_ID, missionsSourceId: MISSIONS_SOURCE_ID };
        }

        if (onMapReady) {
          const reducedMotion = prefersReducedMotion();
          onMapReady((lat: number, lng: number, zoom = 16, pitch = 55, bearing = -12) => {
            map.flyTo({
              center: [lng, lat],
              zoom,
              pitch: reducedMotion ? 0 : pitch,
              bearing: reducedMotion ? 0 : bearing,
              duration: reducedMotion ? 0 : (zoom < 14 ? 1200 : 2500),
              essential: true,
            });
          });
        }

        readyFiredRef.current = true;
        clearTimeout(loadTimeout);
        onReady();
      });

      // Erreur fatale de style (tuiles injoignables, style corrompu...) avant
      // même le premier "load" — l'utilisateur doit voir un message, pas un
      // écran gris. Les erreurs après chargement (ex: une image manquante)
      // sont bénignes et n'affichent rien de cassé à l'écran ; seule
      // l'absence de premier "load" déclenche l'état d'erreur ici.
      map.on("error", (e: unknown) => {
        console.warn("[MapLibre]", e);
        if (!readyFiredRef.current) {
          clearTimeout(loadTimeout);
          onErrorRef.current?.();
        }
      });
    });

    return () => {
      clearTimeout(loadTimeout);
      clusterReadyRef.current = false;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, []); // mount once

  // Mise à jour joueurs quand ils changent — setData() sur la source
  // existante (pas de recréation de carte, pas de perte de zoom/pitch/
  // bearing, pas de listeners dupliqués, pas de marqueurs DOM dupliqués).
  useEffect(() => {
    const map = mapRef.current as any;
    const gl = glRef.current as any;
    if (!map || !gl) return;

    const applyData = () => syncPlayersSource(map, players, superclusterRef);
    if (clusterReadyRef.current) applyData();
    else map.once("load", applyData);
  }, [players]);

  useEffect(() => {
    const map = mapRef.current as any;
    const gl = glRef.current as any;
    if (!map || !gl) return;
    const applyMissions = () => syncMissionsSource(map, missions, missionSuperclusterRef);
    if (clusterReadyRef.current) applyMissions();
    else map.once("load", applyMissions);
  }, [missions]);

  useEffect(() => {
    const map = mapRef.current as any;
    const gl = glRef.current as any;
    myMarkerRef.current?.remove();
    myMarkerRef.current = null;
    if (!map || !gl || myLat == null || myLng == null) return;

    const addMarker = () => {
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Ma position");
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;pointer-events:none;";
      el.innerHTML = '<div style="width:28px;height:28px;border-radius:14px;background:#FFD600;border:3px solid #04040A;box-shadow:0 0 16px #FFD600;display:flex;align-items:center;justify-content:center;font-size:14px">🧢</div><div style="margin-top:2px;padding:1px 5px;border-radius:4px;background:#04040A;color:#FFD600;border:1px solid rgba(255,214,0,.55);font:900 9px system-ui,sans-serif">MOI</div>';
      myMarkerRef.current = new gl.Marker({ element: el, anchor: "bottom" }).setLngLat([myLng, myLat]).addTo(map);
    };

    if (clusterReadyRef.current) addMarker();
    else map.once("load", addMarker);

    return () => {
      myMarkerRef.current?.remove();
      myMarkerRef.current = null;
    };
  }, [myLat, myLng]);

  // ── World Environment : grading du canvas + voile météo ──────────────
  useEffect(() => {
    const map = mapRef.current as any;
    const canvasContainer = map?.getCanvasContainer?.() as HTMLElement | undefined;
    if (canvasContainer && env?.filter) canvasContainer.style.filter = env.filter;
    applyWeatherEl(weatherElRef.current, env);
  }, [env?.filter, env?.weatherKind, env?.weatherOpacity, env?.weatherColor, env?.animate]);

  // ── Territoires de crew au niveau quartier (fill + outline, opacité basse) ──
  const districtsAppliedRef = useRef("");
  useEffect(() => {
    const map = mapRef.current as any;
    const gl = glRef.current as any;
    if (!map || !gl) return;

    const apply = () => {
      if (!map.getStyle?.()) return;
      const list = districtsRef.current;
      const sig = JSON.stringify(list.map((d) => [d.name, d.color, d.contested, Math.round(d.opacity * 100), Math.round(d.radius)]));
      if (sig === districtsAppliedRef.current && map.getSource("mylife-districts")) return;
      districtsAppliedRef.current = sig;

      const features = list.map((d) => ({
        type: "Feature" as const,
        properties: { color: d.color, fillOpacity: d.opacity, contested: d.contested ? 1 : 0 },
        geometry: { type: "Polygon" as const, coordinates: [circlePolygon(d.lat, d.lng, d.radius)] },
      }));
      const data = { type: "FeatureCollection" as const, features };
      const src = map.getSource("mylife-districts");
      if (src) { src.setData(data); return; }
      try {
        map.addSource("mylife-districts", { type: "geojson", data });
        const firstSymbol = (map.getStyle().layers ?? []).find((l: any) => l.type === "symbol")?.id;
        map.addLayer({
          id: "mylife-districts-fill", type: "fill", source: "mylife-districts",
          paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "fillOpacity"] },
        }, firstSymbol);
        map.addLayer({
          id: "mylife-districts-line", type: "line", source: "mylife-districts",
          filter: ["!=", ["get", "contested"], 1],
          paint: { "line-color": ["get", "color"], "line-opacity": 0.3, "line-width": 1 },
        }, firstSymbol);
        // Contesté : contour tireté (indice de FORME, pas seulement la couleur)
        map.addLayer({
          id: "mylife-districts-contested", type: "line", source: "mylife-districts",
          filter: ["==", ["get", "contested"], 1],
          paint: { "line-color": ["get", "color"], "line-opacity": 0.9, "line-width": 2, "line-dasharray": [2, 2] },
        }, firstSymbol);
      } catch { /* style sans couche compatible : on ignore */ }
    };

    if (clusterReadyRef.current) apply();
    else map.once?.("load", apply);
  }, [districts]);

  return (
    <View
      ref={containerRef}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}

// ── Player Sheet ──────────────────────────────────────────────────────────────
function PlayerSheet({ player, myCrewId, playerId, npcOpportunity, onClose, onInvite, onReport, onBlock, onGoTo, traveling, onChatNpc, onFeedback, onNavigate }: {
  player: MapPlayer | null; myCrewId: string | null; onClose: () => void;
  playerId: string | null;
  npcOpportunity: { label: string; route: string } | null;
  onInvite: (p: MapPlayer) => void;
  onReport: (p: MapPlayer) => void;
  onBlock:  (p: MapPlayer) => void;
  onGoTo: (p: MapPlayer) => void;
  traveling: boolean;
  onChatNpc: (p: MapPlayer) => void;
  onFeedback: (t: string) => void;
  onNavigate: (r: string) => void;
}) {
  const scale = useRef(new Animated.Value(0.95)).current;
  const [addState, setAddState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [feelState, setFeelState] = useState<"idle" | "loading" | "sent" | "matched" | "error">("idle");
  const [crewInviteState, setCrewInviteState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  useEffect(() => {
    if (player) Animated.spring(scale, { toValue: 1, tension: 200, friction: 18, useNativeDriver: true }).start();
    setAddState("idle");
    setFeelState("idle");
    setCrewInviteState("idle");
  }, [player]);
  if (!player) return null;

  async function handleCrewInvite() {
    if (!player || !myCrewId || player.is_npc || crewInviteState === "loading" || crewInviteState === "sent") return;
    hapticImpact("light");
    setCrewInviteState("loading");
    const res = await inviteToCrew(myCrewId, player.user_id);
    setCrewInviteState(res.ok ? "sent" : "error");
  }

  async function handleAddFriend() {
    if (!player || player.is_npc || addState === "loading" || addState === "sent") return;
    hapticImpact("light");
    setAddState("loading");
    const res = await requestFriend(player.user_id);
    setAddState(res.ok ? "sent" : "error");
  }

  async function handleFeeling() {
    if (!player || player.is_npc || feelState === "loading" || feelState === "sent" || feelState === "matched") return;
    hapticImpact("medium");
    setFeelState("loading");
    const res = await sendFeeling(player.user_id);
    if (res.error) { setFeelState("error"); return; }
    if (res.matched && res.conversationId) {
      setFeelState("matched");
      hapticImpact("heavy");
      router.push(`/(app)/match-chat?conversationId=${res.conversationId}&targetName=${encodeURIComponent(player.display_name)}&targetEmoji=${encodeURIComponent(player.avatar_emoji)}` as never);
      onClose();
    } else {
      setFeelState("sent");
    }
  }

  const cfg = STATUS_CONFIG[player.status];
  const kind = playerKind(player);
  const min = Math.round((Date.now() - new Date(player.updated_at).getTime()) / 60000);
  const freshness = min < 2 ? "À l'instant" : min < 60 ? `Il y a ${min} min` : "Il y a + d'1h";

  return (
    <Modal transparent animationType="slide" visible={!!player} onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <Animated.View style={{
        transform: [{ scale }],
        backgroundColor: C.card,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 32, gap: 14,
        borderTopWidth: 1, borderColor: C.border,
        width: "100%", maxWidth: 460, alignSelf: "center",
      }}>
        <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: C.muted, alignSelf: "center" }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{
            width: 66, height: 66, borderRadius: 22,
            backgroundColor: cfg.color + "14", borderWidth: 2.5, borderColor: cfg.color,
            alignItems: "center", justifyContent: "center",
            shadowColor: cfg.color, shadowOpacity: 0.5, shadowRadius: 14,
          }}>
            <Text style={{ fontSize: 32 }}>{player.avatar_emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: C.text, fontSize: 19, fontWeight: "900" }}>{player.display_name}</Text>
              <View style={{ backgroundColor: kind.color + "22", borderRadius: 5,
                paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: kind.color + "55" }}>
                <Text style={{ color: kind.color, fontSize: 9, fontWeight: "900" }}>{kind.label}</Text>
              </View>
            </View>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>
              Niveau {player.level} · {player.location_name ?? "Toulouse"}
            </Text>
          </View>
          <View style={{
            alignItems: "center", gap: 4, backgroundColor: cfg.color + "14", borderRadius: 12,
            paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: cfg.color + "35",
          }}>
            <Text style={{ fontSize: 20 }}>{cfg.emoji}</Text>
            <Text style={{ color: cfg.color, fontSize: 9, fontWeight: "900" }}>
              {player.is_npc ? (npcActivityShort(player.last_action) ?? "Ville").toUpperCase() : cfg.label}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: "#08080F", borderRadius: 14, padding: 14, gap: 10,
          borderWidth: 1, borderColor: C.border }}>
          {player.last_action && (
            <View style={{ gap: 3 }}>
              <Text style={{ color: player.is_npc ? C.purple : C.muted, fontSize: 9, fontWeight: "900" }}>
                {player.is_npc ? "ACTIVITÉ ACTUELLE" : "DERNIÈRE ACTIVITÉ"}
              </Text>
              <Text style={{ color: C.soft, fontSize: 13 }}>{player.last_action}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Text style={{ fontSize: 15 }}>📍</Text>
            <Text style={{ color: C.soft, fontSize: 13 }}>
              {player.location_name ?? "Toulouse"}
              {player.location_verified
                ? <Text style={{ color: C.green }}> · Zone vérifiée</Text>
                : <Text style={{ color: C.muted }}> · Zone déclarée</Text>}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Text style={{ fontSize: 15 }}>🕐</Text>
            <Text style={{ color: C.muted, fontSize: 13 }}>{freshness}</Text>
          </View>
        </View>

        {!player.is_npc && (
          <Pressable
            onPress={() => { onGoTo(player); onClose(); }}
            disabled={traveling}
            style={{
              backgroundColor: traveling ? C.muted + "18" : C.gold + "18", borderRadius: 14,
              paddingVertical: 13, alignItems: "center",
              borderWidth: 1, borderColor: traveling ? C.border : C.gold + "45",
            }}>
            <Text style={{ color: traveling ? C.muted : C.gold, fontSize: 13, fontWeight: "900" }}>
              🚶 Rejoindre à pied · +XP trajet réel
            </Text>
          </Pressable>
        )}

        {player.is_npc && playerId && (
          <NpcInteraction
            player={player}
            playerId={playerId}
            nearbyOpportunity={npcOpportunity}
            palette={{ surface: "#08080F", border: C.border, text: C.text, muted: C.soft, accent: C.purple }}
            onFeedback={onFeedback}
            onNavigate={(r) => { onClose(); onNavigate(r); }}
            onClose={onClose}
            onOpenFullChat={() => { onChatNpc(player); onClose(); }}
          />
        )}

        {!player.is_npc && player.status !== "ghost" && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => { hapticImpact("light"); onInvite(player); onClose(); }}
                style={{
                  flex: 1, backgroundColor: "#08080F", borderRadius: 14,
                  paddingVertical: 14, alignItems: "center",
                  borderWidth: 1, borderColor: C.border,
                }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: "900" }}>👋 Saluer</Text>
              </Pressable>
              <Pressable
                onPress={handleFeeling}
                disabled={feelState === "loading" || feelState === "sent" || feelState === "matched"}
                style={{
                  flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center",
                  backgroundColor: feelState === "matched" ? C.green
                    : feelState === "error" ? C.red : cfg.color,
                  shadowColor: cfg.color, shadowOpacity: 0.4, shadowRadius: 16,
                }}>
                <Text style={{ color: "#04040A", fontSize: 13, fontWeight: "900" }}>
                  {feelState === "loading" ? "..."
                    : feelState === "sent" ? "💫 Envoyé"
                    : feelState === "matched" ? "✓ Match !"
                    : feelState === "error" ? "Erreur — réessayer"
                    : "💫 Feeling"}
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => { hapticImpact("medium"); onInvite(player); onClose(); }}
              style={{
                backgroundColor: cfg.color + "18", borderRadius: 14,
                paddingVertical: 13, alignItems: "center",
                borderWidth: 1, borderColor: cfg.color + "45",
              }}>
              <Text style={{ color: cfg.color, fontSize: 13, fontWeight: "900" }}>
                Proposer une activité publique
              </Text>
            </Pressable>
            <Pressable
              onPress={handleAddFriend}
              disabled={addState === "loading" || addState === "sent"}
              style={{
                backgroundColor: addState === "sent" ? C.green + "18" : addState === "error" ? C.red + "18" : "#08080F",
                borderRadius: 14, paddingVertical: 13, alignItems: "center",
                borderWidth: 1,
                borderColor: addState === "sent" ? C.green + "50" : addState === "error" ? C.red + "50" : C.border,
              }}>
              <Text style={{
                color: addState === "sent" ? C.green : addState === "error" ? C.red : C.text,
                fontSize: 13, fontWeight: "900",
              }}>
                {addState === "loading" ? "Envoi..."
                  : addState === "sent" ? "✓ Demande envoyée"
                  : addState === "error" ? "Erreur — réessayer"
                  : "➕ Ajouter en ami"}
              </Text>
            </Pressable>
            {myCrewId && (
              <Pressable
                onPress={handleCrewInvite}
                disabled={crewInviteState === "loading" || crewInviteState === "sent"}
                style={{
                  backgroundColor: crewInviteState === "sent" ? C.green + "18" : crewInviteState === "error" ? C.red + "18" : "#08080F",
                  borderRadius: 14, paddingVertical: 13, alignItems: "center",
                  borderWidth: 1,
                  borderColor: crewInviteState === "sent" ? C.green + "50" : crewInviteState === "error" ? C.red + "50" : C.purple + "45",
                }}>
                <Text style={{
                  color: crewInviteState === "sent" ? C.green : crewInviteState === "error" ? C.red : C.purple,
                  fontSize: 13, fontWeight: "900",
                }}>
                  {crewInviteState === "loading" ? "Envoi..."
                    : crewInviteState === "sent" ? "✓ Invitation envoyée"
                    : crewInviteState === "error" ? "Erreur — réessayer"
                    : "🛡️ Inviter dans mon crew"}
                </Text>
              </Pressable>
            )}
          </View>
        )}
        {!player.is_npc && <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={() => { onReport(player); onClose(); }}
            style={{ flex: 1, paddingVertical: 12, alignItems: "center",
              backgroundColor: "#08080F", borderRadius: 10, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700" }}>🚩 Signaler</Text>
          </Pressable>
          <Pressable onPress={() => { onBlock(player); onClose(); }}
            style={{ flex: 1, paddingVertical: 12, alignItems: "center",
              backgroundColor: C.red + "10", borderRadius: 10,
              borderWidth: 1, borderColor: C.red + "30" }}>
            <Text style={{ color: C.red, fontSize: 12, fontWeight: "700" }}>🚫 Bloquer</Text>
          </Pressable>
        </View>}
      </Animated.View>
    </Modal>
  );
}

// ── Status Picker ─────────────────────────────────────────────────────────────
function StatusPicker({ current, onChange, onClose }: {
  current: MapStatus; onChange: (s: MapStatus) => void; onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(4,4,10,0.82)",
        justifyContent: "center", padding: 24 }} onPress={onClose}>
        <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 20, gap: 8,
          borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: "900",
            marginBottom: 8, textAlign: "center", letterSpacing: 1.5 }}>TON STATUT</Text>
          {(Object.keys(STATUS_CONFIG) as MapStatus[]).map((key) => {
            const cfg = STATUS_CONFIG[key];
            const active = key === current;
            return (
              <Pressable key={key}
                onPress={() => { hapticImpact("light"); onChange(key); onClose(); }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14,
                  backgroundColor: active ? cfg.color + "14" : "#08080F",
                  borderWidth: 1, borderColor: active ? cfg.color + "50" : C.border,
                }}>
                <Text style={{ fontSize: 22 }}>{cfg.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: active ? cfg.color : C.text, fontSize: 15, fontWeight: "800" }}>{cfg.label}</Text>
                  <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{cfg.desc}</Text>
                </View>
                {active && <Text style={{ color: cfg.color, fontSize: 16 }}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Filter Pills ──────────────────────────────────────────────────────────────
function FilterPills({ active, onChange, compact = false }: {
  active: MapStatus | "all";
  onChange: (f: MapStatus | "all") => void;
  compact?: boolean;
}) {
  const pills: { key: MapStatus | "all"; label: string; color: string }[] = [
    { key: "all",   label: "Tous",    color: C.gold },
    { key: "free",  label: "Libres",  color: STATUS_CONFIG.free.color  },
    { key: "vibe",  label: "Sortie",  color: STATUS_CONFIG.vibe.color  },
    { key: "charo", label: "Feeling", color: STATUS_CONFIG.charo.color },
    { key: "taken", label: "Crew",    color: STATUS_CONFIG.taken.color },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={{ position: "absolute", top: compact ? 64 : 108, left: 0, right: compact ? 68 : 0 }}
      contentContainerStyle={{ paddingHorizontal: compact ? 12 : 16, gap: compact ? 6 : 8, flexDirection: "row" }}>
      {pills.map((f) => {
        const on = active === f.key;
        return (
          <Pressable key={f.key} onPress={() => onChange(f.key)}
            style={{
              minHeight: compact ? 38 : undefined,
              paddingHorizontal: compact ? 11 : 12, paddingVertical: compact ? 8 : 6, borderRadius: 20,
              backgroundColor: on ? f.color : "rgba(8,8,15,0.88)",
              borderWidth: 1, borderColor: on ? f.color : C.border,
              justifyContent: "center",
            }}>
            <Text style={{ color: on ? "#04040A" : C.soft, fontSize: 11, fontWeight: "800" }}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CityPulseStrip({ signals, onPress }: {
  signals: CityPulseSignal[];
  onPress: (signal: CityPulseSignal) => void;
}) {
  if (signals.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={{ position: "absolute", top: 188, left: 0, right: 0, zIndex: 5 }}
      pointerEvents="box-none"
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      {signals.map((signal) => (
        <Pressable key={signal.id} onPress={() => onPress(signal)}
          style={{
            width: 230, backgroundColor: "rgba(8,8,15,0.92)", borderRadius: 8,
            paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1,
            borderColor: signal.kind === "CHALLENGE" ? C.red + "80" : signal.kind === "MISSION" ? C.gold + "80" : C.border,
          }}>
          <Text style={{ color: C.gold, fontSize: 10, fontWeight: "900" }} numberOfLines={1}>
            {signal.district ? `${signal.kind} - ${signal.district}` : signal.kind}
          </Text>
          <Text style={{ color: C.text, fontSize: 12, fontWeight: "900", marginTop: 3 }} numberOfLines={1}>
            {signal.title}
          </Text>
          <Text style={{ color: C.soft, fontSize: 11, marginTop: 2 }} numberOfLines={2}>
            {signal.body}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function CrewDominanceStrip({ districts, onPress }: {
  districts: DistrictCrewDominance[];
  onPress: () => void;
}) {
  if (districts.length === 0) return null;
  return (
    <View style={{ position: "absolute", top: 270, left: 16, zIndex: 5, gap: 6, maxWidth: 230 }}>
      {districts.slice(0, 3).map((item) => (
        <Pressable key={`${item.district}:${item.dominant.id}`} onPress={onPress}
          style={{
            backgroundColor: item.state === "contested" ? C.red + "22" : "rgba(8,8,15,0.88)",
            borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
            borderWidth: 1, borderColor: item.state === "contested" ? C.red + "70" : C.border,
          }}>
          <Text style={{ color: item.state === "contested" ? C.red : C.gold, fontSize: 10, fontWeight: "900" }} numberOfLines={1}>
            {item.state === "contested" ? "CONTESTE" : "DOMINANT"} - {item.district}
          </Text>
          <Text style={{ color: C.text, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>
            {item.dominant.name}{item.challenger ? ` vs ${item.challenger.name}` : ""} - {item.trend}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function MobileMapContextDrawer({
  visible,
  signals,
  districts,
  hudLabel,
  takeoverAlert,
  roi,
  onClose,
  onPulsePress,
  onCrewPress,
  onRoiPress,
}: {
  visible: boolean;
  signals: CityPulseSignal[];
  hudLabel: string;
  districts: DistrictCrewDominance[];
  takeoverAlert: TakeoverNotif | null;
  roi: RoiDeToulouse | null;
  onClose: () => void;
  onPulsePress: (signal: CityPulseSignal) => void;
  onCrewPress: () => void;
  onRoiPress: () => void;
}) {
  const slide = useRef(new Animated.Value(380)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(380);
    Animated.timing(slide, { toValue: 0, duration: 210, useNativeDriver: true }).start();
  }, [slide, visible]);

  useEffect(() => {
    if (!visible || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible]);

  if (!visible) return null;

  const groupedSignals = groupMapOpportunities(signals);
  const renderSignalCard = (signal: CityPulseSignal) => (
    <Pressable key={signal.id} onPress={() => onPulsePress(signal)} style={{
      minHeight: 74, backgroundColor: "rgba(255,255,255,0.045)", borderRadius: 8, padding: 12,
      borderWidth: 1,
      borderColor: signal.kind === "CHALLENGE" ? C.red + "70" : signal.kind === "MISSION" ? C.gold + "70" : C.border,
    }}>
      <Text style={{ color: signal.kind === "CHALLENGE" ? C.red : C.gold, fontSize: 10, fontWeight: "900" }} numberOfLines={1}>
        {mapOpportunityIcon(signal.kind)} {mapOpportunityKindLabel(signal.kind)}{signal.district ? ` · ${signal.district}` : ""}
      </Text>
      <Text style={{ color: C.text, fontSize: 13, fontWeight: "900", marginTop: 3 }} numberOfLines={2}>
        {signal.title}
      </Text>
      <Text style={{ color: C.soft, fontSize: 11, marginTop: 3 }} numberOfLines={3}>
        {signal.body}
      </Text>
    </Pressable>
  );
  const renderSignalSection = (section: MapOpportunitySection) => {
    const items = groupedSignals[section];
    if (items.length === 0) return null;
    return (
      <View key={section} style={{ gap: 8 }}>
        <Text style={{ color: C.soft, fontSize: 10, fontWeight: "900", marginTop: 4 }}>
          {MAP_OPPORTUNITY_SECTION_LABELS[section].toUpperCase()}
        </Text>
        {items.map(renderSignalCard)}
      </View>
    );
  };

  return (
    <View
      accessibilityViewIsModal
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, flexDirection: "row", justifyContent: "flex-end" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer les informations de la carte"
        onPress={onClose}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
      />
      <Animated.View style={{
        width: "88%", maxWidth: 360, height: "100%",
        backgroundColor: C.card, borderLeftWidth: 1, borderColor: C.border,
        paddingTop: 12, paddingBottom: 12,
        transform: [{ translateX: slide }],
      }}>
        <View style={{
          minHeight: 56, paddingHorizontal: 16, paddingBottom: 10,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          borderBottomWidth: 1, borderColor: C.border,
        }}>
          <View>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: "900" }}>Autour de toi</Text>
            <Text style={{ color: C.soft, fontSize: 11, marginTop: 2 }}>{hudLabel}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            onPress={onClose}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: C.text, fontSize: 23 }}>×</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, paddingBottom: 28, gap: 10 }}>
          {renderSignalSection("now")}
          {renderSignalSection("nearby")}

          {(takeoverAlert || districts.length > 0 || groupedSignals.crew.length > 0) && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: C.soft, fontSize: 10, fontWeight: "900", marginTop: 4 }}>CREW / TERRITOIRES</Text>
              {groupedSignals.crew.map(renderSignalCard)}
              {takeoverAlert && (
                <Pressable onPress={onCrewPress} style={{
                  minHeight: 64, backgroundColor: takeoverAlert.newCrewColor + "18", borderRadius: 8, padding: 12,
                  borderWidth: 1, borderColor: takeoverAlert.newCrewColor + "70",
                  flexDirection: "row", alignItems: "center", gap: 10,
                }}>
                  <Text style={{ fontSize: 22 }}>{takeoverAlert.newCrewEmoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: takeoverAlert.newCrewColor, fontSize: 10, fontWeight: "900" }}>CONQUÊTE</Text>
                    <Text style={{ color: C.text, fontSize: 12, fontWeight: "800", marginTop: 2 }} numberOfLines={2}>
                      [{takeoverAlert.newCrewTag}] a pris {takeoverAlert.bastionName}
                    </Text>
                  </View>
                  <Text style={{ color: C.soft, fontSize: 16 }}>→</Text>
                </Pressable>
              )}
              {districts.map((item) => (
                <Pressable key={`${item.district}:${item.dominant.id}`} onPress={onCrewPress} style={{
                  minHeight: 62, backgroundColor: item.state === "contested" ? C.red + "12" : "rgba(255,255,255,0.045)",
                  borderRadius: 8, padding: 12, borderWidth: 1,
                  borderColor: item.state === "contested" ? C.red + "60" : C.border,
                }}>
                  <Text style={{ color: item.state === "contested" ? C.red : C.gold, fontSize: 10, fontWeight: "900" }}>
                    {item.state === "contested" ? "DISTRICT CONTESTÉ" : "CREW DOMINANT"} · {item.district}
                  </Text>
                  <Text style={{ color: C.text, fontSize: 12, fontWeight: "800", marginTop: 3 }} numberOfLines={2}>
                    {item.dominant.name}{item.challenger ? ` vs ${item.challenger.name}` : ""} · {item.trend}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {renderSignalSection("city")}

          {roi && (
            <Pressable onPress={onRoiPress} style={{
              minHeight: 62, backgroundColor: C.gold + "10", borderRadius: 8, padding: 12,
              borderWidth: 1, borderColor: C.gold + "45", flexDirection: "row", alignItems: "center", gap: 10,
            }}>
              <Text style={{ fontSize: 22 }}>{roi.avatar_emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.gold, fontSize: 10, fontWeight: "900" }}>ROI DE TOULOUSE</Text>
                <Text style={{ color: C.text, fontSize: 12, fontWeight: "800", marginTop: 2 }} numberOfLines={1}>
                  {roi.display_name}{roi.crew_tag ? ` · [${roi.crew_tag}]` : ""}
                </Text>
              </View>
              <Text style={{ color: C.soft, fontSize: 16 }}>→</Text>
            </Pressable>
          )}

          {!takeoverAlert && signals.length === 0 && districts.length === 0 && !roi && (
            <Text style={{ color: C.muted, fontSize: 13, textAlign: "center", paddingVertical: 36 }}>
              Rien de prioritaire autour de toi pour le moment.
            </Text>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function LifeMapScreen() {
  const { width: viewportWidth } = useWindowDimensions();
  const isMobileWeb = viewportWidth <= 640;
  const avatar           = useGameStore((s) => s.avatar);
  const playerLevel      = useGameStore((s) => s.playerLevel ?? 1);
  const markQuestAction  = useGameStore((s) => s.markQuestAction);
  const livingCity       = useGameStore((s) => s.livingCity);
  const hasHydrated      = useGameStore((s) => s.hasHydrated);
  const mapIntroDismissed = useGameStore((s) => s.mapIntroDismissed);
  const dismissMapIntro  = useGameStore((s) => s.dismissMapIntro);

  const [myUserId,     setMyUserId]     = useState<string | null>(null);
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setMyUserId(data?.user?.id ?? null));
  }, []);
  // Identité locale pour la mémoire PNJ / le chat local quand il n'y a pas
  // de session Supabase (mode profil local). Aligne le web sur le natif.
  const npcActorId = myUserId ?? "local_user";

  const [players,      setPlayers]      = useState<MapPlayer[]>([]);
  const [crewZones,    setCrewZones]    = useState<CrewZoneRich[]>([]);
  // Lien profond depuis une notification Saison 1 ("clic ouvre la mission
  // concernée") : ?missionId=... ouvre directement la fiche correspondante
  // une fois les missions chargées.
  const { missionId: deepLinkMissionId } = useLocalSearchParams<{ missionId?: string }>();
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [seasonMissions, setSeasonMissions] = useState<SeasonMission[]>([]);
  const [missionDistricts, setMissionDistricts] = useState<District[]>([]);
  const [missionCounts, setMissionCounts] = useState<Record<string, number>>({});
  const [myMissionParticipations, setMyMissionParticipations] = useState<Record<string, MissionParticipationStatus>>({});
  const [missionFilter, setMissionFilter] = useState<"all" | "explore" | "move" | "social" | "available" | "in_progress" | "done">("all");
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [moveModalMission, setMoveModalMission] = useState<SeasonMission | null>(null);
  const [missionBusy, setMissionBusy] = useState(false);
  const [missionError, setMissionError] = useState<string | null>(null);

  async function refreshSeasonMissions() {
    const season = await fetchActiveSeason();
    if (!season) return;
    setSeasonId(season.id);
    const [ms, ds, counts, parts] = await Promise.all([
      fetchAllSeasonMissions(season.id), fetchDistricts(),
      fetchMissionParticipantCounts(season.id), fetchMyParticipations(),
    ]);
    setSeasonMissions(ms);
    setMissionDistricts(ds);
    setMissionCounts(counts);
    setMyMissionParticipations(parts);
  }

  useEffect(() => {
    refreshSeasonMissions();
    // Un seul abonnement Realtime pour toute la saison (pas un canal par
    // mission) — tout changement (nouvelle mission, join, validation,
    // récompense, expiration) redéclenche un simple refetch groupé.
    const sub = subscribeToSeasonUpdates(() => refreshSeasonMissions());
    return () => { sub?.unsubscribe(); };
  }, []);

  // Ouverture automatique de la fiche mission depuis un lien de notification
  useEffect(() => {
    if (deepLinkMissionId && seasonMissions.some((m) => m.id === deepLinkMissionId)) {
      setSelectedMissionId(deepLinkMissionId);
    }
  }, [deepLinkMissionId, seasonMissions]);

  const districtById = Object.fromEntries(missionDistricts.map((d) => [d.id, d]));

  // Mémoïsé : sans ça, ce tableau est une NOUVELLE référence à chaque rendu
  // du composant (heartbeat de présence toutes les 60s, etc.), ce qui
  // redéclenchait syncMissionsSource en boucle dans LeafletMap et faisait
  // recalculer les clusters MapLibre en continu — un cluster repéré pour un
  // clic pouvait avoir déjà changé de forme quelques centaines de ms plus
  // tard, rendant le clic silencieusement inopérant. Bug réel trouvé en
  // testant le clic réel sur un cluster de missions.
  const missionMapFeatures: MissionMapFeatureSource[] = useMemo(() => seasonMissions
    .filter((m) => {
      const status = myMissionParticipations[m.id] ?? null;
      if (missionFilter === "explore" || missionFilter === "move" || missionFilter === "social") return m.category === missionFilter;
      if (missionFilter === "available") return !status && m.status === "available" && new Date(m.ends_at) > new Date();
      if (missionFilter === "in_progress") return status === "joined" || status === "in_progress" || status === "validated";
      if (missionFilter === "done") return status === "rewarded";
      return true;
    })
    .filter((m) => m.approx_lat != null && m.approx_lng != null)
    .map((m) => ({
      id: m.id, category: m.category, title: m.title,
      userStatus: myMissionParticipations[m.id] ?? null,
      district: m.district_id ? districtById[m.district_id]?.name ?? null : null,
      difficulty: m.difficulty, starts_at: m.starts_at, ends_at: m.ends_at,
      reward_xp: m.reward_xp, reward_money: m.reward_money, reward_reputation: m.reward_reputation,
      capacity: m.capacity, participant_count: missionCounts[m.id] ?? 0,
      lat: m.approx_lat as number, lng: m.approx_lng as number,
      is_demo: false, is_qa: false,
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [seasonMissions, myMissionParticipations, missionCounts, missionFilter, missionDistricts]);

  const selectedMission = seasonMissions.find((m) => m.id === selectedMissionId) ?? null;

  async function handleMissionAction() {
    if (!selectedMission) return;
    const status = myMissionParticipations[selectedMission.id];
    setMissionError(null);
    setMissionBusy(true);
    try {
      if (!status) {
        const res = await joinMission(selectedMission.id);
        if (!res.ok) { setMissionError(res.error ?? "Erreur"); return; }
        setMyMissionParticipations((p) => ({ ...p, [selectedMission.id]: "joined" }));
        setMapFeedback("Mission commencée");
        return;
      }
      if (status === "joined" || status === "in_progress") {
        if (selectedMission.category === "move") {
          setMoveModalMission(selectedMission);
          return;
        }
        if (selectedMission.category === "social") {
          if (selectedMission.linked_event_id) {
            await joinFlashEvent(selectedMission.linked_event_id);
            const loc = await requestAndGetLocation();
            if (!loc) { setMissionError("Position GPS requise pour le check-in"); return; }
            const checkin = await checkinFlashEvent(selectedMission.linked_event_id, loc.lat, loc.lng);
            if (!checkin.ok) { setMissionError(checkin.error ?? "Check-in impossible"); return; }
          }
          const res = await validateMission(selectedMission.id);
          if (!res.ok) { setMissionError(res.error ?? "Erreur"); return; }
          setMyMissionParticipations((p) => ({ ...p, [selectedMission.id]: "validated" }));
          setMapFeedback("Mission validée · récompense prête");
          return;
        }
        const loc = await requestAndGetLocation();
        if (!loc) { setMissionError("Position GPS requise pour valider"); return; }
        const res = await validateMission(selectedMission.id, loc.lat, loc.lng);
        if (!res.ok) { setMissionError(res.error ?? "Erreur"); return; }
        setMyMissionParticipations((p) => ({ ...p, [selectedMission.id]: "validated" }));
        setMapFeedback("Mission validée · récompense prête");
        return;
      }
      if (status === "validated") {
        const res = await claimMissionReward(selectedMission.id);
        if (!res.ok) { setMissionError(res.error ?? "Erreur"); return; }
        setMyMissionParticipations((p) => ({ ...p, [selectedMission.id]: "rewarded" }));
        setMapFeedback(`+${selectedMission.reward_xp} XP · +${selectedMission.reward_money} Wory`);
      }
    } finally {
      setMissionBusy(false);
    }
  }
  const [myStatus,     setMyStatus]     = useState<MapStatus>("ghost");
  const [myLocation,   setMyLocation]   = useState<{ lat: number; lng: number } | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [selected,     setSelected]     = useState<MapPlayer | null>(null);
  const [showPicker,   setShowPicker]   = useState(false);
  const [filter,       setFilter]       = useState<MapStatus | "all">("all");
  const [reportTarget,    setReportTarget]    = useState<MapPlayer | null>(null);
  const [blocked,         setBlocked]         = useState<string[]>([]);
  const [mapReady,        setMapReady]        = useState(false);
  const [mapFailed,       setMapFailed]       = useState(false);
  const [mapRetryKey,     setMapRetryKey]     = useState(0);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [bastionAlert,    setBastionAlert]    = useState<{ zone: CrewZoneRich; reward: number } | null>(null);
  const [checkinDone,     setCheckinDone]     = useState(false);
  const [takeoverAlert,   setTakeoverAlert]   = useState<TakeoverNotif | null>(null);
  const [roi,             setRoi]             = useState<RoiDeToulouse | null>(null);
  const [myCrewId,        setMyCrewId]        = useState<string | null>(null);
  const [recentPulseIds,  setRecentPulseIds]  = useState<string[]>([]);
  const [showMapContext,  setShowMapContext]  = useState(false);
  const [primarySuggestionDismissed, setPrimarySuggestionDismissed] = useState(false);
  const [mapFeedback, setMapFeedback] = useState<string | null>(null);
  const flyToRef = useRef<((lat: number, lng: number, zoom?: number, pitch?: number, bearing?: number) => void) | null>(null);

  useEffect(() => {
    if (!mapFeedback) return;
    const timeout = setTimeout(() => setMapFeedback(null), 3500);
    return () => clearTimeout(timeout);
  }, [mapFeedback]);

  useEffect(() => {
    if (!isMobileWeb) setShowMapContext(false);
  }, [isMobileWeb]);

  useEffect(() => {
    getMyOfficerCrewId().then(setMyCrewId);
  }, []);

  // ── Trajet réel à pied vers un autre joueur ──────────────────────────────
  // Aucune téléportation : on suit la position GPS réelle (watchPosition),
  // on cumule la distance effectivement parcourue entre chaque mise à jour,
  // et l'arrivée + la récompense ne se déclenchent que quand on est vraiment
  // à proximité de la cible.
  type TravelSession = {
    targetId: string; targetName: string; targetLat: number; targetLng: number;
    destinationVerified: boolean; startAt: number; lastLat: number; lastLng: number;
    distanceCovered: number; watchId: number;
  };
  const [travel, setTravel] = useState<TravelSession | null>(null);
  const [travelResult, setTravelResult] = useState<{ xp: number } | null>(null);

  // ── Chat PNJ — moteur local déterministe, LLM en bonus facultatif ───────
  const [npcChatTarget, setNpcChatTarget] = useState<MapPlayer | null>(null);
  const [npcHistory, setNpcHistory] = useState<NpcChatTurn[]>([]);
  const [npcInput, setNpcInput] = useState("");
  const [npcSending, setNpcSending] = useState(false);
  const [npcError, setNpcError] = useState<string | null>(null);
  const [npcQuickReplies, setNpcQuickReplies] = useState<string[]>([]);
  const [npcEngine, setNpcEngine] = useState<"local" | "anthropic" | "openai">("local");

  async function sendToNpcText(text: string) {
    if (!npcChatTarget || !text.trim() || npcSending) return;
    const trimmed = text.trim();
    setNpcInput("");
    setNpcError(null);
    setNpcQuickReplies([]);
    const nextHistory: NpcChatTurn[] = [...npcHistory, { role: "me", text: trimmed }];
    setNpcHistory(nextHistory);
    setNpcSending(true);
    hapticImpact("light");
    // Délai d'écriture simulé — évite une réponse instantanée irréaliste.
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 500));
    const res = await sendNpcMessage(
      npcActorId, npcChatTarget.user_id, npcChatTarget.display_name, npcChatTarget.last_action, npcHistory, trimmed
    );
    if (res.ok && res.reply) {
      setNpcHistory((prev) => [...prev, { role: "npc", text: res.reply as string }]);
      setNpcQuickReplies(res.quickReplies ?? []);
      setNpcEngine(res.engine ?? "local");
    } else {
      setNpcError(res.error ?? "Erreur PNJ");
    }
    setNpcSending(false);
  }
  const sendToNpc = () => sendToNpcText(npcInput);
  const travelRef = useRef<TravelSession | null>(null);
  travelRef.current = travel;

  function handleGoTo(p: MapPlayer) {
    if (!myLocation || typeof navigator === "undefined" || !navigator.geolocation) return;
    hapticImpact("medium");
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setTravel((prev) => {
          if (!prev) return prev;
          const step = haversineMeters({ lat: prev.lastLat, lng: prev.lastLng }, { lat: latitude, lng: longitude });
          const next: TravelSession = {
            ...prev, lastLat: latitude, lastLng: longitude,
            distanceCovered: prev.distanceCovered + (step > 3 ? step : 0), // ignore le bruit GPS < 3m
          };
          const remaining = haversineMeters({ lat: latitude, lng: longitude }, { lat: next.targetLat, lng: next.targetLng });
          if (remaining < 30 && next.distanceCovered >= 80) {
            navigator.geolocation.clearWatch(next.watchId);
            const durationS = (Date.now() - next.startAt) / 1000;
            claimTravelReward(next.targetId, next.distanceCovered, durationS, next.destinationVerified)
              .then((res) => { if (res.ok) setTravelResult({ xp: res.xp ?? 0 }); });
            hapticImpact("heavy");
            return null;
          }
          return next;
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setTravel({
      targetId: p.user_id, targetName: p.display_name, targetLat: p.lat, targetLng: p.lng,
      destinationVerified: p.location_verified, startAt: Date.now(),
      lastLat: myLocation.lat, lastLng: myLocation.lng, distanceCovered: 0, watchId,
    });
    zoomAnimTrigger(myLocation.lat, myLocation.lng);
  }

  function cancelTravel() {
    if (travel && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(travel.watchId);
    }
    setTravel(null);
  }

  useEffect(() => () => {
    if (travelRef.current && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(travelRef.current.watchId);
    }
  }, []);

  // Recalculée toutes les 20s pour faire disparaître localement les joueurs
  // dont la présence a expiré, même sans nouvel événement Realtime (un client
  // qui ferme l'app sans repasser Ghost ne pousse plus aucune mutation).
  const [presenceTick, setPresenceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPresenceTick((t) => t + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  const visible = players.filter((p) =>
    p.status !== "ghost" &&
    !blocked.includes(p.user_id) &&
    (p.is_npc || isPresenceFresh(p.updated_at)) &&
    (filter === "all" || p.status === filter)
  );
  const visibleRealCount = visible.filter((p) => !p.is_npc).length;
  const visibleNpcCount = visible.length - visibleRealCount;
  const cityPulseSignals = useMemo(() => {
    const livingSignals = livingCityEventsToCityPulse(livingCity?.events ?? []);
    const lookingFor = avatar?.lookingFor ?? [];
    return selectCityPulseOpportunities(livingSignals, {
      district: avatar?.homeDistrict ?? "Capitole",
      crewId: myCrewId,
      // Respecte le choix fait à la création de l'avatar (pas de nouveau système).
      wantsDating: lookingFor.some((x) => /rencontre/i.test(x)),
      wantsSocial: lookingFor.some((x) => /ami|sortie|discussion|social/i.test(x)),
      recentSignalIds: recentPulseIds,
    });
  }, [avatar?.homeDistrict, avatar?.lookingFor, livingCity?.events, myCrewId, recentPulseIds]);
  const npcOpportunity = useMemo(() => {
    const s = cityPulseSignals[0];
    if (!s) return null;
    return {
      label: s.district ? `Voir ${mapOpportunityKindLabel(s.kind)} · ${s.district}` : `Voir ${mapOpportunityKindLabel(s.kind)}`,
      route: cityPulseRoute(s),
    };
  }, [cityPulseSignals]);
  const crewDominance = useMemo(() => {
    const inputs = crewZones.length > 0
      ? crewZones.map((zone) => ({
          id: zone.crew_id,
          name: zone.crew.name,
          district: zone.name,
          reputation: zone.crew.reputation,
          activity: Math.min(100, Math.max(0, zone.crew.member_count * 7)),
          territoryCount: zone.is_bastion ? 2 : 1,
          trend24h: zone.last_activity_at ? 2 : 0,
        }))
      : (livingCity?.crews ?? []).map((crew) => ({
          id: crew.id,
          name: crew.name,
          district: crew.district,
          reputation: crew.reputation,
          activity: crew.activity,
          territoryCount: 1,
          trend24h: 0,
        }));
    return Object.values(crewDominanceByDistrict(inputs))
      .sort((a, b) => (b.state === "contested" ? 1 : 0) - (a.state === "contested" ? 1 : 0) || b.dominant.score - a.dominant.score)
      .slice(0, 3);
  }, [crewZones, livingCity?.crews]);
  void presenceTick; // dépendance volontaire pour forcer le recalcul périodique

  // ── World Environment (jour/nuit + météo) ───────────────────────────
  const env = useWorldEnvironment();
  const mapEnv = useMemo(() => {
    const w = weatherOverlay(env);
    return {
      filter: mapCanvasFilter(env),
      weatherKind: w.kind,
      weatherColor: w.color,
      weatherOpacity: w.opacity,
      animate: env.ambientIntensity > 0.3 && (w.kind === "rain"),
    };
  }, [env]);

  const hudLabel = useMemo(() => environmentHudLabel(env, ACTIVE_CITY.name), [env]);

  const mapDistricts = useMemo(() => {
    const moods = livingCity?.districtStates ?? {};
    const contestedSet = new Set(crewDominance.filter((d) => d.state === "contested").map((d) => d.district));
    return crewZones.map((zone) => {
      const mood = moods[zone.name]?.mood;
      const base = zone.is_bastion ? 0.07 : 0.045;
      return {
        name: zone.name,
        lat: zone.lat,
        lng: zone.lng,
        radius: zone.radius * 1.4,
        color: zone.crew?.color ?? "#FFD600",
        contested: contestedSet.has(zone.name),
        opacity: Math.min(0.16, base * crewOverlayBoost(env, mood)),
      };
    });
  }, [crewZones, crewDominance, livingCity?.districtStates, env]);

  function handleCityPulsePress(signal: CityPulseSignal) {
    setShowMapContext(false);
    setPrimarySuggestionDismissed(true);
    setRecentPulseIds((ids) => [signal.id, ...ids.filter((id) => id !== signal.id)].slice(0, 12));
    router.push(cityPulseRoute(signal) as never);
  }

  function handleCrewContextPress() {
    setShowMapContext(false);
    router.push("/(app)/territories" as never);
  }

  function handleRoiPress() {
    setShowMapContext(false);
    router.push("/(app)/leaderboard" as never);
  }

  // Zones crew + détection guerres
  useEffect(() => {
    fetchCrewZones().then((zones) => {
      setCrewZones(zones);
      checkAndTriggerWars(zones);
    });
  }, []);

  // Feature virale 1 — Subscribe aux takeovers de bastions
  useEffect(() => {
    const sub = subscribeToBastionTakeovers((notif) => {
      setTakeoverAlert(notif);
      void sendLocalNotification("🏴 Bastion pris !", notif.bastionName ? `${notif.newCrewEmoji} [${notif.newCrewTag}] a conquis ${notif.bastionName}` : "Un bastion vient d'être conquis");
      setTimeout(() => setTakeoverAlert(null), 8000); // auto-dismiss 8s
    });
    return () => { sub?.unsubscribe(); };
  }, []);

  // Feature virale 3 — Roi de Toulouse (chargé au montage)
  useEffect(() => {
    fetchRoiDeToulouse().then(setRoi);
  }, []);

  // NPC map engine — démarre quand la map est ouverte, stoppe au démontage
  useEffect(() => {
    startNpcMapEngine();
    return () => stopNpcMapEngine();
  }, []);

  // Auto-fly vers la position du joueur dès que la map est prête + position connue
  useEffect(() => {
    if (!mapReady || !myLocation || !flyToRef.current) return;
    flyToRef.current(myLocation.lat, myLocation.lng, 17);
  }, [mapReady]); // une seule fois au montage

  // Heartbeat de présence — retouche updated_at pendant que la map est ouverte
  // et que le joueur n'est pas Ghost, pour que sa ligne reste dans la fenêtre
  // de fraîcheur RLS (5 min). S'arrête net au démontage : fermer l'onglet ou
  // quitter l'écran suffit à laisser la présence expirer naturellement.
  useEffect(() => {
    if (!myLocation || myStatus === "ghost") return;
    let cancelled = false;
    async function tick() {
      const { data: authData } = await supabase?.auth.getUser() ?? { data: null };
      const uid = authData?.user?.id ?? avatar?.displayName;
      if (!cancelled && uid) await heartbeatPresence(uid, myStatus);
    }
    void tick();
    const id = setInterval(() => void tick(), PRESENCE_HEARTBEAT_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [myLocation, myStatus, avatar?.displayName]);

  // Fetch initial + Realtime
  useEffect(() => {
    fetchAllPlayers().then(setPlayers);
    const sub = subscribeToMap((updated) => {
      if (updated.status === "ghost") {
        setPlayers((prev) => prev.filter((p) => p.id !== updated.id));
        return;
      }
      setPlayers((prev) => {
        const idx = prev.findIndex((p) => p.id === updated.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
        return [...prev, updated];
      });
    });
    return () => { sub?.unsubscribe(); };
  }, []);

  async function activateLocation() {
    setLoading(true);
    const loc = await requestAndGetLocation();
    setLoading(false);
    if (!loc) return;
    setMyLocation({ lat: loc.lat, lng: loc.lng });
    markQuestAction("appear-on-map");

    // Détecte si on est dans un bastion ennemi avec récompense
    const allZones = await fetchCrewZones();
    const nearBastion = allZones.find((z) => {
      const isBastion = (z as CrewZoneRich & { is_bastion?: boolean }).is_bastion;
      if (!isBastion) return false;
      const dist = haversineMeters(loc, { lat: z.lat, lng: z.lng } as { lat: number; lng: number });
      return dist <= z.radius;
    });
    if (nearBastion) {
      const reward = (nearBastion as CrewZoneRich & { visitor_reward?: number }).visitor_reward ?? 0;
      if (reward > 0) setBastionAlert({ zone: nearBastion, reward });
    }

    if (avatar) {
      const { data: authData } = await supabase?.auth.getUser() ?? { data: null };
      const resolvedUserId = authData?.user?.id ?? avatar.displayName;
      await publishPosition({
        userId: resolvedUserId, displayName: avatar.displayName,
        avatarEmoji: "🧢", status: myStatus === "ghost" ? "free" : myStatus,
        level: playerLevel, lastAction: null,
        lat: loc.lat, lng: loc.lng,
        locationName: loc.locationName, locationVerified: loc.verified,
      });
      if (myStatus === "ghost") setMyStatus("free");
    }
    // Zoom cinématique : dézoome sur Toulouse entier → vole vers ma position
    zoomAnimTrigger(loc.lat, loc.lng);
  }

  function zoomAnimTrigger(lat: number, lng: number) {
    if (!flyToRef.current) return;
    // 1. Dézoome sur la ville (1.2s) — vue d'ensemble à plat
    flyToRef.current(43.6047, 1.4442, 11, 0, 0);
    // 2. Fly vers la position du joueur (zoom 17 — street level, inclinée 3D)
    setTimeout(() => {
      flyToRef.current?.(lat, lng, 17, 55, -12);
    }, 1400);
  }

  async function handleStatusChange(s: MapStatus) {
    setMyStatus(s);
    const { data: authData } = await supabase?.auth.getUser() ?? { data: null };
    const resolvedUserId = authData?.user?.id ?? (avatar?.displayName ?? "local_user");
    if (s === "ghost") { await goGhost(resolvedUserId); return; }
    if (myLocation) {
      await publishPosition({
        userId: resolvedUserId, displayName: avatar?.displayName ?? "Moi",
        avatarEmoji: "🧢", status: s, level: playerLevel, lastAction: null,
        lat: myLocation.lat, lng: myLocation.lng, locationName: null, locationVerified: true,
      });
    }
  }

  function handleInvite(p: MapPlayer) {
    hapticImpact("medium");
    router.push(`/(app)/dm?targetId=${p.user_id}&targetName=${encodeURIComponent(p.display_name)}&targetEmoji=${encodeURIComponent(p.avatar_emoji)}` as never);
  }

  async function handleBlock(p: MapPlayer) {
    // Masquage local immédiat (UX) — mais c'est block_user_relationship qui
    // fait le vrai travail : sans lui, "Bloquer" ne faisait que cacher la
    // personne sur CET appareil, elle continuait à voir/contacter le joueur
    // partout ailleurs (bug trouvé en réutilisant lib/safety.blockUser, qui
    // n'écrit que dans AsyncStorage local).
    setBlocked((prev) => [...prev, p.user_id]);
    await blockUser(p.user_id);
    if (!p.is_npc) await blockRelation(p.user_id);
    hapticImpact("medium");
  }

  const cfg = STATUS_CONFIG[myStatus];
  const mapContextCount = cityPulseSignals.length + crewDominance.length + (takeoverAlert ? 1 : 0) + (roi ? 1 : 0);

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: C.void }}>

      {/* ── MAP LEAFLET (DOM direct) ──────────────────────────────────────── */}
      {!mapFailed && (
        <LeafletMap
          key={mapRetryKey}
          players={visible}
          myLat={myLocation?.lat}
          myLng={myLocation?.lng}
          onPlayerClick={(id) => {
            const p = players.find((pl) => pl.id === id);
            if (p) { hapticImpact("light"); setSelected(p); }
          }}
          onReady={() => setMapReady(true)}
          onMapReady={(fn) => { flyToRef.current = fn; }}
          onError={() => setMapFailed(true)}
          crewZones={crewZones}
          missions={missionMapFeatures}
          onMissionClick={(id) => { hapticImpact("light"); setSelectedMissionId(id); setMissionError(null); }}
          env={mapEnv}
          districts={mapDistricts}
        />
      )}


      {/* Loading overlay */}
      {!mapReady && !mapFailed && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: C.void, alignItems: "center", justifyContent: "center", gap: 20,
          zIndex: 10,
        }}>
          <ActivityIndicator color={C.gold} size="large" />
          <Text style={{ color: C.muted, fontSize: 11, letterSpacing: 3, fontWeight: "900" }}>
            CHARGEMENT DE TOULOUSE...
          </Text>
        </View>
      )}

      {/* Panne carte — état visible, pas d'écran gris silencieux */}
      {mapFailed && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: C.void, alignItems: "center", justifyContent: "center", gap: 16, padding: 32,
          zIndex: 10,
        }}>
          <Text style={{ fontSize: 40 }}>🗺️</Text>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: "900", textAlign: "center" }}>
            La carte n'a pas pu se charger
          </Text>
          <Text style={{ color: C.muted, fontSize: 12, textAlign: "center" }}>
            Vérifie ta connexion réseau, puis réessaie.
          </Text>
          <Pressable
            onPress={() => { setMapFailed(false); setMapReady(false); setMapRetryKey((k) => k + 1); }}
            style={{ backgroundColor: C.gold, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12, marginTop: 8 }}>
            <Text style={{ color: "#04040A", fontWeight: "900", fontSize: 13 }}>Réessayer</Text>
          </Pressable>
        </View>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View pointerEvents="box-none" style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 5,
        paddingTop: isMobileWeb ? 10 : 54, paddingHorizontal: isMobileWeb ? 12 : 16, paddingBottom: isMobileWeb ? 6 : 10,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: isMobileWeb ? 6 : 10,
      }}>
        <View style={{
          backgroundColor: "rgba(8,8,15,0.88)", borderRadius: isMobileWeb ? 10 : 14,
          paddingHorizontal: isMobileWeb ? 9 : 14, paddingVertical: isMobileWeb ? 6 : 10,
          borderWidth: 1, borderColor: C.border,
          flex: 1, maxWidth: isMobileWeb ? 178 : 460, gap: 1,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: isMobileWeb ? 6 : 8 }}>
            <View style={{ width: isMobileWeb ? 6 : 7, height: isMobileWeb ? 6 : 7, borderRadius: 4, backgroundColor: C.green,
              shadowColor: C.green, shadowOpacity: 1, shadowRadius: 5 }} />
            <Text style={{ color: C.text, fontSize: isMobileWeb ? 11 : 13, fontWeight: "800" }} numberOfLines={1}>
              {visible.length} actifs · Toulouse
            </Text>
          </View>
          <Text style={{ color: C.gold, fontSize: isMobileWeb ? 9 : 10, fontWeight: "800" }} numberOfLines={1}>
            {visibleRealCount} réels · {visibleNpcCount} simulés
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Statut actuel : ${cfg.label}. Modifier le statut`}
          onPress={() => setShowPicker(true)}
          style={{
            minHeight: 44, backgroundColor: "rgba(8,8,15,0.88)", borderRadius: isMobileWeb ? 12 : 14,
            paddingHorizontal: isMobileWeb ? 10 : 12, paddingVertical: isMobileWeb ? 7 : 10,
            borderWidth: 1, borderColor: cfg.color + "50",
            flexDirection: "row", alignItems: "center", gap: isMobileWeb ? 5 : 6,
          }}>
          <Text style={{ fontSize: 14 }}>{cfg.emoji}</Text>
          <View>
            {!isMobileWeb && <Text style={{ color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1 }}>STATUT</Text>}
            <Text style={{ color: cfg.color, fontSize: isMobileWeb ? 11 : 12, fontWeight: "900" }} numberOfLines={1}>{cfg.label}</Text>
          </View>
        </Pressable>
      </View>

      {/* ── FILTER PILLS ──────────────────────────────────────────────────── */}
      {/* BUG RÉEL TROUVÉ ET CORRIGÉ : ce wrapper n'était pas positionné en
      absolute, donc en tant qu'enfant flex normal dans le conteneur racine
      (flex:1), il s'étirait pour occuper tout l'espace vertical restant
      (~800px de haut) et interceptait TOUS les clics vers la carte en
      dessous, sauf sur les pastilles elles-mêmes. `pointerEvents="box-none"`
      laisse passer les clics sauf sur les enfants interactifs réels — même
      correctif appliqué au wrapper des filtres missions juste après. */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 5 }} pointerEvents="box-none">
        <FilterPills active={filter} onChange={setFilter} compact={isMobileWeb} />
      </View>

      {/* ── FILTRES MISSIONS — indépendants des filtres joueurs ─────────────── */}
      {seasonId && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ position: "absolute", top: isMobileWeb ? 106 : 148, left: 0, right: 0, zIndex: 5 }}
          pointerEvents="box-none"
          contentContainerStyle={{ paddingHorizontal: isMobileWeb ? 12 : 16, gap: isMobileWeb ? 6 : 8 }}>
          {([
            ["all", "🌆 Missions"], ["explore", "Explorer"], ["move", "Bouger"], ["social", "Social"],
            ["available", "Disponibles"], ["in_progress", "En cours"], ["done", "Terminées"],
          ] as const).map(([key, label]) => (
            <Pressable key={key} onPress={() => setMissionFilter(key)}
              style={{ backgroundColor: missionFilter === key ? C.gold : "rgba(8,8,15,0.88)", borderRadius: 14,
                minHeight: isMobileWeb ? 38 : undefined, paddingHorizontal: 12, paddingVertical: isMobileWeb ? 8 : 7, borderWidth: 1,
                borderColor: missionFilter === key ? C.gold : C.border }}>
              <Text style={{ color: missionFilter === key ? "#04040A" : C.soft, fontSize: 11, fontWeight: "800" }}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Bandeaux latéraux retirés : tout passe par ☰ (carte plein écran, web & mobile). */}

      {(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${mapContextCount} informations autour de toi`}
          onPress={() => setShowMapContext(true)}
          style={{
            position: "absolute", top: isMobileWeb ? 63 : 108, right: isMobileWeb ? 12 : 16, zIndex: 7,
            minWidth: 48, height: 44, borderRadius: 22, paddingHorizontal: 10,
            backgroundColor: "rgba(8,8,15,0.94)", borderWidth: 1, borderColor: C.gold + "55",
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
            shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 6,
          }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: "900" }}>☰</Text>
          <Text style={{ color: C.gold, fontSize: 11, fontWeight: "900" }}>{mapContextCount}</Text>
        </Pressable>
      )}

      {/* ── GÉOLOC ────────────────────────────────────────────────────────── */}
      {!myLocation ? (
        <View style={{ position: "absolute", bottom: isMobileWeb ? 14 : 24, left: isMobileWeb ? 12 : 20, right: isMobileWeb ? 12 : 20, zIndex: 5, alignItems: "center" }}>
          <Pressable onPress={() => void activateLocation()}
            style={{
              minHeight: 48, width: "100%", maxWidth: 440, backgroundColor: C.gold, borderRadius: isMobileWeb ? 14 : 16,
              paddingVertical: isMobileWeb ? 13 : 15,
              alignItems: "center", shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 20,
              flexDirection: "row", justifyContent: "center", gap: 10,
            }}>
            {loading
              ? <ActivityIndicator color="#04040A" />
              : <>
                  <Text style={{ fontSize: 20 }}>📍</Text>
                  <Text style={{ color: "#04040A", fontSize: isMobileWeb ? 14 : 16, fontWeight: "900" }}>
                    Apparaître sur la map
                  </Text>
                </>
            }
          </Pressable>
          <Text style={{ color: C.muted, fontSize: 11, textAlign: "center", marginTop: 8 }}>
            Position partagée en zone approximative · Ghost à tout moment
          </Text>
        </View>
      ) : (
        <View style={{ position: "absolute", bottom: isMobileWeb ? 14 : 100, right: isMobileWeb ? 12 : 16, zIndex: 5, gap: 8 }}>
          {/* Recentrer */}
          <Pressable
            onPress={() => zoomAnimTrigger(myLocation.lat, myLocation.lng)}
            style={{
              width: 46, height: 46, borderRadius: 13,
              backgroundColor: "rgba(8,8,15,0.92)",
              borderWidth: 1.5, borderColor: C.gold + "60",
              alignItems: "center", justifyContent: "center",
            }}>
            <Text style={{ fontSize: 20 }}>🎯</Text>
          </Pressable>
          {/* Passer en discret */}
          <Pressable
            onPress={() => void handleStatusChange("ghost")}
            style={{
              width: 46, height: 46, borderRadius: 13,
              backgroundColor: myStatus === "ghost" ? "rgba(74,72,68,0.45)" : "rgba(8,8,15,0.92)",
              borderWidth: 1.5, borderColor: myStatus === "ghost" ? C.muted : "rgba(74,72,68,0.5)",
              alignItems: "center", justifyContent: "center",
            }}>
            <Text style={{ fontSize: 18 }}>{myStatus === "ghost" ? "👁" : "👻"}</Text>
          </Pressable>
        </View>
      )}

      {/* ── BASTION CHECK-IN ALERT ───────────────────────────────────────── */}
      <MapFirstSessionHint
        visible={hasHydrated && !mapIntroDismissed && !showMapContext}
        onDismiss={dismissMapIntro}
        bottom={isMobileWeb ? (myLocation ? 72 : 108) : (myLocation ? 116 : 116)}
        palette={{ background: C.glass, border: C.gold + "70", text: C.text, muted: C.soft, accent: C.gold }}
      />

      <MapPrimarySuggestion
        signal={cityPulseSignals[0] ?? null}
        visible={hasHydrated && mapIntroDismissed && !primarySuggestionDismissed && !showMapContext && !bastionAlert}
        onPress={handleCityPulsePress}
        onDismiss={() => {
          const id = cityPulseSignals[0]?.id;
          if (id) setRecentPulseIds((ids) => [id, ...ids.filter((x) => x !== id)].slice(0, 12));
          setPrimarySuggestionDismissed(true);
        }}
        bottom={isMobileWeb ? (myLocation ? 72 : 108) : (myLocation ? 116 : 116)}
        palette={{ background: C.glass, border: C.gold + "55", text: C.text, muted: C.soft, accent: C.gold }}
      />

      {mapFeedback && (
        <View pointerEvents="none" style={{
          position: "absolute", bottom: isMobileWeb ? 76 : 118, alignSelf: "center", zIndex: 45,
          backgroundColor: C.green + "E8", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
          borderWidth: 1, borderColor: C.green,
        }}>
          <Text style={{ color: "#04040A", fontSize: 12, fontWeight: "900" }}>{mapFeedback}</Text>
        </View>
      )}

      {bastionAlert && !checkinDone && (
        <View style={{
          position: "absolute", top: isMobileWeb ? (seasonId ? 150 : 108) : 80,
          left: isMobileWeb ? 12 : 16, right: isMobileWeb ? 12 : 16, zIndex: 20,
          backgroundColor: C.card, borderRadius: isMobileWeb ? 12 : 16, padding: isMobileWeb ? 12 : 16,
          borderWidth: 1.5, borderColor: C.gold + "60",
          shadowColor: C.gold, shadowOpacity: 0.3, shadowRadius: 16,
          flexDirection: "row", alignItems: "center", gap: 12,
        }}>
          <Text style={{ fontSize: isMobileWeb ? 22 : 28 }}>🏰</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.gold, fontSize: 13, fontWeight: "900" }}>
              Tu es dans le bastion [{bastionAlert.zone.crew?.tag}]
            </Text>
            <Text style={{ color: C.soft, fontSize: 11, marginTop: 2 }}>
              Influence du bastion +{bastionAlert.reward} · 1 fois par 24h
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <Pressable
              onPress={() => {
                if (!avatar) return;
                bastionCheckin(bastionAlert.zone.id, bastionAlert.zone.crew_id, avatar.displayName)
                  .then((r) => {
                    if (r.ok) {
                      setCheckinDone(true);
                      setBastionAlert(null);
                      setMapFeedback(r.blEarned > 0 ? `Check-in réussi · influence +${r.blEarned}` : "Check-in réussi");
                    } else {
                      setMapFeedback(r.error ?? "Check-in impossible");
                    }
                    if (r.ok && r.blEarned > 0) {
                      markQuestAction("appear-on-map");
                    }
                  });
              }}
              style={{ backgroundColor: C.gold + "20", borderRadius: 10,
                paddingHorizontal: 14, paddingVertical: 8,
                borderWidth: 1, borderColor: C.gold + "50" }}>
              <Text style={{ color: C.gold, fontSize: 12, fontWeight: "900" }}>Check-in</Text>
            </Pressable>
            <Pressable onPress={() => setBastionAlert(null)}
              style={{ alignItems: "center" }}>
              <Text style={{ color: C.muted, fontSize: 11 }}>Ignorer</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── MATCHMAKING BUTTON + PANEL ──────────────────────────────────── */}
      {myLocation && (
        <>
          <Pressable
            onPress={() => setShowMatchmaking((p) => !p)}
            style={{
              position: "absolute", bottom: isMobileWeb ? 14 : 100, left: isMobileWeb ? 12 : 16, zIndex: 5,
              minHeight: 46,
              backgroundColor: showMatchmaking ? C.purple + "25" : "rgba(8,8,15,0.92)",
              borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10,
              borderWidth: 1.5, borderColor: showMatchmaking ? C.purple : C.border,
              flexDirection: "row", alignItems: "center", gap: 6,
            }}>
            <Text style={{ fontSize: 16 }}>👥</Text>
            <Text style={{ color: showMatchmaking ? C.purple : C.soft, fontSize: 12, fontWeight: "800" }}>À proximité</Text>
            {(() => {
              const count = visible.filter(
                (p) => !p.is_npc && haversineMeters(myLocation, { lat: p.lat, lng: p.lng }) < 500
              ).length;
              return count > 0 ? (
                <View style={{ backgroundColor: C.purple, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>{count}</Text>
                </View>
              ) : null;
            })()}
          </Pressable>

          {showMatchmaking && (() => {
            const nearby = visible
              .filter((p) => !p.is_npc && haversineMeters(myLocation, { lat: p.lat, lng: p.lng }) < 500)
              .slice(0, 5);
            return (
              <View style={{
                position: "absolute", bottom: isMobileWeb ? 68 : 158, left: isMobileWeb ? 12 : 16, zIndex: 10,
                backgroundColor: C.card, borderRadius: 16, padding: 16,
                width: isMobileWeb ? Math.min(280, viewportWidth - 24) : 240,
                borderWidth: 1, borderColor: C.purple + "40",
                shadowColor: C.purple, shadowOpacity: 0.3, shadowRadius: 20,
              }}>
                <Text style={{ color: C.purple, fontSize: 13, fontWeight: "900", marginBottom: 12 }}>
                  🤝 Joueurs proches
                </Text>
                {nearby.length === 0 ? (
                <Text style={{ color: C.muted, fontSize: 12 }}>Personne dans la zone proche.</Text>
                ) : (
                  nearby.map((p) => {
                    const dist = Math.round(haversineMeters(myLocation, { lat: p.lat, lng: p.lng }));
                    const cfg = STATUS_CONFIG[p.status as MapStatus];
                    return (
                      <Pressable key={p.id} onPress={() => { setSelected(p); setShowMatchmaking(false); markQuestAction("map-encounter"); }}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10,
                          paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                        <Text style={{ fontSize: 20 }}>{p.avatar_emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontSize: 12, fontWeight: "700" }}>{p.display_name}</Text>
                          <Text style={{ color: cfg?.color ?? C.muted, fontSize: 10 }}>
                            {cfg?.label ?? p.status} · {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}
                          </Text>
                        </View>
                        <Text style={{ color: C.purple, fontSize: 12 }}>→</Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            );
          })()}
        </>
      )}

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      <PlayerSheet player={selected} myCrewId={myCrewId} playerId={npcActorId} npcOpportunity={npcOpportunity} onClose={() => setSelected(null)}
        onInvite={handleInvite}
        onReport={(p) => { setSelected(null); setReportTarget(p); }}
        onBlock={handleBlock}
        onGoTo={handleGoTo}
        traveling={!!travel}
        onFeedback={setMapFeedback}
        onNavigate={(r) => router.push(r as never)}
        onChatNpc={(p) => { setNpcChatTarget(p); setNpcHistory([]); setNpcError(null); setNpcQuickReplies([]); setNpcEngine("local"); }} />

      {/* ── TRAJET EN COURS ──────────────────────────────────────────────── */}
      {travel && (
        <View style={{
          position: "absolute", top: 108, left: 16, right: 16, zIndex: 20,
          backgroundColor: C.card, borderRadius: 16, padding: 14,
          borderWidth: 1.5, borderColor: C.gold + "50",
          flexDirection: "row", alignItems: "center", gap: 12,
        }}>
          <Text style={{ fontSize: 24 }}>🚶</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.gold, fontSize: 13, fontWeight: "900" }}>
              En route vers {travel.targetName}
            </Text>
            <Text style={{ color: C.soft, fontSize: 11, marginTop: 2 }}>
              {Math.round(travel.distanceCovered)} m parcourus · reste{" "}
              {Math.max(0, Math.round(haversineMeters({ lat: travel.lastLat, lng: travel.lastLng }, { lat: travel.targetLat, lng: travel.targetLng })))} m
            </Text>
          </View>
          <Pressable onPress={cancelTravel} style={{ padding: 8 }}>
            <Text style={{ color: C.muted, fontSize: 18 }}>×</Text>
          </Pressable>
        </View>
      )}

      {/* ── RÉSULTAT DU TRAJET ───────────────────────────────────────────── */}
      {travelResult && (
        <View style={{
          position: "absolute", top: 108, left: 16, right: 16, zIndex: 20,
          backgroundColor: C.green + "18", borderRadius: 16, padding: 14,
          borderWidth: 1.5, borderColor: C.green + "50",
          flexDirection: "row", alignItems: "center", gap: 12,
        }}>
          <Text style={{ fontSize: 24 }}>🏁</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.green, fontSize: 13, fontWeight: "900" }}>
              Arrivé ! +{travelResult.xp} XP trajet réel
            </Text>
          </View>
          <Pressable onPress={() => setTravelResult(null)} style={{ padding: 8 }}>
            <Text style={{ color: C.muted, fontSize: 18 }}>×</Text>
          </Pressable>
        </View>
      )}

      {reportTarget && (
        <ReportModal visible={!!reportTarget}
          targetUserId={reportTarget.user_id}
          targetName={reportTarget.display_name}
          onClose={() => setReportTarget(null)} />
      )}

      {showPicker && (
        <StatusPicker current={myStatus} onChange={handleStatusChange}
          onClose={() => setShowPicker(false)} />
      )}

      {/* ── CHAT PNJ (IA réelle) ─────────────────────────────────────────── */}
      {npcChatTarget && (
        <Modal transparent animationType="slide" visible onRequestClose={() => setNpcChatTarget(null)}>
          <Pressable style={{ flex: 1 }} onPress={() => setNpcChatTarget(null)} />
          <View style={{
            backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: "70%", borderTopWidth: 1, borderColor: C.border,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10,
              padding: 16, borderBottomWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 22 }}>{npcChatTarget.avatar_emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: "900" }}>{npcChatTarget.display_name}</Text>
                <Text style={{ color: C.purple, fontSize: 10, fontWeight: "800" }}>
                  🤖 PNJ · personnage fictif · {npcEngine === "local" ? "moteur du jeu" : "IA générative"}
                </Text>
              </View>
              <Pressable onPress={() => setNpcChatTarget(null)} style={{ padding: 6 }}>
                <Text style={{ color: C.muted, fontSize: 18 }}>×</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
              {npcHistory.length === 0 && (
                <View style={{ alignItems: "center", gap: 5, marginTop: 14, marginBottom: 8 }}>
                  <Text style={{ color: C.purple, fontSize: 10, fontWeight: "900" }}>EN CE MOMENT</Text>
                  <Text style={{ color: C.text, fontSize: 12, textAlign: "center" }}>
                    {npcChatTarget.last_action ?? `${npcChatTarget.display_name} se déplace dans Toulouse.`}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 11, textAlign: "center" }}>
                    Sa réponse dépend de son activité, de sa personnalité et de votre relation.
                  </Text>
                </View>
              )}
              {npcHistory.map((turn, i) => (
                <View key={i} style={{ alignSelf: turn.role === "me" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                  <View style={{
                    backgroundColor: turn.role === "me" ? C.gold : "#08080F",
                    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8,
                    borderWidth: turn.role === "me" ? 0 : 1, borderColor: C.border,
                  }}>
                    <Text style={{ color: turn.role === "me" ? "#04040A" : C.text, fontSize: 13 }}>{turn.text}</Text>
                  </View>
                </View>
              ))}
              {npcSending && (
                <Text style={{ color: C.muted, fontSize: 12 }}>{npcChatTarget.display_name} écrit…</Text>
              )}
              {npcError && (
                <Text style={{ color: C.red, fontSize: 12 }}>{npcError}</Text>
              )}
            </ScrollView>

            {npcQuickReplies.length > 0 && !npcSending && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
                {npcQuickReplies.map((qr, i) => (
                  <Pressable key={i} onPress={() => sendToNpcText(qr)}
                    style={{ backgroundColor: "#08080F", borderRadius: 14, borderWidth: 1, borderColor: C.border,
                      paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Text style={{ color: C.text, fontSize: 12 }}>{qr}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={{ flexDirection: "row", gap: 8, padding: 16, paddingBottom: 32,
              borderTopWidth: 1, borderColor: C.border, alignItems: "center" }}>
              <View style={{ flex: 1, backgroundColor: "#08080F", borderRadius: 20,
                borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10 }}>
                <TextInput
                  value={npcInput}
                  onChangeText={setNpcInput}
                  onSubmitEditing={sendToNpc}
                  placeholder="Écris un message..."
                  placeholderTextColor={C.muted}
                  style={{ color: C.text, fontSize: 14 }}
                />
              </View>
              <Pressable onPress={sendToNpc} disabled={!npcInput.trim() || npcSending}
                style={{ width: 42, height: 42, borderRadius: 21,
                  backgroundColor: npcInput.trim() ? C.purple : "#08080F",
                  alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 17 }}>➤</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* ── FICHE MISSION (Map) — réutilise exactement les parcours
      Explorer/Bouger/Social déjà construits, aucune logique dupliquée ──── */}
      {selectedMission && (
        <Modal transparent animationType="slide" visible onRequestClose={() => setSelectedMissionId(null)}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelectedMissionId(null)} />
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 20, gap: 10, borderTopWidth: 1, borderColor: C.border }}>
            {(() => {
              const status = myMissionParticipations[selectedMission.id];
              const catLabel = selectedMission.category === "explore" ? "🧭 Explorer"
                : selectedMission.category === "move" ? "🚶 Bouger" : "🤝 Social";
              const district = selectedMission.district_id ? districtById[selectedMission.district_id]?.name : null;
              const expired = new Date(selectedMission.ends_at) < new Date();
              const actionLabel = !status ? "Rejoindre"
                : status === "joined" || status === "in_progress"
                  ? (selectedMission.category === "move" ? "Démarrer" : "Valider")
                : status === "validated" ? "Réclamer"
                : status === "rewarded" ? null : "Rejoindre";
              return (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: C.gold, fontSize: 11, fontWeight: "800" }}>{catLabel}</Text>
                    <Pressable onPress={() => setSelectedMissionId(null)}><Text style={{ color: C.muted, fontSize: 18 }}>×</Text></Pressable>
                  </View>
                  <Text style={{ color: C.text, fontSize: 16, fontWeight: "900" }}>{selectedMission.title}</Text>
                  <Text style={{ color: C.soft, fontSize: 12 }}>{selectedMission.description}</Text>
                  <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                    {district && <Text style={{ color: C.muted, fontSize: 11 }}>📍 {district}</Text>}
                    <Text style={{ color: C.muted, fontSize: 11 }}>⚡ {selectedMission.difficulty}</Text>
                    <Text style={{ color: C.muted, fontSize: 11 }}>
                      👥 {missionCounts[selectedMission.id] ?? 0}{selectedMission.capacity ? `/${selectedMission.capacity}` : ""}
                    </Text>
                    {expired && <Text style={{ color: C.red, fontSize: 11, fontWeight: "800" }}>Expirée</Text>}
                  </View>
                  <Text style={{ color: C.gold, fontSize: 12, fontWeight: "700" }}>
                    +{selectedMission.reward_xp} XP · +{selectedMission.reward_money} Wory · +{selectedMission.reward_reputation} rép
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 10 }}>
                    🔒 Seule ta position approximative (arrondie) est utilisée pour valider — jamais partagée avec les autres joueurs.
                  </Text>
                  {missionError && <Text style={{ color: C.red, fontSize: 11 }}>{missionError}</Text>}
                  {mapFeedback && <Text style={{ color: C.green, fontSize: 11, fontWeight: "800" }}>{mapFeedback}</Text>}
                  {status === "rewarded" ? (
                    <Text style={{ color: C.green, fontSize: 13, fontWeight: "800" }}>✓ Mission récompensée</Text>
                  ) : expired && !status ? null : actionLabel && (
                    <Pressable disabled={missionBusy} onPress={handleMissionAction}
                      style={{ backgroundColor: C.gold, borderRadius: 14, padding: 14, alignItems: "center", marginTop: 4 }}>
                      <Text style={{ color: "#04040A", fontWeight: "900" }}>{missionBusy ? "..." : actionLabel}</Text>
                    </Pressable>
                  )}
                </>
              );
            })()}
          </View>
        </Modal>
      )}

      {moveModalMission && (
        <MoveMissionModal
          mission={moveModalMission}
          onClose={() => setMoveModalMission(null)}
          onClaimed={() => {
            setMyMissionParticipations((p) => ({ ...p, [moveModalMission.id]: "rewarded" }));
            setMoveModalMission(null);
            setSelectedMissionId(null);
          }}
        />
      )}

      <MobileMapContextDrawer
        visible={showMapContext}
        signals={cityPulseSignals}
        hudLabel={hudLabel}
        districts={crewDominance}
        takeoverAlert={takeoverAlert}
        roi={roi}
        onClose={() => setShowMapContext(false)}
        onPulsePress={handleCityPulsePress}
        onCrewPress={handleCrewContextPress}
        onRoiPress={handleRoiPress}
      />

      {/* ── FEATURE VIRALE 1 — Alerte prise de bastion ──────────────────── */}
      {takeoverAlert && !isMobileWeb && (
        <View style={{
          position: "absolute", bottom: 160, left: 16, right: 16, zIndex: 30,
          backgroundColor: takeoverAlert.newCrewColor + "22",
          borderRadius: 18, padding: 16,
          borderWidth: 2, borderColor: takeoverAlert.newCrewColor,
          shadowColor: takeoverAlert.newCrewColor, shadowOpacity: 0.8, shadowRadius: 24,
          flexDirection: "row", alignItems: "center", gap: 14,
        }}>
          <Text style={{ fontSize: 32 }}>🏴</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: takeoverAlert.newCrewColor, fontSize: 14, fontWeight: "900" }}>
              {takeoverAlert.newCrewEmoji} [{takeoverAlert.newCrewTag}] a pris {takeoverAlert.bastionName} !
            </Text>
            <Text style={{ color: C.soft, fontSize: 11, marginTop: 3 }}>
              Bastion conquis · Toulouse vient de changer d'équilibre
            </Text>
          </View>
          <Pressable onPress={() => setTakeoverAlert(null)}
            style={{ padding: 8 }}>
            <Text style={{ color: C.muted, fontSize: 18 }}>×</Text>
          </Pressable>
        </View>
      )}

      {/* ── FEATURE VIRALE 3 — Roi de Toulouse widget ───────────────────── */}
      {roi && !isMobileWeb && (
        <View style={{
          position: "absolute", top: 156, right: 16, zIndex: 6,
          backgroundColor: "rgba(8,8,15,0.92)", borderRadius: 14,
          paddingHorizontal: 12, paddingVertical: 10,
          borderWidth: 1.5, borderColor: C.gold + "50",
          shadowColor: C.gold, shadowOpacity: 0.25, shadowRadius: 12,
          maxWidth: 160,
        }}>
          <Text style={{ color: C.gold, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginBottom: 4 }}>
            👑 ROI DE TOULOUSE
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 22 }}>{roi.avatar_emoji}</Text>
            <View>
              <Text style={{ color: C.text, fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
                {roi.display_name}
              </Text>
              {roi.crew_tag && (
                <Text style={{ color: roi.crew_color ?? C.gold, fontSize: 10, fontWeight: "800" }}>
                  [{roi.crew_tag}] · Niv.{roi.level}
                </Text>
              )}
            </View>
          </View>
          <Text style={{ color: C.muted, fontSize: 9, marginTop: 6 }}>{roi.weekLabel}</Text>
        </View>
      )}
    </View>
  );
}
