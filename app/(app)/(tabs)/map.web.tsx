"use client";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Modal, Pressable, ScrollView,
  Text, View, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";

import { hapticImpact } from "@/lib/safe-haptics";
import {
  goGhost, MOCK_PLAYERS,
  publishPosition, requestAndGetLocation, STATUS_CONFIG, subscribeToMap,
} from "@/lib/life-map";
import type { MapPlayer, MapStatus } from "@/lib/life-map";
import { fetchCrewZones } from "@/lib/crews";
import type { CrewZone } from "@/lib/crews";
import { blockUser } from "@/lib/safety";
import { ReportModal } from "@/components/report-modal";
import { useGameStore } from "@/stores/game-store";

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

// ── Leaflet loader (injection dynamique dans le DOM) ──────────────────────────
let leafletLoaded = false;
let leafletLoading = false;
const leafletCallbacks: Array<() => void> = [];

function loadLeaflet(cb: () => void) {
  if (leafletLoaded) { cb(); return; }
  leafletCallbacks.push(cb);
  if (leafletLoading) return;
  leafletLoading = true;

  // CSS
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);

  // JS
  const script = document.createElement("script");
  script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  script.onload = () => {
    leafletLoaded = true;
    leafletCallbacks.forEach((fn) => fn());
    leafletCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

// ── Styles Leaflet overrides (injectés une fois) ──────────────────────────────
let stylesInjected = false;
function injectMapStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .mylife-map-container .leaflet-container { background: #04040A !important; }
    .mylife-map-container .leaflet-tile-pane { filter: brightness(.9) contrast(1.08) saturate(1.1); }
    .mylife-map-container .leaflet-control-zoom {
      border: 1px solid rgba(255,255,255,.08) !important;
      background: rgba(8,8,15,.92) !important;
      border-radius: 10px !important; overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,.6) !important;
    }
    .mylife-map-container .leaflet-control-zoom a {
      color: #E8E4DC !important; background: transparent !important;
      border: none !important; border-bottom: 1px solid rgba(255,255,255,.06) !important;
      line-height: 30px !important; width: 30px !important; height: 30px !important;
    }
    .mylife-map-container .leaflet-control-zoom a:last-child { border-bottom: none !important; }
    .mylife-map-container .leaflet-control-zoom a:hover { color: #FFD600 !important; }
    .mylife-map-container .leaflet-control-attribution {
      background: rgba(4,4,10,.75) !important; color: rgba(255,255,255,.2) !important;
      font-size: 8px !important; border-radius: 4px 0 0 0 !important;
    }
    .mylife-map-container .leaflet-control-attribution a { color: rgba(255,255,255,.3) !important; }
    .mylife-map-container .leaflet-popup-content-wrapper {
      background: #0E0E16 !important; border: 1px solid rgba(255,255,255,.08) !important;
      border-radius: 12px !important; color: #E8E4DC !important;
      box-shadow: 0 8px 32px rgba(0,0,0,.7) !important;
    }
    .mylife-map-container .leaflet-popup-tip { background: #0E0E16 !important; }
    .mylife-map-container .leaflet-popup-close-button { color: #9A968E !important; }
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

// ── LeafletMap (composant DOM pur) ────────────────────────────────────────────
interface LeafletMapProps {
  players: MapPlayer[];
  myLat?: number;
  myLng?: number;
  onPlayerClick: (id: string) => void;
  onReady: () => void;
  onMapReady?: (flyFn: (lat: number, lng: number, zoom?: number) => void) => void;
  crewZones?: (CrewZone & { crew: { color: string; tag: string; emoji: string } })[];
}

function LeafletMap({ players, myLat, myLng, onPlayerClick, onReady, onMapReady, crewZones = [] }: LeafletMapProps) {
  const containerRef = useRef<View>(null);
  const mapRef       = useRef<unknown>(null);
  const markersRef   = useRef<Record<string, unknown>>({});

  useEffect(() => {
    injectMapStyles();

    loadLeaflet(() => {
      const L = (window as unknown as { L: unknown }).L as {
        map: (el: HTMLElement, opts: object) => {
          zoomControl: { setPosition: (pos: string) => void };
          on: (event: string, handler: () => void) => void;
          flyTo: (coords: number[], zoom: number, opts?: object) => void;
          remove: () => void;
        };
        tileLayer: (url: string, opts: object) => { addTo: (map: unknown) => void };
        marker: (coords: number[], opts: object) => {
          addTo: (map: unknown) => unknown;
          on: (event: string, handler: () => void) => void;
          remove: () => void;
        };
        icon: (opts: object) => unknown;
        circleMarker: (coords: number[], opts: object) => { addTo: (map: unknown) => void };
        circle: (coords: number[], opts: object) => { addTo: (map: unknown) => void };
      };
      if (!L) return;

      // Trouver le div DOM sous notre ref View
      const domNode = (containerRef.current as unknown as { _nativeTag?: HTMLElement } | null)?._nativeTag
        ?? (containerRef.current as unknown as HTMLElement | null);
      if (!domNode) return;

      // Chercher le vrai div enfant (React Native Web wrappe dans des divs)
      let mapEl: HTMLElement | null = domNode instanceof HTMLElement ? domNode : null;
      if (!mapEl) return;

      // S'assurer que l'élément a la bonne classe
      mapEl.classList.add("mylife-map-container");
      mapEl.style.cssText = "width:100%;height:100%;position:absolute;top:0;left:0;right:0;bottom:0;";

      // Créer la Leaflet map
      const map = L.map(mapEl, {
        center: [48.8566, 2.3522],
        zoom: 13,
        zoomControl: true,
        preferCanvas: true,
      });
      map.zoomControl.setPosition("bottomright");
      mapRef.current = map;

      // Expose flyTo pour le parent
      if (onMapReady) {
        onMapReady((lat: number, lng: number, zoom = 16) => {
          map.flyTo([lat, lng], zoom, { animate: true, duration: zoom < 14 ? 1.2 : 2.5 } as object);
        });
      }

      // Tiles CartoDB Dark Matter (premier choix) avec fallback OSM
      const tileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
        subdomains: "abcd",
        maxZoom: 19,
        minZoom: 9,
        errorTileUrl: "",
      });
      tileLayer.addTo(map);
      // Fallback : si CartoDB ne répond pas après 3s → OSM + filtre dark
      setTimeout(() => {
        const container = mapEl?.querySelector?.(".leaflet-tile-pane") as HTMLElement | null;
        const tiles = container?.querySelectorAll?.(".leaflet-tile-loaded");
        if (!tiles || tiles.length === 0) {
          tileLayer.remove?.();
          const osmLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
            maxZoom: 19,
          });
          osmLayer.addTo(map);
          // Filtre CSS dark sur les tiles OSM
          const pane = mapEl?.querySelector?.(".leaflet-tile-pane") as HTMLElement | null;
          if (pane) pane.style.filter = "invert(1) hue-rotate(180deg) brightness(0.85) contrast(1.1) saturate(0.6)";
        }
      }, 3000);

      // Zones crew — cercles colorés semi-transparents
      crewZones.forEach((zone) => {
        const col = zone.crew?.color ?? "#FFD600";
        L.circle([zone.lat, zone.lng], {
          radius: zone.radius,
          color: col, fillColor: col,
          fillOpacity: 0.07, weight: 1.5, dashArray: "6 4",
          opacity: 0.5,
        }).addTo(map);
        // Label du crew au centre de la zone
        const tagSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="24">
          <rect x="0" y="0" width="60" height="24" rx="5" fill="${col}22" stroke="${col}" stroke-width="1" opacity="0.8"/>
          <text x="30" y="16" text-anchor="middle" font-size="10" fill="${col}" font-weight="900" font-family="system-ui,sans-serif">${zone.crew?.emoji ?? ""} ${zone.crew?.tag ?? ""}</text>
        </svg>`;
        const labelIcon = L.icon({
          iconUrl: "data:image/svg+xml," + encodeURIComponent(tagSvg),
          iconSize: [60, 24], iconAnchor: [30, 12],
        });
        L.marker([zone.lat, zone.lng], { icon: labelIcon, interactive: false }).addTo(map);
      });

      // Marqueurs joueurs
      players.forEach((p) => {
        const cfg   = STATUS_CONFIG[p.status];
        const color = cfg?.color ?? "#FFD600";
        const name  = (p.display_name ?? "").split(" ")[0];
        const iconUrl = buildMarkerSvg(p.avatar_emoji ?? "🧢", color, name, p.is_star);
        const size  = p.is_star ? 48 : 38;
        const w = size + 16; const h = size + 30;
        const icon = L.icon({ iconUrl, iconSize: [w, h], iconAnchor: [w / 2, size + 20] });
        const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
        marker.on("click", () => onPlayerClick(p.id));
        markersRef.current[p.id] = marker;
      });

      // Ma position
      if (myLat && myLng) {
        L.circleMarker([myLat, myLng], {
          radius: 10, color: "#FFD600", fillColor: "#FFD600",
          fillOpacity: 0.9, weight: 3,
        }).addTo(map);
        L.circle([myLat, myLng], {
          radius: 80, color: "#FFD600", fillColor: "#FFD600",
          fillOpacity: 0.06, weight: 1, dashArray: "5 5",
        }).addTo(map);
      }

      onReady();
    });

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, []); // mount once

  // Mise à jour joueurs quand ils changent (sans recharger la map)
  useEffect(() => {
    if (!mapRef.current || !leafletLoaded) return;
    const L = (window as unknown as { L: unknown }).L as {
      marker: (coords: number[], opts: object) => { addTo: (map: unknown) => unknown; on: (e: string, h: () => void) => void; remove: () => void };
      icon: (opts: object) => unknown;
    };
    // Supprimer anciens marqueurs
    Object.values(markersRef.current).forEach((m) => (m as { remove: () => void }).remove());
    markersRef.current = {};
    // Re-créer
    players.forEach((p) => {
      const cfg   = STATUS_CONFIG[p.status];
      const color = cfg?.color ?? "#FFD600";
      const name  = (p.display_name ?? "").split(" ")[0];
      const iconUrl = buildMarkerSvg(p.avatar_emoji ?? "🧢", color, name, p.is_star);
      const size  = p.is_star ? 48 : 38;
      const w = size + 16; const h = size + 30;
      const icon = L.icon({ iconUrl, iconSize: [w, h], iconAnchor: [w / 2, size + 20] });
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(mapRef.current);
      marker.on("click", () => onPlayerClick(p.id));
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
              {player.is_star && (
                <View style={{ backgroundColor: cfg.color, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: "#04040A", fontSize: 9, fontWeight: "900" }}>STAR</Text>
                </View>
              )}
            </View>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>
              Niveau {player.level} · {player.location_name ?? "Paris"}
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
              {player.location_name ?? "Paris"}
              {player.location_verified
                ? <Text style={{ color: C.green }}> · Vérifié ✓</Text>
                : <Text style={{ color: C.muted }}> · Non vérifié</Text>}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Text style={{ fontSize: 15 }}>🕐</Text>
            <Text style={{ color: C.muted, fontSize: 13 }}>{freshness}</Text>
          </View>
        </View>

        {player.status !== "ghost" && (
          <Pressable
            onPress={() => { hapticImpact("medium"); onInvite(player); onClose(); }}
            style={{
              backgroundColor: cfg.color, borderRadius: 16, paddingVertical: 17,
              alignItems: "center", shadowColor: cfg.color, shadowOpacity: 0.4, shadowRadius: 16,
              flexDirection: "row", justifyContent: "center", gap: 10,
            }}>
            <Text style={{ color: "#04040A", fontSize: 16, fontWeight: "900" }}>
              {player.is_star ? `🎤 Dire wesh à ${player.display_name}` : "💬 Dire wesh"}
            </Text>
          </Pressable>
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
    { key: "all",   label: "Tous",      color: C.gold },
    { key: "free",  label: "🟡 Libre",  color: STATUS_CONFIG.free.color  },
    { key: "vibe",  label: "💜 Soirée", color: STATUS_CONFIG.vibe.color  },
    { key: "charo", label: "🔴 Charo",  color: STATUS_CONFIG.charo.color },
    { key: "taken", label: "💍 Pris",   color: STATUS_CONFIG.taken.color },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={{ position: "absolute", top: 72, left: 0, right: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: "row" }}>
      {pills.map((f) => {
        const on = active === f.key;
        return (
          <Pressable key={f.key} onPress={() => onChange(f.key)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
              backgroundColor: on ? f.color : "rgba(8,8,15,0.88)",
              borderWidth: 1, borderColor: on ? f.color : C.border,
            }}>
            <Text style={{ color: on ? "#04040A" : C.text, fontSize: 12, fontWeight: "800" }}>
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
  const avatar      = useGameStore((s) => s.avatar);
  const playerLevel = useGameStore((s) => s.playerLevel ?? 1);

  const [players,      setPlayers]      = useState<MapPlayer[]>(MOCK_PLAYERS);
  const [crewZones,    setCrewZones]    = useState<(CrewZone & { crew: { color: string; tag: string; emoji: string } })[]>([]);
  const [myStatus,     setMyStatus]     = useState<MapStatus>("ghost");
  const [myLocation,   setMyLocation]   = useState<{ lat: number; lng: number } | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [selected,     setSelected]     = useState<MapPlayer | null>(null);
  const [showPicker,   setShowPicker]   = useState(false);
  const [filter,       setFilter]       = useState<MapStatus | "all">("all");
  const [reportTarget, setReportTarget] = useState<MapPlayer | null>(null);
  const [blocked,      setBlocked]      = useState<string[]>([]);
  const [mapReady,     setMapReady]     = useState(false);
  const flyToRef = useRef<((lat: number, lng: number, zoom?: number) => void) | null>(null);

  const visible = players.filter((p) =>
    p.status !== "ghost" &&
    !blocked.includes(p.user_id) &&
    (filter === "all" || p.status === filter)
  );

  // Zones crew
  useEffect(() => {
    fetchCrewZones().then(setCrewZones);
  }, []);

  // Realtime
  useEffect(() => {
    const sub = subscribeToMap((updated) => {
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
    if (avatar) {
      await publishPosition({
        userId: "local_user", displayName: avatar.displayName,
        avatarEmoji: "🧢", status: myStatus === "ghost" ? "free" : myStatus,
        level: playerLevel, lastAction: null,
        lat: loc.lat, lng: loc.lng,
        locationName: loc.locationName, locationVerified: loc.verified,
      });
      if (myStatus === "ghost") setMyStatus("free");
    }
    // Zoom cinématique : dézoome sur Paris entier → vole vers ma position
    zoomAnimTrigger(loc.lat, loc.lng);
  }

  function zoomAnimTrigger(lat: number, lng: number) {
    if (!flyToRef.current) return;
    // 1. Dézoome animé sur Paris entier (1.2s) — on voit la ville s'éloigner
    flyToRef.current(48.8566, 2.3522, 11);
    // 2. Après 1.4s (fin du déZoom), fly vers ma position au zoom 17 (2.5s) — on voit la distance
    setTimeout(() => {
      flyToRef.current?.(lat, lng, 17);
    }, 1400);
  }

  async function handleStatusChange(s: MapStatus) {
    setMyStatus(s);
    if (s === "ghost") { await goGhost("local_user"); return; }
    if (myLocation) {
      await publishPosition({
        userId: "local_user", displayName: avatar?.displayName ?? "Moi",
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
            CHARGEMENT DE PARIS...
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
            {visible.length} en live · Paris
          </Text>
        </View>

        <Pressable onPress={() => setShowPicker(true)}
          style={{
            backgroundColor: "rgba(8,8,15,0.88)", borderRadius: 14,
            paddingHorizontal: 14, paddingVertical: 10,
            borderWidth: 1, borderColor: cfg.color + "50",
            flexDirection: "row", alignItems: "center", gap: 8,
          }}>
          <Text style={{ fontSize: 16 }}>{cfg.emoji}</Text>
          <Text style={{ color: cfg.color, fontSize: 13, fontWeight: "800" }}>{cfg.label}</Text>
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
            Ta position est réelle · Ghost à tout moment
          </Text>
        </View>
      ) : (
        /* Bouton recentrage — en bas à droite au-dessus des contrôles zoom */
        <Pressable
          onPress={() => zoomAnimTrigger(myLocation.lat, myLocation.lng)}
          style={{
            position: "absolute", bottom: 160, right: 20, zIndex: 5,
            width: 48, height: 48, borderRadius: 14,
            backgroundColor: "rgba(8,8,15,0.92)",
            borderWidth: 1.5, borderColor: C.gold + "60",
            alignItems: "center", justifyContent: "center",
            shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 12,
          }}>
          <Text style={{ fontSize: 22 }}>🎯</Text>
        </Pressable>
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
    </View>
  );
}
