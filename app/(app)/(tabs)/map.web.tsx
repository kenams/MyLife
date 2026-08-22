"use client";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Modal, Pressable, ScrollView,
  Text, View, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";

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
  type CrewZoneRich, type TakeoverNotif, type RoiDeToulouse,
} from "@/lib/crews";
import { startNpcMapEngine, stopNpcMapEngine } from "@/lib/npc-map-engine";
import { sendLocalNotification } from "@/lib/push-notifications";
import { blockUser } from "@/lib/safety";
import { ReportModal } from "@/components/report-modal";
import { useGameStore } from "@/stores/game-store";
import { supabase } from "@/lib/supabase";

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
  return { label: "PNJ DÉMO", color: C.purple };
}

// ── MapLibre GL loader (injection dynamique dans le DOM) ──────────────────────
// Moteur : MapLibre GL JS (open-source, licence BSD-3, gratuit, pas de clé API).
// Tuiles : OpenFreeMap (https://openfreemap.org) — vecteur, gratuit, sans clé,
// sans quota. Choisi après comparaison avec Mapbox (payant au-delà d'un seuil)
// et MapTiler (quota gratuit limité) : OpenFreeMap est financé pour rester
// gratuit indéfiniment et ne nécessite aucune inscription/API key à gérer.
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
      background: radial-gradient(120% 85% at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%);
    }
    .mylife-map-container .mylife-map-scanlines {
      position: absolute; inset: 0; pointer-events: none; z-index: 3; opacity: .05;
      background: repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px);
    }
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
  crewZones?: CrewZoneRich[];
}

function playerMarkerEl(p: MapPlayer, dotColor: string): HTMLElement {
  const radius  = p.is_star ? 9 : 6;
  const svgSize = p.is_star ? 48 : 32;
  const cx = svgSize / 2;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize + 14}">`,
    p.is_star ? `<circle cx="${cx}" cy="${cx}" r="${cx - 2}" fill="${dotColor}" opacity="0.18"/>` : "",
    `<circle cx="${cx}" cy="${cx}" r="${radius}" fill="${dotColor}" stroke="#04040A" stroke-width="2"/>`,
    p.crew_tag ? `<rect x="${cx - p.crew_tag.length * 3.2 - 2}" y="${svgSize + 1}" width="${p.crew_tag.length * 6.4 + 4}" height="11" rx="3" fill="#04040A" opacity="0.85"/>
    <text x="${cx}" y="${svgSize + 10}" text-anchor="middle" font-size="8" fill="${dotColor}" font-weight="900" font-family="system-ui,sans-serif">${escapeHtml(p.crew_tag)}</text>` : "",
    `</svg>`,
  ].join("");
  const el = document.createElement("div");
  el.style.cssText = "cursor:pointer;width:" + svgSize + "px;height:" + (svgSize + 14) + "px;";
  el.innerHTML = `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" width="${svgSize}" height="${svgSize + 14}" />`;
  return el;
}

function LeafletMap({ players, myLat, myLng, onPlayerClick, onReady, onMapReady, crewZones = [] }: LeafletMapProps) {
  const containerRef = useRef<View>(null);
  const mapRef        = useRef<unknown>(null);
  const glRef         = useRef<unknown>(null);
  const markersRef    = useRef<Record<string, { remove: () => void }>>({});
  const myMarkerRef   = useRef<{ remove: () => void } | null>(null);

  // Init carte — une seule fois
  useEffect(() => {
    injectMapStyles();

    loadMaplibre(() => {
      const gl = (window as unknown as { maplibregl: unknown }).maplibregl as any;
      glRef.current = gl;
      if (!gl) return;

      const domNode = (containerRef.current as unknown as { _nativeTag?: HTMLElement } | null)?._nativeTag
        ?? (containerRef.current as unknown as HTMLElement | null);
      if (!domNode || !(domNode instanceof HTMLElement)) return;
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

      map.on("load", () => {
        const canvasContainer = map.getCanvasContainer?.() as HTMLElement | undefined;
        if (canvasContainer) {
          canvasContainer.style.filter =
            "invert(1) hue-rotate(255deg) brightness(1.35) contrast(0.95) saturate(2.2)";
        }

        // Extrusion 3D des bâtiments si la source vectorielle les expose
        // (couche "building" — présente sur les styles OpenFreeMap/OSM standards)
        try {
          const style = map.getStyle();
          const hasBuildingSource = style?.sources && Object.keys(style.sources).length > 0;
          if (hasBuildingSource) {
            map.addLayer({
              id: "mylife-3d-buildings",
              source: Object.keys(style.sources)[0],
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
        const scanlinesEl = document.createElement("div");
        scanlinesEl.className = "mylife-map-scanlines";
        mapEl.appendChild(scanlinesEl);

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

        // Ma position
        if (myLat && myLng) {
          const el = document.createElement("div");
          el.style.cssText = "width:20px;height:20px;border-radius:10px;background:#FFD600;border:3px solid #04040A;box-shadow:0 0 16px #FFD600;";
          myMarkerRef.current = new gl.Marker({ element: el }).setLngLat([myLng, myLat]).addTo(map);
        }

        if (onMapReady) {
          onMapReady((lat: number, lng: number, zoom = 16, pitch = 55, bearing = -12) => {
            map.flyTo({ center: [lng, lat], zoom, pitch, bearing, duration: zoom < 14 ? 1200 : 2500, essential: true });
          });
        }

        onReady();
      });

      map.on("error", (e: unknown) => console.warn("[MapLibre]", e));
    });

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, []); // mount once

  // Mise à jour joueurs quand ils changent
  useEffect(() => {
    const map = mapRef.current as any;
    const gl = glRef.current as any;
    if (!map || !gl) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    players.forEach((p) => {
      const dotColor = p.crew_color ?? STATUS_CONFIG[p.status]?.color ?? "#FFD600";
      const name = p.display_name.split(" ")[0];
      const el = playerMarkerEl(p, dotColor);
      el.addEventListener("click", () => onPlayerClick(p.id));
      const popup = new gl.Popup({ closeButton: false, offset: 18, className: "mylife-tooltip" }).setHTML(
        `<b style="color:${dotColor}">${escapeHtml(name)}</b>${p.crew_tag ? ` <span style="opacity:.6">[${escapeHtml(p.crew_tag)}]</span>` : ""}`
      );
      const marker = new gl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
      el.addEventListener("mouseenter", () => marker.togglePopup());
      el.addEventListener("mouseleave", () => marker.togglePopup());
      markersRef.current[p.id] = marker;
    });
  }, [players]);

  return (
    <View
      ref={containerRef}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}

// ── Player Sheet ──────────────────────────────────────────────────────────────
function PlayerSheet({ player, onClose, onInvite, onReport, onBlock }: {
  player: MapPlayer | null; onClose: () => void;
  onInvite: (p: MapPlayer) => void;
  onReport: (p: MapPlayer) => void;
  onBlock:  (p: MapPlayer) => void;
}) {
  const scale = useRef(new Animated.Value(0.95)).current;
  useEffect(() => {
    if (player) Animated.spring(scale, { toValue: 1, tension: 200, friction: 18, useNativeDriver: true }).start();
  }, [player]);
  if (!player) return null;

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
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24, paddingBottom: 48, gap: 18,
        borderTopWidth: 1, borderColor: C.border,
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
            <Text style={{ color: cfg.color, fontSize: 9, fontWeight: "900" }}>{cfg.label}</Text>
          </View>
        </View>

        <View style={{ backgroundColor: "#08080F", borderRadius: 14, padding: 14, gap: 10,
          borderWidth: 1, borderColor: C.border }}>
          {player.last_action && (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Text style={{ fontSize: 15 }}>🎮</Text>
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

        {player.status !== "ghost" && (
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
                onPress={() => { hapticImpact("medium"); onInvite(player); onClose(); }}
                style={{
                  flex: 1, backgroundColor: cfg.color, borderRadius: 14,
                  paddingVertical: 14, alignItems: "center",
                  shadowColor: cfg.color, shadowOpacity: 0.4, shadowRadius: 16,
                }}>
                <Text style={{ color: "#04040A", fontSize: 13, fontWeight: "900" }}>💫 Feeling</Text>
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
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 10 }}>
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
        </View>
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
function FilterPills({ active, onChange }: {
  active: MapStatus | "all"; onChange: (f: MapStatus | "all") => void;
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
      style={{ position: "absolute", top: 108, left: 0, right: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: "row" }}>
      {pills.map((f) => {
        const on = active === f.key;
        return (
          <Pressable key={f.key} onPress={() => onChange(f.key)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
              backgroundColor: on ? f.color : "rgba(8,8,15,0.88)",
              borderWidth: 1, borderColor: on ? f.color : C.border,
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

// ── Screen ────────────────────────────────────────────────────────────────────
export default function LifeMapScreen() {
  const avatar           = useGameStore((s) => s.avatar);
  const playerLevel      = useGameStore((s) => s.playerLevel ?? 1);
  const markQuestAction  = useGameStore((s) => s.markQuestAction);

  const [players,      setPlayers]      = useState<MapPlayer[]>([]);
  const [crewZones,    setCrewZones]    = useState<CrewZoneRich[]>([]);
  const [myStatus,     setMyStatus]     = useState<MapStatus>("ghost");
  const [myLocation,   setMyLocation]   = useState<{ lat: number; lng: number } | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [selected,     setSelected]     = useState<MapPlayer | null>(null);
  const [showPicker,   setShowPicker]   = useState(false);
  const [filter,       setFilter]       = useState<MapStatus | "all">("all");
  const [reportTarget,    setReportTarget]    = useState<MapPlayer | null>(null);
  const [blocked,         setBlocked]         = useState<string[]>([]);
  const [mapReady,        setMapReady]        = useState(false);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [bastionAlert,    setBastionAlert]    = useState<{ zone: CrewZoneRich; reward: number } | null>(null);
  const [checkinDone,     setCheckinDone]     = useState(false);
  const [takeoverAlert,   setTakeoverAlert]   = useState<TakeoverNotif | null>(null);
  const [roi,             setRoi]             = useState<RoiDeToulouse | null>(null);
  const flyToRef = useRef<((lat: number, lng: number, zoom?: number, pitch?: number, bearing?: number) => void) | null>(null);

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
  void presenceTick; // dépendance volontaire pour forcer le recalcul périodique

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
    await blockUser(p.user_id);
    setBlocked((prev) => [...prev, p.user_id]);
    hapticImpact("medium");
  }

  const cfg = STATUS_CONFIG[myStatus];

  return (
    <View style={{ flex: 1, backgroundColor: C.void }}>

      {/* ── MAP LEAFLET (DOM direct) ──────────────────────────────────────── */}
      <LeafletMap
        players={visible}
        myLat={myLocation?.lat}
        myLng={myLocation?.lng}
        onPlayerClick={(id) => {
          const p = players.find((pl) => pl.id === id);
          if (p) { hapticImpact("light"); setSelected(p); }
        }}
        onReady={() => setMapReady(true)}
        onMapReady={(fn) => { flyToRef.current = fn; }}
        crewZones={crewZones}
      />


      {/* Loading overlay */}
      {!mapReady && (
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

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 5,
        paddingTop: 54, paddingHorizontal: 16, paddingBottom: 10,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        <View style={{
          backgroundColor: "rgba(8,8,15,0.88)", borderRadius: 14,
          paddingHorizontal: 14, paddingVertical: 10,
          borderWidth: 1, borderColor: C.border,
          flexDirection: "row", alignItems: "center", gap: 8,
        }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green,
            shadowColor: C.green, shadowOpacity: 1, shadowRadius: 5 }} />
          <Text style={{ color: C.text, fontSize: 13, fontWeight: "800" }}>
            {visibleRealCount} en live · Toulouse
          </Text>
          {visibleNpcCount > 0 && (
            <Text style={{ color: C.gold, fontSize: 10, fontWeight: "800" }}>
              +{visibleNpcCount} DÉMO
            </Text>
          )}
        </View>

        <Pressable onPress={() => setShowPicker(true)}
          style={{
            backgroundColor: "rgba(8,8,15,0.88)", borderRadius: 14,
            paddingHorizontal: 12, paddingVertical: 10,
            borderWidth: 1, borderColor: cfg.color + "50",
            flexDirection: "row", alignItems: "center", gap: 6,
          }}>
          <Text style={{ fontSize: 14 }}>{cfg.emoji}</Text>
          <View>
            <Text style={{ color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1 }}>STATUT</Text>
            <Text style={{ color: cfg.color, fontSize: 12, fontWeight: "900" }}>{cfg.label}</Text>
          </View>
        </Pressable>
      </View>

      {/* ── FILTER PILLS ──────────────────────────────────────────────────── */}
      <View style={{ zIndex: 5 }}>
        <FilterPills active={filter} onChange={setFilter} />
      </View>

      {/* ── GÉOLOC ────────────────────────────────────────────────────────── */}
      {!myLocation ? (
        <View style={{ position: "absolute", bottom: 110, left: 20, right: 20, zIndex: 5 }}>
          <Pressable onPress={() => void activateLocation()}
            style={{
              backgroundColor: C.gold, borderRadius: 18, paddingVertical: 18,
              alignItems: "center", shadowColor: C.gold, shadowOpacity: 0.5, shadowRadius: 24,
              flexDirection: "row", justifyContent: "center", gap: 10,
            }}>
            {loading
              ? <ActivityIndicator color="#04040A" />
              : <>
                  <Text style={{ fontSize: 20 }}>📍</Text>
                  <Text style={{ color: "#04040A", fontSize: 16, fontWeight: "900" }}>
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
        <View style={{ position: "absolute", bottom: 100, right: 16, zIndex: 5, gap: 10 }}>
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
      {bastionAlert && !checkinDone && (
        <View style={{
          position: "absolute", top: 80, left: 16, right: 16, zIndex: 20,
          backgroundColor: C.card, borderRadius: 16, padding: 16,
          borderWidth: 1.5, borderColor: C.gold + "60",
          shadowColor: C.gold, shadowOpacity: 0.3, shadowRadius: 16,
          flexDirection: "row", alignItems: "center", gap: 12,
        }}>
          <Text style={{ fontSize: 28 }}>🏰</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.gold, fontSize: 13, fontWeight: "900" }}>
              Tu es dans le bastion [{bastionAlert.zone.crew?.tag}]
            </Text>
            <Text style={{ color: C.soft, fontSize: 11, marginTop: 2 }}>
              Check-in pour gagner {bastionAlert.reward} BL · 1 fois par 24h
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <Pressable
              onPress={() => {
                if (!avatar) return;
                bastionCheckin(bastionAlert.zone.id, bastionAlert.zone.crew_id, avatar.displayName)
                  .then((r) => {
                    setCheckinDone(true);
                    setBastionAlert(null);
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
              position: "absolute", bottom: 100, left: 16, zIndex: 5,
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
                position: "absolute", bottom: 158, left: 16, zIndex: 10,
                backgroundColor: C.card, borderRadius: 16, padding: 16, width: 240,
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
      <PlayerSheet player={selected} onClose={() => setSelected(null)}
        onInvite={handleInvite}
        onReport={(p) => { setSelected(null); setReportTarget(p); }}
        onBlock={handleBlock} />

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

      {/* ── FEATURE VIRALE 1 — Alerte prise de bastion ──────────────────── */}
      {takeoverAlert && (
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
      {roi && (
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
